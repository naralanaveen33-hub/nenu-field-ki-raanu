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
import logging
import threading
from datetime import datetime
from backend.sensors import sensor_manager
from backend.motor import motor_controller

logger = logging.getLogger("SerialManager")

class SerialManager:
    def __init__(self):
        self.port = os.getenv("SERIAL_PORT", "/dev/ttyACM0")
        self.baud_rate = int(os.getenv("SERIAL_BAUD") or os.getenv("BAUD_RATE", "9600"))
        self.force_demo = os.getenv("DEMO_MODE", "true").lower() in ("true", "1", "yes")

        self.serial_conn = None
        self.is_connected = False
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

            # If Arduino is disconnected or demo mode is on, simulate motor confirmation
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
            self.serial_conn = None
            self.is_connected = False
            return False

    def _parse_arduino_line(self, line: str):
        """
        Parse line: MOISTURE:42,TEMP:30.5,HUM:68,MOTOR:0
        """
        try:
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
                        self._parse_arduino_line(line)
                    time.sleep(0.1)
                except Exception as e:
                    logger.warning(f"Serial read error: {e}. Reverting to demo mode.")
                    self.is_connected = False
                    if self.serial_conn:
                        try:
                            self.serial_conn.close()
                        except Exception:
                            pass
                        self.serial_conn = None
            else:
                # Disconnected or Demo Mode: generate smooth dynamic demo values
                motor_status = motor_controller.get_status()["is_on"]
                sensor_manager.update_demo_step(motor_status)
                time.sleep(2.0)

# Singleton serial manager
serial_manager = SerialManager()
