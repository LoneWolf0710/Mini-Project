# fleet-agent/config.py

# MQTT
BROKER_HOST = "broker.hivemq.com"
BROKER_PORT = 1883
BROKER_USER = ""
BROKER_PASS = ""
VEHICLE_ID  = "vehicle_01"
TOPIC_TELEMETRY = f"fleet/{VEHICLE_ID}/telemetry"
TOPIC_KILL      = f"fleet/{VEHICLE_ID}/kill"

# GPIO
RELAY_PIN = 17

# Polling intervals (seconds)
OBD_POLL_INTERVAL  = 2
GPS_POLL_INTERVAL  = 1
IMU_POLL_INTERVAL  = 0.1   # 10Hz
MAIN_LOOP_INTERVAL = 2

# IMU thresholds (g-force)
HARSH_BRAKE_THRESHOLD  = -0.4
HARSH_ACCEL_THRESHOLD  =  0.4
HARSH_CORNER_THRESHOLD =  0.35

# OBD PIDs to poll (as obd.commands references, listed by name)
# RPM, SPEED, COOLANT_TEMP, FUEL_LEVEL, THROTTLE_POS, ENGINE_LOAD, MAF, INTAKE_PRESSURE

# Geofence polygon (realistic Delhi campus sample, 5 points)
GEOFENCE_COORDS = [
    (28.6139, 77.2090),
    (28.6150, 77.2110),
    (28.6145, 77.2135),
    (28.6125, 77.2130),
    (28.6118, 77.2095),
]

# MQTT buffer
MQTT_QUEUE_MAXLEN = 500

# Dashboard server
DASHBOARD_HOST = "0.0.0.0"
DASHBOARD_PORT = 5000

# MQTT topics — geofence sync
TOPIC_GEOFENCE_UPDATE = f"fleet/{VEHICLE_ID}/geofence/update"
TOPIC_GEOFENCE_ACK    = f"fleet/{VEHICLE_ID}/geofence/ack"

# Google Maps
GOOGLE_MAPS_API_KEY = "YOUR_GOOGLE_MAPS_API_KEY"
