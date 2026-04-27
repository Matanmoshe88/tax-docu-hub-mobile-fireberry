import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Always returns 200. Logging must never surface errors to clients.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { event, recordId, clientId, payload, error, userAgent } = body ?? {};

    if (!event || typeof event !== "string") {
      return new Response(
        JSON.stringify({ ok: false, reason: "missing_event" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { error: insertError } = await supabase
      .from("poa_flow_logs")
      .insert({
        event: String(event).slice(0, 100),
        record_id: recordId ? String(recordId).slice(0, 100) : null,
        client_id: clientId ? String(clientId).slice(0, 50) : null,
        payload: payload ?? null,
        error: error ? String(error).slice(0, 500) : null,
        user_agent: userAgent ? String(userAgent).slice(0, 500) : null,
      });

    if (insertError) {
      console.error("poa_flow_logs insert failed:", insertError.message);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("log-poa-event error:", e);
    return new Response(JSON.stringify({ ok: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
