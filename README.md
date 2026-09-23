# SmartFarm Voice (స్మార్ట్‌ఫామ్ వాయిస్)

A production-ready smart agriculture monitoring, Telugu voice assistant, and intelligent irrigation platform designed for smallholder and commercial farmers.

---

## 🌾 Highlights & Capabilities

- **Mobile-First Dashboard (Next.js & Vercel)**:
  - Clean, modern, responsive agricultural interface with native Telugu and English localization.
  - Real-time telemetry monitoring: Soil Moisture, Temperature, Humidity, and Gateway connectivity.
  - Open-Meteo satellite weather forecast integration with rain probability and hourly outlook.
  - Interactive SVG historical analytics across 24 Hours, 7 Days, and 30 Days.
- **Intelligent Irrigation Recommendation Engine**:
  - Evaluates multi-factor conditions: Soil moisture + rain forecast + recent watering cooldown.
  - Clear bilingual explanations in Telugu and English.
  - **Strict Safety Guarantee**: Never activates water pumps without explicit farmer confirmation.
- **Telugu Push-to-Talk Voice Assistant**:
  - Web Speech API (`te-IN`) integration for speech-to-text.
  - Phonetic NLP parser for common agricultural phrases ("తేమ ఎంత ఉంది?", "పంప్ ఆన్ చేయి", "వర్షం పడుతుందా?").
  - Spoken audio feedback directly from phone speakers via SpeechSynthesis.
- **Common Command Architecture**:
  - Web UI buttons, Telugu voice, and VoIP confirmations all route through the same unified command layer with rate-limiting, duration caps (max 15 mins), and cooldown timers.
- **Internet VoIP Calling Abstraction (`VoiceCallProvider`)**:
  - Designed for future automated calling without requiring GSM.
  - Includes interactive in-browser VoIP call simulation with incoming ringtone, spoken Telugu dialogue, and hands-free confirmation.
  - Extensible Twilio Voice adapter ready for deployment.
- **Raspberry Pi 5 Field Gateway (Python)**:
  - Modular services: `sensor_gateway.py`, `arduino_comm.py`, `irrigation.py`, `offline_buffer.py`.
  - Offline-first resilience: Buffers readings in local SQLite when rural internet drops; syncs in batches upon reconnection.
  - Strict local pump safety engine: Enforces 15-minute runtime caps and 10-minute cooldown periods regardless of internet status.
- **Arduino Sensor Controller (C++)**:
  - Reads DHT22 temperature/humidity and calibrated analog soil moisture sensor with running-average smoothing.
  - Controls 5V optocoupled relay module.
  - Hardware watchdog timer: Auto shut-off failsafe if serial communication drops for 10 minutes.
- **Interactive Live Demo Mode**:
  - Test all features immediately in your browser without needing physical hardware plugged in.

---

## 📐 System Architecture

```
Mobile Browser (PWA)
       ↓  (HTTPS / WSS)
Vercel Next.js 16 Application
       ↓  (PostgreSQL + RLS + Realtime)
Supabase Cloud
       ↓  (REST / WebSocket)
Raspberry Pi 5 Field Gateway (Python)
       ↓  (USB-Serial 115200 Baud JSON)
Arduino Controller (C++)
       ↓  (GPIO / ADC)
DHT22 + Soil Moisture Sensor + 5V Relay Module
       ↓
Magnetic Contactor → High-Voltage Water Pump
```

---

## 🚀 Quick Start & Development

### 1. Web Dashboard (Next.js)

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) on your desktop or mobile browser.

- **Demo Mode**: Enabled by default when Supabase keys are not present.
- **Test Telugu Voice**: Tap the **TALK (టాక్)** button or click any of the Telugu suggestion chips.
- **Test Recommendation**: Open the **Demo Settings (⚙️)** drawer, drag soil moisture below 25%, and observe the instant recommendation and confirmation prompt.
- **Test VoIP Call**: Click **ఫోన్ కాల్ అలర్ట్ (VoIP Call)** in the navbar to experience an automated incoming internet voice call.

### 2. Raspberry Pi 5 Gateway (Python)

```bash
cd pi
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run unit tests
python3 test_gateway.py

# Run mock hardware gateway for testing on PC/Mac
python3 sensor_gateway.py
```

### 3. Arduino Firmware

1. Open `arduino/smartfarm/smartfarm.ino` in the Arduino IDE.
2. Install libraries: `DHT sensor library` and `ArduinoJson`.
3. Select board `Arduino Uno` and upload to your board.

---

## ⚡ Electrical & Relay Safety Notice

> [!CAUTION]
> - Never wire 230V AC irrigation pumps directly to low-voltage 5V PCB relays.
> - The 5V relay should exclusively energize the **coil of an industrial magnetic contactor (e.g., 25A/40A AC-3 rated)**.
> - Install an Emergency Stop (E-Stop) switch in series with the contactor coil.
> - Use an IP65 waterproof outdoor enclosure.
> - Consult [docs/hardware.md](docs/hardware.md) for full schematics and pinouts.

---

## 📁 Repository Structure

```
.
├── web/                       # Next.js App Router, Tailwind CSS, TypeScript
│   ├── app/                   # App routes & API endpoints
│   ├── components/            # Telemetry, Pump, Voice, Calling, Demo UI
│   ├── lib/                   # Supabase, Open-Meteo, Recommendation & NLP engines
│   └── types/                 # Data models & interfaces
├── supabase/
│   ├── migrations/            # SQL DDL, 8 tables, RLS policies, realtime
│   └── seed.sql               # Seed data for development
├── pi/                        # Raspberry Pi 5 Python Gateway
│   ├── sensor_gateway.py      # Master gateway service
│   ├── irrigation.py          # Local safety watchdog & cooldown engine
│   ├── offline_buffer.py      # SQLite local queue
│   ├── arduino_comm.py        # USB serial driver
│   └── test_gateway.py        # Unit test suite
├── arduino/
│   └── smartfarm/
│       ├── smartfarm.ino      # Arduino controller firmware
│       └── config.h           # Pinouts and watchdog limits
├── docs/                      # Comprehensive technical documentation
│   ├── architecture.md
│   ├── api.md
│   ├── hardware.md
│   └── setup.md
└── .env.example               # Master configuration template
```

---

## 📜 License & Compliance

Designed and built for smart agriculture automation. Works locally offline and scales smoothly with cloud synchronization.
# nenu-field-ki-raanu
