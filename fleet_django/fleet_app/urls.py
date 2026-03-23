from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('vehicles/', views.vehicles_view, name='vehicles'),
    path('predictions/', views.predictions_view, name='predictions'),
    path('alerts/', views.alerts_view, name='alerts'),
    path('analytics/', views.analytics_view, name='analytics'),
    path('iot/', views.iot_view, name='iot'),
    path('settings/', views.settings_view, name='settings'),
]
