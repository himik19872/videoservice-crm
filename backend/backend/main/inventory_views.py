"""
API для выдачи ЗИП мастеру и отображения материалов у мастера.
"""
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from .models import IssueOrder, IssueOrderItem, InventoryItem, Master, InventoryMovement


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def issue_zip_to_master(request):
    """
    Выдача ЗИП (запасных частей) мастеру без привязки к заявке.
    Принимает: { master_id: int, items: [{ inventory_item_id: int, quantity: int }], notes: str }
    """
    master_id = request.data.get('master_id')
    items_data = request.data.get('items', [])
    notes = request.data.get('notes', 'Выдача ЗИП мастеру')

    if not master_id or not items_data:
        return Response({'error': 'Укажите master_id и items'}, status=400)

    try:
        master = Master.objects.get(id=master_id)
    except Master.DoesNotExist:
        return Response({'error': 'Мастер не найден'}, status=404)

    # Создаём расходный ордер без привязки к заявке
    issue_order = IssueOrder.objects.create(
        order=None,
        master=master,
        issued_by=request.user,
        status='pending',
        notes=notes,
    )

    for item_data in items_data:
        inv_item_id = item_data.get('inventory_item_id')
        qty = item_data.get('quantity', 1)

        try:
            inv_item = InventoryItem.objects.get(id=inv_item_id)
        except InventoryItem.DoesNotExist:
            continue

        # Создаём позицию ордера
        IssueOrderItem.objects.create(
            issue_order=issue_order,
            inventory_item=inv_item,
            quantity_issued=qty,
        )

        # Создаём движение
        InventoryMovement.objects.create(
            item=inv_item,
            movement_type='out_to_master',
            quantity=qty,
            master=master,
            performed_by=request.user,
            notes=f'Выдача ЗИП: {notes}'
        )

    # Отмечаем ордер как полученный
    issue_order.status = 'received'
    issue_order.received_at = timezone.now()
    issue_order.save()

    from .serializers import IssueOrderSerializer
    return Response(IssueOrderSerializer(issue_order).data, status=201)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def master_inventory(request, master_id):
    """
    Возвращает список материалов, числящихся на мастере.
    Включает: остатки ЗИП и материалы по заявкам.
    """
    from .models import IssueOrderItem

    try:
        master = Master.objects.get(id=master_id)
    except Master.DoesNotExist:
        return Response({'error': 'Мастер не найден'}, status=404)

    # Все позиции расходных ордеров мастера, которые ещё не закрыты
    items = IssueOrderItem.objects.filter(
        issue_order__master=master,
        issue_order__status__in=['pending', 'received', 'partially_used'],
    ).select_related('inventory_item', 'issue_order')

    # Также инвентарь со статусом with_master
    from .models import InventoryItem
    master_items = InventoryItem.objects.filter(status='with_master')

    result = []
    for ioi in items:
        result.append({
            'type': 'issue_order',
            'item_name': ioi.inventory_item.name,
            'item_type': ioi.inventory_item.get_item_type_display(),
            'serial_number': ioi.inventory_item.serial_number,
            'quantity_issued': ioi.quantity_issued,
            'quantity_used': ioi.quantity_used,
            'quantity_returned': ioi.quantity_returned,
            'remaining': ioi.remaining,
            'order_id': ioi.issue_order.order_id,
            'order_number': ioi.issue_order.order.number if ioi.issue_order.order else 'ЗИП (без заявки)',
            'issued_at': ioi.issue_order.issued_at.isoformat(),
            'need_return_old': ioi.need_return_old,
        })

    return Response({'master_name': str(master), 'items': result, 'total': len(result)})
