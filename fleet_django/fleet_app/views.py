import json
from django.shortcuts import render
from django.http import JsonResponse
from .fleet_data import (
    generate_vehicles, generate_alerts, generate_predictions,
    generate_time_series, get_fleet_stats, predict_maintenance
)

# Use a session-based approach to persist resolved alerts within a session
_VEHICLES = generate_vehicles()
_RESOLVED_ALERTS = set()


def get_alerts_with_state(request):
    alerts = generate_alerts(_VEHICLES)
    resolved = request.session.get('resolved_alerts', [])
    for alert in alerts:
        if alert['id'] in resolved:
            alert['resolved'] = True
    return alerts


def index(request):
    return render(request, 'fleet/index.html')


def dashboard(request):
    vehicles = _VEHICLES
    alerts = get_alerts_with_state(request)
    stats = get_fleet_stats(vehicles)
    ts_data = generate_time_series()
    unresolved = [a for a in alerts if not a['resolved']]
    maintenance_queue = [v for v in vehicles if v['maintenance_needed']]

    context = {
        'stats': stats,
        'vehicles': vehicles[:6],
        'unresolved_alerts': unresolved[:6],
        'maintenance_queue': maintenance_queue[:6],
        'ts_data': json.dumps(ts_data),
        'pie_data': json.dumps([
            {'name': 'Healthy', 'value': stats['healthy']},
            {'name': 'Warning', 'value': stats['warning']},
            {'name': 'Critical', 'value': stats['critical']},
        ]),
        'active_alert_count': len(unresolved),
    }
    return render(request, 'fleet/dashboard.html', context)


def vehicles_view(request):
    filter_status = request.GET.get('filter', 'all')
    search = request.GET.get('search', '')
    vehicles = _VEHICLES
    if filter_status != 'all':
        vehicles = [v for v in vehicles if v['status'] == filter_status]
    if search:
        s = search.lower()
        vehicles = [v for v in vehicles if s in v['name'].lower() or s in v['id'].lower()]
    return render(request, 'fleet/vehicles.html', {
        'vehicles': vehicles,
        'filter': filter_status,
        'search': search,
    })


def predictions_view(request):
    predictions = generate_predictions(_VEHICLES)
    chart_data = [{'name': p['vehicle_name'], 'probability': p['probability']} for p in predictions[:10]]
    result = None

    if request.method == 'POST':
        try:
            engine_temp = float(request.POST.get('engine_temp', 85))
            vibration_level = float(request.POST.get('vibration_level', 5))
            battery_voltage = float(request.POST.get('battery_voltage', 12))
            engine_rpm = float(request.POST.get('engine_rpm', 3000))
            mileage = float(request.POST.get('mileage', 80000))
            prob = predict_maintenance(engine_temp, vibration_level, battery_voltage, engine_rpm, mileage)
            score = prob * 100
            result = 'Maintenance Required' if score > 50 else 'Vehicle Healthy'
        except (ValueError, TypeError):
            result = 'Invalid input'

    return render(request, 'fleet/predictions.html', {
        'predictions': predictions,
        'chart_data': json.dumps(chart_data),
        'result': result,
        'form_defaults': {
            'engine_temp': 85, 'vibration_level': 5, 'battery_voltage': 12,
            'engine_rpm': 3000, 'fuel_level': 50, 'mileage': 80000,
        },
    })


def alerts_view(request):
    if request.method == 'POST':
        alert_id = request.POST.get('alert_id')
        resolved = request.session.get('resolved_alerts', [])
        if alert_id and alert_id not in resolved:
            resolved.append(alert_id)
            request.session['resolved_alerts'] = resolved
        return JsonResponse({'status': 'ok'})

    alerts = get_alerts_with_state(request)
    unresolved = [a for a in alerts if not a['resolved']]
    for a in unresolved:
        try:
            a['timestamp_display'] = a['timestamp'][:16].replace('T', ' ')
        except Exception:
            a['timestamp_display'] = ''
    critical = [a for a in unresolved if a['type'] == 'critical']
    warnings = [a for a in unresolved if a['type'] == 'warning']
    info = [a for a in unresolved if a['type'] == 'info']
    return render(request, 'fleet/alerts.html', {
        'alerts': unresolved,
        'critical_count': len(critical),
        'warning_count': len(warnings),
        'info_count': len(info),
    })


def analytics_view(request):
    vehicles = _VEHICLES
    ts_data = generate_time_series()
    stats = get_fleet_stats(vehicles)
    fuel_by_vehicle = [{'name': v['name'], 'fuel': v['fuel_level'], 'temp': v['engine_temp']} for v in vehicles[:10]]
    return render(request, 'fleet/analytics.html', {
        'ts_data': json.dumps(ts_data),
        'fuel_by_vehicle': json.dumps(fuel_by_vehicle),
        'stats': stats,
        'fleet_uptime': round((stats['healthy'] / stats['total']) * 100),
        'iot_coverage': round((stats['iot_connected'] / stats['total']) * 100),
        'total_mileage_m': round(stats['total_mileage'] / 1_000_000, 1),
    })


def iot_view(request):
    return render(request, 'fleet/iot.html', {'vehicles': _VEHICLES})


def settings_view(request):
    security_items = [
        {'label': 'TLS/SSL Encryption', 'status': 'Active',
         'icon_path': '<rect x="5" y="11" width="14" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'},
        {'label': 'API Key Authentication', 'status': 'Enabled',
         'icon_path': '<path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>'},
        {'label': 'Rate Limiting', 'status': '100 req/min',
         'icon_path': '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>'},
        {'label': 'CORS Protection', 'status': 'Configured',
         'icon_path': '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'},
    ]
    iot_items = [
        {'label': 'Data Polling Interval', 'value': '5 seconds'},
        {'label': 'Sensor Channels', 'value': '6 (Temp, Vibration, Voltage, RPM, Fuel, GPS)'},
        {'label': 'Communication Protocol', 'value': 'HTTP REST + WebSocket'},
        {'label': 'Microcontroller', 'value': 'Arduino UNO R4 WiFi'},
        {'label': 'Firmware Version', 'value': 'v1.3.2'},
    ]
    system_items = [
        {'label': 'Backend Framework', 'value': 'Django 5.x'},
        {'label': 'Python Version', 'value': '3.11+'},
        {'label': 'Database', 'value': 'SQLite (dev) / PostgreSQL (prod)'},
        {'label': 'Platform Version', 'value': 'v2.4.1'},
    ]
    return render(request, 'fleet/settings.html', {
        'security_items': security_items,
        'iot_items': iot_items,
        'system_items': system_items,
    })
