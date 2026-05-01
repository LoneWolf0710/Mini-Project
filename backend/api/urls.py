from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('vehicles/', views.vehicles_page, name='vehicles'),
    path('vehicles/<uuid:vehicle_id>/', views.vehicle_detail, name='vehicle_detail'),
    path('alerts/', views.alerts_page, name='alerts'),
    path('map/', views.map_page, name='map'),
    path('predictions/', views.predictions_page, name='predictions'),
    path('drivers/', views.drivers_page, name='drivers'),
    path('maintenance/', views.maintenance_page, name='maintenance'),
    path('fuel/', views.fuel_logs_page, name='fuel_logs'),
    path('routes/', views.routes_page, name='routes'),
    path('analytics/', views.analytics_page, name='analytics'),
    path('reports/', views.reports_page, name='reports'),
    path('scheduler/', views.scheduler_page, name='scheduler'),
    path('replay/', views.replay_page, name='replay'),
    path('me/', views.my_vehicle_page, name='my_vehicle'),
    path('admin/users/', views.admin_users_page, name='admin_users'),
    path('admin/rules/', views.admin_alert_rules_page, name='admin_alert_rules'),
    path('admin/webhooks/', views.admin_webhooks_page, name='admin_webhooks'),
    path('admin/simulator/', views.admin_simulator_page, name='admin_simulator'),
    path('docs/iot/', views.docs_iot_page, name='docs_iot'),
    path('landing/', views.landing_page, name='landing'),
    path('auth/', views.auth_page, name='auth'),
    
    # API endpoints
    path('api/seed-fleet/', views.api_seed_fleet, name='api_seed_fleet'),
    path('api/simulate-telemetry/', views.api_simulate_telemetry, name='api_simulate_telemetry'),
    path('api/predict-maintenance/', views.api_predict_maintenance, name='api_predict_maintenance'),
    path('api/config/', views.api_config, name='api_config'),
    path('api/dashboard/stats/', views.api_dashboard_stats, name='api_dashboard_stats'),
]