"""
backend/telugu_assistant.py
Dedicated Telugu Voice Assistant Logic for Farmer Phone Calls.

Architecture Pipeline:
Farmer Phone Call
  -> Telugu Audio Capture (Xiaomi 11i 5G / GSM Gateway)
  -> Speech-to-Text (Transcribed Telugu text)
  -> Python Rule-based Intent Engine
  -> Live Telemetry Analysis (Moisture, Weather, Rain POP)
  -> Natural Telugu Voice Response Formulation
  -> Text-to-Speech (WAV/MP3 audio generation)
  -> Farmer Earphone / Phone Speaker
"""

from backend.sensors import sensor_manager
from backend.weather import weather_service
from backend.motor import motor_controller
from backend.irrigation import evaluate_irrigation

def handle_telugu_voice_call(transcript: str, serial_manager_instance=None) -> dict:
    """
    Generate spoken Telugu response based on live telemetry and safety rules.
    """
    text = transcript.strip()
    sensor_data = sensor_manager.get_sensors()
    weather_data = weather_service.get_weather()
    motor_status = motor_controller.get_status()

    moisture = sensor_data["moisture"]
    temp = sensor_data["temperature"]
    rain_prob = weather_data["rain_probability"]
    rec = evaluate_irrigation(moisture, rain_prob)

    # 1. Core question: “ఇప్పుడు నీరు పెట్టాలా?”
    if any(q in text for q in ["నీరు పెట్టాలా", "తడి కట్టాలా", "మోటార్ వెయ్యాలా", "neeru pettala"]):
        if moisture < 30.0 and rain_prob >= 60:
            spoken_response = (
                f"మట్టి తేమ {int(round(moisture))} శాతం ఉంది. "
                f"రాబోయే రెండు గంటల్లో వర్షం పడే అవకాశం ఎక్కువగా ఉంది ({rain_prob} శాతం). "
                f"కాబట్టి ఇప్పుడు నీరు పెట్టకుండా వేచి ఉండాలని సూచిస్తున్నాను."
            )
            intent = "SHOULD_IRRIGATE_WAIT_RAIN"
        elif moisture < 30.0 and rain_prob < 40:
            spoken_response = (
                f"మట్టి తేమ {int(round(moisture))} శాతం ఉంది. "
                f"వర్షం పడే అవకాశం చాలా తక్కువ ({rain_prob} శాతం). "
                f"కాబట్టి ఇప్పుడు పొలానికి నీరు పెట్టాలని మరియు మోటార్ ఆన్ చేయాలని సూచిస్తున్నాను."
            )
            intent = "SHOULD_IRRIGATE_CONFIRMED"
        elif moisture >= 40.0:
            spoken_response = (
                f"మట్టి తేమ {int(round(moisture))} శాతం ఉంది. "
                f"పంటకు సరిపడా తడి ఉంది. అందువల్ల ఇప్పుడు నీరు పెట్టవలసిన అవసరం లేదు."
            )
            intent = "SHOULD_IRRIGATE_NOT_REQUIRED"
        else:
            spoken_response = (
                f"మట్టి తేమ {int(round(moisture))} శాతం సాధారణ స్థాయిలో ఉంది. "
                f"వర్షం అవకాశం {rain_prob} శాతం. ఇంకొంత సమయం వేచి చూసి తేమను గమనించండి."
            )
            intent = "SHOULD_IRRIGATE_MONITOR"

    # 2. Moisture question: “మట్టి తేమ ఎంత ఉంది?”
    elif any(q in text for q in ["మట్టి తేమ", "తేమ ఎంత", "matti tema"]):
        intent = "SOIL_MOISTURE"
        spoken_response = f"ప్రస్తుతం పొలంలో మట్టి తేమ {int(round(moisture))} శాతం ఉంది."

    # 3. Rain question: “వర్షం పడుతుందా?”
    elif any(q in text for q in ["వర్షం పడుతుందా", "వర్షం వస్తుందా", "varsham"]):
        intent = "RAIN_QUERY"
        chance = "ఎక్కువగా" if rain_prob >= 50 else "తక్కువగా"
        spoken_response = f"రాబోయే కొద్ది గంటల్లో వర్షం పడే అవకాశం {rain_prob} శాతం ఉంది. వర్ష సూచన {chance} ఉంది."

    # 4. Temperature question: “ఉష్ణోగ్రత ఎంత?”
    elif any(q in text for q in ["ఉష్ణోగ్రత", "ఎండ ఎంత", "ushnogratha"]):
        intent = "TEMPERATURE"
        spoken_response = f"పొలంలో ప్రస్తుత ఉష్ణోగ్రత {round(temp, 1)} డిగ్రీల సెల్సియస్ ఉంది."

    # 5. Motor ON: “మోటార్ ఆన్ చేయి”
    elif any(q in text for q in ["మోటార్ ఆన్", "మోటారు ఆన్", "మోటార్ స్టార్ట్", "motor on"]):
        intent = "MOTOR_ON_COMMAND"
        if serial_manager_instance:
            serial_manager_instance.send_motor_command("MOTOR_ON")
        else:
            motor_controller.request_motor_on("phone_assistant")
            motor_controller.set_confirmed_state(1)
        spoken_response = "ఆదేశం స్వీకరించబడింది. బోరుబావి మోటార్ ఆన్ చేయబడింది. నీరు ప్రవహిస్తోంది."

    # 6. Motor OFF: “మోటార్ ఆఫ్ చేయి”
    elif any(q in text for q in ["మోటార్ ఆఫ్", "మోటారు ఆఫ్", "మోటార్ ఆపు", "motor off"]):
        intent = "MOTOR_OFF_COMMAND"
        if serial_manager_instance:
            serial_manager_instance.send_motor_command("MOTOR_OFF")
        else:
            motor_controller.request_motor_off("phone_assistant")
            motor_controller.set_confirmed_state(0)
        spoken_response = "మోటార్ ఆఫ్ చేయబడింది. నీటి సరఫరా నిలిపివేయబడింది."

    # 7. Motor status: “మోటార్ నడుస్తుందా?”
    elif any(q in text for q in ["మోటార్ నడుస్తుందా", "మోటార్ స్టేటస్", "మోటార్ స్థితి"]):
        intent = "MOTOR_STATUS"
        state = "ఆన్ లో నడుస్తోంది" if motor_status["is_on"] else "ఆఫ్ లో ఉంది"
        spoken_response = f"ప్రస్తుతం మోటార్ {state}."

    # 8. Fallback
    else:
        intent = "GENERAL"
        spoken_response = (
            f"నమస్కారం రైతు సోదరా. ప్రస్తుత మట్టి తేమ {int(round(moisture))} శాతం, "
            f"వర్షం అవకాశం {rain_prob} శాతం. మీకు నీటి సలహా కావాలా లేదా మోటార్ వివరాలు కావాలా?"
        )

    return {
        "status": "success",
        "input_transcript": text,
        "telugu_response": spoken_response,
        "intent": intent,
        "telemetry_used": {
            "soil_moisture": moisture,
            "rain_probability": rain_prob,
            "temperature": temp,
            "motor_on": motor_status["is_on"],
            "recommendation": rec["recommendation"]
        }
    }
