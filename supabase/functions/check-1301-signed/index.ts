/**
 * Supabase Edge Function: check-1301-signed
 *
 * Tells the portal whether the 1301 has already been signed for an Opportunity,
 * so the documents page can show the card as locked/signed after a refresh (the
 * 1301 equivalent of how POA uses documentStatus['poa-signed']).
 *
 * "Signed" = the distribution finished and created the audit record. We detect it
 * by querying the Fireberry "1301" object (type 1046) for the Opportunity and
 * checking whether any record's `name` is the audit-record name ("אימות חתימה").
 *
 * REQUEST:  { "recordId": "<Fireberry Opportunity id>" }
 * RESPONSE: { "success": true, "signed": true|false }
 *
 * ENV: FIREBERRY_TOKEN_ID
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FIREBERRY_API = 'https://api.fireberry.com/api'
const OBJECT_TYPE = 1046 // Fireberry "1301" object
const AUDIT_RECORD_NAME = 'אימות חתימה' // created last by distribute-1301

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { recordId } = await req.json()
    if (!recordId) {
      return json({ success: false, error: 'recordId is required' }, 400)
    }

    const token = Deno.env.get('FIREBERRY_TOKEN_ID') ?? ''

    // All 1301 records for this Opportunity (page_size high enough to include the
    // audit record even if the form was signed more than once).
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
