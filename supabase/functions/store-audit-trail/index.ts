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
    const auditData = await req.json();

    console.log('Storing audit trail for record:', auditData.recordId);

    // Initialize Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Server timestamp for signature submission (3rd party timestamp)
    const signatureSubmittedAt = new Date().toISOString();

    // Prepare data for insert
    const insertData = {
      record_id: auditData.recordId,
      document_id: auditData.documentId || null,
      
      // Client Identity
      client_name: auditData.clientName || null,
      client_id: auditData.clientId || null,
      client_phone: auditData.clientPhone || null,
      masked_phone: auditData.maskedPhone || null,
      
      // Phone Verification - SMS Sending (InforUMobile 3rd party)
      sms_sent_time: auditData.smsSentTime || null,
      sms_provider_message_id: auditData.smsMessageId || null,
      sms_provider_status: auditData.smsProviderStatus || null,
      
      // Phone Verification - OTP Entry & Verification
      otp_code_entered: auditData.otpCodeEntered || null,
      otp_verified: auditData.otpVerified || false,
      otp_verification_time: auditData.otpVerificationTime || null,
      
      // Document Timeline (Supabase server timestamps - 3rd party)
      contract_viewed_at: auditData.contractViewedAt || null,
      signature_submitted_at: signatureSubmittedAt, // Server timestamp (3rd party)
      time_spent_reading_seconds: auditData.timeSpentReadingSeconds || null,
      
      // Device & Session Info
      ip_address: auditData.ipAddress || null,
      masked_ip_address: auditData.maskedIpAddress || null,
      user_agent: auditData.userAgent || null,
      browser_name: auditData.browserName || null,
      operating_system: auditData.operatingSystem || null,
      screen_resolution: auditData.screenResolution || null,
      timezone: auditData.timezone || null,
      language: auditData.language || null,
      
      // Document Integrity (SHA256 hashes of actual bytes)
      pdf_hash: auditData.pdfHash || null,
      signature_hash: auditData.signatureHash || null,
      
      // Storage References
      pdf_storage_path: auditData.pdfStoragePath || null,
      signature_storage_path: auditData.signatureStoragePath || null,
      pdf_public_url: auditData.pdfPublicUrl || null,
      signature_public_url: auditData.signaturePublicUrl || null,
    };

    console.log('Inserting audit trail data:', JSON.stringify(insertData, null, 2));

    const { data, error } = await supabase
      .from('audit_trails')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error storing audit trail:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to store audit trail', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Audit trail stored successfully:', data.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        auditTrailId: data.id,
        signatureSubmittedAt: signatureSubmittedAt,
        message: 'Audit trail stored successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in store-audit-trail:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});