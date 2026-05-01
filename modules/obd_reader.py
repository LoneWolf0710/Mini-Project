# fleet-agent/modules/obd_reader.py
"""OBD-II ECU data reader via ELM327 adapter."""

import logging
import threading
import time
import obd
import config

logger = logging.getLogger("obd_reader")

_obd_data = {
    "rpm": None,
    "speed_kmh": None,
    "coolant_temp": None,
    "fuel_level": None,
    "throttle_pos": None,
    "engine_load": None,
    "maf_gs": None,
    "intake_map": None
}
_lock = threading.Lock()
_connection = None

def _connect() -> None:
    global _connection
    backoff = [2, 4, 8, 16, 32]
    
    for attempt, wait_time in enumerate(backoff):
        try:
            logger.info(f"Connecting to OBD-II adapter on /dev/ttyUSB0 (Attempt {attempt+1}/5)")
            _connection = obd.OBD("/dev/ttyUSB0", fast=False)
            if _connection.is_connected():
                logger.info("Successfully connected to OBD-II adapter.")
                return
            else:
                logger.warning("OBD connection failed.")
        except Exception as e:
            logger.warning(f"OBD connection exception: {e}")
        time.sleep(wait_time)
        
    logger.error("Failed to connect to OBD-II adapter after 5 attempts.")
    raise RuntimeError("OBD connection failed after 5 attempts.")

def _poll_daemon() -> None:
    try:
        _connect()
    except RuntimeError:
        return
        
    pid_map = {
        "rpm": obd.commands.RPM,
        "speed_kmh": obd.commands.SPEED,
        "coolant_temp": obd.commands.COOLANT_TEMP,
        "fuel_level": obd.commands.FUEL_LEVEL,
        "throttle_pos": obd.commands.THROTTLE_POS,
        "engine_load": obd.commands.ENGINE_LOAD,
        "maf_gs": obd.commands.MAF,
        "intake_map": obd.commands.INTAKE_PRESSURE
    }
    
    while True:
        try:
            readings = {}
            for key, cmd in pid_map.items():
                if _connection and _connection.is_connected():
                    response = _connection.query(cmd)
                    if response is None or response.is_null():
                        logger.warning(f"PID {key} returned null or None.")
                        readings[key] = None
                    else:
                        val = response.value
                        readings[key] = val.magnitude if hasattr(val, 'magnitude') else val
                else:
                    readings[key] = None
                    
            with _lock:
                _obd_data.update(readings)
                
        except Exception as e:
            logger.error(f"Error polling OBD-II: {e}")
            
        time.sleep(config.OBD_POLL_INTERVAL)

def start() -> None:
    t = threading.Thread(target=_poll_daemon, daemon=True)
    t.start()

def get_obd_data() -> dict:
    with _lock:
        return dict(_obd_data)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    start()
    for _ in range(10):
        time.sleep(2)
        print(get_obd_data())
