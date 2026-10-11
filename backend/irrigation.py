"""
backend/irrigation.py
Irrigation decision engine based on soil moisture and rain probability.

Core Rules:
1. If soil moisture >= 40:
   "IRRIGATION NOT REQUIRED"
2. If soil moisture < 30 and rain probability >= 60:
   "WAIT FOR RAIN"
3. If soil moisture < 30 and rain probability < 40:
   "IRRIGATION RECOMMENDED"
4. Otherwise:
   "MONITOR SOIL"

SAFETY GUARANTEE:
- Never automatically start the motor from this recommendation.
"""

from datetime import datetime

def evaluate_irrigation(soil_moisture: float, rain_probability: float) -> dict:
    """
    Evaluate irrigation state and provide human-readable reason in English and Telugu.
    """
    moisture = round(float(soil_moisture), 1)
    rain_prob = int(rain_probability)

    if moisture >= 40.0:
        recommendation = "IRRIGATION NOT REQUIRED"
        recommendation_te = "నీరు పెట్టవలసిన అవసరం లేదు"
        reason = f"Soil moisture is sufficient ({moisture}% >= 40%). Crops have adequate root-zone hydration."
        reason_te = f"మట్టి తేమ {moisture}% తో సరిపడా ఉంది. పంటకు ప్రస్తుతానికి నీరు అవసరం లేదు."
        status_code = "NO_ACTION"
        badge_color = "success"

    elif moisture < 30.0 and rain_prob >= 60:
        recommendation = "WAIT FOR RAIN"
        recommendation_te = "వర్షం కోసం వేచి చూడండి"
        reason = f"Soil moisture is dry ({moisture}% < 30%), but high rain probability ({rain_prob}% >= 60%) is forecasted. Avoid running motor."
        reason_te = f"మట్టి తేమ {moisture}% తక్కువగా ఉన్నప్పటికీ, రాబోయే సమయంలో వర్షం పడే అవకాశం {rain_prob}% ఎక్కువగా ఉంది. నీరు వృధా కాకుండా వేచి ఉండండి."
        status_code = "WAIT_RAIN"
        badge_color = "warning"

    elif moisture < 30.0 and rain_prob < 40:
        recommendation = "IRRIGATION RECOMMENDED"
        recommendation_te = "నీరు పెట్టడం సిఫార్సు చేయబడింది"
        reason = f"Soil moisture is critically low ({moisture}% < 30%) and rain chance is low ({rain_prob}% < 40%). Manual motor start advised."
        reason_te = f"మట్టి తేమ {moisture}% చాలా తక్కువగా ఉంది, వర్షం పడే అవకాశం {rain_prob}% మాత్రమే ఉంది. కాబట్టి మోటార్ ఆన్ చేసి నీరు పెట్టడం మంచిది."
        status_code = "IRRIGATE"
        badge_color = "danger"

    else:
        recommendation = "MONITOR SOIL"
        recommendation_te = "మట్టి తేమను పర్యవేక్షించండి"
        reason = f"Soil moisture is moderate ({moisture}%) or weather is in transitional range ({rain_prob}% rain chance). Keep monitoring before irrigating."
        reason_te = f"మట్టి తేమ {moisture}% సాధారణ స్థాయిలో ఉంది. మోటార్ ఆన్ చేసే ముందు మరికొంత సమయం గమనించండి."
        status_code = "MONITOR"
        badge_color = "info"

    return {
        "recommendation": recommendation,
        "recommendation_te": recommendation_te,
        "status_code": status_code,
        "badge_color": badge_color,
        "reason": reason,
        "reason_te": reason_te,
        "soil_moisture": moisture,
        "rain_probability": rain_prob,
        "auto_action": False,
        "timestamp": datetime.now().isoformat()
    }
