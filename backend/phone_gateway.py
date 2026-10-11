"""
backend/phone_gateway.py
Xiaomi 11i 5G / GSM / Telecom IVR Phone Call Gateway Interface.

Provides deterministic DTMF IVR state machine execution alongside
asynchronous logging and hardware status verification.
"""

import os
import time
import queue
import logging
import threading
from datetime import datetime
from backend.dtmf_engine import dtmf_engine, DTMFState
from backend.telugu_assistant import handle_telugu_voice_call

logger = logging.getLogger("PhoneGateway")

class PhoneGateway:
    def __init__(self, serial_manager_instance=None):
        self.serial_manager = serial_manager_instance
        self.dtmf_engine = dtmf_engine
        self.call_queue = queue.Queue(maxsize=100)
        self.call_logs = []
        self.max_logs = 50
        self.lock = threading.Lock()
        self.enabled = os.getenv("PHONE_GATEWAY_ENABLED", "true").lower() in ("true", "1", "yes")
        self.device_model = "Xiaomi 11i 5G / GSM IVR Gateway"
        self.status = "READY"
        self.worker_thread = None
        self._running = False

    def start(self):
        """Start non-blocking call processing worker thread."""
        self._running = True
        self.worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
        self.worker_thread.start()
        logger.info(f"PhoneGateway worker started for device: {self.device_model}")

    def stop(self):
        self._running = False

    def process_dtmf_event(
        self,
        session_id: str = None,
        event: str = "DTMF_DIGIT",
        digit: str = None,
        caller_id: str = "Farmer Mobile (+91 98480 22338)",
        farm_id: str = None,
        test_flags: dict = None
    ) -> dict:
        """
        Execute deterministic DTMF phone state machine step.
        """
        start_ts = time.time()
        session = self.dtmf_engine.get_or_create_session(session_id, caller_id)
        if test_flags and isinstance(test_flags, dict):
            session.test_flags.update(test_flags)

        result = self.dtmf_engine.handle_event(
            session_id=session.session_id,
            event=event,
            digit=digit,
            caller_id=caller_id,
            farm_id_override=farm_id
        )
        duration_ms = round((time.time() - start_ts) * 1000, 1)

        log_entry = {
            "id": f"call_{int(time.time()*1000)}",
            "session_id": result["session_id"],
            "caller_id": caller_id or "Farmer Mobile",
            "gateway_device": self.device_model,
            "event": event,
            "digit": digit,
            "state": result["current_state"],
            "response_out": result["response_text"],
            "farm_id": result["farm_id"],
            "motor_status": result["motor_status"],
            "processing_time_ms": duration_ms,
            "timestamp": datetime.now().isoformat(),
            "status": "COMPLETED"
        }

        with self.lock:
            self.call_logs.insert(0, log_entry)
            if len(self.call_logs) > self.max_logs:
                self.call_logs.pop()

        result["processing_time_ms"] = duration_ms
        result["success"] = True
        result["caller_id"] = caller_id
        return result

    def process_incoming_call(self, caller_id: str, speech_text: str = None, **kwargs) -> dict:
        """
        Process incoming call via DTMF or fallback speech transcript.
        """
        # If digit or event is provided in kwargs, route directly to DTMF engine
        digit = kwargs.get("digit")
        event = kwargs.get("event")
        session_id = kwargs.get("session_id")
        farm_id = kwargs.get("farm_id")
        test_flags = kwargs.get("test_flags")

        if digit is not None or event is not None:
            return self.process_dtmf_event(
                session_id=session_id,
                event=event or "DTMF_DIGIT",
                digit=digit,
                caller_id=caller_id,
                farm_id=farm_id,
                test_flags=test_flags
            )

        # Check if speech_text contains single keypad digit
        clean_speech = str(speech_text or "").strip()
        if clean_speech in ("0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "#"):
            return self.process_dtmf_event(
                session_id=session_id,
                event="DTMF_DIGIT",
                digit=clean_speech,
                caller_id=caller_id,
                farm_id=farm_id,
                test_flags=test_flags
            )

        # Fallback to speech assistant logic if speech string was supplied
        start_ts = time.time()
        result = handle_telugu_voice_call(clean_speech, self.serial_manager)
        duration_ms = round((time.time() - start_ts) * 1000, 1)

        log_entry = {
            "id": f"call_{int(time.time()*1000)}",
            "caller_id": caller_id or "Farmer Mobile (+91 98xxx xxxxx)",
            "gateway_device": self.device_model,
            "transcript_in": clean_speech,
            "response_out": result["telugu_response"],
            "intent": result["intent"],
            "processing_time_ms": duration_ms,
            "timestamp": datetime.now().isoformat(),
            "status": "COMPLETED"
        }

        with self.lock:
            self.call_logs.insert(0, log_entry)
            if len(self.call_logs) > self.max_logs:
                self.call_logs.pop()

        return {
            "success": True,
            "caller_id": log_entry["caller_id"],
            "session_id": session_id or log_entry["id"],
            "current_state": "MAIN_MENU",
            "speech_in": clean_speech,
            "response_text": result["telugu_response"],
            "speech_out": result["telugu_response"],
            "language": "te",
            "farm_id": farm_id or "field-101",
            "pending_action": None,
            "motor_status": "ON" if result.get("telemetry_used", {}).get("motor_on") else "OFF",
            "intent": result["intent"],
            "processing_time_ms": duration_ms
        }

    def _worker_loop(self):
        """Background loop to process decoupled call batches if queued asynchronously."""
        while self._running:
            try:
                task = self.call_queue.get(timeout=1.0)
                caller_id, text = task
                self.process_incoming_call(caller_id, text)
                self.call_queue.task_done()
            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"Phone gateway queue worker error: {e}")

    def get_logs(self) -> list:
        with self.lock:
            return list(self.call_logs)

    def get_info(self) -> dict:
        return {
            "gateway_device": self.device_model,
            "status": self.status,
            "enabled": self.enabled,
            "queue_size": self.call_queue.qsize(),
            "total_calls_handled": len(self.call_logs)
        }

# Singleton instance
phone_gateway = PhoneGateway()

