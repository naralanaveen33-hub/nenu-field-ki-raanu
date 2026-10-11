"""
backend/app.py
Main Flask Application for Smart Farm Irrigation System.

ARCHITECTURE:
Each farm has exactly ONE sensor data source.
Farm
└── One Sensor
    ├── Soil moisture
    ├── Temperature
    └── Humidity

Data Relationship:
farm_id -> sensor_id -> latest telemetry
"""

import os
import sys
import json
import time
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Load environment configuration
load_dotenv(PROJECT_ROOT / ".env")

from flask import Flask, jsonify, request, send_from_directory, Response
from backend.sensors import sensor_manager
from backend.motor import motor_controller
from backend.serial_manager import serial_manager
from backend.weather import weather_service
from backend.irrigation import evaluate_irrigation
from backend.chatbot import process_chat_message
from backend.grok import ask_grok, is_grok_configured
from backend.phone_gateway import phone_gateway

app = Flask(__name__, static_folder=str(PROJECT_ROOT / "frontend"), static_url_path="")
START_TIME = time.time()
FIELDS_FILE = PROJECT_ROOT / "data" / "fields.json"

# Configure CORS for Vercel frontend origin
cors_origins_env = os.getenv("CORS_ORIGINS", "")
custom_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
allowed_origins = custom_origins or [
    "https://nenu-field-ki-raanu.vercel.app",
    "https://nenu-field-ki-raanu-rio8y49y5-naralanaveen33-hubs-projects.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

try:
    from flask_cors import CORS
    CORS(app, resources={r"/api/*": {"origins": allowed_origins + [r"https://.*\.vercel\.app"]}}, supports_credentials=True)
except ImportError:
    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get("Origin")
        if origin and (origin in allowed_origins or origin.endswith(".vercel.app") or "localhost" in origin):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

# Connect phone gateway with serial manager
phone_gateway.serial_manager = serial_manager


def load_fields_list() -> list:
    if not FIELDS_FILE.exists():
        return []
    try:
        with open(FIELDS_FILE, "r", encoding="utf-8") as f:
            fields = json.load(f)
            return fields if isinstance(fields, list) else []
    except Exception:
        return []

def get_field_by_id(field_id: str):
    if not field_id:
        return None
    for f in load_fields_list():
        if f.get("id") == field_id:
            return f
    return None

def calculate_centroid(coords):
    if not coords or len(coords) == 0:
        return {"lat": 17.3855, "lng": 78.4865}
    sum_lat = sum(p[0] for p in coords)
    sum_lng = sum(p[1] for p in coords)
    return {
        "lat": round(sum_lat / len(coords), 4),
        "lng": round(sum_lng / len(coords), 4)
    }


# --- Static Frontend Routes ---

@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(app.static_folder, filename)


# --- REST API Endpoints ---

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "system": "Smart Farm Irrigation System (Nenu Farm Ki Ranu)",
        "uptime_seconds": int(time.time() - START_TIME),
        "demo_mode": os.getenv("DEMO_MODE", "true").lower() in ("true", "1", "yes"),
        "timestamp": datetime.now().isoformat()
    })

@app.route("/api/sensors", methods=["GET"])
def get_sensors():
    """
    Returns sensor readings for the specified farm_id.
    If no farm_id is provided, returns clear prompt to select a farm.
    """
    farm_id = request.args.get("farm_id") or request.args.get("field_id")
    if not farm_id or not str(farm_id).strip():
        return jsonify({
            "farm_selected": False,
            "message": "Please select a farm to view sensor data.",
            "sensors": None
        })

    clean_id = str(farm_id).strip()
    sensor = sensor_manager.get_sensor_for_farm(clean_id)
    if not sensor:
        return jsonify({
            "farm_selected": False,
            "message": "Please select a farm to view sensor data.",
            "sensors": None
        }), 404

    return jsonify({
        "farm_selected": True,
        "farm_id": clean_id,
        "sensor_id": sensor.get("sensor_id"),
        "moisture": sensor.get("moisture"),
        "temperature": sensor.get("temperature"),
        "humidity": sensor.get("humidity"),
        "motor": sensor.get("motor", 0),
        "is_hardware": sensor.get("is_hardware", False),
        "last_updated": sensor.get("last_updated"),
        "source": sensor.get("source", "sensor")
    })

@app.route("/api/weather", methods=["GET"])
def get_weather():
    farm_id = request.args.get("farm_id") or request.args.get("field_id")
    if farm_id:
        farm = get_field_by_id(farm_id)
        if farm and farm.get("coordinates"):
            center = calculate_centroid(farm["coordinates"])
            return jsonify({
                **weather_service.get_weather(),
                "farm_id": farm_id,
                "center": center
            })
    return jsonify(weather_service.get_weather())

@app.route("/api/recommendation", methods=["GET"])
def get_recommendation():
    """
    Evaluates irrigation recommendation based on the selected farm's single sensor.
    If no farm is selected, instructs farmer to select a farm first.
    """
    farm_id = request.args.get("farm_id") or request.args.get("field_id")
    if not farm_id or not str(farm_id).strip():
        return jsonify({
            "recommendation": "SELECT FARM",
            "reason": "Please select a farm to view sensor data and irrigation recommendations.",
            "reason_te": "సెన్సార్ వివరాలు మరియు నీటి సిఫార్సుల కోసం దయచేసి ఒక ఫార్మ్‌ను ఎంచుకోండి."
        })

    sensor = sensor_manager.get_sensor_for_farm(farm_id)
    if not sensor:
        return jsonify({
            "recommendation": "SELECT FARM",
            "reason": f"Farm {farm_id} not found.",
            "reason_te": "ఎంచుకున్న ఫార్మ్ కనుగొనబడలేదు."
        }), 404

    weather = weather_service.get_weather()
    rec = evaluate_irrigation(sensor["moisture"], weather.get("rain_probability", 0))
    return jsonify(rec)

@app.route("/api/status", methods=["GET"])
def get_status():
    """
    Consolidated status endpoint for dashboard fast polling.
    Respects selected farm:
    - If farm_id is provided: returns that farm's single sensor, motor state, and recommendation.
    - If farm_id is omitted: returns farm_selected=False and instructions to select a farm.
    """
    farm_id = request.args.get("farm_id") or request.args.get("field_id")
    serial_ok = serial_manager.has_recent_data
    is_demo = os.getenv("DEMO_MODE", "true").lower() in ("true", "1", "yes")

    if not farm_id or not str(farm_id).strip():
        return jsonify({
            "farm_selected": False,
            "message": "Please select a farm to view sensor data.",
            "sensors": None,
            "sensor": None,
            "motor": {
                "is_on": False,
                "status": "OFF",
                "message": "Please select a farm to view motor status."
            },
            "recommendation": {
                "recommendation": "SELECT FARM",
                "reason": "Please select a farm to view sensor data and irrigation recommendations.",
                "reason_te": "సెన్సార్ వివరాలు మరియు నీటి సిఫార్సుల కోసం దయచేసి ఒక ఫార్మ్‌ను ఎంచుకోండి."
            },
            "weather": None,
            "serial_connected": serial_ok,
            "demo_mode": is_demo,
            "timestamp": datetime.now().isoformat()
        })

    clean_id = str(farm_id).strip()
    sensor = sensor_manager.get_sensor_for_farm(clean_id)
    if not sensor:
        return jsonify({
            "farm_selected": False,
            "message": f"Farm '{clean_id}' not found.",
            "sensors": None,
            "sensor": None,
            "motor": None,
            "recommendation": {
                "recommendation": "SELECT FARM",
                "reason": "Selected farm was not found. Please select a valid farm.",
                "reason_te": "దయచేసి సరైన ఫార్మ్‌ను ఎంచుకోండి."
            },
            "weather": None,
            "serial_connected": serial_ok,
            "timestamp": datetime.now().isoformat()
        }), 404

    # The USB port being open does not establish that this farm has live data.
    is_demo = not (serial_ok and sensor.get("is_hardware") and
                   sensor.get("source") == "arduino" and not sensor.get("is_demo"))

    farm = get_field_by_id(clean_id)
    weather = weather_service.get_weather()
    rec = evaluate_irrigation(sensor["moisture"], weather.get("rain_probability", 0))

    motor_status = {
        "is_on": sensor.get("motor", 0) == 1,
        "status": "ON" if sensor.get("motor", 0) == 1 else "OFF",
        "farm_id": clean_id,
        "current_session_seconds": 0
    }

    return jsonify({
        "farm_selected": True,
        "farm_id": clean_id,
        "farm_name": farm.get("name") if farm else f"Farm {clean_id}",
        "crop": farm.get("crop") if farm else "Crop",
        "sensor_id": sensor.get("sensor_id"),
        "sensors": sensor,
        "sensor": sensor,
        "motor": motor_status,
        "weather": weather,
        "recommendation": rec,
        "serial_connected": serial_ok,
        "demo_mode": is_demo,
        "timestamp": datetime.now().isoformat()
    })

@app.route("/api/motor/on", methods=["POST"])
def motor_on():
    """Explicit farmer action to start the motor for the selected farm."""
    body = request.get_json(silent=True) or {}
    farm_id = body.get("farm_id") or request.args.get("farm_id")
    if not farm_id:
        return jsonify({
            "success": False,
            "error": "no_farm_selected",
            "message": "Please select a farm to control its motor."
        }), 400

    clean_id = str(farm_id).strip()
    sensor = sensor_manager.get_sensor_for_farm(clean_id)
    if not sensor:
        return jsonify({"success": False, "error": "farm_not_found"}), 404

    operator = body.get("operator", "farmer_dashboard")
    sensor_manager.set_motor_state(clean_id, True)

    # If this farm is linked to physical Arduino hardware, send serial command
    if clean_id == "field-101" or sensor.get("is_hardware"):
        motor_controller.request_motor_on(operator)
        serial_manager.send_motor_command("MOTOR_ON")

    status = {
        "is_on": True,
        "status": "ON",
        "farm_id": clean_id
    }

    return jsonify({
        "success": True,
        "action": "MOTOR_ON",
        "farm_id": clean_id,
        "motor": status,
        "message": f"Motor activation requested for {clean_id}."
    })

@app.route("/api/motor/off", methods=["POST"])
def motor_off():
    """Explicit farmer action to shut down the motor for the selected farm."""
    body = request.get_json(silent=True) or {}
    farm_id = body.get("farm_id") or request.args.get("farm_id")
    if not farm_id:
        return jsonify({
            "success": False,
            "error": "no_farm_selected",
            "message": "Please select a farm to control its motor."
        }), 400

    clean_id = str(farm_id).strip()
    sensor = sensor_manager.get_sensor_for_farm(clean_id)
    if not sensor:
        return jsonify({"success": False, "error": "farm_not_found"}), 404

    operator = body.get("operator", "farmer_dashboard")
    sensor_manager.set_motor_state(clean_id, False)

    if clean_id == "field-101" or sensor.get("is_hardware"):
        motor_controller.request_motor_off(operator)
        serial_manager.send_motor_command("MOTOR_OFF")

    status = {
        "is_on": False,
        "status": "OFF",
        "farm_id": clean_id
    }

    return jsonify({
        "success": True,
        "action": "MOTOR_OFF",
        "farm_id": clean_id,
        "motor": status,
        "message": f"Motor shutdown command sent for {clean_id}."
    })

@app.route("/api/motor", methods=["GET", "POST"])
def motor_base():
    """General motor endpoint supporting GET status and POST actions with farm_id."""
    farm_id = request.args.get("farm_id") or (request.get_json(silent=True) or {}).get("farm_id")
    if request.method == "GET":
        if not farm_id:
            return jsonify({"is_on": False, "status": "OFF", "message": "Please select a farm."})
        sensor = sensor_manager.get_sensor_for_farm(farm_id)
        is_on = bool(sensor and sensor.get("motor") == 1)
        return jsonify({"is_on": is_on, "status": "ON" if is_on else "OFF", "farm_id": farm_id})

    body = request.get_json(silent=True) or {}
    action = str(body.get("action") or body.get("command") or "").strip().lower()
    state = body.get("state")

    if action in ("on", "start") or state in (1, "1", True):
        return motor_on()
    elif action in ("off", "stop") or state in (0, "0", False):
        return motor_off()
    else:
        return jsonify({"error": "Invalid action. Use {'action': 'on'} or {'action': 'off'}"}), 400

@app.route("/api/fields", methods=["GET"])
def get_fields():
    fields = load_fields_list()
    return jsonify(fields)

@app.route("/api/fields", methods=["POST"])
def save_field():
    payload = request.get_json()
    if not payload or "coordinates" not in payload:
        return jsonify({"error": "Missing coordinates in field payload"}), 400

    field_name = payload.get("name", "").strip() or f"Field {int(time.time())}"
    crop_type = payload.get("crop", "General Crop")
    coordinates = payload.get("coordinates", [])
    area_sq_m = payload.get("area_sq_m", 0)
    area_acres = payload.get("area_acres", 0)

    fields = load_fields_list()
    new_field_id = f"field_{int(time.time()*1000)}"
    new_sensor_id = f"sensor_{len(fields) + 1}"

    new_field = {
        "id": new_field_id,
        "name": field_name,
        "crop": crop_type,
        "sensor_id": new_sensor_id,
        "coordinates": coordinates,
        "area_sq_m": round(float(area_sq_m), 2),
        "area_acres": round(float(area_acres), 2),
        "created_at": datetime.now().isoformat()
    }

    # Register exactly one sensor for this new farm
    sensor_manager.register_farm(new_field_id, new_sensor_id, field_name)

    fields.append(new_field)

    FIELDS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(FIELDS_FILE, "w", encoding="utf-8") as f:
        json.dump(fields, f, indent=2, ensure_ascii=False)

    return jsonify({"success": True, "field": new_field}), 201

@app.route("/api/chat", methods=["GET", "POST"])
def chat():
    if request.method == "GET":
        is_avail = is_grok_configured()
        model_name = os.getenv("XAI_MODEL") or os.getenv("GROK_MODEL") or "grok-2-latest"
        return jsonify({
            "configured": is_avail,
            "provider": "grok" if is_avail else "local_fallback",
            "status": "available" if is_avail else "fallback",
            "label": "Grok AI • Farm Assistant" if is_avail else "Local Assistant • Fallback",
            "model": model_name
        })

    body = request.get_json(silent=True) or {}
    user_msg = body.get("message") or body.get("transcript") or body.get("text") or ""
    if not user_msg.strip():
        return jsonify({"error": "Missing 'message' field"}), 400

    farm_id = body.get("farm_id") or request.args.get("farm_id")
    weather_data = weather_service.get_weather()
    fields = load_fields_list()

    if farm_id and str(farm_id).strip():
        clean_id = str(farm_id).strip()
        selected_farm = get_field_by_id(clean_id)
        sensor_data = sensor_manager.get_sensor_for_farm(clean_id)

        if sensor_data:
            rec = evaluate_irrigation(sensor_data.get("moisture", 24.0), weather_data.get("rain_probability", 0))
            farm_context = {
                "selected_farm": selected_farm,
                "farm_id": clean_id,
                "farm_name": selected_farm.get("name") if selected_farm else f"Farm {clean_id}",
                "crop": selected_farm.get("crop") if selected_farm else "General Crop",
                "sensor_id": sensor_data.get("sensor_id"),
                "soil_moisture": sensor_data.get("moisture"),
                "temperature": sensor_data.get("temperature"),
                "humidity": sensor_data.get("humidity"),
                "motor_status": "ON" if sensor_data.get("motor") == 1 else "OFF",
                "motor_on": sensor_data.get("motor") == 1,
                "weather": weather_data.get("condition", "Clear"),
                "rain_probability": weather_data.get("rain_probability", 0),
                "irrigation_recommendation": rec.get("recommendation", "MONITOR SOIL"),
                "recommendation_reason": rec.get("reason", ""),
                "fields": fields
            }
        else:
            farm_context = {
                "selected_farm": None,
                "farm_id": None,
                "soil_moisture": None,
                "temperature": None,
                "humidity": None,
                "motor_status": None,
                "weather": weather_data.get("condition", "Clear"),
                "rain_probability": weather_data.get("rain_probability", 0),
                "irrigation_recommendation": None,
                "fields": fields
            }
    else:
        # No farm selected
        farm_context = {
            "selected_farm": None,
            "farm_id": None,
            "soil_moisture": None,
            "temperature": None,
            "humidity": None,
            "motor_status": None,
            "weather": weather_data.get("condition", "Clear"),
            "rain_probability": weather_data.get("rain_probability", 0),
            "irrigation_recommendation": None,
            "fields": fields
        }

    # Ask Grok AI with truthful per-farm context
    result = ask_grok(user_msg, farm_context)
    return jsonify(result)

# --- Telugu Phone Gateway Endpoints ---

@app.route("/api/phone/simulate", methods=["POST"])
def phone_simulate():
    """
    Simulate incoming phone call / DTMF keypad interaction from Xiaomi 11i 5G / IVR gateway.
    Supports deterministic DTMF events: CALL_STARTED, DTMF_DIGIT, TIMEOUT, CALL_ENDED.
    """
    body = request.get_json(silent=True) or {}
    caller_id = body.get("caller_id", "Farmer Phone (+91 98480 22338)")
    session_id = body.get("session_id")
    event = body.get("event")
    digit = body.get("digit")
    speech = body.get("speech")
    farm_id = body.get("farm_id")
    test_flags = body.get("test_flags")

    # If DTMF event or digit is explicitly provided
    if digit is not None or event is not None:
        call_result = phone_gateway.process_dtmf_event(
            session_id=session_id,
            event=event or "DTMF_DIGIT",
            digit=str(digit) if digit is not None else None,
            caller_id=caller_id,
            farm_id=farm_id,
            test_flags=test_flags
        )
    elif speech and str(speech).strip() in ("0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "#"):
        # Keypad digit entered as speech string
        call_result = phone_gateway.process_dtmf_event(
            session_id=session_id,
            event="DTMF_DIGIT",
            digit=str(speech).strip(),
            caller_id=caller_id,
            farm_id=farm_id,
            test_flags=test_flags
        )
    elif speech:
        # Legacy freeform speech transcript
        call_result = phone_gateway.process_incoming_call(
            caller_id=caller_id,
            speech_text=speech,
            session_id=session_id,
            farm_id=farm_id,
            test_flags=test_flags
        )
    else:
        # Default: Initiate or advance call session
        call_result = phone_gateway.process_dtmf_event(
            session_id=session_id,
            event="CALL_STARTED",
            caller_id=caller_id,
            farm_id=farm_id,
            test_flags=test_flags
        )

    return jsonify(call_result)

@app.route("/api/phone/twiml", methods=["GET", "POST"])
def phone_twiml():
    """Real Telephony adapter endpoint for Twilio / Exotel webhooks."""
    values = request.values or request.get_json(silent=True) or {}
    caller_id = values.get("From", "Farmer Mobile")
    session_id = values.get("CallSid") or values.get("session_id")
    digits = values.get("Digits")
    event = "DTMF_DIGIT" if digits else "CALL_STARTED"

    res = phone_gateway.process_dtmf_event(
        session_id=session_id,
        event=event,
        digit=digits,
        caller_id=caller_id
    )

    lang_code = "te-IN" if res.get("language") == "te" else "en-IN"
    text = res.get("response_text", "")
    hangup = res.get("should_hangup", False)

    if hangup:
        twiml = f'<?xml version="1.0" encoding="UTF-8"?><Response><Say language="{lang_code}">{text}</Say><Hangup/></Response>'
    else:
        twiml = (
            f'<?xml version="1.0" encoding="UTF-8"?>'
            f'<Response>'
            f'<Gather numDigits="1" timeout="7" action="/api/phone/twiml">'
            f'<Say language="{lang_code}">{text}</Say>'
            f'</Gather>'
            f'<Redirect>/api/phone/twiml?Digits=TIMEOUT</Redirect>'
            f'</Response>'
        )
    return Response(twiml, mimetype="text/xml")

@app.route("/api/phone/logs", methods=["GET"])
def phone_logs():
    return jsonify(phone_gateway.get_logs())

@app.route("/api/phone/info", methods=["GET"])
def phone_info():
    return jsonify(phone_gateway.get_info())


# --- Startup Logic ---

def init_background_services():
    """Launch serial manager and phone gateway."""
    serial_manager.start()
    phone_gateway.start()

# Start background workers upon loading
init_background_services()

if __name__ == "__main__":
    import socket

    def _is_port_free(port_num: int, host_ip: str) -> bool:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((host_ip, port_num))
                return True
            except OSError:
                return False

    configured_port = int(os.getenv("BACKEND_PORT") or os.getenv("PORT", "5000"))
    host = os.getenv("HOST", "0.0.0.0")

    # On Raspberry Pi, port 5000 is always free. On macOS dev machines, AirPlay Receiver
    # may occupy 5000, so we check availability and select the appropriate port.
    port = configured_port
    if not _is_port_free(configured_port, host):
        if os.getenv("BACKEND_PORT"):
            print(f"⚠️ Warning: Configured BACKEND_PORT {configured_port} is already in use.")
        for candidate in [5001, 5050, 8080]:
            if _is_port_free(candidate, host):
                print(f"ℹ️ Port {port} occupied (e.g. macOS AirPlay). Using fallback port {candidate}.")
                port = candidate
                break

    print(f"\n=======================================================")
    print(f"🚜 Smart Farm Irrigation System running at http://{host}:{port}")
    print(f"📡 Serial Port: {serial_manager.port} @ {serial_manager.baud_rate} baud (Force Demo: {serial_manager.force_demo})")
    print(f"🌐 Allowed CORS Origins: {allowed_origins}")
    print(f"=======================================================\n")
    app.run(host=host, port=port, debug=False)
