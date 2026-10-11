export interface ParsedVoiceCommand {
  transcript: string;
  intent: 
    | 'GET_SOIL_MOISTURE'
    | 'GET_WEATHER'
    | 'GET_RECOMMENDATION'
    | 'PUMP_ON'
    | 'PUMP_OFF'
    | 'CONFIRM_IRRIGATION'
    | 'CANCEL_IRRIGATION'
    | 'GET_PUMP_HISTORY'
    | 'UNKNOWN';
  parameters: {
    duration_seconds?: number;
    reason?: string;
  };
  confidence: number;
}

export function parseTeluguVoiceTranscript(rawText: string): ParsedVoiceCommand {
  const text = rawText.trim().toLowerCase();

  // 1. Duration extraction (in Telugu and English numerals)
  let durationSeconds = 300; // default 5 mins
  if (text.includes('ఒక నిమిషం') || text.includes('1 నిమిషం') || text.includes('one minute') || text.includes('1 min')) {
    durationSeconds = 60;
  } else if (text.includes('రెండు నిమిషాలు') || text.includes('2 నిమిషాలు') || text.includes('రెండు నిముషాలు') || text.includes('two minute') || text.includes('2 min')) {
    durationSeconds = 120;
  } else if (text.includes('మూడు నిమిషాలు') || text.includes('3 నిమిషాలు') || text.includes('3 min')) {
    durationSeconds = 180;
  } else if (text.includes('ఐదు నిమిషాలు') || text.includes('5 నిమిషాలు') || text.includes('five minute') || text.includes('5 min')) {
    durationSeconds = 300;
  } else if (text.includes('పది నిమిషాలు') || text.includes('10 నిమిషాలు') || text.includes('ten minute') || text.includes('10 min')) {
    durationSeconds = 600;
  }

  // 2. Intent matching with rich Telugu farmer phrasing

  // CONFIRM_IRRIGATION
  if (
    text.includes('అవును') ||
    text.includes('సరే') ||
    text.includes('ధృవీకరించు') ||
    text.includes('ఆన్ చేయ్') ||
    text.includes('చెయ్యి') ||
    text.includes('yes') ||
    text.includes('confirm')
  ) {
    if (text.includes('వద్దు') || text.includes('ఆపవద్దు') || text.includes('నో') || text.includes('no')) {
      return {
        transcript: rawText,
        intent: 'CANCEL_IRRIGATION',
        parameters: {},
        confidence: 0.95
      };
    }
    return {
      transcript: rawText,
      intent: 'CONFIRM_IRRIGATION',
      parameters: { duration_seconds: durationSeconds },
      confidence: 0.95
    };
  }

  // CANCEL_IRRIGATION
  if (
    text.includes('వద్దు') ||
    text.includes('ఆపవద్దు') ||
    text.includes('రద్దు చేయి') ||
    text.includes('నో') ||
    text.includes('వద్దులే') ||
    text.includes('cancel')
  ) {
    return {
      transcript: rawText,
      intent: 'CANCEL_IRRIGATION',
      parameters: {},
      confidence: 0.95
    };
  }

  // PUMP_OFF
  if (
    text.includes('పంప్ ఆఫ్') ||
    text.includes('మోటార్ ఆఫ్') ||
    text.includes('నీళ్లు ఆపు') ||
    text.includes('మోటారు ఆపు') ||
    text.includes('మోటార్ బంద్') ||
    text.includes('పంప్ ఆపు') ||
    text.includes('stop pump') ||
    text.includes('turn off pump')
  ) {
    return {
      transcript: rawText,
      intent: 'PUMP_OFF',
      parameters: {},
      confidence: 0.98
    };
  }

  // PUMP_ON
  if (
    text.includes('పంప్ ఆన్') ||
    text.includes('మోటార్ ఆన్') ||
    text.includes('నీళ్లు పెట్టు') ||
    text.includes('మోటారు వేయి') ||
    text.includes('మోటార్ స్టార్ట్') ||
    text.includes('నీరు పెట్టు') ||
    text.includes('start pump') ||
    text.includes('turn on pump')
  ) {
    return {
      transcript: rawText,
      intent: 'PUMP_ON',
      parameters: { duration_seconds: durationSeconds },
      confidence: 0.96
    };
  }

  // GET_SOIL_MOISTURE
  if (
    text.includes('తేమ') ||
    text.includes('తేవ') ||
    text.includes('మట్టి') ||
    text.includes('నేలలో') ||
    text.includes('పరిస్థితి') ||
    text.includes('స్థితి') ||
    text.includes('moisture') ||
    text.includes('soil')
  ) {
    return {
      transcript: rawText,
      intent: 'GET_SOIL_MOISTURE',
      parameters: {},
      confidence: 0.95
    };
  }

  // GET_WEATHER
  if (
    text.includes('వర్షం') ||
    text.includes('వాన') ||
    text.includes('వాతావరణం') ||
    text.includes('ఎండ') ||
    text.includes('ఉష్ణోగ్రత') ||
    text.includes('weather') ||
    text.includes('rain')
  ) {
    return {
      transcript: rawText,
      intent: 'GET_WEATHER',
      parameters: {},
      confidence: 0.94
    };
  }

  // GET_RECOMMENDATION
  if (
    text.includes('నీరు పెట్టాలా') ||
    text.includes('నీళ్లు పెట్టాలా') ||
    text.includes('సిఫార్సు') ||
    text.includes('నీటి తడి') ||
    text.includes('మోటార్ వేయాలా') ||
    text.includes('recommendation') ||
    text.includes('irrigate') ||
    text.includes('water')
  ) {
    return {
      transcript: rawText,
      intent: 'GET_RECOMMENDATION',
      parameters: {},
      confidence: 0.93
    };
  }

  // GET_PUMP_HISTORY
  if (
    text.includes('ఎంతసేపు నడిచింది') ||
    text.includes('ఎంత సమయం') ||
    text.includes('చరిత్ర') ||
    text.includes('పంప్ రికార్డు') ||
    text.includes('history') ||
    text.includes('runtime')
  ) {
    return {
      transcript: rawText,
      intent: 'GET_PUMP_HISTORY',
      parameters: {},
      confidence: 0.91
    };
  }

  return {
    transcript: rawText,
    intent: 'UNKNOWN',
    parameters: {},
    confidence: 0.4
  };
}

export function generateTeluguVoiceResponse(
  intent: ParsedVoiceCommand['intent'],
  context: {
    soilMoisture?: number;
    temp?: number;
    rainProb?: number;
    precipMm?: number;
    pumpState?: boolean;
    pumpRemainingSeconds?: number;
    pumpTotalTodaySeconds?: number;
    recommendationTextTe?: string;
    recommendationType?: string;
    durationMinutes?: number;
    reason?: string;
  }
): { text_te: string; text_en: string } {
  switch (intent) {
    case 'GET_SOIL_MOISTURE': {
      const moisture = (context.soilMoisture ?? 25).toFixed(1);
      const isDry = (context.soilMoisture ?? 25) < 30;
      return {
        text_te: isDry
          ? `ప్రస్తుతం మీ నేలలో తేమ ${moisture} శాతం మాత్రమే ఉంది. మట్టి పొడిగా ఉంది.`
          : `ప్రస్తుతం మీ నేలలో తేమ ${moisture} శాతం ఉంది. తేమ బాగానే ఉంది.`,
        text_en: `Current soil moisture is ${moisture}%. ${isDry ? 'The soil is dry.' : 'Moisture is normal.'}`
      };
    }

    case 'GET_WEATHER': {
      const rain = context.rainProb ?? 10;
      const temp = (context.temp ?? 28).toFixed(1);
      return {
        text_te: rain >= 50
          ? `ఈరోజు ఉష్ణోగ్రత ${temp} డిగ్రీలు ఉంది. వర్షం వచ్చే అవకాశం ${rain} శాతం ఉంది.`
          : `ఈరోజు ఉష్ణోగ్రత ${temp} డిగ్రీలు ఉంది. వర్ష సూచన తక్కువగా ఉంది, కేవలం ${rain} శాతం మాత్రమే.`,
        text_en: `Today's temperature is ${temp}°C with a ${rain}% probability of rain.`
      };
    }

    case 'GET_RECOMMENDATION': {
      if (context.recommendationType === 'IRRIGATE_RECOMMENDED') {
        return {
          text_te: `మట్టి తేమ తక్కువగా ఉంది. వర్షం కూడా లేదు. నీరు పెట్టడం సిఫార్సు చేయబడింది. పంప్ ఆన్ చేయమంటారా?`,
          text_en: `Soil moisture is low and no rain expected. Irrigation recommended. Would you like to turn on the pump?`
        };
      } else if (context.recommendationType === 'WAIT_RECHECK') {
        return {
          text_te: `వర్షం వచ్చే అవకాశం ఉన్నందున ఇప్పుడే నీరు పెట్టడం సిఫార్సు చేయడం లేదు. వేచి చూడండి.`,
          text_en: `Rain is expected soon. Delaying irrigation is recommended.`
        };
      } else {
        return {
          text_te: `నేలలో ఇప్పటికే తగినంత తేమ ఉంది. నీరు పెట్టాల్సిన అవసరం లేదు.`,
          text_en: `Soil moisture is already sufficient. No irrigation required.`
        };
      }
    }

    case 'PUMP_ON': {
      const mins = context.durationMinutes ?? 5;
      return {
        text_te: `సరే. నీటి పంపు ${mins} నిమిషాల పాటు ప్రారంభించబడింది.`,
        text_en: `Okay. The water pump has been turned on for ${mins} minutes.`
      };
    }

    case 'PUMP_OFF': {
      return {
        text_te: `నీటి పంపు విజయవంతంగా ఆపబడింది.`,
        text_en: `Water pump has been turned off successfully.`
      };
    }

    case 'CONFIRM_IRRIGATION': {
      const mins = context.durationMinutes ?? 5;
      return {
        text_te: `ధృవీకరించబడింది. పంప్ ${mins} నిమిషాల పాటు నీరు అందిస్తుంది.`,
        text_en: `Confirmed. Pump will run for ${mins} minutes.`
      };
    }

    case 'CANCEL_IRRIGATION': {
      return {
        text_te: `సరే, నీటి తడి రద్దు చేయబడింది. పంప్ ఆఫ్ లోనే ఉంటుంది.`,
        text_en: `Understood. Irrigation cancelled. Pump remains off.`
      };
    }

    case 'GET_PUMP_HISTORY': {
      const totalMins = Math.round((context.pumpTotalTodaySeconds ?? 0) / 60);
      return {
        text_te: `ఈరోజు మోటార్ మొత్తం ${totalMins} నిమిషాలు నడిచింది.`,
        text_en: `The pump has run for a total of ${totalMins} minutes today.`
      };
    }

    default:
      return {
        text_te: `క్షమించండి, మీ ఆదేశం అర్థం కాలేదు. "తేమ ఎంత ఉంది?", "పంప్ ఆన్ చేయి", లేదా "వర్షం పడుతుందా?" అని అడగండి.`,
        text_en: `Sorry, I didn't recognize that command. You can ask for soil moisture, weather, or pump control.`
      };
  }
}
