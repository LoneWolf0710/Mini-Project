# fleet-agent/modules/geofence.py
"""Geofence boundary checker with breach detection."""

import logging
import threading
import time
import json
from shapely.geometry import Point, Polygon
import paho.mqtt.client as mqtt
import config

logger = logging.getLogger("geofence")

_lock = threading.Lock()
_inside: bool = True
_prev_inside: bool = True
_breach_count: int = 0
_last_breach_time: float | None = None
_new_breach_flag: bool = False

try:
    _polygon = Polygon(config.GEOFENCE_COORDS)
except Exception as e:
    logger.error(f"Failed to create geofence polygon: {e}")
    _polygon = None

def check_geofence(lat: float, lon: float) -> bool:
    global _inside, _prev_inside, _breach_count, _last_breach_time, _new_breach_flag
    
    if _polygon is None:
        return True
        
    try:
        point = Point(lat, lon)
        current_inside = _polygon.contains(point)
        
        with _lock:
            _inside = current_inside
            
            if _prev_inside and not _inside:
                _breach_count += 1
                _last_breach_time = time.time()
                _new_breach_flag = True
                logger.critical(f"GEOFENCE BREACH — vehicle_id={config.VEHICLE_ID} lat={lat} lon={lon}")
            elif not _prev_inside and _inside:
                logger.info("Geofence re-entry — vehicle back inside boundary")
                _new_breach_flag = False
                
            _prev_inside = _inside
            return _inside
            
    except Exception as e:
        logger.error(f"Geofence check error: {e}")
        return _inside

def is_new_breach() -> bool:
    global _new_breach_flag
    with _lock:
        val = _new_breach_flag
        _new_breach_flag = False
        return val

def get_geofence_status() -> dict:
    with _lock:
        return {
            "inside": _inside,
            "breach_count": _breach_count,
            "last_breach_time": _last_breach_time
        }

def update_geofence(coords: list[tuple[float, float]]) -> None:
    global _polygon, _breach_count, _last_breach_time, _new_breach_flag, _prev_inside, _inside
    with _lock:
        try:
            _polygon = Polygon(coords)
            config.GEOFENCE_COORDS = coords
            _breach_count = 0
            _last_breach_time = None
            _new_breach_flag = False
            _prev_inside = True
            _inside = True
            logger.info(f"Geofence polygon updated — {len(coords)} vertices")
        except Exception as e:
            logger.error(f"Failed to update geofence polygon: {e}")

def _on_message(client: mqtt.Client, userdata, msg: mqtt.MQTTMessage) -> None:
    try:
        payload = json.loads(msg.payload.decode("utf-8"))
        raw_coords = payload.get("coords", [])
        if len(raw_coords) >= 3:
            coords = [(float(pt[0]), float(pt[1])) for pt in raw_coords]
            update_geofence(coords)
            
            ack_payload = {
                "vehicle_id": config.VEHICLE_ID,
                "status": "updated",
                "vertex_count": len(coords),
                "timestamp": time.time()
            }
            client.publish(config.TOPIC_GEOFENCE_ACK, json.dumps(ack_payload), qos=1)
        else:
            logger.warning("Received geofence update with less than 3 points")
    except Exception as e:
        logger.error(f"Failed to process geofence update MQTT message: {e}")

def _on_disconnect(client: mqtt.Client, userdata, rc: int) -> None:
    logger.warning("Geofence MQTT disconnected.")
    while True:
        try:
            logger.info("Attempting to reconnect geofence MQTT...")
            client.reconnect()
            logger.info("Geofence MQTT reconnected.")
            break
        except Exception as e:
            time.sleep(5)

def _mqtt_daemon() -> None:
    try:
        client = mqtt.Client()
        client.tls_set()
        client.username_pw_set(config.BROKER_USER, config.BROKER_PASS)
        client.on_message = _on_message
        client.on_disconnect = _on_disconnect
        
        client.connect(config.BROKER_HOST, config.BROKER_PORT, 60)
        client.subscribe(config.TOPIC_GEOFENCE_UPDATE, qos=1)
        client.loop_forever()
    except Exception as e:
        logger.error(f"Geofence MQTT daemon failed: {e}")

t = threading.Thread(target=_mqtt_daemon, daemon=True)
t.start()

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    test_coords = [
        (28.6139, 77.2110),
        (28.6200, 77.2200),
        (28.6139, 77.2110)
    ]
    for lat, lon in test_coords:
        check_geofence(lat, lon)
        print(get_geofence_status())
        time.sleep(1)
