/**
 * Supabase Edge Function: submit-1301-signature
 *
 * THE "SIGN & GO" ENDPOINT — replaces the old client-orchestrated chain
 * (sign-1301-pdf → storage upload → distribute-1301) with ONE call that answers
 * the client in ~1s and does all heavy work in the background.
 *
 * WHY: clients were waiting ~12s after signing because the 2.5 MB PDF crossed
 * their mobile connection 3 times (upload to sign fn → download signed → re-upload
 * to storage). The signature event itself is tiny (~20 KB PNG + audit JSON) — the
 * document assembly is back-office work the client never needed to wait for.
 *
 * HOW IT WORKS — two halves:
 *
 *   SYNCHRONOUS (client waits, ~1s):
 *     1. Validate input; capture the client IP server-side (x-forwarded-for).
 *     2. Upload the signature PNG to the 'signatures' bucket.
 *     3. Insert a signing_jobs row (status 'received') — THE durable legal record
 *        of the signing event. From this row alone the signed document can be
 *        re-assembled at any time.
 *     4. Return { success, jobId }  →  the portal shows the green light.
 *
 *   BACKGROUND (EdgeRuntime.waitUntil — client already gone):
 *     5. Fetch the unsigned merged PDF from storage (saved by generate-1301-pdf).
 *     6. Stamp the signature on EVERY page at its box (boxes from form1301Generator,
 *        PDF points, bottom-left origin — no y-flip).
 *     7. Append the audit-trail page (Hebrew font from the 'templates' bucket).
 *     8. Upload the signed merged PDF to storage.
 *     9. FIREBERRY: delete existing 1046 records for the Opportunity (prevents
 *        duplicates on re-sign/retry), then split per year + audit page → upload
 *        each → create one 1046 record each { name, pcfeport1301, pcfopp }.
 *    10. Mark the job 'completed' (or 'failed' + error).
 *
 * RETRY / SELF-HEALING:
 *   POST { "retryJobId": "<uuid>" } re-runs the background half for a stuck or
 *   failed job (invoked fire-and-forget by check-1301-signed). Safe to repeat —
 *   step 9 deletes before creating. Capped at 5 attempts.
 *
 * REQUEST (from SignableDocumentModal):
 *   {
 *     "recordId": "<Fireberry Opportunity id>",
 *     "unsignedPdfPath": "form1301-unsigned-<id>-<ts>.pdf",   // 'signatures' bucket
 *     "pages": [ { "page":1, "year":2025, "signature":{x,y,width,height} }, ... ],
 *     "signatureDataUrl": "data:image/png;base64,...",
 *     "auditData": { ... },          // WITHOUT ipAddress — stamped here, server-side
 *     "clientName": "..."            // optional, for logs
 *   }
 *   — or —  { "retryJobId": "<signing_jobs uuid>" }
 *
 * RESPONSE: { "success": true, "jobId": "<uuid>" }   (or { retried: true })
 *
 * ENV: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (storage + signing_jobs),
 *      FIREBERRY_TOKEN_ID (CRM records)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { PDFDocument, rgb, StandardFonts, type PDFFont } from 'https://esm.sh/pdf-lib@1.17.1?pin=v135'
import fontkit from 'https://esm.sh/@pdf-lib/fontkit@1.1.1?pin=v135'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3?pin=v135'

// EdgeRuntime is provided by the Supabase edge runtime.
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }

const VERSION = 'submit-1301-v1.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FIREBERRY_API = 'https://api.fireberry.com/api'
const OBJECT_TYPE = 1046 // Fireberry "1301" object
const STORAGE_BUCKET = 'signatures'
const AUDIT_RECORD_NAME = 'אימות חתימה'
const MAX_ATTEMPTS = 5

interface SignatureBox { x: number; y: number; width: number; height: number }
interface PageInfo { page: number; year?: number; signature: SignatureBox }

interface SigningJob {
  id: string
  record_id: string
  status: string
  unsigned_pdf_path: string
  signature_path: string | null
  pages: PageInfo[]
  audit_data: Record<string, unknown> | null
  attempts: number
}

function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    console.log(`🚀 ${VERSION}`)
    if (req.method !== 'POST') throw new Error('Only POST method is allowed')

    const body = await req.json()
    const supabase = serviceClient()

    // ── RETRY PATH — re-run the background half for a stuck/failed job ──
    if (body.retryJobId) {
      const { data: job, error } = await supabase
        .from('signing_jobs').select('*').eq('id', body.retryJobId).single()
      if (error || !job) return json({ success: false, error: 'Job not found' }, 404)
      if (job.status === 'completed') return json({ success: true, alreadyCompleted: true }, 200)
      if (job.attempts >= MAX_ATTEMPTS) {
        return json({ success: false, error: `Retry cap reached (${job.attempts} attempts)` }, 409)
      }
      console.log(`🔁 retrying job ${job.id} (attempt ${job.attempts + 1}, was ${job.status})`)
      EdgeRuntime.waitUntil(processJob(supabase, job as SigningJob))
      return json({ success: true, retried: true, jobId: job.id }, 200)
    }

    // ── NEW SIGNING — the synchronous half ──
    const { recordId, unsignedPdfPath, pages, signatureDataUrl, auditData, clientName } = body
    if (!recordId) throw new Error('Missing required field: recordId')
    if (!unsignedPdfPath) throw new Error('Missing required field: unsignedPdfPath')
    if (!Array.isArray(pages) || pages.length === 0) throw new Error('Missing required field: pages[]')
    if (!signatureDataUrl?.startsWith('data:image/png;base64,')) {
      throw new Error('Missing or invalid field: signatureDataUrl')
    }

    // 1) capture the client IP HERE (server-side) — replaces the old serial
    //    get-client-ip round trip the client used to wait for.
    const ipAddress =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('cf-connecting-ip') || ''
    const fullAuditData = {
      ...(auditData ?? {}),
      ipAddress,
      signatureSubmittedAt: new Date().toISOString(), // server timestamp
      recordId,
    }

    // 2) save the signature PNG (~20 KB — the only binary the client sent)
    const stamp = Date.now()
    const signaturePath = `form1301-signature-${recordId}-${stamp}.png`
    const signatureBytes = Uint8Array.from(atob(signatureDataUrl.split(',')[1]), (c) => c.charCodeAt(0))
    const { error: sigErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(signaturePath, new Blob([signatureBytes], { type: 'image/png' }), {
        contentType: 'image/png', upsert: false,
      })
    if (sigErr) throw new Error(`Signature upload failed: ${sigErr.message}`)

    // 3) durably record the signing event — THE green-light moment
    const { data: job, error: insErr } = await supabase
      .from('signing_jobs')
      .insert({
        record_id: recordId,
        document_type: 'form_1301',
        status: 'received',
        unsigned_pdf_path: unsignedPdfPath,
        signature_path: signaturePath,
        pages,
        audit_data: fullAuditData,
      })
      .select().single()
    if (insErr || !job) throw new Error(`Failed to record signing event: ${insErr?.message}`)
    console.log(`✅ signing event recorded: job ${job.id} for ${recordId} (${clientName || 'unknown'})`)

    // 4) heavy work happens AFTER the response — client gets the green light now
    EdgeRuntime.waitUntil(processJob(supabase, job as SigningJob))

    return json({ success: true, jobId: job.id }, 200)
  } catch (error) {
    console.error('💥 submit-1301-signature error:', error)
    return json({ success: false, error: (error as Error).message }, 500)
  }
})

// ════════════════════════════════════════════════════════════════════════════
// BACKGROUND HALF — assemble + distribute (the client is already gone)
// ════════════════════════════════════════════════════════════════════════════
async function processJob(supabase: SupabaseClient, job: SigningJob): Promise<void> {
  const setStatus = (fields: Record<string, unknown>) =>
    supabase.from('signing_jobs')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', job.id)

  try {
    await setStatus({ status: 'processing', attempts: job.attempts + 1 })

    // 5) fetch the unsigned merged PDF (stored by generate-1301-pdf)
    const { data: pdfFile, error: pdfErr } = await supabase.storage
      .from(STORAGE_BUCKET).download(job.unsigned_pdf_path)
    if (pdfErr || !pdfFile) throw new Error(`Unsigned PDF download failed: ${pdfErr?.message}`)
    const pdfDoc = await PDFDocument.load(new Uint8Array(await pdfFile.arrayBuffer()))
    pdfDoc.registerFontkit(fontkit)

    // fetch the signature PNG
    if (!job.signature_path) throw new Error('Job has no signature_path')
    const { data: sigFile, error: sigErr } = await supabase.storage
      .from(STORAGE_BUCKET).download(job.signature_path)
    if (sigErr || !sigFile) throw new Error(`Signature download failed: ${sigErr?.message}`)
    const signatureImage = await pdfDoc.embedPng(new Uint8Array(await sigFile.arrayBuffer()))
    const imgAspect = signatureImage.height / signatureImage.width

    // 6) stamp the SAME signature on EVERY page at its own box (bottom-left, no flip)
    const docPages = pdfDoc.getPages()
    for (const info of job.pages) {
      const idx = (info.page ?? 0) - 1
      if (idx < 0 || idx >= docPages.length || !info.signature) continue
      const box = info.signature
      docPages[idx].drawImage(signatureImage, {
        x: box.x, y: box.y, width: box.width, height: box.width * imgAspect,
      })
    }
    console.log(`✅ signature stamped on ${job.pages.length} page(s)`)

    // 7) audit-trail page (Hebrew font from the 'templates' bucket)
    const latinFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
    if (job.audit_data) {
      const { data: fontData, error: fontErr } = await supabase.storage
        .from('templates').download('NotoSansHebrew-Regular.ttf')
      if (fontErr || !fontData) throw new Error('Failed to load Hebrew font for audit trail')
      const hebrewFont = await pdfDoc.embedFont(await fontData.arrayBuffer(), { subset: false })
      addAuditTrailPage(pdfDoc, job.audit_data, hebrewFont, latinFont)
      console.log('✅ audit trail page added')
    }

    // 8) save + upload the signed merged PDF
    const signedBytes = await pdfDoc.save()
    const stamp = Date.now()
    const signedPath = `form1301-signed-${job.record_id}-${stamp}.pdf`
    const { data: up, error: upErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(signedPath, new Blob([signedBytes], { type: 'application/pdf' }), {
        contentType: 'application/pdf', upsert: false,
      })
    if (upErr) throw new Error(`Signed PDF upload failed: ${upErr.message}`)
    const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(up.path)
    await setStatus({ signed_pdf_url: pub.publicUrl })
    console.log(`✅ signed PDF saved: ${pub.publicUrl}`)

    // 9) Fireberry: delete existing 1046 records (idempotency — no duplicates on
    //    re-sign/retry), then split + upload + create fresh records.
    const token = Deno.env.get('FIREBERRY_TOKEN_ID') ?? ''
    await deleteExistingRecords(token, job.record_id)

    const merged = await PDFDocument.load(signedBytes)
    const total = merged.getPageCount()
    const failures: string[] = []

    for (const p of job.pages) {
      try {
        const idx = (p.page ?? 0) - 1
        if (idx < 0 || idx >= total) { console.warn(`skip year ${p.year}: page out of range`); continue }
        const url = await splitAndUpload(supabase, merged, idx, `form1301-${p.year}-${job.record_id}-${stamp}.pdf`)
        await createRecord(token, String(p.year ?? ''), url, job.record_id)
        console.log(`✅ year ${p.year} → 1046 record created`)
      } catch (e) {
        failures.push(`year ${p.year}: ${(e as Error).message}`)
        console.error(`❌ year ${p.year} failed:`, e)
      }
    }

    // audit page = the LAST page (beyond the year pages)
    if (total > job.pages.length) {
      try {
        const url = await splitAndUpload(supabase, merged, total - 1, `form1301-audit-${job.record_id}-${stamp}.pdf`)
        await createRecord(token, AUDIT_RECORD_NAME, url, job.record_id)
        console.log('✅ audit page → 1046 record created')
      } catch (e) {
        failures.push(`audit: ${(e as Error).message}`)
        console.error('❌ audit page failed:', e)
      }
    }

    // Any per-record failure → job 'failed' so the self-healing retry re-runs it
    // (the delete-then-create in step 9 makes the re-run safe).
    if (failures.length > 0) throw new Error(`Distribution incomplete: ${failures.join('; ')}`)

    // 10) done
    await setStatus({ status: 'completed', error: null })
    console.log(`🎉 job ${job.id} completed for ${job.record_id}`)
  } catch (error) {
    console.error(`💥 job ${job.id} failed:`, error)
    await setStatus({ status: 'failed', error: (error as Error).message })
  }
}

// ── Fireberry helpers ────────────────────────────────────────────────────────

/** Delete every existing 1046 record for the Opportunity (idempotent re-runs). */
async function deleteExistingRecords(token: string, opportunityId: string): Promise<void> {
  const res = await fetch(`${FIREBERRY_API}/query`, {
    method: 'POST',
    headers: { TokenID: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      objecttype: OBJECT_TYPE,
      fields: 'customobject1046id,name', // customobject1046id = the record's primary key
      query: `(pcfopp = ${opportunityId})`,
      page_size: 200,
    }),
  })
  if (!res.ok) throw new Error(`Fireberry query for existing 1046 records failed (${res.status})`)
  const result = await res.json()
  const rows: Array<Record<string, string>> = result?.data?.Data ?? []
  for (const row of rows) {
    const id = row.customobject1046id
    if (!id) continue
    const del = await fetch(`${FIREBERRY_API}/record/${OBJECT_TYPE}/${id}`, {
      method: 'DELETE',
      headers: { TokenID: token, 'Content-Type': 'application/json' },
    })
    if (!del.ok) throw new Error(`Failed to delete old 1046 record ${id} (${del.status})`)
    console.log(`🗑️ deleted old 1046 record ${id} (${row.name})`)
  }
}

/** Extract a single page into its own PDF, upload to storage, return public URL. */
async function splitAndUpload(
  supabase: SupabaseClient, merged: PDFDocument, pageIndex: number, fileName: string,
): Promise<string> {
  const out = await PDFDocument.create()
  const [page] = await out.copyPages(merged, [pageIndex])
  out.addPage(page)
  const bytes = await out.save()
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, new Blob([bytes], { type: 'application/pdf' }), {
      contentType: 'application/pdf', upsert: false,
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
    body: JSON.stringify({ name, pcfeport1301: fileUrl, pcfopp: opportunityId }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Fireberry create record failed (${res.status}): ${body}`)
  }
}

// ── audit-trail page (same rendering as the old sign-1301-pdf) ───────────────

function formatIsoToIsrael(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} שניות`
  const minutes = Math.floor(seconds / 60)
  const rem = seconds % 60
  return rem === 0 ? `${minutes} דקות` : `${minutes} דקות ו-${rem} שניות`
}
function isHebrewChar(char: string): boolean {
  const code = char.charCodeAt(0)
  return code >= 0x0590 && code <= 0x05FF
}
function hasHebrew(text: string): boolean { return /[֐-׿]/.test(text) }
function splitIntoSegments(text: string): Array<{ text: string; isHebrew: boolean }> {
  const segments: Array<{ text: string; isHebrew: boolean }> = []
  let cur = ''; let curHeb: boolean | null = null
  for (const ch of text) {
    const heb = isHebrewChar(ch)
    if (curHeb === null) { curHeb = heb; cur = ch }
    else if (heb === curHeb) { cur += ch }
    else { if (cur) segments.push({ text: cur, isHebrew: curHeb }); cur = ch; curHeb = heb }
  }
  if (cur) segments.push({ text: cur, isHebrew: curHeb! })
  return segments
}

function addAuditTrailPage(
  pdfDoc: PDFDocument, audit: Record<string, unknown>, hebrewFont: PDFFont, latinFont: PDFFont,
): void {
  // typed view of the audit_data jsonb (same keys the modal collects)
  const a = audit as {
    clientName?: string; clientId?: string; clientPhone?: string
    smsSentTime?: string; smsProviderStatusId?: number; smsProviderStatusDescription?: string
    otpCodeEntered?: string; otpVerified?: boolean; otpVerificationTime?: string
    contractViewedAt?: string; signatureSubmittedAt?: string; timeSpentReadingSeconds?: number
    ipAddress?: string; browserName?: string; operatingSystem?: string
    screenResolution?: string; timezone?: string; recordId?: string
  }

  const page = pdfDoc.addPage([595.28, 841.89])
  const { width, height } = page.getSize()
  let y = height - 50
  const margin = 50
  const lineHeight = 18
  const rightEdge = width - margin

  const drawLatinText = (text: string, x: number, yPos: number, size = 11, color = rgb(0, 0, 0)) =>
    page.drawText(text, { x, y: yPos, size, font: latinFont, color })
  const drawLine = (x1: number, y1: number, x2: number, thickness = 1, color = rgb(0.8, 0.8, 0.8)) =>
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y1 }, thickness, color })
  const drawMixedText = (text: string, yPos: number, size = 11, color = rgb(0, 0, 0)) => {
    if (!hasHebrew(text)) { page.drawText(text, { x: margin, y: yPos, size, font: latinFont, color }); return }
    let xPos = rightEdge
    for (const seg of splitIntoSegments(text)) {
      const font = seg.isHebrew ? hebrewFont : latinFont
      xPos -= font.widthOfTextAtSize(seg.text, size)
      page.drawText(seg.text, { x: xPos, y: yPos, size, font, color })
    }
  }
  const drawLabelValue = (label: string, value: string, yPos: number, size = 11) => {
    let xPos = rightEdge
    for (const seg of [...splitIntoSegments(label), ...splitIntoSegments(value)]) {
      const font = seg.isHebrew ? hebrewFont : latinFont
      xPos -= font.widthOfTextAtSize(seg.text, size)
      page.drawText(seg.text, { x: xPos, y: yPos, size, font, color: rgb(0, 0, 0) })
    }
  }

  drawMixedText('פרוטוקול אימות חתימה דיגיטלית', y, 18, rgb(0.15, 0.38, 0.93)); y -= 25
  drawMixedText('מסלול ביקורת - דוח 1301 לחתימה', y, 12, rgb(0.4, 0.4, 0.4)); y -= 10
  drawLine(margin, y, width - margin, 2, rgb(0.15, 0.38, 0.93)); y -= 30

  drawMixedText('פרטי הלקוח', y, 14, rgb(0.12, 0.25, 0.69)); y -= 20
  if (a.clientName) { drawLabelValue('שם מלא: ', a.clientName, y); y -= lineHeight }
  if (a.clientId) { drawLabelValue('מספר זהות: ', a.clientId, y); y -= lineHeight }
  if (a.clientPhone) { drawLabelValue('טלפון: ', a.clientPhone, y); y -= lineHeight }
  y -= 15

  const otpColor = a.otpVerified ? rgb(0.09, 0.40, 0.21) : rgb(0.86, 0.15, 0.15)
  drawMixedText('אימות טלפון (OTP)', y, 14, otpColor); y -= 20
  if (a.smsSentTime) {
    drawLabelValue('SMS נשלח: ', formatIsoToIsrael(a.smsSentTime), y); y -= lineHeight
    drawMixedText('(נשלח על ידי צד ג׳ - InforUMobile)', y, 9, rgb(0.02, 0.52, 0.40)); y -= lineHeight
    if (a.smsProviderStatusId !== undefined) {
      drawLabelValue('סטטוס: ', `${a.smsProviderStatusId} - ${a.smsProviderStatusDescription || 'הצלחה'}`, y, 9); y -= lineHeight
    }
  }
  if (a.otpCodeEntered) { drawLabelValue('קוד שהוזן: ', a.otpCodeEntered, y); y -= lineHeight }
  if (a.otpVerificationTime) { drawLabelValue('OTP אומת: ', formatIsoToIsrael(a.otpVerificationTime), y); y -= lineHeight }
  drawMixedText(`סטטוס אימות: ${a.otpVerified ? 'אומת בהצלחה' : 'לא אומת'}`, y, 11, otpColor); y -= 25

  drawMixedText('ציר זמן המסמך', y, 14, rgb(0.43, 0.16, 0.84)); y -= 20
  if (a.contractViewedAt) { drawLabelValue('המסמך נצפה: ', formatIsoToIsrael(a.contractViewedAt), y); y -= lineHeight }
  if (a.signatureSubmittedAt) { drawLabelValue('החתימה נשלחה: ', formatIsoToIsrael(a.signatureSubmittedAt), y); y -= lineHeight }
  if (a.timeSpentReadingSeconds) { drawLabelValue('זמן קריאה: ', formatDuration(a.timeSpentReadingSeconds), y); y -= lineHeight }
  y -= 15

  drawMixedText('פרטי מכשיר וחיבור', y, 14, rgb(0.85, 0.62, 0.04)); y -= 20
  if (a.ipAddress) { drawLabelValue('כתובת IP: ', a.ipAddress, y); y -= lineHeight }
  if (a.browserName) { drawLabelValue('דפדפן: ', a.browserName, y); y -= lineHeight }
  if (a.operatingSystem) { drawLabelValue('מערכת הפעלה: ', a.operatingSystem, y); y -= lineHeight }
  if (a.screenResolution) { drawLabelValue('רזולוציית מסך: ', a.screenResolution, y); y -= lineHeight }
  if (a.timezone) { drawLabelValue('אזור זמן: ', a.timezone, y); y -= lineHeight }
  y -= 15

  if (a.recordId) {
    page.drawRectangle({ x: margin, y: y - 25, width: width - 2 * margin, height: 30, color: rgb(0.95, 0.96, 0.98), borderColor: rgb(0.8, 0.85, 0.9), borderWidth: 1 })
    drawLatinText(`Record ID: ${a.recordId}`, margin + 10, y - 15, 10, rgb(0.4, 0.45, 0.53))
    y -= 45
  }

  page.drawRectangle({ x: margin, y: y - 60, width: width - 2 * margin, height: 55, color: rgb(0.94, 0.96, 1), borderColor: rgb(0.15, 0.38, 0.93), borderWidth: 2 })
  drawMixedText('תהליך חתימה', y - 20, 12, rgb(0.12, 0.25, 0.69))
  drawMixedText('פרוטוקול זה מתעד את תהליך החתימה הדיגיטלית על דוח 1301.', y - 38, 10)
  y -= 80

  drawLine(margin, y, width - margin); y -= 15
  drawMixedText('נוצר על ידי מערכת החתימה הדיגיטלית של QuickTax', y, 9, rgb(0.58, 0.64, 0.72)); y -= 12
  drawMixedText('כל הזמנים מוצגים באזור הזמן של ישראל (Asia/Jerusalem)', y, 9, rgb(0.58, 0.64, 0.72))
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
