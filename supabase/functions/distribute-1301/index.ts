/**
 * Supabase Edge Function: distribute-1301
 *
 * Runs AFTER the merged, signed 1301 PDF is saved to storage. It splits that PDF
 * into per-year files and creates one record per year in the Fireberry "1301"
 * object (type 1046). The audit page becomes its own separate record.
 *
 * IMPORTANT — the client does NOT wait for this:
 *   The modal invokes this function FIRE-AND-FORGET right after the merged file is
 *   uploaded (the client already got the green light). This function returns 200
 *   immediately and does the real work in the background via EdgeRuntime.waitUntil,
 *   so it completes even though the client has moved on.
 *
 * REQUEST (from the modal):
 *   {
 *     "signedPdfUrl": "https://…/signatures/form1301-signed-<id>-<ts>.pdf",
 *     "pages": [ { "page": 1, "year": 2025, ... }, … ],   // year→page map (from the Lambda)
 *     "recordId": "<Fireberry Opportunity id>",
 *     "clientName": "…"                                    // optional, for logs
 *   }
 *
 * WHAT IT DOES (background):
 *   1. Download the merged signed PDF (6 year pages + 1 audit page).
 *   2. For each year in `pages`: extract that single page → upload to storage →
 *      create a 1301 record { name: "<year>", pcfeport1301: <url>, pcfopp: <recordId> }.
 *   3. Extract the LAST page (audit) → upload → create a 1301 record
 *      { name: "אימות חתימה", pcfeport1301: <url>, pcfopp: <recordId> }.
 *
 * Each year is processed independently — one failure is logged and does not stop
 * the others. (No automatic retry; failures are visible in the function logs.)
 *
 * FIREBERRY 1301 OBJECT (type 1046):
 *   name           text    → the tax year, e.g. "2025" (audit record: "אימות חתימה")
 *   pcfeport1301   url     → the split file URL
 *   pcfopp         lookup  → the Opportunity record id
 *
 * ENV: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (storage), FIREBERRY_TOKEN_ID (CRM).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1?pin=v135'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3?pin=v135'

// EdgeRuntime is provided by the Supabase edge runtime.
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FIREBERRY_API = 'https://api.fireberry.com/api'
const OBJECT_TYPE = 1046 // Fireberry "1301" object
const STORAGE_BUCKET = 'signatures'
const AUDIT_RECORD_NAME = 'אימות חתימה' // name for the audit-page record

interface PageInfo { page: number; year?: number }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { signedPdfUrl, pages, recordId, clientName } = await req.json()

    if (!signedPdfUrl || !Array.isArray(pages) || pages.length === 0 || !recordId) {
      return json({ success: false, error: 'signedPdfUrl, pages[] and recordId are required' }, 400)
    }

    console.log(`🚀 distribute-1301 queued for ${recordId} (${clientName || 'unknown'}), ${pages.length} year(s)`)

    // Return immediately; do the splitting + CRM records in the background.
    EdgeRuntime.waitUntil(distribute(signedPdfUrl, pages as PageInfo[], recordId))

    return json({ success: true, queued: true }, 200)
  } catch (error) {
    console.error('distribute-1301 error:', error)
    return json({ success: false, error: 'Internal server error' }, 500)
  }
})

async function distribute(signedPdfUrl: string, pages: PageInfo[], recordId: string): Promise<void> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
  const token = Deno.env.get('FIREBERRY_TOKEN_ID') ?? ''

  // 1) download the merged signed PDF
  const res = await fetch(signedPdfUrl)
  if (!res.ok) {
    console.error(`❌ Failed to download signed PDF (${res.status}) ${signedPdfUrl}`)
    return
  }
  const mergedBytes = new Uint8Array(await res.arrayBuffer())
  const merged = await PDFDocument.load(mergedBytes)
  const total = merged.getPageCount()
  const stamp = Date.now()

  // 2) one record per year (year page only)
  for (const p of pages) {
    try {
      const idx = (p.page ?? 0) - 1
      if (idx < 0 || idx >= total) { console.warn(`skip year ${p.year}: page ${p.page} out of range`); continue }
      const url = await splitAndUpload(supabase, merged, idx, `form1301-${p.year}-${recordId}-${stamp}.pdf`)
      await createRecord(token, String(p.year ?? ''), url, recordId)
      console.log(`✅ year ${p.year} → record created`)
    } catch (e) {
      console.error(`❌ year ${p.year} failed:`, e)
    }
  }

  // 3) audit page = the LAST page, if the signed PDF has one beyond the year pages
  if (total > pages.length) {
    try {
      const url = await splitAndUpload(supabase, merged, total - 1, `form1301-audit-${recordId}-${stamp}.pdf`)
      await createRecord(token, AUDIT_RECORD_NAME, url, recordId)
      console.log('✅ audit page → record created')
    } catch (e) {
      console.error('❌ audit page failed:', e)
    }
  }

  console.log(`🎉 distribute-1301 done for ${recordId}`)
}

/** Extract a single page into its own PDF, upload to storage, return the public URL. */
async function splitAndUpload(
  supabase: ReturnType<typeof createClient>,
  merged: PDFDocument,
  pageIndex: number,
  fileName: string,
): Promise<string> {
  const out = await PDFDocument.create()
  const [page] = await out.copyPages(merged, [pageIndex])
  out.addPage(page)
  const bytes = await out.save()

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, new Blob([bytes], { type: 'application/pdf' }), {
      contentType: 'application/pdf',
      upsert: false,
    })
  if (error) throw error

  const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.path)
  return pub.publicUrl
}

/** Create one Fireberry 1301 (type 1046) record. */
async function createRecord(token: string, name: string, fileUrl: string, opportunityId: string): Promise<void> {
  const res = await fetch(`${FIREBERRY_API}/record/${OBJECT_TYPE}`, {
    method: 'POST',
    headers: { TokenID: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      pcfeport1301: fileUrl, // url field ("דוח")
      pcfopp: opportunityId, // lookup → Opportunity
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Fireberry create record failed (${res.status}): ${body}`)
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
