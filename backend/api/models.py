from django.db import models
import uuid


class Profile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    avatar_url = models.URLField(max_length=500, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    display_name = models.CharField(max_length=255, null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "profiles"


class UserRole(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    role = models.CharField(max_length=50)
    user = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='user_roles')

    class Meta:
        db_table = "user_roles"


class Driver(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    license_number = models.CharField(max_length=100, null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    user = models.ForeignKey(Profile, on_delete=models.CASCADE)

    class Meta:
        db_table = "drivers"


class DriverScore(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    driver = models.OneToOneField(Driver, on_delete=models.CASCADE, related_name='score')
    harsh_accel = models.IntegerField(default=0)
    idle_minutes = models.IntegerField(default=0)
    over_speed = models.IntegerField(default=0)
    score = models.IntegerField(default=100)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "driver_scores"


class VehicleStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    IDLE = "idle", "Idle"
    MAINTENANCE = "maintenance", "Maintenance"


class Vehicle(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assigned_driver = models.ForeignKey(Driver, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    ingest_api_key_hash = models.CharField(max_length=255, null=True, blank=True)
    last_lat = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    last_lng = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    name = models.CharField(max_length=255)
    odometer = models.IntegerField(default=0)
    plate = models.CharField(max_length=20)
    status = models.CharField(max_length=50, choices=VehicleStatus.choices, default=VehicleStatus.ACTIVE)
    updated_at = models.DateTimeField(auto_now=True)
    vehicle_type = models.CharField(max_length=100, default="car")

    def __str__(self):
        return f"{self.name} ({self.plate})"

    class Meta:
        db_table = "vehicles"


class AlertSeverity(models.TextChoices):
    INFO = "info", "Info"
    WARNING = "warning", "Warning"
    CRITICAL = "critical", "Critical"


class RiskLevel(models.TextChoices):
    LOW = "low", "Low"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"


class TelemetryReading(models.Model):
    id = models.BigAutoField(primary_key=True)
    battery_voltage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    engine_temp = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    fuel_level = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    lat = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    lng = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    rpm = models.IntegerField(null=True, blank=True)
    speed = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    ts = models.DateTimeField()
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='telemetry')
    vibration = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)

    class Meta:
        db_table = "telemetry_readings"
        ordering = ['-ts']


class Alert(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    alert_type = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    is_resolved = models.BooleanField(default=False)
    message = models.TextField()
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.CharField(max_length=255, null=True, blank=True)
    severity = models.CharField(max_length=20, choices=AlertSeverity.choices)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE)

    class Meta:
        db_table = "alerts"
        ordering = ['-created_at']


class AlertRule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    comparator = models.CharField(max_length=20, default="gt")
    consecutive_required = models.IntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.CharField(max_length=255, null=True, blank=True)
    enabled = models.BooleanField(default=True)
    metric = models.CharField(max_length=100)
    name = models.CharField(max_length=255)
    severity = models.CharField(max_length=20, choices=AlertSeverity.choices)
    threshold = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = "alert_rules"


class MaintenanceRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.CharField(max_length=255, null=True, blank=True)
    maintenance_type = models.CharField(max_length=100)
    notes = models.TextField(null=True, blank=True)
    performed_at = models.DateTimeField()
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE)

    class Meta:
        db_table = "maintenance_records"
        ordering = ['-performed_at']


class MaintenanceSchedule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.CharField(max_length=255, null=True, blank=True)
    maintenance_type = models.CharField(max_length=100)
    notes = models.TextField(null=True, blank=True)
    scheduled_for = models.DateTimeField()
    status = models.CharField(max_length=50, default="scheduled")
    updated_at = models.DateTimeField(auto_now=True)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE)

    class Meta:
        db_table = "maintenance_schedules"


class MaintenancePrediction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    confidence = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    health_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    predicted_at = models.DateTimeField(auto_now_add=True)
    reasons = models.JSONField(default=list)
    recommended_action = models.CharField(max_length=255, null=True, blank=True)
    risk = models.CharField(max_length=20, choices=RiskLevel.choices)
    sensor_contributions = models.JSONField(default=dict)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE)

    class Meta:
        db_table = "maintenance_predictions"
        ordering = ['-predicted_at']


class FuelLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    liters = models.DecimalField(max_digits=10, decimal_places=2)
    logged_at = models.DateTimeField(auto_now_add=True)
    logged_by = models.CharField(max_length=255, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    odometer = models.IntegerField(null=True, blank=True)
    price_per_liter = models.DecimalField(max_digits=10, decimal_places=2)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE)

    class Meta:
        db_table = "fuel_logs"
        ordering = ['-logged_at']


class Geofence(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    alert_on_enter = models.BooleanField(default=False)
    alert_on_exit = models.BooleanField(default=False)
    center_lat = models.DecimalField(max_digits=10, decimal_places=7)
    center_lng = models.DecimalField(max_digits=10, decimal_places=7)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.CharField(max_length=255, null=True, blank=True)
    name = models.CharField(max_length=255)
    radius_m = models.IntegerField(default=1000)

    class Meta:
        db_table = "geofences"


class PlannedRoute(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.CharField(max_length=255, null=True, blank=True)
    geometry = models.JSONField(null=True, blank=True)
    name = models.CharField(max_length=255)
    status = models.CharField(max_length=50, default="planned")
    stops = models.JSONField(default=list)
    total_distance_m = models.IntegerField(null=True, blank=True)
    total_duration_s = models.IntegerField(null=True, blank=True)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = "planned_routes"


class Webhook(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.CharField(max_length=255, null=True, blank=True)
    enabled = models.BooleanField(default=True)
    events = models.JSONField(default=list)
    name = models.CharField(max_length=255)
    secret = models.CharField(max_length=255)
    url = models.URLField(max_length=500)

    class Meta:
        db_table = "webhooks"


class WebhookDelivery(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    delivered_at = models.DateTimeField(auto_now_add=True)
    error = models.TextField(null=True, blank=True)
    event = models.CharField(max_length=100)
    payload = models.JSONField(default=dict)
    response_body = models.TextField(null=True, blank=True)
    response_status = models.IntegerField(null=True, blank=True)
    webhook = models.ForeignKey(Webhook, on_delete=models.CASCADE, related_name='deliveries')

    class Meta:
        db_table = "webhook_deliveries"


class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    action = models.CharField(max_length=100)
    actor = models.ForeignKey(Profile, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    details = models.JSONField(null=True, blank=True)
    target_id = models.CharField(max_length=255, null=True, blank=True)
    target_type = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        db_table = "audit_log"


class UserDashboardLayout(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    layout = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)
    user = models.OneToOneField(Profile, on_delete=models.CASCADE, related_name="dashboard_layout")
    widgets = models.JSONField(default=list)

    class Meta:
        db_table = "user_dashboard_layouts"