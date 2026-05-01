from rest_framework import serializers
from .models import (
    Profile, UserRole, Driver, DriverScore, Vehicle, TelemetryReading,
    Alert, AlertRule, MaintenanceRecord, MaintenanceSchedule, MaintenancePrediction,
    FuelLog, Geofence, PlannedRoute, Webhook, WebhookDelivery, AuditLog, UserDashboardLayout
)


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['id', 'avatar_url', 'created_at', 'display_name', 'phone', 'updated_at']


class UserRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserRole
        fields = ['id', 'created_at', 'role', 'user']


class DriverSerializer(serializers.ModelSerializer):
    class Meta:
        model = Driver
        fields = ['id', 'created_at', 'license_number', 'phone', 'user']


class DriverScoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = DriverScore
        fields = ['id', 'driver', 'harsh_accel', 'idle_minutes', 'over_speed', 'score', 'updated_at']


class VehicleListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = ['id', 'name', 'plate', 'status', 'vehicle_type', 'odometer', 'last_lat', 'last_lng', 'assigned_driver']


class VehicleDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = '__all__'


class TelemetryReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = TelemetryReading
        fields = ['id', 'battery_voltage', 'engine_temp', 'fuel_level', 'lat', 'lng',
                  'rpm', 'speed', 'ts', 'vehicle', 'vibration']


class AlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = ['id', 'alert_type', 'created_at', 'is_resolved', 'message',
                  'resolved_at', 'resolved_by', 'severity', 'vehicle']


class AlertRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = AlertRule
        fields = ['id', 'comparator', 'consecutive_required', 'created_at', 'created_by',
                  'enabled', 'metric', 'name', 'severity', 'threshold']


class MaintenanceRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaintenanceRecord
        fields = ['id', 'cost', 'created_at', 'created_by', 'maintenance_type',
                  'notes', 'performed_at', 'vehicle']


class MaintenanceScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaintenanceSchedule
        fields = ['id', 'created_at', 'created_by', 'maintenance_type', 'notes',
                  'scheduled_for', 'status', 'updated_at', 'vehicle']


class MaintenancePredictionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaintenancePrediction
        fields = ['id', 'confidence', 'health_score', 'predicted_at', 'reasons',
                  'recommended_action', 'risk', 'sensor_contributions', 'vehicle']


class FuelLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = FuelLog
        fields = ['id', 'created_at', 'liters', 'logged_at', 'logged_by',
                  'notes', 'odometer', 'price_per_liter', 'vehicle']


class GeofenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Geofence
        fields = ['id', 'alert_on_enter', 'alert_on_exit', 'center_lat', 'center_lng',
                  'created_at', 'created_by', 'name', 'radius_m']


class PlannedRouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlannedRoute
        fields = ['id', 'created_at', 'created_by', 'geometry', 'name', 'status',
                  'stops', 'total_distance_m', 'total_duration_s', 'vehicle']


class WebhookSerializer(serializers.ModelSerializer):
    class Meta:
        model = Webhook
        fields = ['id', 'created_at', 'created_by', 'enabled', 'events', 'name', 'secret', 'url']


class WebhookDeliverySerializer(serializers.ModelSerializer):
    class Meta:
        model = WebhookDelivery
        fields = ['id', 'delivered_at', 'error', 'event', 'payload', 'response_body', 'response_status', 'webhook']


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = ['id', 'action', 'actor', 'created_at', 'details', 'target_id', 'target_type']


class UserDashboardLayoutSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserDashboardLayout
        fields = ['id', 'layout', 'updated_at', 'user', 'widgets']