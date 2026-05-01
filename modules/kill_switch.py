# fleet-agent/modules/kill_switch.py
"""Relay-based ignition kill switch with MQTT command listener."""

import logging
import threading
import time
import json
import atexit
import RPi.GPIO as GPIO
import paho.mqtt.client as mqtt
import config

logger = logging.getLogger("kill_switch")

_lock = threading.Lock()
_kill_status: str = "NORMAL"

try:
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(config.RELAY_PIN, GPIO.OUT)
    GPIO.output(config.RELAY_PIN, GPIO.HIGH)
except Exception as e:
    logger.error(f"GPIO setup failed: {e}")

def engage_kill() -> None:
    global _kill_status
    try:
        GPIO.output(config.RELAY_PIN, GPIO.LOW)
        with _lock:
            _kill_status = "ACTIVE"
        logger.critical(f"KILL ENGAGED at {time.time()} — ignition cut")
    except Exception as e:
        logger.error(f"Failed to engage kill switch: {e}")

def restore_power() -> None:
    global _kill_status
    try:
        GPIO.output(config.RELAY_PIN, GPIO.HIGH)
        with _lock:
            _kill_status = "NORMAL"
        logger.info("Power restored — ignition relay closed")
    except Exception as e:
        logger.error(f"Failed to restore power: {e}")

def get_kill_status() -> str:
    with _lock:
        return _kill_status

def cleanup() -> None:
    try:
        GPIO.cleanup()
        logger.info("GPIO cleaned up")
    except Exception as e:
        logger.error(f"GPIO cleanup failed: {e}")

def _on_message(client: mqtt.Client, userdata, msg: mqtt.MQTTMessage) -> None:
    try:
        payload = json.loads(msg.payload.decode("utf-8"))
        action = payload.get("action")
        if action == "KILL":
            engage_kill()
        elif action == "RESTORE":
            restore_power()
    except Exception as e:
        logger.error(f"Failed to process MQTT message: {e}")

def _on_disconnect(client: mqtt.Client, userdata, rc: int) -> None:
    logger.warning("Kill switch MQTT disconnected.")
    while True:
        try:
            logger.info("Attempting to reconnect kill switch MQTT...")
            client.reconnect()
            logger.info("Kill switch MQTT reconnected.")
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
        client.subscribe(config.TOPIC_KILL, qos=1)
        client.loop_forever()
    except Exception as e:
        logger.error(f"Kill switch MQTT daemon failed: {e}")

t = threading.Thread(target=_mqtt_daemon, daemon=True)
t.start()

def _exit_handler() -> None:
    restore_power()
    cleanup()

atexit.register(_exit_handler)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(get_kill_status())
    time.sleep(10)
    cleanup()
