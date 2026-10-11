"""
backend/motor.py
Relay and water motor controller with safety guarantees.

Safety Guarantees:
1. Never claim the motor is ON unless Arduino (or verified demo simulator) confirms it.
2. Never automatically start the physical motor from the recommendation engine.
3. Motor activation requires explicit farmer action.
"""

import threading
import time
from datetime import datetime

class MotorController:
    def __init__(self):
        self.lock = threading.Lock()
        self.confirmed_state = 0   # 0 = OFF, 1 = ON (only confirmed from Arduino or demo ACK)
        self.requested_state = 0   # 0 = OFF, 1 = ON
        self.last_command_time = None
        self.last_action_by = "System Init"
        self.total_runtime_seconds = 0
        self._start_time = None

    def request_motor_on(self, triggered_by: str = "farmer") -> dict:
        """
        Request motor activation. Requires explicit farmer action.
        Sends command to Arduino via serial or demo simulator.
        """
        with self.lock:
            self.requested_state = 1
            self.last_command_time = datetime.now().isoformat()
            self.last_action_by = triggered_by
            return {
                "success": True,
                "requested": "ON",
                "confirmed_state": "ON" if self.confirmed_state == 1 else "PENDING_CONFIRMATION",
                "triggered_by": triggered_by,
                "timestamp": self.last_command_time
            }

    def request_motor_off(self, triggered_by: str = "farmer") -> dict:
        """
        Request motor shutdown. Requires explicit farmer action.
        """
        with self.lock:
            self.requested_state = 0
            self.last_command_time = datetime.now().isoformat()
            self.last_action_by = triggered_by
            if self._start_time:
                self.total_runtime_seconds += time.time() - self._start_time
                self._start_time = None

            return {
                "success": True,
                "requested": "OFF",
                "confirmed_state": "OFF" if self.confirmed_state == 0 else "PENDING_CONFIRMATION",
                "triggered_by": triggered_by,
                "timestamp": self.last_command_time
            }

    def set_confirmed_state(self, is_on: int):
        """
        Only called when Arduino explicitly sends confirmation in serial stream
        (e.g., MOTOR:1 or MOTOR:0) or demo loop validates it.
        """
        with self.lock:
            prev = self.confirmed_state
            self.confirmed_state = 1 if is_on else 0

            if prev == 0 and self.confirmed_state == 1:
                self._start_time = time.time()
            elif prev == 1 and self.confirmed_state == 0 and self._start_time:
                self.total_runtime_seconds += time.time() - self._start_time
                self._start_time = None

    def get_status(self) -> dict:
        """Return verified motor status."""
        with self.lock:
            is_active = (self.confirmed_state == 1)
            current_run = 0
            if is_active and self._start_time:
                current_run = int(time.time() - self._start_time)

            return {
                "is_on": is_active,
                "status_text": "RUNNING" if is_active else "STOPPED",
                "confirmed_state": self.confirmed_state,
                "requested_state": self.requested_state,
                "last_action_by": self.last_action_by,
                "last_command_time": self.last_command_time,
                "current_session_seconds": current_run,
                "total_runtime_seconds": int(self.total_runtime_seconds + current_run)
            }

# Singleton instance
motor_controller = MotorController()
