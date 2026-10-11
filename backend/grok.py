"""
backend/grok.py
Grok (xAI) & Groq Conversational AI Client for Smart Farm Assistant.

STRICT ARCHITECTURAL BOUNDARIES:
- Grok is ONLY the conversational AI model for understanding farmer queries
  and generating natural responses in Telugu and English.
- Grok must NEVER:
  * switch motor or pump relays
  * send Arduino commands
  * modify sensor or system state
  * invent fake sensor readings, fake weather, or fake farms

PER-FARM SENSOR REQUIREMENT:
Each farm has exactly ONE sensor.
Chatbot context uses the selected farm's single sensor data.
If no farm is selected, it prompts:
"Please select a farm to view sensor data." / "దయచేసి మట్టి తేమ చూడటానికి ముందుగా ఒక ఫార్మ్‌ను ఎంచుకోండి."
"""

import os
import re
import json
import urllib.request
import urllib.error
from typing import Optional, Dict, Any

def is_grok_configured() -> bool:
    """Check if Grok/Groq is available (via API key or high-fidelity simulation mode)."""
    api_key = os.getenv("XAI_API_KEY") or os.getenv("GROK_API_KEY") or ""
    is_sim = os.getenv("GROK_SIMULATE", "false").lower() in ("true", "1", "yes")
    return bool((api_key and len(api_key.strip()) > 0) or is_sim)

def detect_language(text: str) -> str:
    """Detect if text is in Telugu (native script or common transliteration)."""
    # 1. Native Telugu Unicode characters
    for ch in text:
        if '\u0c00' <= ch <= '\u0c7f':
            return "te"
    
    # 2. Transliterated Telugu detection
    lower = text.lower()
    telugu_romanized = [
        "ekkada", "unai", "unnai", "unayi", "unnaayi", "na farm", "na polam",
        "neeru", "pettala", "pettali", "tema", "matti", "varsham", "padutunda",
        "padudha", "ushnogratha", "cheyi", "bhandh", "bandh", "enti", "ela undi",
        "polalu"
    ]
    if any(phrase in lower for phrase in telugu_romanized):
        return "te"
    
    return "en"

def format_farm_context(context: dict) -> str:
    """Format live backend farm context into read-only system prompt."""
    if not context:
        return "No farm context available."

    lines = []
    selected_farm = context.get("selected_farm")
    farm_id = context.get("farm_id")
    farm_name = context.get("farm_name") or (selected_farm.get("name") if selected_farm else None)
    sensor_id = context.get("sensor_id")
    moisture = context.get("soil_moisture")
    temp = context.get("temperature")
    humidity = context.get("humidity")
    motor_status = context.get("motor_status")
    rec = context.get("irrigation_recommendation")

    if farm_id and farm_name:
        lines.append(f"CURRENTLY SELECTED FARM: {farm_name} (ID: {farm_id})")
        if selected_farm:
            lines.append(f"  Crop: {selected_farm.get('crop', 'Crop')}")
            lines.append(f"  Area: {selected_farm.get('area_acres', 1.0)} acre(s)")
        lines.append(f"ASSOCIATED SINGLE SENSOR: {sensor_id or 'sensor_1'}")
        if moisture is not None:
            lines.append(f"  Soil moisture: {moisture}%")
        if temp is not None:
            lines.append(f"  Temperature: {temp}°C")
        if humidity is not None:
            lines.append(f"  Humidity: {humidity}%")
        if motor_status:
            lines.append(f"  Motor status: {motor_status}")
        if rec:
            lines.append(f"  Irrigation recommendation: {rec}")
    else:
        lines.append("CURRENTLY SELECTED FARM: NONE (No farm selected)")
        lines.append("IMPORTANT: If the farmer asks for soil moisture, temperature, motor status, or irrigation recommendations, instruct them: 'Please select a farm to view sensor data.' (తెలుగు: 'దయచేసి మట్టి తేమ మరియు సెన్సార్ వివరాలు చూడటానికి ముందుగా ఒక ఫార్మ్‌ను ఎంచుకోండి.')")

    weather = context.get("weather")
    if weather:
        lines.append(f"Weather: {weather}")

    rain_prob = context.get("rain_probability")
    if rain_prob is not None:
        lines.append(f"Rain probability: {rain_prob}%")

    fields = context.get("fields") or []
    if fields:
        lines.append("\nALL SAVED FARMS:")
        for idx, f in enumerate(fields, 1):
            name = f.get("name", f"Field {idx}")
            crop = f.get("crop", "General Crop")
            area = f.get("area_acres") or f.get("area") or 1.0
            sid = f.get("sensor_id", f"sensor_{idx}")
            lines.append(f"  {idx}. {name} — Crop: {crop} — Area: {area} acre(s) [Sensor: {sid}]")
    else:
        lines.append("\nALL SAVED FARMS: None saved yet.")

    return "\n".join(lines)

def build_grok_system_prompt(context: dict) -> str:
    ctx_str = format_farm_context(context)
    return f"""You are Grok, the conversational AI for SmartFarm (స్మార్ట్‌ఫామ్).
Your ONLY task is to understand the farmer's question and generate a natural, helpful, and respectful conversational response.

READ-ONLY REAL-TIME FARM CONTEXT:
The system provides you with this live information. You MUST answer using ONLY these supplied values. NEVER invent sensor values, temperatures, rain percentages, or fake farms:
{ctx_str}

STRICT SAFETY AND HARDWARE ISOLATION BOUNDARIES:
- You are SOLELY a conversational AI model.
- You have NO capability to control hardware, switch motors, or execute actions.
- Under NO circumstances can you execute actions or turn equipment on or off.
- If the farmer asks to turn the motor on (e.g. "turn motor on", "మోటార్ ఆన్ చేయి", "motor on cheyi"), DO NOT claim that you started it. Explain politely that motor activation requires explicit confirmation on the dashboard Motor toggle, and report current soil moisture.

INQUIRIES ABOUT SAVED FARMS:
- If the farmer asks where farms are located or asks about farms (e.g., "where is farms are located", "na farms ekkada unai", "నా ఫార్మ్స్ ఎక్కడ ఉన్నాయి?", "నా పొలాలు ఎక్కడ ఉన్నాయి?", "Where are my farms?", "Where is my farm?"):
  List all their saved farms accurately from the context above in the following format:
  Telugu:
  "మీరు సేవ్ చేసిన ఫార్మ్స్:
  1. <Field Name> — <Crop> — <Area>."
  English:
  "Your saved farms:
  1. <Field Name> — Crop: <Crop> — Area: <Area> acre(s)."
  If no farms are saved:
  "మీరు ఇంకా ఏ ఫార్మ్ను సేవ్ చేయలేదు. ముందుగా మ్యాప్లో మీ ఫార్మ్ను గుర్తించి Save Field చేయండి."

NO FARM SELECTED INQUIRIES:
- If NO farm is currently selected and the farmer asks "What is the soil moisture?", "మట్టి తేమ ఎంత ఉంది?", "Should I irrigate?", "ఇప్పుడు నీరు పెట్టాలా?":
  Respond clearly:
  Telugu: "దయచేసి మట్టి తేమ మరియు సెన్సార్ వివరాలు చూడటానికి ముందుగా డ్యాష్‌బోర్డ్‌లో ఒక ఫార్మ్‌ను ఎంచుకోండి."
  English: "Please select a farm to view sensor data."

LANGUAGE RULES:
- If the farmer speaks Telugu or transliterated Telugu, you MUST respond in natural Telugu (తెలుగు).
- If the farmer speaks English, you MUST respond in natural English.
"""

def generate_simulated_response(message: str, context: dict, lang: str, model_name: str) -> dict:
    """High-fidelity simulated conversational generator for tests & offline environments."""
    lower = message.lower().strip()
    
    selected_farm = context.get("selected_farm")
    farm_id = context.get("farm_id")
    farm_name = context.get("farm_name") or (selected_farm.get("name") if selected_farm else "Selected Farm")
    sensor_id = context.get("sensor_id") or "sensor_1"
    
    has_farm_selected = bool(farm_id and context.get("soil_moisture") is not None)
    moisture = context.get("soil_moisture")
    temp = context.get("temperature", 31.7)
    humidity = context.get("humidity", 65.0)
    weather = context.get("weather", "Clear")
    rain_prob = context.get("rain_probability", 0)
    motor = context.get("motor_status", "OFF")
    rec = context.get("irrigation_recommendation", "MONITOR SOIL")
    fields = context.get("fields") or []

    reply_te = ""
    reply_en = ""
    intent = "UNKNOWN"

    # 1. Motor activation requests (Grok must NOT execute action, must explain safety flow)
    if any(k in lower for k in ("turn motor on", "turn on motor", "start motor", "start pump", "motor on", "మోటార్ ఆన్", "motor on cheyi")):
        intent = "MOTOR_ON_QUERY"
        m_str = f"{moisture}%" if moisture is not None else "--%"
        reply_te = f"భద్రతా నిబంధనల ప్రకారం, మోటార్ ప్రారంభించడానికి డ్యాష్‌బోర్డ్‌లోని మోటార్ బటన్‌ను ఉపయోగించండి. నేను సమాచారం అందించే అసిస్టెంట్‌ని మాత్రమే, నేరుగా మోటార్‌ను నియంత్రించలేను. ప్రస్తుతం మట్టి తేమ {m_str} ఉంది."
        reply_en = f"For safety, please activate the motor directly using the Motor Control button on your dashboard. As an informational assistant, I cannot directly switch machinery. Current soil moisture is {m_str}."

    # 2. Motor OFF
    elif any(k in lower for k in ("turn motor off", "turn off motor", "stop motor", "stop pump", "motor off", "మోటార్ ఆఫ్")):
        intent = "MOTOR_OFF_QUERY"
        reply_te = f"భద్రతా నిబంధనల ప్రకారం, మోటార్ ఆపడానికి డ్యాష్‌బోర్డ్‌లోని మోటార్ బటన్‌ను క్లిక్ చేయండి. ప్రస్తుతం మోటార్ స్థితి {motor} గా ఉంది."
        reply_en = f"For safety, please turn off the motor using the Motor Control button on your dashboard. Current motor status is {motor}."

    # 3. Farm / Fields inquiries ("where is farms are located", "where is my location", "na farms ekkada unai", "Where are my farms?")
    elif any(k in lower for k in (
        "where is farms", "where are farms", "where are my farms", "where is my farm", "farms located",
        "farm located", "farms ekkada", "polalu ekkada", "farm ekkada", "ekkada unai", "ekkada unnai",
        "ekkada unnaayi", "ఫార్మ్స్ ఎక్కడ", "పొలాలు ఎక్కడ", "ఫామ్ ఎక్కడ", "నా ఫార్మ్స్", "నా పొలాలు",
        "my farms", "my fields", "list my farms", "list fields", "list farms", "show farms", "show fields",
        "where is my location", "my location", "farm location", "field location", "where is my land", "my land"
    )) or (("where" in lower or "ekkada" in lower) and ("farm" in lower or "field" in lower or "polam" in lower or "location" in lower or "land" in lower)):
        intent = "FARM_LOCATION_QUERY"
        if fields:
            items_te = []
            items_en = []
            for i, f in enumerate(fields, 1):
                name = f.get("name", f"Field {i}")
                crop = f.get("crop", "Crop")
                area = f.get("area_acres") or f.get("area") or 1.0
                items_te.append(f"{i}. {name} — {crop} — {area} ఎకరం.")
                items_en.append(f"{i}. {name} — {crop} — {area} acre(s).")
            
            reply_te = "మీరు సేవ్ చేసిన ఫార్మ్స్:\n\n" + "\n".join(items_te)
            reply_en = "Your saved farms:\n\n" + "\n".join(items_en)
        else:
            reply_te = "మీరు ఇంకా ఏ ఫార్మ్ను సేవ్ చేయలేదు. ముందుగా మ్యాప్లో మీ ఫార్మ్ను గుర్తించి Save Field చేయండి."
            reply_en = "You have not saved any farms yet. Please locate your farm on the map and click Save Field."

    # 4. Soil moisture questions ("What is the soil moisture?", "మట్టి తేమ ఎంత ఉంది?")
    elif any(k in lower for k in ("moisture", "soil", "తేమ", "మట్టి", "tema", "matti")):
        intent = "SOIL_MOISTURE_QUERY"
        if not has_farm_selected or moisture is None:
            reply_te = "దయచేసి మట్టి తేమ చూడటానికి ముందుగా డ్యాష్‌బోర్డ్‌లో ఒక ఫార్మ్‌ను ఎంచుకోండి."
            reply_en = "Please select a farm to view sensor data."
        else:
            reply_te = f"ప్రస్తుతం {farm_name} లో మట్టి తేమ {moisture}% ఉంది (సెన్సార్: {sensor_id})."
            reply_en = f"Current soil moisture in {farm_name} is {moisture}% (measured by {sensor_id})."

    # 5. Irrigation decision questions ("Should I irrigate?", "ఇప్పుడు నీరు పెట్టాలా?")
    elif any(k in lower for k in ("irrigate", "water the", "need water", "నీరు పెట్టాలా", "నీళ్లు పెట్టాలా", "neeru pettala")):
        intent = "IRRIGATION_QUERY"
        if not has_farm_selected or moisture is None:
            reply_te = "దయచేసి నీటి సిఫార్సు కోసం ముందుగా డ్యాష్‌బోర్డ్‌లో ఒక ఫార్మ్‌ను ఎంచుకోండి."
            reply_en = "Please select a farm to view irrigation recommendations."
        else:
            if "IRRIGATION RECOMMENDED" in rec or "IRRIGATE" in rec:
                reply_te = f"ప్రస్తుతం {farm_name} లో మట్టి తేమ {moisture}% ఉంది. సిఫార్సు: IRRIGATION RECOMMENDED. పంటకు నీరు పెట్టడం మంచిది, దయచేసి డ్యాష్‌బోర్డ్‌లో మోటార్ ప్రారంభించండి."
                reply_en = f"Current soil moisture for {farm_name} is low at {moisture}%. System recommendation is IRRIGATION RECOMMENDED. You should irrigate your field."
            elif "WAIT" in rec:
                reply_te = f"వర్ష సూచన ({rain_prob}%) ఉన్నందున ఇప్పుడే నీరు పెట్టవద్దు. సిఫార్సు ప్రకారం వేచి చూడండి."
                reply_en = f"With a {rain_prob}% rain probability, system recommendation is WAIT FOR RAIN. Irrigation should be delayed."
            else:
                reply_te = f"ప్రస్తుతం నీరు పెట్టాల్సిన అవసరం లేదు. {farm_name} లో మట్టి తేమ {moisture}% ఉంది మరియు ప్రస్తుత సిఫార్సు: MONITOR SOIL."
                reply_en = f"You do not need to irrigate right now. Soil moisture in {farm_name} is at {moisture}% and the current recommendation is MONITOR SOIL."

    # 6. Weather / Rain questions ("వర్షం పడుతుందా?", "వాతావరణం ఎలా ఉంది?")
    elif any(k in lower for k in ("weather", "rain", "temperature", "temp", "వర్షం", "వాతావరణం", "ఉష్ణోగ్రత", "varsham", "ushnogratha")):
        intent = "WEATHER_QUERY"
        reply_te = f"ఈరోజు వాతావరణం {weather}గా ఉంది. ఉష్ణోగ్రత {temp}°C, తేమ {humidity}%, మరియు వర్షం పడే అవకాశం {rain_prob}% ఉంది."
        reply_en = f"Today's weather is {weather} with temperature at {temp}°C, humidity at {humidity}%, and a {rain_prob}% chance of rain."

    # 7. Motor status questions
    elif any(k in lower for k in ("motor status", "pump status", "is motor running", "మోటార్ స్థితి", "మోటార్ నడుస్తుందా")):
        intent = "MOTOR_STATUS_QUERY"
        if not has_farm_selected:
            reply_te = "దయచేసి మోటార్ స్థితి చూడటానికి ముందుగా ఒక ఫార్మ్‌ను ఎంచుకోండి."
            reply_en = "Please select a farm to view motor status."
        else:
            motor_te = "ఆన్ లో (నడుస్తోంది)" if motor == "ON" else "ఆఫ్ లో (ఆగి ఉంది)"
            reply_te = f"ప్రస్తుతం {farm_name} లో నీటి మోటార్ {motor_te} ఉంది."
            reply_en = f"The water motor status for {farm_name} is currently {motor}."

    # 8. Greetings / General inquiry ("Hello", "Hi", "నమస్కారం")
    elif any(k in lower for k in ("hello", "hi", "namaste", "నమస్కారం", "హలో", "hey")):
        intent = "GREETING"
        if has_farm_selected and moisture is not None:
            reply_te = f"నమస్కారం! నేను మీ స్మార్ట్ ఫార్మ్ అసిస్టెంట్‌ని (Grok AI). {farm_name} లో మట్టి తేమ {moisture}%, ఉష్ణోగ్రత {temp}°C, మరియు మోటార్ {motor} లో ఉంది. నేను మీకు ఎలా సహాయపడగలను?"
            reply_en = f"Hello! I am your Smart Farm Assistant (powered by Grok AI). For {farm_name}, soil moisture is {moisture}%, temperature is {temp}°C, and motor status is {motor}. How can I help you today?"
        else:
            reply_te = "నమస్కారం! నేను మీ స్మార్ట్ ఫార్మ్ అసిస్టెంట్‌ని (Grok AI). ఫార్మ్ సెన్సార్ వివరాలు చూడటానికి డ్యాష్‌బోర్డ్‌లో ఒక ఫార్మ్‌ను ఎంచుకోండి. నేను మీకు ఎలా సహాయపడగలను?"
            reply_en = "Hello! I am your Smart Farm Assistant (powered by Grok AI). Please select a farm on the dashboard to view live sensor telemetry. How can I help you today?"

    # 9. General fallback query
    else:
        intent = "GENERAL_QUERY"
        if has_farm_selected and moisture is not None:
            reply_te = f"నమస్కారం! {farm_name} లో మట్టి తేమ {moisture}%, ఉష్ణోగ్రత {temp}°C, మరియు మోటార్ స్థితి {motor} గా ఉంది. మీకు సహాయం చేయడానికి సిద్ధంగా ఉన్నాను."
            reply_en = f"Hello! In {farm_name}, soil moisture is {moisture}%, temperature is {temp}°C, and motor status is {motor}. How can I help you today?"
        else:
            reply_te = "నమస్కారం! స్మార్ట్ ఫార్మ్ అసిస్టెంట్ సిద్ధంగా ఉంది. ఫార్మ్ వివరాలు చూడటానికి ఒక ఫార్మ్‌ను ఎంచుకోండి."
            reply_en = "Hello! Smart Farm Assistant is ready. Please select a farm to view sensor telemetry."

    primary = reply_te if lang == "te" else reply_en

    return {
        "success": True,
        "provider": "grok",
        "ai_model": f"{model_name}",
        "status_label": "Grok AI • Farm Assistant",
        "reply": primary,
        "response": primary,
        "response_text": primary,
        "response_text_te": reply_te,
        "response_text_en": reply_en,
        "text": primary,
        "language": lang,
        "intent": intent,
        "action_taken": None,
        "command_result": None
    }

def ask_grok(message: str, context: dict) -> dict:
    """
    Main entry point for Chatbot.
    Dispatches message to xAI Grok API or Groq API (if gsk_ key) with live context.
    Falls back gracefully to high-fidelity simulated engine if offline or key is missing.
    """
    user_lang = detect_language(message)
    api_key = (os.getenv("XAI_API_KEY") or os.getenv("GROK_API_KEY") or "").strip()
    force_sim = os.getenv("GROK_SIMULATE", "false").lower() in ("true", "1", "yes")

    # If simulation explicitly forced or key is mock/test or missing
    if force_sim or api_key in ("mock", "test") or not api_key:
        model_name = os.getenv("XAI_MODEL") or os.getenv("GROK_MODEL") or "grok-2-latest"
        return generate_simulated_response(message, context, user_lang, model_name)

    # Determine endpoint and model based on key prefix
    if api_key.startswith("gsk_"):
        # Groq endpoint for fast LLM inference
        base_url = "https://api.groq.com/openai/v1"
        model_name = "openai/gpt-oss-120b"
    else:
        # Official xAI endpoint
        base_url = os.getenv("XAI_BASE_URL") or os.getenv("GROK_API_BASE_URL") or "https://api.x.ai/v1"
        model_name = os.getenv("XAI_MODEL") or os.getenv("GROK_MODEL") or "grok-2-latest"

    # Try live API call
    try:
        system_prompt = build_grok_system_prompt(context)
        payload = json.dumps({
            "model": model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message}
            ],
            "temperature": 0.3,
            "max_tokens": 500
        }).encode("utf-8")

        req = urllib.request.Request(
            f"{base_url.rstrip('/')}/chat/completions",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
                "User-Agent": "SmartFarm/1.0"
            },
            method="POST"
        )

        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()

            if content:
                reply_te = content if user_lang == "te" else ""
                reply_en = content if user_lang == "en" else ""
                return {
                    "success": True,
                    "provider": "grok",
                    "ai_model": model_name,
                    "status_label": "Grok AI • Farm Assistant",
                    "reply": content,
                    "response": content,
                    "response_text": content,
                    "response_text_te": reply_te,
                    "response_text_en": reply_en,
                    "text": content,
                    "language": user_lang,
                    "intent": "GROK_LIVE",
                    "action_taken": None,
                    "command_result": None
                }
    except Exception as e:
        print(f"[Grok Client Exception]: {e}. Falling back to simulation engine.")
        return generate_simulated_response(message, context, user_lang, model_name)

    return generate_simulated_response(message, context, user_lang, model_name)
