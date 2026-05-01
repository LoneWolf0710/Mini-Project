# fleet-agent/modules/imu_reader.py
"""MPU-6050 IMU reader for driver behaviour detection."""

import logging
import threading
import time
import smbus2
import config

logger = logging.getLogger("imu_reader")

_imu_data = {
    "accel_x": 0.0,
    "accel_y": 0.0,
    "accel_z": 0.0,
    "event": "normal",
    "harsh_brake_count": 0,
    "harsh_accel_count": 0,
    "harsh_corner_count": 0
}
_lock = threading.Lock()

def _read_word_2c(bus: smbus2.SMBus, addr: int, reg: int) -> int:
    try:
        high = bus.read_byte_data(addr, reg)
        low = bus.read_byte_data(addr, reg + 1)
        val = (high << 8) + low
        if val >= 0x8000:
            return -((65535 - val) + 1)
        else:
            return val
    except Exception as e:
        logger.error(f"I2C read error at register {hex(reg)}: {e}")
        return 0

def _poll_daemon() -> None:
    bus = None
    try:
        bus = smbus2.SMBus(1)
        bus.write_byte_data(0x68, 0x6B, 0x00)
        logger.info("MPU-6050 woken up on I2C bus 1, address 0x68")
    except Exception as e:
        logger.error(f"Failed to initialize MPU-6050: {e}")
        
    while True:
        try:
            if bus:
                ax_raw = _read_word_2c(bus, 0x68, 0x3B)
                ay_raw = _read_word_2c(bus, 0x68, 0x3D)
                az_raw = _read_word_2c(bus, 0x68, 0x3F)
                
                ax = ax_raw / 16384.0
                ay = ay_raw / 16384.0
                az = az_raw / 16384.0
                
                event = "normal"
                if ax < config.HARSH_BRAKE_THRESHOLD:
                    event = "harsh_brake"
                elif ax > config.HARSH_ACCEL_THRESHOLD:
                    event = "harsh_accel"
                elif abs(ay) > config.HARSH_CORNER_THRESHOLD:
                    event = "harsh_corner"
                    
                with _lock:
                    _imu_data["accel_x"] = ax
                    _imu_data["accel_y"] = ay
                    _imu_data["accel_z"] = az
                    _imu_data["event"] = event
                    
                    if event == "harsh_brake":
                        _imu_data["harsh_brake_count"] += 1
                    elif event == "harsh_accel":
                        _imu_data["harsh_accel_count"] += 1
                    elif event == "harsh_corner":
                        _imu_data["harsh_corner_count"] += 1
                        
        except Exception as e:
            logger.error(f"IMU reading error: {e}")
            
        time.sleep(config.IMU_POLL_INTERVAL)

def start() -> None:
    t = threading.Thread(target=_poll_daemon, daemon=True)
    t.start()

def get_imu_data() -> dict:
    with _lock:
        return dict(_imu_data)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    start()
    for _ in range(30):
        time.sleep(0.5)
        print(get_imu_data())
