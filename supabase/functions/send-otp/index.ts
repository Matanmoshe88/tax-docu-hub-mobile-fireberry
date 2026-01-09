import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone number to international format
    let normalizedPhone = phone.replace(/[\s\-()]/g, '');
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '+972' + normalizedPhone.substring(1);
    } else if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = '+972' + normalizedPhone;
    }

    console.log('Sending OTP to:', normalizedPhone);

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Delete any existing OTP for this phone
    await supabase
      .from('otp_codes')
      .delete()
      .eq('phone', normalizedPhone);

    // Store OTP with 5-minute expiry
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { error: insertError } = await supabase
      .from('otp_codes')
      .insert({
        phone: normalizedPhone,
        code: code,
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error('Error storing OTP:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate OTP' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send SMS via InforUMobile
    const inforuToken = Deno.env.get('INFORU_API_TOKEN');
    if (!inforuToken) {
      console.error('INFORU_API_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'SMS service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use local phone format for SMS
    let smsPhone = phone.replace(/[\s\-()]/g, '');
    if (smsPhone.startsWith('+972')) {
      smsPhone = '0' + smsPhone.substring(4);
    } else if (smsPhone.startsWith('972')) {
      smsPhone = '0' + smsPhone.substring(3);
    }

    console.log('SMS Phone (local format):', smsPhone);
    
    const authHeader = inforuToken.startsWith('Basic ') ? inforuToken : `Basic ${inforuToken}`;

    const requestBody = {
      Data: {
        Message: `קוד האימות שלך ל-QuickTax: ${code}`,
        Recipients: [{ Phone: smsPhone }],
        Settings: {
          Sender: 'Quicktax',
        },
      },
    };

    console.log('Sending SMS request...');

    const smsResponse = await fetch('https://capi.inforu.co.il/api/v2/SMS/SendSms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': authHeader,
      },
      body: JSON.stringify(requestBody),
    });

    const smsResult = await smsResponse.json();
    console.log('InforUMobile response:', JSON.stringify(smsResult));

    if (smsResult.StatusId !== 1) {
      console.error('SMS sending failed:', smsResult);
      return new Response(
        JSON.stringify({ error: 'Failed to send SMS', details: smsResult.StatusDescription }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'OTP sent successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-otp:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
