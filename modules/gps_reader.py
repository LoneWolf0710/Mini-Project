# fleet-agent/modules/gps_reader.py
"""GPS location reader via gpsd and Neo-6M module."""

import logging
import threading
import time
import gpsd
import config

logger = logging.getLogger("gps_reader")

_gps_data = {
    "lat": None,
    "lon": None,
    "speed_ms": None,
    "heading": None,
    "altitude": None,
    "fix": False,
    "satellites": 0
}
_lock = threading.Lock()

def _poll_daemon() -> None:
    try:
        gpsd.connect(host="127.0.0.1", port=2947)
        logger.info("Connected to gpsd on localhost:2947")
    except Exception as e:
        logger.error(f"Failed to connect to gpsd: {e}")
        
    while True:
        try:
            packet = gpsd.get_current()
            mode = getattr(packet, 'mode', 1)
            sats = getattr(packet, 'sats', 0)
            
            if mode >= 2:
                if sats < 4:
                    logger.warning(f"Low satellite count: {sats}")
                    
                with _lock:
                    _gps_data["lat"] = getattr(packet, 'lat', _gps_data["lat"])
                    _gps_data["lon"] = getattr(packet, 'lon', _gps_data["lon"])
                    _gps_data["speed_ms"] = getattr(packet, 'hspeed', _gps_data["speed_ms"])
                    _gps_data["heading"] = getattr(packet, 'track', _gps_data["heading"])
                    _gps_data["altitude"] = getattr(packet, 'alt', _gps_data["altitude"])
                    _gps_data["fix"] = True
                    _gps_data["satellites"] = sats
            else:
                with _lock:
                    _gps_data["fix"] = False
                    _gps_data["satellites"] = sats
                logger.warning("No GPS fix.")
                
        except Exception as e:
            with _lock:
                _gps_data["fix"] = False
            logger.warning(f"GPS polling exception: {e}")
            
        time.sleep(config.GPS_POLL_INTERVAL)

def start() -> None:
    t = threading.Thread(target=_poll_daemon, daemon=True)
    t.start()

def get_gps_data() -> dict:
    with _lock:
        return dict(_gps_data)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    start()
    for _ in range(20):
        time.sleep(1)
        print(get_gps_data())
