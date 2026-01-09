import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📍 Getting client IP address...');
    
    // Get IP from various headers (in order of preference)
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const cfConnectingIp = req.headers.get('cf-connecting-ip');
    
    let clientIp = 'Unknown';
    
    if (cfConnectingIp) {
      clientIp = cfConnectingIp;
    } else if (forwardedFor) {
      // x-forwarded-for can contain multiple IPs, get the first one
      clientIp = forwardedFor.split(',')[0].trim();
    } else if (realIp) {
      clientIp = realIp;
    }
    
    console.log('✅ Client IP:', clientIp);
    
    // Get additional headers for audit
    const userAgent = req.headers.get('user-agent') || 'Unknown';
    
    return new Response(
      JSON.stringify({
        success: true,
        ip: clientIp,
        userAgent,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Error getting client IP:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to get client IP',
        ip: 'Unknown',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Return 200 even on error to not break the flow
      }
    );
  }
});
