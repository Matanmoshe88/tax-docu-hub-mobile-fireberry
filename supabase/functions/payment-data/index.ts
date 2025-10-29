import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface FireberryResponse {
  success: boolean;
  data: {
    Record: {
      pcfsystemfield814: string; // first name
      pcfsystemfield815: string; // last name
      pcfsystemfield804: string; // date of refund
      pcfsystemfield803: number; // refund amount
      pcfsystemfield812: number; // commission
      pcfsystemfield813: number; // amount no vat
      pcfsystemfield819: number; // amount to pay
      pcfsystemfield811: number; // payment status (1=not paid, 2/3=paid)
      pcfsystemfield838: string; // CardCom payment URL
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recordId } = await req.json();

    if (!recordId) {
      throw new Error('Record ID is required');
    }

    console.log('Fetching payment data for record:', recordId);

    const response = await fetch(
      `https://api.fireberry.com/api/record/customobject1007/${recordId}`,
      {
        method: 'GET',
        headers: {
          'TokenID': Deno.env.get('FIREBERRY_TOKEN_ID') || '',
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Fireberry API error: ${response.status}`);
    }

    const fireberryData = await response.json() as FireberryResponse;

    console.log('Fireberry payment data:', fireberryData);

    const record = fireberryData.data.Record;

    const paymentData = {
      clientName: `${record.pcfsystemfield814} ${record.pcfsystemfield815}`,
      depositDate: record.pcfsystemfield804,
      refundAmount: record.pcfsystemfield803,
      commissionRate: record.pcfsystemfield812,
      feeBeforeVAT: record.pcfsystemfield813,
      totalPayment: record.pcfsystemfield819,
      paymentStatus: record.pcfsystemfield811,
      paymentUrl: record.pcfsystemfield838,
    };

    return new Response(
      JSON.stringify({ success: true, data: paymentData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching payment data:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
