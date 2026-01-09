import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple admin password check - you can change this
const ADMIN_PASSWORD = 'quicktax2024';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { setting_key, setting_value, admin_password } = await req.json();

    if (!setting_key || setting_value === undefined) {
      return new Response(
        JSON.stringify({ error: 'setting_key and setting_value are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Simple admin password check
    if (admin_password !== ADMIN_PASSWORD) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update or insert the setting
    const { data, error } = await supabase
      .from('system_settings')
      .upsert({
        setting_key,
        setting_value,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'setting_key'
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating setting:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to update setting' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Setting updated:', setting_key, setting_value);
    return new Response(
      JSON.stringify({ success: true, setting: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in update-settings:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
