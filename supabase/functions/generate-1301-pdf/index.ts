/**
 * Supabase Edge Function: generate-1301-pdf
 *
 * Generates the merged, multi-year 1301 first-page PDF by invoking the AWS Lambda
 * `form1301Generator` via its public Function URL, then returns it as base64 so
 * SignableDocumentModal can render it exactly like the POA PDF.
 *
 * Why fetch + re-encode to base64?
 *   The merged 1301 PDF (one page per signed tax year, ~7–8 MB) exceeds the AWS
 *   Lambda Function URL's 6 MB response limit, so the Lambda returns a presigned
 *   S3 URL (responseType "url", its default). This edge function downloads the PDF
 *   from that URL server-side (no S3 CORS needed) and returns base64 to the
 *   browser. The modal therefore needs no changes to its rendering.
 *
 * It also passes through `pages[]` — the per-page signature boxes the Lambda
 * computes — so the signing step (sign-1301-pdf) can stamp the signature on every
 * page.
 *
 * ENDPOINT: POST /functions/v1/generate-1301-pdf
 *
 * REQUEST:  { "recordId": "<Fireberry Opportunity id>" }
 *
 * RESPONSE (success):
 *   { "success": true, "data": {
 *       "pdf": "JVBERi0...",                       // base64 of the merged PDF
 *       "pages": [ { "page":1, "year":2025, "signature":{x,y,width,height} }, ... ],
 *       "pageCount": 6,
 *       "skippedYears": [2026],                     // contract years without a template/map
 *       "coordSystem": "pdf-points-bottom-left",
 *       "pageSize": { "width":595.27, "height":841.89 },
 *       "filename": "form1301-<id>.pdf",
 *       "contentType": "application/pdf"
 *   } }
 *
 * ERROR CODES (passthrough from Lambda + this fn):
 *   MISSING_RECORD_ID(400) RECORD_NOT_FOUND(404) MISSING_REQUIRED_FIELDS(400)
 *   NO_YEARS_FOUND(404) FIREBERRY_AUTH_ERROR(401) FIREBERRY_API_ERROR(502)
 *   TEMPLATE_NOT_FOUND_FOR_YEAR(500) COORDINATE_MAP_MISSING(500)
 *   PDF_GENERATION_ERROR(500) PDF_FETCH_ERROR(502) RATE_LIMITED(429) INTERNAL_ERROR(500)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Public Function URL of the AWS Lambda `form1301Generator` (auth=NONE).
// The Lambda validates recordId against Fireberry on every call.
const LAMBDA_URL = 'https://qa7xpecgk74fpxhmbm3q3fwyia0zddbe.lambda-url.eu-west-2.on.aws/'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limiting (max 5 requests / recordId / minute) — guards against loops.
const requestCounts = new Map<string, number>()

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { recordId } = await req.json()

    if (!recordId) {
      return json({ success: false, error: 'recordId is required', errorCode: 'MISSING_RECORD_ID' }, 400)
    }

    const count = requestCounts.get(recordId) || 0
    if (count > 5) {
      console.warn(`⚠️ Rate limit exceeded for recordId: ${recordId}`)
      return json({ success: false, error: 'Too many requests', errorCode: 'RATE_LIMITED' }, 429)
    }
    requestCounts.set(recordId, count + 1)
    setTimeout(() => requestCounts.delete(recordId), 60000)

    // 1) Ask the Lambda to generate the merged PDF. It returns a presigned URL
    //    (responseType defaults to "url" because the PDF is too big for base64).
    console.log(`📤 Calling form1301Generator Lambda for recordId: ${recordId}`)
    const lambdaRes = await fetch(LAMBDA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId }),
    })

    const lambdaBody = await lambdaRes.json()
    console.log(`📥 Lambda response: success=${lambdaBody.success}, errorCode=${lambdaBody.errorCode || 'none'}`)

    if (!lambdaBody.success) {
      const statusMap: Record<string, number> = {
        MISSING_RECORD_ID: 400,
        INVALID_RECORD_ID: 400,
        MISSING_REQUIRED_FIELDS: 400,
        RECORD_NOT_FOUND: 404,
        NO_YEARS_FOUND: 404,
        FIREBERRY_AUTH_ERROR: 401,
        FIREBERRY_API_ERROR: 502,
        TEMPLATE_NOT_FOUND_FOR_YEAR: 500,
        COORDINATE_MAP_MISSING: 500,
        PDF_GENERATION_ERROR: 500,
        INTERNAL_ERROR: 500,
      }
      return json(
        { success: false, error: lambdaBody.error, errorCode: lambdaBody.errorCode },
        statusMap[lambdaBody.errorCode] || 500,
      )
    }

    const data = lambdaBody.data

    // 2) Download the merged PDF from the presigned URL (server-side, no CORS).
    const pdfRes = await fetch(data.url)
    if (!pdfRes.ok) {
      return json(
        { success: false, error: `Failed to fetch generated PDF (HTTP ${pdfRes.status})`, errorCode: 'PDF_FETCH_ERROR' },
        502,
      )
    }
    const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer())
    const pdfBase64 = toBase64(pdfBytes)
    console.log(`✅ 1301 PDF fetched (${(pdfBytes.length / 1024 / 1024).toFixed(1)} MB) and base64-encoded`)

    // 3) Return base64 + the per-page signature boxes for the signing step.
    return json(
      {
        success: true,
        data: {
          pdf: pdfBase64,
          pages: data.pages,
          pageCount: data.pageCount,
          skippedYears: data.skippedYears,
          coordSystem: data.coordSystem,
          pageSize: data.pageSize,
          filename: data.filename,
          contentType: 'application/pdf',
        },
      },
      200,
    )
  } catch (error) {
    console.error('generate-1301-pdf error:', error)
    return json({ success: false, error: 'Internal server error', errorCode: 'INTERNAL_ERROR' }, 500)
  }
})

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Chunked base64 encoder — avoids call-stack overflow on large buffers.
function toBase64(bytes: Uint8Array): string {
  const chunkSize = 8192
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}
