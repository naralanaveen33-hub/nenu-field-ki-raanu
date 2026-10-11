"""
backend/serial_manager.py
Arduino USB Serial communication manager with automatic demo fallback.

Packet format received from Arduino:
MOISTURE:42,TEMP:30.5,HUM:68,MOTOR:0

Commands sent to Arduino:
MOTOR_ON
MOTOR_OFF
"""

import os
import time
import json
import math
import logging
import threading
from datetime import datetime
from backend.sensors import sensor_manager
from backend.motor import motor_controller

logger = logging.getLogger("SerialManager")

class SerialManager:
    def __init__(self):
        self.port = os.getenv("SERIAL_PORT", "/dev/ttyACM0")
        self.baud_rate = int(os.getenv("SERIAL_BAUD") or os.getenv("BAUD_RATE", "115200"))
        self.force_demo = os.getenv("DEMO_MODE", "true").lower() in ("true", "1", "yes")

        self.serial_conn = None
        self.is_connected = False
        self.last_valid_packet_at = None
        self.running = False
        self.worker_thread = None
        self.lock = threading.Lock()

    def start(self):
        """Start background monitoring thread."""
        self.running = True
        self.worker_thread = threading.Thread(target=self._run_loop, daemon=True)
        self.worker_thread.start()
        logger.info(f"SerialManager started. Force demo={self.force_demo}, Target port={self.port}")

    def stop(self):
        """Stop serial thread and close port."""
        self.running = False
        if self.serial_conn:
            try:
                self.serial_conn.close()
            except Exception:
                pass
            self.serial_conn = None
        self.is_connected = False
        self.last_valid_packet_at = None

    @property
    def has_recent_data(self):
        """Report live Arduino data only after a valid packet was parsed."""
        return (self.is_connected and self.last_valid_packet_at is not None
                and time.monotonic() - self.last_valid_packet_at < 30)

    def send_motor_command(self, action: str):
        """
        Send command to Arduino over Serial, or simulate acknowledgment if in demo mode.
        action: 'MOTOR_ON' or 'MOTOR_OFF'
        """
        action = action.strip().upper()
        if action not in ("MOTOR_ON", "MOTOR_OFF"):
            logger.error(f"Invalid motor command: {action}")
            return False

        with self.lock:
            if self.is_connected and self.serial_conn:
                try:
                    payload = f"{action}\n".encode("utf-8")
                    self.serial_conn.write(payload)
                    self.serial_conn.flush()
                    logger.info(f"Sent serial command to Arduino: {action}")
                    return True
                except Exception as e:
                    logger.warning(f"Failed to send to serial: {e}. Falling back to demo ACK.")

            if not self.force_demo:
                logger.error("Arduino command %s was not sent: serial data is unavailable", action)
                return False

            # Explicit demo mode only: simulate motor confirmation.
            target_state = 1 if action == "MOTOR_ON" else 0
            motor_controller.set_confirmed_state(target_state)
            sensor_manager.update_demo_step(target_state == 1)
            return True

    def _try_connect_serial(self):
        """Attempt to open physical serial port."""
        if self.force_demo:
            return False

        try:
            import serial
            self.serial_conn = serial.Serial(self.port, self.baud_rate, timeout=2)
            time.sleep(2)  # Wait for Arduino bootloader reset
            self.is_connected = True
            logger.info(f"Successfully connected to Arduino on {self.port} at {self.baud_rate} baud.")
            return True
        except Exception as e:
            logger.warning("Could not open Arduino serial port %s at %s baud: %s",
                           self.port, self.baud_rate, e)
            self.serial_conn = None
            self.is_connected = False
            return False

    def _parse_arduino_line(self, line: str):
        """
        Parse the existing Arduino JSON line protocol:
        {"soil":1008,"temperature":0.0,"humidity":0.0,"pump":0}
        Legacy labeled CSV packets remain supported.
        """
        try:
            if line == "SMARTFARM_READY":
                logger.info("Arduino startup banner received")
                return False

            if line.startswith("{"):
                packet = json.loads(line)
                required = ("soil", "temperature", "humidity", "pump")
                if not all(key in packet for key in required):
                    raise ValueError("Arduino JSON packet is missing required fields")
                values = {key: float(packet[key]) for key in required}
                if not all(math.isfinite(value) for value in values.values()):
                    raise ValueError("Arduino JSON packet contains a non-finite value")
                if values["soil"] < 0 or values["soil"] > 1023:
                    raise ValueError("Arduino soil ADC value is outside 0..1023")

                sensor_manager.update_from_arduino_json(
                    soil_raw=int(values["soil"]),
                    temp=values["temperature"],
                    hum=values["humidity"],
                    motor=int(values["pump"]),
                )
                motor_controller.set_confirmed_state(int(values["pump"]))
                self.last_valid_packet_at = time.monotonic()
                logger.info("Arduino JSON packet parsed: soil_adc=%s temperature=%s humidity=%s pump=%s",
                            int(values["soil"]), values["temperature"], values["humidity"], int(values["pump"]))
                return True

            parts = line.strip().split(",")
            data = {}
            for part in parts:
                if ":" in part:
                    k, v = part.split(":", 1)
                    data[k.strip().upper()] = float(v.strip())

            if "MOISTURE" in data and "TEMP" in data and "HUM" in data:
                moisture = data["MOISTURE"]
                temp = data["TEMP"]
                hum = data["HUM"]
                motor = int(data.get("MOTOR", 0))

                # Update live sensor readings
                sensor_manager.update_from_serial(moisture, temp, hum, motor)
                # Confirm motor state from hardware
                motor_controller.set_confirmed_state(motor)
                self.last_valid_packet_at = time.monotonic()
                logger.info("Arduino packet: moisture=%s temp=%s humidity=%s motor=%s",
                            moisture, temp, hum, motor)
                return True
        except Exception as e:
            logger.debug(f"Could not parse serial line '{line}': {e}")
        return False

    def _run_loop(self):
        """Continuous background loop with auto-reconnect and demo simulation fallback."""
        while self.running:
            if not self.force_demo and not self.is_connected:
                self._try_connect_serial()

            if self.is_connected and self.serial_conn:
                try:
                    line = self.serial_conn.readline().decode("utf-8", errors="ignore").strip()
                    if line:
                        if not self._parse_arduino_line(line):
                            logger.warning("Unrecognized Arduino serial line: %r", line[:160])
                    time.sleep(0.1)
                except Exception as e:
                    logger.warning(f"Serial read error: {e}. Reverting to demo mode.")
                    self.is_connected = False
                    self.last_valid_packet_at = None
                    if self.serial_conn:
                        try:
                            self.serial_conn.close()
                        except Exception:
                            pass
                        self.serial_conn = None
            else:
                if self.force_demo:
                    motor_status = motor_controller.get_status()["is_on"]
                    sensor_manager.update_demo_step(motor_status)
                time.sleep(2.0)

# Singleton serial manager
serial_manager = SerialManager()
