# fleet-agent/dashboard/server.py
"""Flask + SocketIO server bridging MQTT and browser."""

import os
import sys
import time
import json
import logging
import threading
from flask import Flask, render_template, send_from_directory, jsonify
from flask_socketio import SocketIO
import paho.mqtt.client as mqtt

# Add fleet-agent root to sys.path to import config
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import config

logger = logging.getLogger("dashboard.server")

app = Flask(__name__, static_folder="static", template_folder="static")
socketio = SocketIO(app, cors_allowed_origins="*")
mqtt_client = mqtt.Client()

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info("Dashboard MQTT connected.")
        client.subscribe(config.TOPIC_TELEMETRY, qos=1)
        client.subscribe(config.TOPIC_GEOFENCE_ACK, qos=1)
        client.subscribe(config.TOPIC_KILL, qos=1)
    else:
        logger.warning(f"Dashboard MQTT connection failed: {rc}")

def on_disconnect(client, userdata, rc):
    logger.warning("Dashboard MQTT disconnected.")
    # Attempt reconnect in background thread
    def reconnect_thread():
        while True:
            try:
                logger.info("Attempting to reconnect dashboard MQTT...")
                client.reconnect()
                break
            except Exception as e:
                time.sleep(10)
    threading.Thread(target=reconnect_thread, daemon=True).start()

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode("utf-8"))
        if msg.topic == config.TOPIC_TELEMETRY:
            socketio.emit("telemetry", payload)
        elif msg.topic == config.TOPIC_GEOFENCE_ACK:
            socketio.emit("geofence_ack", payload)
        elif msg.topic == config.TOPIC_KILL:
            socketio.emit("kill_status", payload)
    except Exception as e:
        logger.error(f"Error processing MQTT message on topic {msg.topic}: {e}")

try:
    # mqtt_client.tls_set()
    # mqtt_client.username_pw_set(config.BROKER_USER, config.BROKER_PASS)
    mqtt_client.on_connect = on_connect
    mqtt_client.on_disconnect = on_disconnect
    mqtt_client.on_message = on_message
    
    mqtt_client.connect(config.BROKER_HOST, config.BROKER_PORT, 60)
    mqtt_client.loop_start()
except Exception as e:
    logger.error(f"Failed to start dashboard MQTT client: {e}")

@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/config")
def get_config():
    return jsonify({
        "api_key": config.GOOGLE_MAPS_API_KEY,
        "vehicle_id": config.VEHICLE_ID,
        "geofence_coords": config.GEOFENCE_COORDS
    })

@socketio.on("update_geofence")
def handle_update_geofence(data):
    coords = data.get("coords", [])
    if len(coords) < 3:
        return {"error": "Geofence requires at least 3 points."}
        
    payload = {"coords": coords}
    mqtt_client.publish(config.TOPIC_GEOFENCE_UPDATE, json.dumps(payload), qos=1)
    
    # Update local memory
    config.GEOFENCE_COORDS = [(float(c[0]), float(c[1])) for c in coords]
    
    logger.info(f"Geofence update pushed — {len(coords)} vertices")
    socketio.emit("geofence_push_status", {"status": "pushed", "vertex_count": len(coords)})

@socketio.on("send_kill")
def handle_send_kill(data):
    action = data.get("action")
    if action in ["KILL", "RESTORE"]:
        payload = {"action": action}
        mqtt_client.publish(config.TOPIC_KILL, json.dumps(payload), qos=1)
        logger.info(f"Kill command sent: {action}")

@socketio.on("request_status")
def handle_request_status():
    socketio.emit("current_status", {"geofence_coords": config.GEOFENCE_COORDS})

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    )
    logger.info(f"Dashboard server starting on port {config.DASHBOARD_PORT}")
    socketio.run(app, host=config.DASHBOARD_HOST, port=config.DASHBOARD_PORT, debug=False, allow_unsafe_werkzeug=True)
