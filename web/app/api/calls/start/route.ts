import { NextRequest, NextResponse } from 'next/server';
import { getVoiceCallProvider } from '@/lib/calling/provider';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const provider = getVoiceCallProvider();

    const callState = await provider.initiateCall({
      farmId: body.farm_id || '11111111-1111-1111-1111-111111111111',
      recipientPhone: body.phone_number || '+91 98765 43210',
      farmerName: body.farmer_name || 'రామేశ్ కుమార్ (Ramesh Kumar)',
      soilMoisture: Number(body.soil_moisture || 22.0),
      rainProbability: Number(body.rain_probability || 12.0),
      suggestedDurationSeconds: Number(body.suggested_duration_seconds || 180),
      explanationTe: body.explanation_te || 'మట్టి తేమ తక్కువగా ఉంది, నీరు పెట్టడం సిఫార్సు చేయబడింది.'
    });

    return NextResponse.json({
      success: true,
      call: callState
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
