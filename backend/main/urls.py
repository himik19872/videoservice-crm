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
    ErcAccountViewSet, ErcBillingRecordViewSet,
    StorageLocationViewSet,
    OutgoingInvoiceViewSet,
    CallLogViewSet,
    AsteriskSipPeerViewSet, AsteriskTrunkViewSet, AsteriskRouteViewSet,
    AsteriskIvrViewSet, AsteriskIvrOptionViewSet,
    AsteriskVoicemailViewSet, AsteriskCallRecordingViewSet,
    login_view, me_view, refresh_token_view,
    import_clients_excel_view, import_erc_excel_view, import_preview_view,
    system_stats_view, export_clients_excel_view, cleanup_media_view,
)
from .bitrix24_views import bitrix24_clients_to_bitrix_view, bitrix24_clients_from_bitrix_view
from .bitrix24_views import bitrix24_products_to_bitrix_view, bitrix24_products_from_bitrix_view
from .rostelecom_views import (
    rostelecom_get_calls_view, rostelecom_sync_calls_view,
    rostelecom_status_view, rostelecom_test_connection_view,
    rostelecom_update_settings_view,
)
from .asterisk_views import (
    asterisk_generate_configs_view, asterisk_push_configs_view,
    asterisk_dashboard_view,
)
from .max_views import MaxSettingsViewSet, max_webhook_view
from .inventory_views import issue_zip_to_master, master_inventory

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
router.register(r'erc-accounts', ErcAccountViewSet, basename='erc-accounts')
router.register(r'erc-billing', ErcBillingRecordViewSet, basename='erc-billing')
router.register(r'storage-locations', StorageLocationViewSet, basename='storage-locations')
router.register(r'outgoing-invoices', OutgoingInvoiceViewSet, basename='outgoing-invoices')
router.register(r'call-logs', CallLogViewSet, basename='call-logs')
router.register(r'asterisk/sip-peers', AsteriskSipPeerViewSet, basename='asterisk-sip-peers')
router.register(r'asterisk/trunks', AsteriskTrunkViewSet, basename='asterisk-trunks')
router.register(r'asterisk/routes', AsteriskRouteViewSet, basename='asterisk-routes')
router.register(r'asterisk/ivrs', AsteriskIvrViewSet, basename='asterisk-ivrs')
router.register(r'asterisk/ivr-options', AsteriskIvrOptionViewSet, basename='asterisk-ivr-options')
router.register(r'asterisk/voicemails', AsteriskVoicemailViewSet, basename='asterisk-voicemails')
router.register(r'asterisk/recordings', AsteriskCallRecordingViewSet, basename='asterisk-recordings')

urlpatterns = [
    path('auth/login/', login_view, name='auth-login'),
    path('auth/refresh/', refresh_token_view, name='auth-refresh'),
    path('users/me/', me_view, name='users-me'),
    path('max/webhook/', max_webhook_view, name='max-webhook'),
    path('import/clients/', import_clients_excel_view, name='import-clients'),
    path('import/erc/', import_erc_excel_view, name='import-erc'),
    path('import/preview/', import_preview_view, name='import-preview'),
    path('import/preview/', import_preview_view, name='import-preview'),
    path('bitrix24/clients/to-bitrix/', bitrix24_clients_to_bitrix_view, name='bitrix24-clients-to'),
    path('bitrix24/clients/from-bitrix/', bitrix24_clients_from_bitrix_view, name='bitrix24-clients-from'),
    path('bitrix24/products/to-bitrix/', bitrix24_products_to_bitrix_view, name='bitrix24-products-to'),
    path('bitrix24/products/from-bitrix/', bitrix24_products_from_bitrix_view, name='bitrix24-products-from'),
    path('system/stats/', system_stats_view, name='system-stats'),
    path('system/export-clients/', export_clients_excel_view, name='export-clients'),
    path('system/cleanup-media/', cleanup_media_view, name='cleanup-media'),
    path('inventory/issue-zip/', issue_zip_to_master, name='issue-zip'),
    path('masters/<int:master_id>/inventory/', master_inventory, name='master-inventory'),
    path('rostelecom/get-calls/', rostelecom_get_calls_view, name='rostelecom-get-calls'),
    path('rostelecom/sync-calls/', rostelecom_sync_calls_view, name='rostelecom-sync-calls'),
    path('rostelecom/status/', rostelecom_status_view, name='rostelecom-status'),
    path('rostelecom/test-connection/', rostelecom_test_connection_view, name='rostelecom-test'),
    path('rostelecom/update-settings/', rostelecom_update_settings_view, name='rostelecom-update-settings'),
    path('asterisk/dashboard/', asterisk_dashboard_view, name='asterisk-dashboard'),
    path('asterisk/generate-configs/', asterisk_generate_configs_view, name='asterisk-generate-configs'),
    path('asterisk/push-configs/', asterisk_push_configs_view, name='asterisk-push-configs'),
    path('', include(router.urls)),
]
