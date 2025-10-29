import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreatePaymentRequest {
  recordId: string;
}

interface FireberryRecord {
  pcfsystemfield814: string; // first name
  pcfsystemfield815: string; // family name
  pcfsystemfield817: string; // ID number
  pcfsystemfield816: string; // phone
  pcfsystemfield822: string; // email
  pcfsystemfield819: number; // amount
  pcfsystemfield770: string; // oppid
  pcfsystemfield767: string; // accountid
}

interface CardComResponse {
  ResponseCode: string | number;
  Url?: string;
  LowProfileId?: string;
  Description?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recordId }: CreatePaymentRequest = await req.json();
    console.log('Creating payment for record:', recordId);

    const fireberryToken = Deno.env.get('FIREBERRY_TOKEN_ID');
    const cardcomTerminal = Deno.env.get('CARDCOM_TERMINAL_NUMBER');
    const cardcomApiName = Deno.env.get('CARDCOM_API_NAME');

    if (!fireberryToken || !cardcomTerminal || !cardcomApiName) {
      throw new Error('Missing required environment variables');
    }

    // Step 1: Fetch fresh Fireberry record
    console.log('Fetching Fireberry record:', recordId);
    const fireberryResponse = await fetch(
      `https://api.powerlink.co.il/api/record/1007/${recordId}`,
      {
        headers: {
          'TokenID': fireberryToken,
        },
      }
    );

    if (!fireberryResponse.ok) {
      console.error('Fireberry API error:', fireberryResponse.status);
      throw new Error(`Fireberry API error: ${fireberryResponse.status}`);
    }

    const fireberryData = await fireberryResponse.json();
    console.log('Fireberry data fetched successfully');

    const record: FireberryRecord = fireberryData.data.Record;

    // Step 2: Create CardCom payment
    console.log('Creating CardCom payment...');
    const cardcomPayload = {
      TerminalNumber: parseInt(cardcomTerminal),
      ApiName: cardcomApiName,
      ReturnValue: recordId,
      Amount: record.pcfsystemfield819,
      SuccessRedirectUrl: `https://tax-docu-hub-mobile-fireberry.lovable.app/payment-success/${recordId}`,
      FailedRedirectUrl: `https://tax-docu-hub-mobile-fireberry.lovable.app/payment-failed/${recordId}`,
      WebHookUrl: "https://hook.eu1.make.com/wl56f8mnsxz1ueb4kp3c22xzk9kmtd9e",
      UIDefinition: {
        IsHideCardOwnerName: false,
        CardOwnerNameValue: `${record.pcfsystemfield815} ${record.pcfsystemfield814}`,
        CardOwnerIdValue: record.pcfsystemfield817,
        CardOwnerPhoneValue: record.pcfsystemfield816,
        CardOwnerEmailValue: record.pcfsystemfield822,
        CustomFields: [
          { Id: 1, Value: recordId },
          { Id: 2, Value: record.pcfsystemfield770 },
          { Id: 3, Value: record.pcfsystemfield767 }
        ]
      }
    };

    console.log('CardCom payload:', JSON.stringify(cardcomPayload, null, 2));

    const cardcomResponse = await fetch(
      'https://secure.cardcom.solutions/api/v11/LowProfile/Create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cardcomPayload),
      }
    );

    const cardcomData: CardComResponse = await cardcomResponse.json();
    console.log('CardCom response:', JSON.stringify(cardcomData, null, 2));

    // ResponseCode is a number, 0 = success
    if (!cardcomResponse.ok || (cardcomData.ResponseCode !== '0' && cardcomData.ResponseCode !== 0)) {
      console.error('CardCom error:', cardcomData.Description || cardcomData.ResponseCode);
      throw new Error('CardCom payment creation failed');
    }

    // Step 3: Update Fireberry record with CardCom details
    console.log('Updating Fireberry record with payment details...');
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'); // YYYY-MM-DDTHH:mm:ssZ
    
    const updatePayload = {
      pcfsystemfield838: cardcomData.Url,
      pcfsystemfield839: cardcomData.LowProfileId,
      pcfsystemfield842: timestamp,
      pcfsystemfield843: cardcomData.ResponseCode,
    };

    console.log('Update payload:', JSON.stringify(updatePayload, null, 2));

    const updateResponse = await fetch(
      `https://api.powerlink.co.il/api/record/1007/${recordId}`,
      {
        method: 'PUT',
        headers: {
          'TokenID': fireberryToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      }
    );

    if (!updateResponse.ok) {
      console.error('Fireberry update error:', updateResponse.status);
      // Don't fail the entire request, just log it
      console.warn('Failed to update Fireberry record, but payment created successfully');
    } else {
      console.log('Fireberry record updated successfully');
    }

    // Return success with payment URL
    return new Response(
      JSON.stringify({
        success: true,
        paymentUrl: cardcomData.Url,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in create-payment function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
