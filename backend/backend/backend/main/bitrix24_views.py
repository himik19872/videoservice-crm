"""
API для экспорта/импорта в Битрикс24.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .bitrix24_service import bitrix24 as bx


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bitrix24_clients_to_bitrix_view(request):
    """Экспорт клиентов из CRM → в Битрикс24"""
    result = bx.export_clients()
    return Response(result)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bitrix24_clients_from_bitrix_view(request):
    """Импорт клиентов из Битрикс24 → в CRM"""
    result = bx.import_clients()
    return Response(result)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bitrix24_products_to_bitrix_view(request):
    """Экспорт товаров из CRM → в Битрикс24"""
    result = bx.export_products()
    return Response(result)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bitrix24_products_from_bitrix_view(request):
    """Импорт товаров из Битрикс24 → в CRM"""
    result = bx.import_products()
    return Response(result)
