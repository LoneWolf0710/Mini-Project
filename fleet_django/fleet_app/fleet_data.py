"""
Fleet data generation - Python equivalent of src/lib/fleetData.ts
"""
import random
import math
from datetime import datetime, timedelta


VEHICLE_NAMES = [
    'Alpha-01', 'Bravo-02', 'Charlie-03', 'Delta-04', 'Echo-05',
    'Foxtrot-06', 'Golf-07', 'Hotel-08', 'India-09', 'Juliet-10',
    'Kilo-11', 'Lima-12'
]

DRIVERS = [
    'James Wilson', 'Sarah Chen', 'Mike Rodriguez', 'Emma Thompson',
    'David Park', 'Lisa Kumar', 'Alex Johnson', 'Maria Garcia',
    'Ryan Lee', 'Sophie Brown', 'Carlos Diaz', 'Nina Patel'
]

VEHICLE_TYPES = ['truck', 'van', 'bus', 'car']


def predict_maintenance(engine_temp, vibration_level, battery_voltage, engine_rpm, mileage):
    score = 0
    if engine_temp > 100:
        score += 0.3
    elif engine_temp > 90:
        score += 0.15
    if vibration_level > 7:
        score += 0.25
    elif vibration_level > 5:
        score += 0.1
    if battery_voltage <= 11:
        score += 0.2
    if engine_rpm > 4500:
        score += 0.1
    if mileage > 150000:
        score += 0.15
    elif mileage > 100000:
        score += 0.08
    return min(score, 1.0)


def get_status(prob):
    if prob > 0.6:
        return 'critical'
    if prob > 0.35:
        return 'warning'
    return 'healthy'


def generate_vehicles(seed=42):
    rng = random.Random(seed)
    vehicles = []
    for i, name in enumerate(VEHICLE_NAMES):
        engine_temp = 60 + rng.randint(0, 59)
        vibration_level = 1 + rng.randint(0, 8)
        battery_voltage = 11 + rng.randint(0, 3)
        engine_rpm = 700 + rng.randint(0, 4499)
        fuel_level = 5 + rng.randint(0, 94)
        mileage = 10000 + rng.randint(0, 189999)
        prob = predict_maintenance(engine_temp, vibration_level, battery_voltage, engine_rpm, mileage)
        status = get_status(prob)

        vehicles.append({
            'id': f'VH-{str(i + 1).zfill(3)}',
            'name': name,
            'type': VEHICLE_TYPES[i % 4],
            'status': status,
            'engine_temp': engine_temp,
            'vibration_level': vibration_level,
            'battery_voltage': battery_voltage,
            'engine_rpm': engine_rpm,
            'fuel_level': fuel_level,
            'mileage': mileage,
            'maintenance_needed': prob > 0.5,
            'last_maintenance': f'2026-0{1 + (i % 3)}-{str(10 + i).zfill(2)}',
            'next_maintenance': f'2026-0{4 + (i % 3)}-{str(10 + i).zfill(2)}',
            'driver': DRIVERS[i],
            'lat': 28.6 + rng.random() * 0.1,
            'lng': 77.2 + rng.random() * 0.1,
            'speed': rng.randint(0, 79),
            'iot_connected': rng.random() > 0.15,
        })
    return vehicles


def generate_alerts(vehicles):
    now = datetime.now()
    alerts = []
    for v in vehicles:
        if v['status'] == 'critical':
            alerts.append({
                'id': f'AL-{v["id"]}-1',
                'vehicle_id': v['id'],
                'vehicle_name': v['name'],
                'type': 'critical',
                'message': f'Engine temperature critical: {v["engine_temp"]}°C',
                'timestamp': (now - timedelta(seconds=random.randint(0, 3600))).isoformat(),
                'resolved': False,
            })
        if v['vibration_level'] > 7:
            alerts.append({
                'id': f'AL-{v["id"]}-2',
                'vehicle_id': v['id'],
                'vehicle_name': v['name'],
                'type': 'warning',
                'message': f'High vibration detected: Level {v["vibration_level"]}',
                'timestamp': (now - timedelta(seconds=random.randint(0, 7200))).isoformat(),
                'resolved': False,
            })
        if v['battery_voltage'] <= 11:
            alerts.append({
                'id': f'AL-{v["id"]}-3',
                'vehicle_id': v['id'],
                'vehicle_name': v['name'],
                'type': 'warning',
                'message': f'Low battery voltage: {v["battery_voltage"]}V',
                'timestamp': (now - timedelta(seconds=random.randint(0, 5400))).isoformat(),
                'resolved': False,
            })
        if v['fuel_level'] < 15:
            alerts.append({
                'id': f'AL-{v["id"]}-4',
                'vehicle_id': v['id'],
                'vehicle_name': v['name'],
                'type': 'info',
                'message': f'Low fuel: {v["fuel_level"]}%',
                'timestamp': (now - timedelta(seconds=random.randint(0, 1800))).isoformat(),
                'resolved': False,
            })
    alerts.sort(key=lambda a: a['timestamp'], reverse=True)
    return alerts


def generate_predictions(vehicles):
    predictions = []
    today = datetime.now()
    for v in vehicles:
        prob = predict_maintenance(
            v['engine_temp'], v['vibration_level'],
            v['battery_voltage'], v['engine_rpm'], v['mileage']
        )
        factors = []
        if v['engine_temp'] > 100:
            factors.append('High engine temperature')
        if v['vibration_level'] > 7:
            factors.append('Excessive vibration')
        if v['battery_voltage'] <= 11:
            factors.append('Low battery voltage')
        if v['mileage'] > 150000:
            factors.append('High mileage')
        if v['engine_rpm'] > 4500:
            factors.append('High RPM strain')
        if not factors:
            factors.append('Normal wear')

        days_until = max(1, int((1 - prob) * 90))
        predicted_date = (today + timedelta(days=days_until)).strftime('%Y-%m-%d')
        priority = 'high' if prob > 0.6 else ('medium' if prob > 0.35 else 'low')

        predictions.append({
            'vehicle_id': v['id'],
            'vehicle_name': v['name'],
            'probability': round(prob * 100),
            'predicted_date': predicted_date,
            'factors': factors,
            'priority': priority,
        })
    predictions.sort(key=lambda p: p['probability'], reverse=True)
    return predictions


def generate_time_series():
    data = []
    for i in range(24):
        data.append({
            'time': f'{str(i).zfill(2)}:00',
            'avg_temp': round(70 + math.sin(i / 4) * 15 + random.random() * 10, 1),
            'avg_rpm': round(2500 + math.sin(i / 3) * 800 + random.random() * 500),
            'avg_fuel': round(max(10, 75 - i * 2 + random.random() * 10), 1),
            'alerts': random.randint(0, 4),
            'active_vehicles': 8 + int(math.sin(i / 6) * 4),
        })
    return data


def get_fleet_stats(vehicles):
    total = len(vehicles)
    healthy = sum(1 for v in vehicles if v['status'] == 'healthy')
    warning = sum(1 for v in vehicles if v['status'] == 'warning')
    critical = sum(1 for v in vehicles if v['status'] == 'critical')
    avg_fuel = round(sum(v['fuel_level'] for v in vehicles) / total)
    avg_temp = round(sum(v['engine_temp'] for v in vehicles) / total)
    iot_connected = sum(1 for v in vehicles if v['iot_connected'])
    total_mileage = sum(v['mileage'] for v in vehicles)
    return {
        'total': total,
        'healthy': healthy,
        'warning': warning,
        'critical': critical,
        'avg_fuel': avg_fuel,
        'avg_temp': avg_temp,
        'iot_connected': iot_connected,
        'total_mileage': total_mileage,
    }
