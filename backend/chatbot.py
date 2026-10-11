"""
backend/chatbot.py
Rule-based intent detection chatbot supporting English and Telugu.
Uses live sensor and weather data without requiring an external AI API.
"""

import re
from backend.sensors import sensor_manager
from backend.motor import motor_controller
from backend.weather import weather_service
from backend.irrigation import evaluate_irrigation

def detect_language(text: str) -> str:
    """Detect if input contains Telugu Unicode characters."""
    for ch in text:
        if '\u0c00' <= ch <= '\u0c7f':
            return "telugu"
    return "english"

def process_chat_message(user_message: str, serial_manager_instance=None) -> dict:
    """
    Process user query and return contextual response with live farm telemetry.
    """
    raw_query = user_message.strip()
    query_lower = raw_query.lower()
    lang = detect_language(raw_query)

    # 1. Fetch current live states
    sensor_data = sensor_manager.get_sensors()
    weather_data = weather_service.get_weather()
    motor_status = motor_controller.get_status()
    rec = evaluate_irrigation(sensor_data["moisture"], weather_data["rain_probability"])

    moisture = sensor_data["moisture"]
    temp = sensor_data["temperature"]
    humidity = sensor_data["humidity"]
    rain_prob = weather_data["rain_probability"]
    motor_on = motor_status["is_on"]

    intent = "UNKNOWN"
    action_taken = None

    # Intent 1: Turn Motor ON
    if (
        "turn motor on" in query_lower or "turn on motor" in query_lower or "start motor" in query_lower or
        "మోటార్ ఆన్ చేయి" in raw_query or "మోటారు ఆన్" in raw_query or "motor on cheyi" in query_lower
    ):
        intent = "MOTOR_ON"
        if serial_manager_instance:
            serial_manager_instance.send_motor_command("MOTOR_ON")
        else:
            motor_controller.request_motor_on("chatbot")
            motor_controller.set_confirmed_state(1)

        action_taken = "MOTOR_ON"
        if lang == "telugu":
            reply = "మోటార్ ఆన్ చేయబడింది. నీరు ప్రవహిస్తోంది. మట్టి తేమ పెరిగే వరకు పర్యవేక్షించండి."
        else:
            reply = "Water motor has been turned ON. Sensors will monitor moisture elevation in real time."

    # Intent 2: Turn Motor OFF
    elif (
        "turn motor off" in query_lower or "turn off motor" in query_lower or "stop motor" in query_lower or
        "మోటార్ ఆఫ్ చేయి" in raw_query or "మోటారు ఆఫ్" in raw_query or "motor off cheyi" in query_lower
    ):
        intent = "MOTOR_OFF"
        if serial_manager_instance:
            serial_manager_instance.send_motor_command("MOTOR_OFF")
        else:
            motor_controller.request_motor_off("chatbot")
            motor_controller.set_confirmed_state(0)

        action_taken = "MOTOR_OFF"
        if lang == "telugu":
            reply = "మోటార్ ఆఫ్ చేయబడింది. విద్యుత్ మరియు నీటి వినియోగం నిలిపివేయబడింది."
        else:
            reply = "Water motor has been turned OFF. Irrigation stopped."

    # Intent 3: Should I irrigate?
    elif (
        "should i irrigate" in query_lower or "water the crops" in query_lower or "irrigate now" in query_lower or
        "need water" in query_lower or "ఇప్పుడు నీరు పెట్టాలా" in raw_query or "నీరు పెట్టాలా" in raw_query or
        "ippudu neeru pettala" in query_lower or "neeru pettala" in query_lower
    ):
        intent = "IRRIGATION_QUERY"
        if lang == "telugu":
            reply = (
                f"మట్టి తేమ {moisture}% ఉంది. వర్షం పడే అవకాశం {rain_prob}%. "
                f"సిఫార్సు: {rec['recommendation_te']}. కారణం: {rec['reason_te']}"
            )
        else:
            reply = (
                f"Current soil moisture is {moisture}% and rain probability is {rain_prob}%. "
                f"Recommendation: {rec['recommendation']}. {rec['reason']}"
            )

    # Intent 4: Soil moisture query
    elif (
        "soil moisture" in query_lower or "moisture level" in query_lower or "how wet is the soil" in query_lower or
        "మట్టి తేమ ఎంత ఉంది" in raw_query or "మట్టి తేమ" in raw_query or "matti tema" in query_lower
    ):
        intent = "SOIL_MOISTURE_QUERY"
        if lang == "telugu":
            status_desc = "తగినంత తేమగా ఉంది" if moisture >= 40 else "పొడిగా ఉంది"
            reply = f"ప్రస్తుతం పొలంలో మట్టి తేమ {moisture}% ఉంది ({status_desc})."
        else:
            status_desc = "Optimal" if moisture >= 40 else "Dry"
            reply = f"The live soil moisture level is {moisture}% ({status_desc})."

    # Intent 5: Temperature & Humidity query
    elif (
        "temperature" in query_lower or "how hot" in query_lower or "weather temp" in query_lower or
        "ఉష్ణోగ్రత ఎంత" in raw_query or "ఉష్ణోగ్రత" in raw_query or "ushnogratha" in query_lower
    ):
        intent = "TEMPERATURE_QUERY"
        if lang == "telugu":
            reply = f"పొలంలో ప్రస్తుత ఉష్ణోగ్రత {temp}°C మరియు గాలిలో తేమ {humidity}% ఉంది."
        else:
            reply = f"Field temperature is {temp}°C with ambient humidity at {humidity}%."

    # Intent 6: Rain probability query
    elif (
        "rain coming" in query_lower or "will it rain" in query_lower or "rain probability" in query_lower or
        "వర్షం పడుతుందా" in raw_query or "వర్షం" in raw_query or "varsham padutunda" in query_lower
    ):
        intent = "RAIN_QUERY"
        if lang == "telugu":
            chance_word = "ఎక్కువగా ఉంది" if rain_prob >= 50 else "తక్కువగా ఉంది"
            reply = f"రాబోయే కొన్ని గంటల్లో వర్షం పడే అవకాశం {rain_prob}% ({chance_word}). ప్రస్తుత వాతావరణం: {weather_data.get('condition')}."
        else:
            chance_word = "High chance" if rain_prob >= 50 else "Low probability"
            reply = f"Rain probability is {rain_prob}% ({chance_word}). Current condition: {weather_data.get('condition')}."

    # Intent 7: Motor status query
    elif (
        "motor status" in query_lower or "is motor on" in query_lower or "is pump running" in query_lower or
        "మోటార్ స్థితి" in raw_query or "మోటార్ నడుస్తుందా" in raw_query or "motor status enti" in query_lower
    ):
        intent = "MOTOR_STATUS_QUERY"
        status_word = "ఆన్ లో ఉంది (నడుస్తోంది)" if motor_on else "ఆఫ్ లో ఉంది (ఆగి ఉంది)"
        if lang == "telugu":
            reply = f"ప్రస్తుతం మోటార్ {status_word}. చివరి ఆదేశం: {motor_status.get('last_action_by')} ద్వారా."
        else:
            state_text = "RUNNING (ON)" if motor_on else "STOPPED (OFF)"
            reply = f"Motor is currently {state_text}. Controlled by: {motor_status.get('last_action_by')}."

    # Intent 8: General greetings / Help
    elif any(g in query_lower for g in ("hello", "hi", "namaste", "help", "నమస్కారం", "హలో")):
        intent = "GREETING"
        if lang == "telugu":
            reply = (
                "నమస్కారం! నేను మీ స్మార్ట్ ఫార్మ్ సహాయకుడిని. "
                "మీరు నన్ను 'ఇప్పుడు నీరు పెట్టాలా?', 'మట్టి తేమ ఎంత?', 'వర్షం పడుతుందా?', లేదా 'మోటార్ ఆన్ చేయి' అని అడగవచ్చు."
            )
        else:
            reply = (
                "Hello! I am your Smart Farm Assistant. You can ask me: "
                "'Should I irrigate?', 'What is the soil moisture?', 'Is rain coming?', or command 'Turn motor on' / 'Turn motor off'."
            )

    # Fallback
    else:
        intent = "UNKNOWN"
        if lang == "telugu":
            reply = (
                f"క్షమించండి, మీ ప్రశ్న అర్థం కాలేదు. "
                f"మట్టి తేమ: {moisture}%, ఉష్ణోగ్రత: {temp}°C, వర్షం అవకాశం: {rain_prob}%. "
                f"నీరు పెట్టాలా లేదా మోటార్ ఆన్ చేయాలా అని అడగండి."
            )
        else:
            reply = (
                f"I didn't quite catch that. Current telemetry: Soil Moisture {moisture}%, "
                f"Temp {temp}°C, Rain chance {rain_prob}%. Try asking 'Should I irrigate?' or 'Turn motor on'."
            )

    return {
        "reply": reply,
        "intent": intent,
        "language": lang,
        "action_taken": action_taken,
        "telemetry": {
            "soil_moisture": moisture,
            "temperature": temp,
            "humidity": humidity,
            "rain_probability": rain_prob,
            "motor_on": motor_on,
            "recommendation": rec["recommendation"]
        }
    }
