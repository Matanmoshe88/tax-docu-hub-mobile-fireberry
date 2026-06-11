/**
 * Supabase Edge Function: check-1301-signed
 *
 * Tells the portal whether the 1301 has already been signed for an Opportunity,
 * so the documents page can show the card as locked/signed after a refresh (the
 * 1301 equivalent of how POA uses documentStatus['poa-signed']).
 *
 * "SIGNED" — two sources, newest first:
 *   1. signing_jobs table (async flow): a row exists for this record_id → signed,
 *      REGARDLESS of status. The row is the durable record of the client's signing
 *      intent; document assembly may still be running in the background.
 *   2. Legacy fallback: the audit record ("אימות חתימה") exists in the Fireberry
 *      "1301" object (type 1046) — covers records signed before the async flow.
 *
 * SELF-HEALING (the retry mechanism of the async flow):
 *   This function runs on every documents-page load anyway, so it doubles as the
 *   reconciler: if the newest job is stuck ('received'/'processing' for >3 min —
 *   a crashed background worker) or 'failed', and attempts < 5, it re-triggers
 *   processing by invoking submit-1301-signature with { retryJobId } —
 *   fire-and-forget, the page load never waits. Re-runs are idempotent (the
 *   processor deletes existing 1046 records before creating).
 *
 * REQUEST:  { "recordId": "<Fireberry Opportunity id>" }
 * RESPONSE: { "success": true, "signed": true|false, "jobStatus"?: string }
 *
 * ENV: FIREBERRY_TOKEN_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3?pin=v135'

// EdgeRuntime is provided by the Supabase edge runtime.
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FIREBERRY_API = 'https://api.fireberry.com/api'
const OBJECT_TYPE = 1046 // Fireberry "1301" object
const AUDIT_RECORD_NAME = 'אימות חתימה'
const STUCK_AFTER_MS = 3 * 60 * 1000 // job not updated for 3 min = worker died
const MAX_ATTEMPTS = 5

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { recordId } = await req.json()
    if (!recordId) {
      return json({ success: false, error: 'recordId is required' }, 400)
    }

    // ── 1) async flow: newest signing job for this Opportunity ──
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const { data: job, error: jobErr } = await supabase
      .from('signing_jobs')
      .select('id, status, attempts, updated_at')
      .eq('record_id', recordId)
      .eq('document_type', 'form_1301')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (jobErr) console.error('check-1301-signed: signing_jobs query failed:', jobErr)

    if (job) {
      // self-healing: kick stuck/failed jobs back to life (fire-and-forget)
      const stale = Date.now() - new Date(job.updated_at).getTime() > STUCK_AFTER_MS
      const needsKick =
        (job.status === 'failed' || ((job.status === 'received' || job.status === 'processing') && stale)) &&
        job.attempts < MAX_ATTEMPTS
      if (needsKick) {
        console.log(`🔁 kicking ${job.status} job ${job.id} (attempt ${job.attempts})`)
        EdgeRuntime.waitUntil(
          fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/submit-1301-signature`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({ retryJobId: job.id }),
          }).catch((e) => console.error('retry kick failed:', e)),
        )
      }
      // a job row = the client signed (intent recorded) → card locks, no re-sign
      return json({ success: true, signed: true, jobStatus: job.status }, 200)
    }

    // ── 2) legacy fallback: audit record in Fireberry 1046 ──
    const token = Deno.env.get('FIREBERRY_TOKEN_ID') ?? ''
    const res = await fetch(`${FIREBERRY_API}/query`, {
      method: 'POST',
      headers: { TokenID: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        objecttype: OBJECT_TYPE,
        fields: 'name',
        query: `(pcfopp = ${recordId})`,
        page_size: 200,
      }),
    })

    if (!res.ok) {
      console.error(`check-1301-signed: Fireberry query failed ${res.status}`)
      return json({ success: false, error: `Fireberry error ${res.status}` }, 502)
    }

    const result = await res.json()
    const rows: Array<{ name?: string }> = result?.data?.Data ?? []
    const signed = rows.some((r) => r.name === AUDIT_RECORD_NAME)

    return json({ success: true, signed }, 200)
  } catch (error) {
    console.error('check-1301-signed error:', error)
    return json({ success: false, error: 'Internal server error' }, 500)
  }
})

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
