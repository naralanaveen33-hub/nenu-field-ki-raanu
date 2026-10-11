"""
backend/sensors.py
Per-Farm Sensor Management: Farm -> Exactly One Sensor -> Telemetry.

ARCHITECTURAL REQUIREMENT:
Each farm has exactly ONE sensor data source.
Farm
└── One Sensor
    ├── Soil moisture
    ├── Temperature
    └── Humidity

Data Relationship:
farm_id -> sensor_id -> latest telemetry
"""

import os
import json
import time
import math
import random
import threading
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any
from backend.soil_calibration import moisture_percent

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SENSORS_FILE = PROJECT_ROOT / "data" / "sensors.json"
FIELDS_FILE = PROJECT_ROOT / "data" / "fields.json"


class SensorManager:
    """
    Manages exactly one sensor per farm.
    Tracks live Arduino hardware telemetry on designated hardware farm (sensor_1),
    and distinct individual sensor telemetry for each additional farm.
    """

    def __init__(self, demo_mode: bool = True):
        self.lock = threading.Lock()
        self.demo_mode = demo_mode
        self._soil_dry_adc = self._read_adc_calibration("SOIL_DRY_ADC")
        self._soil_wet_adc = self._read_adc_calibration("SOIL_WET_ADC")
        self._hardware_farm_id = "field-101"
        self._demo_step = 0
        self._sensors: Dict[str, dict] = {}  # farm_id -> sensor data dict
        self._init_sensors_store()

    @staticmethod
    def _read_adc_calibration(name: str) -> Optional[int]:
        try:
            value = os.getenv(name, "").strip()
            return int(value) if value else None
        except ValueError:
            return None

    def _init_sensors_store(self):
        """Load or create initial 1-to-1 farm-sensor records."""
        with self.lock:
            # 1. Load from SENSORS_FILE if exists
            if SENSORS_FILE.exists():
                try:
                    with open(SENSORS_FILE, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        if isinstance(data, dict):
                            self._sensors = data
                except Exception as e:
                    print(f"[SensorManager] Error loading sensors.json: {e}")

            # 2. Synchronize with fields from FIELDS_FILE
            fields = []
            if FIELDS_FILE.exists():
                try:
                    with open(FIELDS_FILE, "r", encoding="utf-8") as f:
                        fields = json.load(f)
                except Exception:
                    fields = []

            # Defaults for known seed farms if not present
            seed_defaults = {
                "field-101": {"sensor_id": "sensor_1", "moisture": 24.0, "temp": 31.7, "hum": 68.5, "is_hw": True},
                "field-102": {"sensor_id": "sensor_2", "moisture": 45.2, "temp": 33.8, "hum": 54.0, "is_hw": False},
                "field_1791681266750": {"sensor_id": "sensor_3", "moisture": 36.5, "temp": 30.5, "hum": 62.0, "is_hw": False},
                "field_1791681929527": {"sensor_id": "sensor_4", "moisture": 21.5, "temp": 32.5, "hum": 66.0, "is_hw": False},
                "field_1791683727206": {"sensor_id": "sensor_5", "moisture": 55.0, "temp": 29.5, "hum": 70.0, "is_hw": False},
                "field_1791684673379": {"sensor_id": "sensor_6", "moisture": 27.0, "temp": 32.0, "hum": 63.0, "is_hw": False},
            }

            for idx, field in enumerate(fields, 1):
                fid = field.get("id")
                if not fid:
                    continue

                if fid not in self._sensors:
                    sensor_id = field.get("sensor_id") or seed_defaults.get(fid, {}).get("sensor_id") or f"sensor_{idx}"
                    cfg = seed_defaults.get(fid, {
                        "sensor_id": sensor_id,
                        "moisture": round(random.uniform(25.0, 50.0), 1),
                        "temp": round(random.uniform(28.0, 33.0), 1),
                        "hum": round(random.uniform(50.0, 70.0), 1),
                        "is_hw": (fid == self._hardware_farm_id)
                    })

                    self._sensors[fid] = {
                        "sensor_id": sensor_id,
                        "farm_id": fid,
                        "name": f"Sensor ({field.get('name', 'Farm')})",
                        "moisture": cfg["moisture"],
                        "temperature": cfg["temp"],
                        "humidity": cfg["hum"],
                        "motor": 0,
                        "is_hardware": cfg.get("is_hw", False),
                        "is_demo": self.demo_mode,
                        "last_updated": datetime.now().isoformat(),
                        "source": "arduino" if cfg.get("is_hw") and not self.demo_mode else "sensor"
                    }

            self._save_to_disk_locked()

    def _save_to_disk_locked(self):
        """Save sensors mapping to JSON file (must hold self.lock)."""
        try:
            SENSORS_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(SENSORS_FILE, "w", encoding="utf-8") as f:
                json.dump(self._sensors, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"[SensorManager] Error saving sensors.json: {e}")

    def register_farm(self, farm_id: str, sensor_id: Optional[str] = None, farm_name: str = "") -> dict:
        """Register a new farm with its single unique sensor."""
        with self.lock:
            if farm_id in self._sensors:
                return dict(self._sensors[farm_id])

            sid = sensor_id or f"sensor_{len(self._sensors) + 1}"
            new_sensor = {
                "sensor_id": sid,
                "farm_id": farm_id,
                "name": f"Sensor ({farm_name or farm_id})",
                "moisture": 32.5,
                "temperature": 30.8,
                "humidity": 62.0,
                "motor": 0,
                "is_hardware": False,
                "is_demo": self.demo_mode,
                "last_updated": datetime.now().isoformat(),
                "source": "sensor"
            }
            self._sensors[farm_id] = new_sensor
            self._save_to_disk_locked()
            return dict(new_sensor)

    def remove_farm(self, farm_id: str) -> bool:
        """Remove the sensor record for a deleted farm."""
        with self.lock:
            if farm_id not in self._sensors:
                return False
            del self._sensors[farm_id]
            self._save_to_disk_locked()
            return True

    def get_sensor_for_farm(self, farm_id: Optional[str]) -> Optional[dict]:
        """
        Return the single sensor data for the specified farm_id.
        If farm_id is None, empty, or not found, returns None.
        CRITICAL: Never silently returns another farm's sensor.
        """
        if not farm_id or not str(farm_id).strip():
            return None

        clean_id = str(farm_id).strip()
        with self.lock:
            if clean_id in self._sensors:
                return dict(self._sensors[clean_id])
            
            # Check by sensor_id if caller passed sensor_id
            for fid, sdata in self._sensors.items():
                if sdata.get("sensor_id") == clean_id:
                    return dict(sdata)

            return None

    def get_sensors(self, farm_id: Optional[str] = None) -> Optional[dict]:
        """
        Fetch sensor readings.
        Requires farm_id to return sensor readings. If farm_id is omitted, returns None.
        """
        return self.get_sensor_for_farm(farm_id)

    def get_all_sensors(self) -> Dict[str, dict]:
        """Return snapshot of all registered farm sensors."""
        with self.lock:
            return {fid: dict(data) for fid, data in self._sensors.items()}

    def update_from_serial(self, moisture: float, temp: float, hum: float, motor: int):
        """Update the hardware-associated farm sensor from Arduino serial stream."""
        with self.lock:
            target_fid = self._hardware_farm_id
            if target_fid in self._sensors:
                self._sensors[target_fid].update({
                    "moisture": round(float(moisture), 1),
                    "temperature": round(float(temp), 1),
                    "humidity": round(float(hum), 1),
                    "motor": int(motor),
                    "is_hardware": True,
                    "is_demo": False,
                    "last_updated": datetime.now().isoformat(),
                    "source": "arduino"
                })
                self._save_to_disk_locked()

    def update_from_arduino_json(self, soil_raw: int, temp: float, hum: float, motor: int):
        """Store Arduino JSON values and calibrated relative soil moisture."""
        with self.lock:
            target_fid = self._hardware_farm_id
            if target_fid in self._sensors:
                self._sensors[target_fid].update({
                    "moisture": moisture_percent(soil_raw, self._soil_dry_adc, self._soil_wet_adc),
                    "soil_raw": int(soil_raw),
                    "temperature": float(temp),
                    "humidity": float(hum),
                    "motor": int(motor),
                    "is_hardware": True,
                    "is_demo": False,
                    "last_updated": datetime.now().isoformat(),
                    "source": "arduino_json",
                })
                self._save_to_disk_locked()

    def update_demo_step(self, motor_active: bool):
        """
        Advance demo physics for the hardware sensor:
        - If motor is active: moisture increases (+1.2% per update up to 80%)
        - If motor is off: moisture slowly dries down (-0.2% per update down to 24%)
        """
        with self.lock:
            target_fid = self._hardware_farm_id
            if target_fid not in self._sensors:
                return

            hw_sensor = self._sensors[target_fid]
            current_moisture = hw_sensor["moisture"]
            if motor_active:
                current_moisture = min(82.0, current_moisture + 1.2)
            else:
                current_moisture = max(24.0, current_moisture - 0.2)

            self._demo_step += 1
            temp = 31.0 + 2.0 * math.sin(self._demo_step * 0.1) + random.uniform(-0.2, 0.2)
            hum = 65.0 - 5.0 * math.sin(self._demo_step * 0.1) + random.uniform(-0.3, 0.3)

            hw_sensor.update({
                "moisture": round(current_moisture, 1),
                "temperature": round(temp, 1),
                "humidity": round(hum, 1),
                "motor": 1 if motor_active else 0,
                "last_updated": datetime.now().isoformat(),
                "source": "demo"
            })

            # Also slowly simulate any other farm with active motor
            for fid, sdata in self._sensors.items():
                if fid != target_fid and sdata.get("motor") == 1:
                    sdata["moisture"] = min(80.0, sdata["moisture"] + 1.0)
                    sdata["last_updated"] = datetime.now().isoformat()

    def set_motor_state(self, farm_id: str, is_on: bool):
        """Set motor state for a specific farm's sensor."""
        with self.lock:
            if farm_id in self._sensors:
                self._sensors[farm_id]["motor"] = 1 if is_on else 0
                self._sensors[farm_id]["last_updated"] = datetime.now().isoformat()
                self._save_to_disk_locked()

    def update_arduino_motor_status(self, is_on: int):
        """Apply Arduino's command acknowledgment without refreshing sensor timestamps."""
        with self.lock:
            sensor = self._sensors.get(self._hardware_farm_id)
            if sensor is None:
                return
            sensor.update({
                "motor": 1 if int(is_on) else 0,
                "is_hardware": True,
                "is_demo": False,
            })
            self._save_to_disk_locked()


# Singleton SensorManager instance
sensor_manager = SensorManager(demo_mode=True)
