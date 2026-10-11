"""Convert a soil probe's ADC reading to a calibrated relative percentage."""

from typing import Optional


def moisture_percent(raw_adc: int, dry_adc: Optional[int], wet_adc: Optional[int]) -> Optional[float]:
    """Map the configured dry and wet calibration endpoints to 0..100%."""
    if dry_adc is None or wet_adc is None:
        return None
    if not (0 <= raw_adc <= 1023 and 0 <= dry_adc <= 1023 and 0 <= wet_adc <= 1023):
        return None
    if dry_adc == wet_adc:
        return None

    relative = 100.0 * (dry_adc - raw_adc) / (dry_adc - wet_adc)
    return round(max(0.0, min(100.0, relative)), 1)
