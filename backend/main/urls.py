from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    RegionViewSet, MasterViewSet, ClientViewSet,
    EquipmentViewSet, OrderViewSet, ReportViewSet, BuildingViewSet,
    TraccarSettingsViewSet, TraccarDeviceViewSet, SystemSettingsViewSet,
    UserProfileViewSet, WorkShiftViewSet, OrderMediaViewSet, PushTokenViewSet,
    InventoryItemViewSet, InventoryMovementViewSet, PaymentViewSet, MasterSalaryViewSet,
    MessageViewSet,
    LegalEntityViewSet, EstimateServiceViewSet, CommercialEstimateViewSet, EstimateItemViewSet,
    SupplierViewSet, SupplyInvoiceViewSet,
    IssueOrderViewSet, PurchaseRequestViewSet,
    login_view, me_view, refresh_token_view
)
from .max_views import MaxSettingsViewSet, max_webhook_view

router = DefaultRouter()
router.register(r'regions', RegionViewSet)
router.register(r'masters', MasterViewSet)
router.register(r'clients', ClientViewSet)
router.register(r'equipment', EquipmentViewSet)
router.register(r'orders', OrderViewSet)
router.register(r'reports', ReportViewSet)
router.register(r'buildings', BuildingViewSet)
router.register(r'traccar/settings', TraccarSettingsViewSet, basename='traccar-settings')
router.register(r'traccar/devices', TraccarDeviceViewSet, basename='traccar-devices')
router.register(r'system-settings', SystemSettingsViewSet, basename='system-settings')
router.register(r'users', UserProfileViewSet, basename='user-profiles')
router.register(r'shifts', WorkShiftViewSet, basename='work-shifts')
router.register(r'order-media', OrderMediaViewSet, basename='order-media')
router.register(r'push-tokens', PushTokenViewSet, basename='push-tokens')
router.register(r'max-settings', MaxSettingsViewSet, basename='max-settings')
router.register(r'inventory', InventoryItemViewSet, basename='inventory')
router.register(r'inventory-movements', InventoryMovementViewSet, basename='inventory-movements')
router.register(r'payments', PaymentViewSet, basename='payments')
router.register(r'master-salaries', MasterSalaryViewSet, basename='master-salaries')
router.register(r'messages', MessageViewSet, basename='messages')
router.register(r'legal-entities', LegalEntityViewSet, basename='legal-entities')
router.register(r'estimate-services', EstimateServiceViewSet, basename='estimate-services')
router.register(r'estimates', CommercialEstimateViewSet, basename='estimates')
router.register(r'estimate-items', EstimateItemViewSet, basename='estimate-items')
router.register(r'suppliers', SupplierViewSet, basename='suppliers')
router.register(r'supply-invoices', SupplyInvoiceViewSet, basename='supply-invoices')
router.register(r'issue-orders', IssueOrderViewSet, basename='issue-orders')
router.register(r'purchase-requests', PurchaseRequestViewSet, basename='purchase-requests')

urlpatterns = [
    path('auth/login/', login_view, name='auth-login'),
    path('auth/refresh/', refresh_token_view, name='auth-refresh'),
    path('users/me/', me_view, name='users-me'),
    path('max/webhook/', max_webhook_view, name='max-webhook'),
    path('', include(router.urls)),
]
