import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FireberryPaymentData {
  pcfsystemfield814: string; // first name
  pcfsystemfield815: string; // last name
  pcfsystemfield804: string; // date of refund
  pcfsystemfield803: number; // refund amount
  pcfsystemfield812: number; // commission
  pcfsystemfield813: number; // amount no vat
  pcfsystemfield819: number; // amount to pay
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
          'TokenID': '5faa4ab2-0ff7-4cbf-ae58-ba040ce51ae2',
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Fireberry API error: ${response.status}`);
    }

    const data = await response.json() as FireberryPaymentData;

    console.log('Fireberry payment data:', data);

    const paymentData = {
      clientName: `${data.pcfsystemfield814} ${data.pcfsystemfield815}`,
      depositDate: data.pcfsystemfield804,
      refundAmount: data.pcfsystemfield803,
      commissionRate: data.pcfsystemfield812,
      feeBeforeVAT: data.pcfsystemfield813,
      totalPayment: data.pcfsystemfield819,
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
