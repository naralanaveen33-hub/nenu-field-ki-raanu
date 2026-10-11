import unittest
from unittest.mock import PropertyMock, patch

from backend.app import app
from backend.motor import motor_controller
from backend.sensors import sensor_manager
from backend.serial_manager import serial_manager


class LiveMotorApiTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        self.sensor = {
            "farm_id": "field-101",
            "is_hardware": True,
            "motor": 0,
            "moisture": 25.0,
            "source": "arduino_json",
        }
        self.sensor_lookup = patch.object(
            sensor_manager, "get_sensor_for_farm", side_effect=lambda *_args: dict(self.sensor)
        )
        self.sensor_lookup.start()
        self.set_motor = patch.object(sensor_manager, "set_motor_state")
        self.set_motor_mock = self.set_motor.start()
        self.send = patch.object(serial_manager, "send_motor_command", return_value=True)
        self.send_mock = self.send.start()
        self.request_on = patch.object(motor_controller, "request_motor_on")
        self.request_on_mock = self.request_on.start()
        self.request_off = patch.object(motor_controller, "request_motor_off")
        self.request_off_mock = self.request_off.start()
        self.force_demo = patch.object(serial_manager, "force_demo", False)
        self.force_demo.start()
        self.sequence = patch.object(serial_manager, "packet_sequence", 23)
        self.sequence.start()
        self.recent_data = patch.object(
            type(serial_manager), "has_recent_data", new_callable=PropertyMock, return_value=True
        )
        self.recent_data.start()
        self.addCleanup(patch.stopall)

    def test_live_command_requires_explicit_confirmation(self):
        response = self.client.post("/api/motor/on", json={"farm_id": "field-101"})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json["error"], "explicit_confirmation_required")
        self.send_mock.assert_not_called()

    def test_live_command_is_rejected_without_recent_arduino_data(self):
        with patch.object(type(serial_manager), "has_recent_data", new_callable=PropertyMock, return_value=False):
            response = self.client.post(
                "/api/motor/on", json={"farm_id": "field-101", "confirmed": True}
            )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json["error"], "arduino_not_live")
        self.send_mock.assert_not_called()

    def test_live_command_reports_pending_until_fresh_arduino_packet(self):
        response = self.client.post(
            "/api/motor/on", json={"farm_id": "field-101", "confirmed": True}
        )

        self.assertEqual(response.status_code, 202)
        self.assertTrue(response.json["success"])
        self.assertTrue(response.json["motor"]["pending"])
        self.assertFalse(response.json["motor"]["is_on"])
        self.assertEqual(response.json["packet_sequence"], 23)
        self.send_mock.assert_called_once_with("MOTOR_ON")
        self.request_on_mock.assert_called_once_with("farmer_dashboard")
        self.set_motor_mock.assert_not_called()

    def test_live_command_does_not_mark_motor_state_when_serial_write_fails(self):
        self.send_mock.return_value = False
        response = self.client.post(
            "/api/motor/off", json={"farm_id": "field-101", "confirmed": True}
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json["error"], "motor_command_failed")
        self.request_off_mock.assert_not_called()
        self.set_motor_mock.assert_not_called()

    def test_motor_start_is_blocked_at_high_moisture(self):
        self.sensor["moisture"] = 75.0

        response = self.client.post(
            "/api/motor/on", json={"farm_id": "field-101", "confirmed": True}
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json["error"], "soil_moisture_sufficient")
        self.send_mock.assert_not_called()
        self.request_on_mock.assert_not_called()

    def test_motor_start_is_blocked_when_calibrated_moisture_is_missing(self):
        self.sensor["moisture"] = None

        response = self.client.post(
            "/api/motor/on", json={"farm_id": "field-101", "confirmed": True}
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json["error"], "soil_moisture_unavailable")
        self.send_mock.assert_not_called()
        self.request_on_mock.assert_not_called()


if __name__ == "__main__":
    unittest.main()
