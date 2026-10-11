"""
backend/weather.py
Weather provider supporting OpenWeatherMap API, Open-Meteo free API, and reliable Demo Fallback.
"""

import os
import requests
import logging
from datetime import datetime

logger = logging.getLogger("Weather")

class WeatherService:
    def __init__(self):
        self.api_key = os.getenv("WEATHER_API_KEY", "").strip()
        self.lat = float(os.getenv("WEATHER_LAT", "17.3850"))
        self.lon = float(os.getenv("WEATHER_LON", "78.4867"))
        self.city = os.getenv("WEATHER_CITY", "Telangana Regional Farm")
        self._cached_weather = None
        self._last_fetch_time = 0
        self.cache_ttl = 300  # 5 minutes cache

    def get_weather(self) -> dict:
        """Fetch real or demo weather data with caching."""
        import time
        now = time.time()
        if self._cached_weather and (now - self._last_fetch_time < self.cache_ttl):
            return self._cached_weather

        # 1. If OpenWeatherMap API Key is configured, try it
        if self.api_key:
            data = self._fetch_openweathermap()
            if data:
                self._cached_weather = data
                self._last_fetch_time = now
                return data

        # 2. Try Open-Meteo (free open weather API, no API key needed)
        data = self._fetch_openmeteo()
        if data:
            self._cached_weather = data
            self._last_fetch_time = now
            return data

        # 3. Fallback to realistic demo weather
        data = self._get_demo_weather()
        self._cached_weather = data
        self._last_fetch_time = now
        return data

    def _fetch_openweathermap(self):
        try:
            url = f"https://api.openweathermap.org/data/2.5/weather?lat={self.lat}&lon={self.lon}&appid={self.api_key}&units=metric"
            resp = requests.get(url, timeout=3)
            if resp.status_code == 200:
                json_data = resp.json()
                temp = json_data.get("main", {}).get("temp", 31.0)
                hum = json_data.get("main", {}).get("humidity", 60)
                weather_desc = json_data.get("weather", [{}])[0].get("main", "Clear")
                # OpenWeatherMap current weather doesn't provide rain pop in basic free tier, infer from clouds/weather
                clouds = json_data.get("clouds", {}).get("all", 20)
                rain_prob = 75 if "rain" in weather_desc.lower() else int(clouds * 0.7)

                return {
                    "temperature": round(temp, 1),
                    "humidity": int(hum),
                    "rain_probability": rain_prob,
                    "condition": weather_desc,
                    "city": json_data.get("name", self.city),
                    "forecast": self._generate_forecast_slots(temp, rain_prob),
                    "is_demo": False,
                    "source": "OpenWeatherMap",
                    "last_updated": datetime.now().isoformat()
                }
        except Exception as e:
            logger.warning(f"OpenWeatherMap fetch failed: {e}")
        return None

    def _fetch_openmeteo(self):
        try:
            url = (
                f"https://api.open-meteo.com/v1/forecast?"
                f"latitude={self.lat}&longitude={self.lon}&"
                f"current=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code&"
                f"hourly=temperature_2m,precipitation_probability&forecast_days=1"
            )
            resp = requests.get(url, timeout=3)
            if resp.status_code == 200:
                d = resp.json()
                cur = d.get("current", {})
                temp = cur.get("temperature_2m", 31.5)
                hum = cur.get("relative_humidity_2m", 62)
                rain_prob = cur.get("precipitation_probability", 25)

                # Format hourly forecast
                hourly = d.get("hourly", {})
                times = hourly.get("time", [])[:6]
                temps = hourly.get("temperature_2m", [])[:6]
                rain_probs = hourly.get("precipitation_probability", [])[:6]

                forecast = []
                for i in range(len(times)):
                    t_str = times[i].split("T")[-1][:5] if "T" in times[i] else f"+{i}h"
                    forecast.append({
                        "time": t_str,
                        "temp": round(temps[i], 1) if i < len(temps) else temp,
                        "rain_prob": int(rain_probs[i]) if i < len(rain_probs) else rain_prob
                    })

                code = cur.get("weather_code", 0)
                condition = "Clear Sky"
                if code in (1, 2, 3):
                    condition = "Partly Cloudy"
                elif code in (51, 53, 55, 61, 63, 65):
                    condition = "Rain / Showers"
                elif code in (95, 96):
                    condition = "Thunderstorm"

                return {
                    "temperature": round(temp, 1),
                    "humidity": int(hum),
                    "rain_probability": int(rain_prob),
                    "condition": condition,
                    "city": self.city,
                    "forecast": forecast if forecast else self._generate_forecast_slots(temp, rain_prob),
                    "is_demo": False,
                    "source": "Open-Meteo Live",
                    "last_updated": datetime.now().isoformat()
                }
        except Exception as e:
            logger.debug(f"Open-Meteo fetch failed: {e}")
        return None

    def _get_demo_weather(self) -> dict:
        """High-fidelity demo weather data for local testing & demos."""
        return {
            "temperature": 32.4,
            "humidity": 65,
            "rain_probability": 28,
            "condition": "Partly Cloudy (వేడిగా మరియు కొద్దిగా మేఘావృతం)",
            "city": f"{self.city} (Demo)",
            "forecast": [
                {"time": "Next 1h", "temp": 33.1, "rain_prob": 25},
                {"time": "Next 2h", "temp": 33.8, "rain_prob": 30},
                {"time": "Next 3h", "temp": 32.5, "rain_prob": 35},
                {"time": "Next 4h", "temp": 31.0, "rain_prob": 40},
                {"time": "Evening", "temp": 28.5, "rain_prob": 55}
            ],
            "is_demo": True,
            "source": "Demo Simulation",
            "last_updated": datetime.now().isoformat()
        }

    def _generate_forecast_slots(self, base_temp, base_rain):
        return [
            {"time": "Next 1h", "temp": round(base_temp + 0.5, 1), "rain_prob": min(100, max(0, base_rain - 5))},
            {"time": "Next 2h", "temp": round(base_temp + 1.2, 1), "rain_prob": base_rain},
            {"time": "Next 3h", "temp": round(base_temp - 0.4, 1), "rain_prob": min(100, max(0, base_rain + 10))},
            {"time": "Evening", "temp": round(base_temp - 2.5, 1), "rain_prob": min(100, max(0, base_rain + 15))}
        ]

# Singleton weather service
weather_service = WeatherService()
