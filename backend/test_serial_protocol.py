import unittest
from unittest.mock import patch

from backend.motor import motor_controller
from backend.sensors import sensor_manager
from backend.serial_manager import SerialManager


class FakeSerial:
    def __init__(self):
        self.writes = []

    def write(self, payload):
        self.writes.append(payload)

    def flush(self):
        pass


class ArduinoSerialProtocolTests(unittest.TestCase):
    def test_internal_motor_actions_use_the_existing_pump_command_protocol(self):
        manager = SerialManager()
        fake_serial = FakeSerial()
        manager.force_demo = False
        manager.is_connected = True
        manager.serial_conn = fake_serial

        self.assertTrue(manager.send_motor_command("MOTOR_ON"))
        self.assertTrue(manager.send_motor_command("MOTOR_OFF"))
        self.assertEqual(fake_serial.writes, [b"PUMP_ON\n", b"PUMP_OFF\n"])

    def test_pump_acknowledgment_updates_verified_motor_state(self):
        manager = SerialManager()
        with patch.object(sensor_manager, "update_arduino_motor_status") as update_sensor, \
             patch.object(motor_controller, "set_confirmed_state") as update_controller:
            parsed = manager._parse_arduino_line(
                '{"ok":true,"command":"PUMP_ON","pump":1}'
            )

        self.assertTrue(parsed)
        self.assertEqual(manager.packet_sequence, 1)
        update_sensor.assert_called_once_with(1)
        update_controller.assert_called_once_with(1)


if __name__ == "__main__":
    unittest.main()
