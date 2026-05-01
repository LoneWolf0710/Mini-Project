import time
import json
import logging
import threading
import paho.mqtt.client as mqtt
import config

logging.basicConfig(level=logging.INFO)

client = mqtt.Client()
# client.tls_set()
# client.username_pw_set(config.BROKER_USER, config.BROKER_PASS)
client.connect(config.BROKER_HOST, config.BROKER_PORT)

# Keep track of inside state
inside = True
breach_count = 0

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode("utf-8"))
        if msg.topic == config.TOPIC_KILL:
            print(f"Received KILL command: {payload}")
        elif msg.topic == config.TOPIC_GEOFENCE_UPDATE:
            print(f"Received GEOFENCE update: {payload}")
            coords = payload.get("coords", [])
            ack = {
                "vehicle_id": config.VEHICLE_ID,
                "status": "updated",
                "vertex_count": len(coords),
                "timestamp": time.time()
            }
            client.publish(config.TOPIC_GEOFENCE_ACK, json.dumps(ack), qos=1)
    except Exception as e:
        print(f"Error in mock: {e}")

client.on_message = on_message
client.subscribe(config.TOPIC_KILL)
client.subscribe(config.TOPIC_GEOFENCE_UPDATE)
client.loop_start()

print("Publishing mock telemetry...")

# coordinates to move around in Delhi
start_lat, start_lon = 28.6139, 77.2090
import math

t = 0
try:
    while True:
        # Move in a circle
        lat = start_lat + 0.005 * math.sin(t)
        lon = start_lon + 0.005 * math.cos(t)
        t += 0.1

        # Simulate breach randomly or manually via coords (just mock it)
        # We can alternate inside / outside status based on t
        if t > 6.28:
            t = 0
            
        is_inside = (t < 3.14)
        if not is_inside and inside:
            breach_count += 1
            alert = "GEOFENCE_BREACH"
        else:
            alert = None
            
        inside = is_inside

        telemetry = {
            "vehicle_id": config.VEHICLE_ID,
            "timestamp": time.time(),
            "gps": {
                "lat": lat,
                "lon": lon,
                "fix": True,
                "speed": 15.5,
                "satellites": 8
            },
            "kill_status": "NORMAL",
            "alert": alert,
            "geofence": {
                "inside": inside,
                "breach_count": breach_count
            }
        }
        
        client.publish(config.TOPIC_TELEMETRY, json.dumps(telemetry))
        time.sleep(2)
except KeyboardInterrupt:
    pass
