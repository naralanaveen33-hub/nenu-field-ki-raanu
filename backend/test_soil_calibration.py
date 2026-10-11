import unittest

from backend.soil_calibration import moisture_percent


class SoilCalibrationTests(unittest.TestCase):
    def test_dry_endpoint_is_zero_percent(self):
        self.assertEqual(moisture_percent(1000, 1000, 600), 0.0)

    def test_wet_endpoint_is_one_hundred_percent(self):
        self.assertEqual(moisture_percent(600, 1000, 600), 100.0)

    def test_midpoint_is_fifty_percent(self):
        self.assertEqual(moisture_percent(800, 1000, 600), 50.0)

    def test_values_outside_calibration_range_are_clamped(self):
        self.assertEqual(moisture_percent(1003, 1000, 600), 0.0)
        self.assertEqual(moisture_percent(500, 1000, 600), 100.0)

    def test_invalid_or_missing_calibration_is_not_reported_as_percent(self):
        self.assertIsNone(moisture_percent(800, None, 600))
        self.assertIsNone(moisture_percent(800, 600, 600))
        self.assertIsNone(moisture_percent(1100, 1000, 600))


if __name__ == "__main__":
    unittest.main()
