# fleet-agent/modules/mqtt_publisher.py
"""MQTT publisher with offline buffering for telemetry data."""

import logging
import threading
import time
import json
from collections import deque
import paho.mqtt.client as mqtt
import config

logger = logging.getLogger("mqtt_publisher")

_client = mqtt.Client()
_lock = threading.Lock()
_connected: bool = False
_buffer = deque(maxlen=config.MQTT_QUEUE_MAXLEN)

def _on_connect(client: mqtt.Client, userdata, flags: dict, rc: int) -> None:
    global _connected
    if rc == 0:
        with _lock:
            _connected = True
            
        flush_count = 0
        with _lock:
            while _buffer:
                msg = _buffer.popleft()
                client.publish(config.TOPIC_TELEMETRY, msg, qos=1)
                flush_count += 1
                
        logger.info(f"MQTT connected. Flushed {flush_count} buffered messages.")
    else:
        logger.warning(f"MQTT connect failed with result code {rc}")

def _on_disconnect(client: mqtt.Client, userdata, rc: int) -> None:
    global _connected
    with _lock:
        _connected = False
    logger.warning("MQTT disconnected.")

_client.on_connect = _on_connect
_client.on_disconnect = _on_disconnect

def connect() -> None:
    try:
        _client.tls_set()
        _client.username_pw_set(config.BROKER_USER, config.BROKER_PASS)
    except Exception as e:
        logger.error(f"MQTT TLS/Auth setup failed: {e}")
        
    backoff = [2, 4, 8, 16, 32, 64]
    attempt = 0
    
    while attempt < 10:
        wait_time = backoff[attempt] if attempt < len(backoff) else 64
        try:
            logger.info(f"Connecting to MQTT broker {config.BROKER_HOST}:{config.BROKER_PORT} (Attempt {attempt+1}/10)")
            _client.connect(config.BROKER_HOST, config.BROKER_PORT, 60)
            _client.loop_start()
            return
        except Exception as e:
            logger.error(f"MQTT connection failed: {e}")
            time.sleep(wait_time)
            attempt += 1
            
    logger.error("Failed to connect to MQTT broker after 10 attempts.")

def publish_telemetry(payload: dict) -> bool:
    try:
        json_str = json.dumps(payload)
        with _lock:
            is_conn = _connected
            
        if is_conn:
            _client.publish(config.TOPIC_TELEMETRY, json_str, qos=1)
            return True
        else:
            with _lock:
                _buffer.append(json_str)
                queue_len = len(_buffer)
            logger.warning(f"MQTT offline — buffered {queue_len} messages")
            return False
    except Exception as e:
        logger.error(f"Failed to publish telemetry: {e}")
        return False

def disconnect() -> None:
    try:
        _client.loop_stop()
        _client.disconnect()
        logger.info("MQTT publisher disconnected.")
    except Exception as e:
        logger.error(f"Error during MQTT disconnect: {e}")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    connect()
    for i in range(5):
        publish_telemetry({"test": i})
        time.sleep(2)
    disconnect()
