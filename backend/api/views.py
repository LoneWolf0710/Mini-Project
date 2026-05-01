from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.utils import timezone
import json

@require_http_methods(["GET"])
def index(request):
    return render(request, 'pages/index.html')


@require_http_methods(["GET"])
def dashboard(request):
    from backend.api.models import Vehicle, Alert, TelemetryReading, MaintenancePrediction
    
    vehicles = Vehicle.objects.all()
    alerts_open = Alert.objects.filter(is_resolved=False).count()
    active_count = vehicles.filter(status='active').count()
    vehicles_list = []
    
    for v in vehicles:
        latest = v.telemetry.order_by('-ts').first()
        pred = MaintenancePrediction.objects.filter(vehicle=v).order_by('-predicted_at').first()
        
        vehicles_list.append({
            'id': str(v.id),
            'name': v.name,
            'plate': v.plate,
            'status': v.status,
            'odometer': v.odometer,
            'last_lat': float(v.last_lat) if v.last_lat else None,
            'last_lng': float(v.last_lng) if v.last_lng else None,
            'engine_temp': round(float(latest.engine_temp), 1) if latest and latest.engine_temp else None,
            'health_score': int(pred.health_score) if pred and pred.health_score else 100,
            'risk': pred.risk if pred else 'low',
        })
    
    stats = {
        'active': f'{active_count}/{vehicles.count()}',
        'open_alerts': alerts_open,
        'high_risk': sum(1 for v in vehicles_list if v['risk'] == 'high'),
        'avg_health': sum(v['health_score'] for v in vehicles_list) // max(vehicles.count(), 1),
        'avg_fuel': 65,
    }
    
    return render(request, 'pages/dashboard.html', {
        'vehicles': vehicles_list,
        'stats': stats,
        'empty': len(vehicles_list) == 0,
    })


@require_http_methods(["GET"])
def vehicles_page(request):
    from backend.api.models import Vehicle, TelemetryReading, MaintenancePrediction
    
    vehicles = Vehicle.objects.all()
    vehicles_list = []
    
    for v in vehicles:
        latest = v.telemetry.order_by('-ts').first()
        pred = MaintenancePrediction.objects.filter(vehicle=v).order_by('-predicted_at').first()
        
        vehicles_list.append({
            'id': str(v.id),
            'name': v.name,
            'plate': v.plate,
            'status': v.status,
            'vehicle_type': v.vehicle_type,
            'odometer': v.odometer,
            'last_lat': float(v.last_lat) if v.last_lat else None,
            'last_lng': float(v.last_lng) if v.last_lng else None,
            'health_score': int(pred.health_score) if pred and pred.health_score else 100,
            'risk': pred.risk if pred else 'low',
            'speed': float(latest.speed) if latest and latest.speed else 0,
            'fuel_level': float(latest.fuel_level) if latest and latest.fuel_level else 0,
            'engine_temp': round(float(latest.engine_temp), 1) if latest and latest.engine_temp else None,
        })
    
    return render(request, 'pages/vehicles.html', {'vehicles': vehicles_list})


@require_http_methods(["GET"])
def vehicle_detail(request, vehicle_id):
    from backend.api.models import Vehicle, TelemetryReading, MaintenancePrediction, MaintenanceRecord, FuelLog
    
    try:
        vehicle = Vehicle.objects.get(id=vehicle_id)
    except Vehicle.DoesNotExist:
        return render(request, 'pages/not_found.html')
    
    latest = vehicle.telemetry.order_by('-ts').first()
    pred = MaintenancePrediction.objects.filter(vehicle=vehicle).order_by('-predicted_at').first()
    records = MaintenanceRecord.objects.filter(vehicle=vehicle)[:10]
    fuel_logs = FuelLog.objects.filter(vehicle=vehicle)[:5]
    
    history = vehicle.telemetry.order_by('-ts')[:100]
    
    context = {
        'vehicle': {
            'id': str(vehicle.id),
            'name': vehicle.name,
            'plate': vehicle.plate,
            'status': vehicle.status,
            'vehicle_type': vehicle.vehicle_type,
            'odometer': vehicle.odometer,
            'last_lat': float(vehicle.last_lat) if vehicle.last_lat else None,
            'last_lng': float(vehicle.last_lng) if vehicle.last_lng else None,
        },
        'telemetry': {
            'speed': float(latest.speed) if latest and latest.speed else 0,
            'rpm': latest.rpm if latest and latest.rpm else 0,
            'engine_temp': round(float(latest.engine_temp), 1) if latest and latest.engine_temp else None,
            'fuel_level': float(latest.fuel_level) if latest and latest.fuel_level else None,
            'battery_voltage': float(latest.battery_voltage) if latest and latest.battery_voltage else None,
            'lat': float(latest.lat) if latest and latest.lat else None,
            'lng': float(latest.lng) if latest and latest.lng else None,
            'ts': latest.ts if latest else None,
        },
        'prediction': {
            'health_score': int(pred.health_score) if pred and pred.health_score else 100,
            'risk': pred.risk if pred else 'low',
            'confidence': float(pred.confidence) if pred and pred.confidence else 0,
            'recommended_action': pred.recommended_action if pred else None,
        } if pred else None,
        'records': [{'id': str(r.id), 'maintenance_type': r.maintenance_type, 'performed_at': r.performed_at, 'cost': float(r.cost)} for r in records],
        'fuel_logs': [{'id': str(f.id), 'liters': float(f.liters), 'price_per_liter': float(f.price_per_liter), 'logged_at': f.logged_at} for f in fuel_logs],
        'history': [{'ts': h.ts, 'speed': float(h.speed) if h.speed else 0, 'fuel_level': float(h.fuel_level) if h.fuel_level else 0} for h in history],
    }
    
    return render(request, 'pages/vehicle_detail.html', context)


@require_http_methods(["GET"])
def alerts_page(request):
    from backend.api.models import Alert
    
    resolved = request.GET.get('resolved', 'false') == 'true'
    alerts = Alert.objects.filter(is_resolved=resolved)
    
    alerts_list = []
    for a in alerts:
        try:
            vehicle = a.vehicle
        except:
            vehicle = None
        
        alerts_list.append({
            'id': str(a.id),
            'alert_type': a.alert_type,
            'message': a.message,
            'severity': a.severity,
            'is_resolved': a.is_resolved,
            'created_at': a.created_at,
            'vehicle': {'id': str(vehicle.id), 'name': vehicle.name, 'plate': vehicle.plate} if vehicle else None,
        })
    
    return render(request, 'pages/alerts.html', {'alerts': alerts_list, 'resolved': resolved})


@require_http_methods(["GET"])
def map_page(request):
    from backend.api.models import Vehicle
    
    vehicles = Vehicle.objects.all()
    vehicles_list = []
    
    for v in vehicles:
        vehicles_list.append({
            'id': str(v.id),
            'name': v.name,
            'plate': v.plate,
            'status': v.status,
            'lat': float(v.last_lat) if v.last_lat else None,
            'lng': float(v.last_lng) if v.last_lng else None,
        })
    
    return render(request, 'pages/map.html', {'vehicles': vehicles_list})


@require_http_methods(["GET"])
def predictions_page(request):
    from backend.api.models import Vehicle, MaintenancePrediction
    
    predictions = MaintenancePrediction.objects.order_by('-predicted_at')
    
    predictions_list = []
    for pred in predictions:
        try:
            vehicle = pred.vehicle
        except:
            vehicle = None
        
        predictions_list.append({
            'id': str(pred.id),
            'vehicle': {'id': str(vehicle.id), 'name': vehicle.name, 'plate': vehicle.plate} if vehicle else None,
            'health_score': int(pred.health_score) if pred.health_score else 100,
            'risk': pred.risk,
            'confidence': float(pred.confidence) if pred.confidence else 0,
            'recommended_action': pred.recommended_action,
            'predicted_at': pred.predicted_at,
        })
    
    return render(request, 'pages/predictions.html', {'predictions': predictions_list})


@require_http_methods(["GET"])
def drivers_page(request):
    from backend.api.models import Driver, DriverScore
    
    drivers = Driver.objects.all()
    drivers_list = []
    
    for d in drivers:
        score = d.score.first() if d.score.exists() else None
        drivers_list.append({
            'id': str(d.id),
            'license_number': d.license_number,
            'phone': d.phone,
            'score': score.score if score else 100,
            'harsh_accel': score.harsh_accel if score else 0,
            'idle_minutes': score.idle_minutes if score else 0,
            'over_speed': score.over_speed if score else 0,
        })
    
    return render(request, 'pages/drivers.html', {'drivers': drivers_list})


@require_http_methods(["GET"])
def maintenance_page(request):
    from backend.api.models import Vehicle, MaintenanceRecord
    
    records = MaintenanceRecord.objects.all()[:50]
    records_list = []
    
    for r in records:
        try:
            vehicle = r.vehicle
        except:
            vehicle = None
        
        records_list.append({
            'id': str(r.id),
            'maintenance_type': r.maintenance_type,
            'cost': float(r.cost),
            'notes': r.notes,
            'performed_at': r.performed_at,
            'vehicle': {'id': str(vehicle.id), 'name': vehicle.name} if vehicle else None,
        })
    
    return render(request, 'pages/maintenance.html', {'records': records_list})


@require_http_methods(["GET"])
def fuel_logs_page(request):
    from backend.api.models import Vehicle, FuelLog
    
    logs = FuelLog.objects.all()[:50]
    logs_list = []
    
    for f in logs:
        try:
            vehicle = f.vehicle
        except:
            vehicle = None
        
        logs_list.append({
            'id': str(f.id),
            'liters': float(f.liters),
            'price_per_liter': float(f.price_per_liter),
            'total': float(f.liters) * float(f.price_per_liter),
            'odometer': f.odometer,
            'logged_at': f.logged_at,
            'vehicle': {'id': str(vehicle.id), 'name': vehicle.name} if vehicle else None,
        })
    
    return render(request, 'pages/fuel_logs.html', {'fuel_logs': logs_list})


@require_http_methods(["GET"])
def routes_page(request):
    from backend.api.models import PlannedRoute
    
    routes = PlannedRoute.objects.all()
    routes_list = [{'id': str(r.id), 'name': r.name, 'status': r.status, 'stops': r.stops, 'total_distance_m': r.total_distance_m, 'total_duration_s': r.total_duration_s} for r in routes]
    
    return render(request, 'pages/routes.html', {'routes': routes_list})


@require_http_methods(["GET"])
def analytics_page(request):
    from backend.api.models import Vehicle, TelemetryReading
    
    vehicles = Vehicle.objects.all()
    
    return render(request, 'pages/analytics.html', {'vehicles': list(vehicles.values('id', 'name', 'plate', 'status'))})


@require_http_methods(["GET"])
def reports_page(request):
    return render(request, 'pages/reports.html')


@require_http_methods(["GET"])
def scheduler_page(request):
    from backend.api.models import Vehicle, MaintenanceSchedule
    
    schedules = MaintenanceSchedule.objects.all()
    schedules_list = []
    
    for s in schedules:
        try:
            vehicle = s.vehicle
        except:
            vehicle = None
        
        schedules_list.append({
            'id': str(s.id),
            'maintenance_type': s.maintenance_type,
            'scheduled_for': s.scheduled_for,
            'status': s.status,
            'vehicle': {'id': str(vehicle.id), 'name': vehicle.name} if vehicle else None,
        })
    
    return render(request, 'pages/scheduler.html', {'schedules': schedules_list})


@require_http_methods(["GET"])
def replay_page(request):
    from backend.api.models import Vehicle
    
    vehicles = Vehicle.objects.all()
    vehicles_list = [{'id': str(v.id), 'name': v.name, 'plate': v.plate} for v in vehicles]
    
    return render(request, 'pages/replay.html', {'vehicles': vehicles_list})


@require_http_methods(["GET"])
def admin_users_page(request):
    from backend.api.models import Profile, UserRole
    
    profiles = Profile.objects.all()
    users_list = []
    
    for p in profiles:
        role = p.userrole_set.first() if hasattr(p, 'userrole_set') else None
        users_list.append({
            'id': str(p.id),
            'display_name': p.display_name,
            'phone': p.phone,
            'role': role.role if role else None,
        })
    
    return render(request, 'pages/admin_users.html', {'users': users_list})


@require_http_methods(["GET"])
def admin_alert_rules_page(request):
    from backend.api.models import AlertRule
    
    rules = AlertRule.objects.all()
    rules_list = [{'id': str(r.id), 'name': r.name, 'metric': r.metric, 'comparator': r.comparator, 'threshold': float(r.threshold), 'severity': r.severity, 'enabled': r.enabled} for r in rules]
    
    return render(request, 'pages/admin_alert_rules.html', {'rules': rules_list})


@require_http_methods(["GET"])
def admin_webhooks_page(request):
    from backend.api.models import Webhook, WebhookDelivery
    
    webhooks = Webhook.objects.all()
    webhooks_list = []
    
    for w in webhooks:
        deliveries = w.webhookdelivery_set.order_by('-delivered_at')[:5] if hasattr(w, 'webhookdelivery_set') else []
        webhooks_list.append({
            'id': str(w.id),
            'name': w.name,
            'url': w.url,
            'events': w.events,
            'enabled': w.enabled,
            'recent_deliveries': [{'event': d.event, 'response_status': d.response_status, 'delivered_at': d.delivered_at, 'error': d.error} for d in deliveries],
        })
    
    return render(request, 'pages/admin_webhooks.html', {'webhooks': webhooks_list})


@require_http_methods(["GET"])
def admin_simulator_page(request):
    return render(request, 'pages/admin_simulator.html')


@require_http_methods(["GET"])
def docs_iot_page(request):
    return render(request, 'pages/docs_iot.html')


@require_http_methods(["GET"])
def my_vehicle_page(request):
    from backend.api.models import Vehicle, TelemetryReading
    
    vehicles = Vehicle.objects.filter(assigned_driver__isnull=False)[:1]
    
    if vehicles:
        vehicle = vehicles[0]
        latest = vehicle.telemetry.order_by('-ts').first()
        
        context = {
            'vehicle': {
                'id': str(vehicle.id),
                'name': vehicle.name,
                'plate': vehicle.plate,
                'status': vehicle.status,
                'odometer': vehicle.odometer,
            },
            'telemetry': {
                'speed': float(latest.speed) if latest and latest.speed else 0,
                'fuel_level': float(latest.fuel_level) if latest and latest.fuel_level else 0,
            } if latest else None,
        }
        return render(request, 'pages/my_vehicle.html', context)
    
    return render(request, 'pages/my_vehicle.html', {'vehicle': None})


@require_http_methods(["GET"])
def landing_page(request):
    return render(request, 'pages/landing.html')


@require_http_methods(["GET"])
def auth_page(request):
    return render(request, 'pages/auth.html')


@require_http_methods(["GET"])
def not_found_page(request):
    return render(request, 'pages/not_found.html')


@require_http_methods(["POST"])
@csrf_exempt
def api_seed_fleet(request):
    from backend.api.models import Vehicle
    import uuid
    import random
    
    count = 6
    names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa']
    vehicle_types = ['car', 'truck', 'van', 'motorcycle']
    
    vehicles = []
    for i in range(count):
        v = Vehicle.objects.create(
            id=uuid.uuid4(),
            name=f"Vehicle {names[i]}" if i < len(names) else f"Vehicle {i+1}",
            plate=f"ABC-{1000+i}",
            vehicle_type=random.choice(vehicle_types),
            status='active',
            odometer=random.randint(5000, 50000),
            last_lat=random.uniform(40, 42),
            last_lng=random.uniform(-74, -72),
        )
        vehicles.append(v)
    
    return JsonResponse({'created': len(vehicles), 'vehicles': [{'id': str(v.id), 'name': v.name, 'plate': v.plate} for v in vehicles]})


@require_http_methods(["POST"])
@csrf_exempt
def api_simulate_telemetry(request):
    from backend.api.models import Vehicle, TelemetryReading
    import random
    
    ticks = 1
    vehicles = Vehicle.objects.all()
    now = timezone.now()
    readings = []
    
    for v in vehicles:
        for _ in range(ticks):
            reading = TelemetryReading.objects.create(
                vehicle=v,
                ts=now,
                speed=random.uniform(0, 80),
                rpm=random.randint(500, 4000),
                engine_temp=random.uniform(70, 110),
                fuel_level=random.uniform(10, 100),
                battery_voltage=random.uniform(12, 14),
                lat=v.last_lat + random.uniform(-0.001, 0.001) if v.last_lat else random.uniform(40, 42),
                lng=v.last_lng + random.uniform(-0.001, 0.001) if v.last_lng else random.uniform(-74, -72),
                vibration=random.uniform(0, 2)
            )
            readings.append(reading.id)
            v.last_lat = reading.lat
            v.last_lng = reading.lng
            v.save()
    
    return JsonResponse({'created': len(readings)})


@require_http_methods(["POST"])
@csrf_exempt
def api_predict_maintenance(request):
    from backend.api.models import Vehicle, MaintenancePrediction
    import random
    
    vehicles = Vehicle.objects.all()
    predictions = []
    
    for v in vehicles:
        latest = v.telemetry.order_by('-ts').first()
        if not latest:
            continue
        
        engine_temp = float(latest.engine_temp) if latest.engine_temp else 80
        fuel_level = float(latest.fuel_level) if latest.fuel_level else 50
        
        health_score = 100
        if engine_temp > 100:
            health_score -= 20
        if engine_temp > 110:
            health_score -= 20
        if fuel_level < 20:
            health_score -= 15
        
        risk = 'low'
        if health_score < 50:
            risk = 'high'
        elif health_score < 75:
            risk = 'medium'
        
        pred = MaintenancePrediction.objects.create(
            vehicle=v,
            health_score=health_score,
            confidence=random.uniform(0.7, 0.95),
            risk=risk,
            reasons=['Engine temperature analysis', 'Fuel level check'],
            recommended_action='Regular maintenance' if risk == 'low' else 'Immediate inspection' if risk == 'high' else 'Schedule service',
            sensor_contributions={'engine_temp': 40, 'fuel_level': 30, 'battery': 30}
        )
        predictions.append(str(pred.id))
    
    return JsonResponse({'predictions': len(predictions)})


@require_http_methods(["GET"])
def api_config(request):
    return JsonResponse({
        'apiUrl': '/api',
        'siteName': 'CareDrive',
        'features': {
            'demo': True,
            'ai': True,
            'map': True
        }
    })


@require_http_methods(["GET"])
def api_dashboard_stats(request):
    from backend.api.models import Vehicle, Alert, TelemetryReading, MaintenancePrediction
    
    vehicles = Vehicle.objects.all()
    alerts_open = Alert.objects.filter(is_resolved=False).count()
    active_count = vehicles.filter(status='active').count()
    
    return JsonResponse({
        'active': f'{active_count}/{vehicles.count()}',
        'open_alerts': alerts_open,
    })