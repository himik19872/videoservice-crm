from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    RegionViewSet, MasterViewSet, ClientViewSet,
    EquipmentViewSet, OrderViewSet, ReportViewSet, BuildingViewSet,
    TraccarSettingsViewSet, TraccarDeviceViewSet, SystemSettingsViewSet,
    UserProfileViewSet, WorkShiftViewSet, OrderMediaViewSet, PushTokenViewSet,
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

urlpatterns = [
    path('auth/login/', login_view, name='auth-login'),
    path('auth/refresh/', refresh_token_view, name='auth-refresh'),
    path('users/me/', me_view, name='users-me'),
    path('max/webhook/', max_webhook_view, name='max-webhook'),
    path('', include(router.urls)),
]
