# fleet-agent/main.py
"""Fleet agent entry point — orchestrates all subsystems."""

import sys
import time
import logging
import config
from modules import (obd_reader, gps_reader, imu_reader,
                     geofence, kill_switch, mqtt_publisher)

# 1. Configure root logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("main")

# 2. Call obd_reader.start()
obd_reader.start()
# 3. Call gps_reader.start()
gps_reader.start()
# 4. Call imu_reader.start()
imu_reader.start()
# 5. Call mqtt_publisher.connect()
mqtt_publisher.connect()

# 6. Log INFO
logger.info(f"Fleet agent started — Vehicle ID: {config.VEHICLE_ID}")

try:
    while True:
        gps = gps_reader.get_gps_data()
        ecu = obd_reader.get_obd_data()
        imu = imu_reader.get_imu_data()
        geo = geofence.get_geofence_status()

        alert = None

        if gps["lat"] is not None and gps["lon"] is not None:
            geofence.check_geofence(gps["lat"], gps["lon"])
            if geofence.is_new_breach():
                alert = "GEOFENCE_BREACH"
                kill_switch.engage_kill()
                mqtt_publisher.publish_telemetry({
                    "vehicle_id": config.VEHICLE_ID,
                    "timestamp":  time.time(),
                    "alert":      "GEOFENCE_BREACH",
                    "lat":        gps["lat"],
                    "lon":        gps["lon"],
                })
                logger.info("Geofence breach handled — kill engaged, alert published")

        payload = {
            "vehicle_id": config.VEHICLE_ID,
            "timestamp":  time.time(),
            "gps": {
                "lat":        gps["lat"],
                "lon":        gps["lon"],
                "speed_ms":   gps["speed_ms"],
                "heading":    gps["heading"],
                "altitude":   gps["altitude"],
                "fix":        gps["fix"],
                "satellites": gps["satellites"],
            },
            "ecu": {
                "rpm":          ecu["rpm"],
                "speed_kmh":    ecu["speed_kmh"],
                "coolant_temp": ecu["coolant_temp"],
                "fuel_level":   ecu["fuel_level"],
                "throttle_pos": ecu["throttle_pos"],
                "engine_load":  ecu["engine_load"],
                "maf_gs":       ecu["maf_gs"],
                "intake_map":   ecu["intake_map"],
            },
            "imu": {
                "accel_x":            imu["accel_x"],
                "accel_y":            imu["accel_y"],
                "accel_z":            imu["accel_z"],
                "event":              imu["event"],
                "harsh_brake_count":  imu["harsh_brake_count"],
                "harsh_accel_count":  imu["harsh_accel_count"],
                "harsh_corner_count": imu["harsh_corner_count"],
            },
            "geofence": {
                "inside":           geo["inside"],
                "breach_count":     geo["breach_count"],
                "last_breach_time": geo["last_breach_time"],
            },
            "kill_status": kill_switch.get_kill_status(),
            "alert":       alert,
        }

        mqtt_publisher.publish_telemetry(payload)
        time.sleep(config.MAIN_LOOP_INTERVAL)

except KeyboardInterrupt:
    logger.info("Shutdown signal received — cleaning up")
    kill_switch.restore_power()
    kill_switch.cleanup()
    mqtt_publisher.disconnect()
    logger.info("Fleet agent stopped.")
    sys.exit(0)
except Exception as e:
    logger.error(f"Unexpected exception in main loop: {e}")
    kill_switch.restore_power()
    kill_switch.cleanup()
    mqtt_publisher.disconnect()
    sys.exit(1)
