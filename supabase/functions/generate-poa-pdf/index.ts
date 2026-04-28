/**
 * Supabase Edge Function: generate-poa-pdf
 *
 * Generates Power of Attorney PDF (Form 2279/א5) by invoking the AWS Lambda
 * `powerOfAttorneyPdfGenerator` via its public Function URL.
 *
 * Why no AWS SDK?
 *   The @aws-sdk/client-lambda package transitively imports
 *   @aws-sdk/xml-builder which uses a CJS/ESM mix that breaks in Deno's
 *   edge runtime ("Expected to resolve main module, got Import instead").
 *   Plain fetch to the Lambda's Function URL avoids the issue entirely.
 *
 * ENDPOINT: POST /functions/v1/generate-poa-pdf
 *
 * REQUEST:
 *   {
 *     "recordId": "3b419d18-...",   // Fireberry Opportunity ID (required)
 *     "responseType": "base64"       // Optional: "base64" (default) or "url"
 *   }
 *
 * RESPONSE (success):
 *   {
 *     "success": true,
 *     "data": {
 *       "pdf": "JVBERi0xLjQK...",   // base64 (when responseType=base64)
 *       "url": "https://...",         // S3 presigned URL (when responseType=url)
 *       "filename": "poa-3b419d18.pdf",
 *       "contentType": "application/pdf"
 *     }
 *   }
 *
 * ERROR CODES (passthrough from Lambda):
 *   - MISSING_RECORD_ID (400)
 *   - INVALID_RECORD_ID (400)
 *   - MISSING_REQUIRED_FIELDS (400)
 *   - RECORD_NOT_FOUND (404)
 *   - FIREBERRY_AUTH_ERROR (401)
 *   - FIREBERRY_API_ERROR (502)
 *   - TEMPLATE_NOT_FOUND (500)
 *   - PDF_GENERATION_ERROR (500)
 *   - INTERNAL_ERROR (500)
 *   - RATE_LIMITED (429, this Edge Function only)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Public Function URL of the AWS Lambda (auth=NONE).
// The Lambda validates recordId against Fireberry on every call,
// so an attacker can only generate PoAs for valid Opportunity UUIDs
// they already happen to know — same effective surface as before.
const LAMBDA_URL = 'https://f3uqwpbcos2alqwv3ckjgyj47y0egxjq.lambda-url.eu-west-2.on.aws/'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limiting to prevent infinite loop attacks (max 5 requests / recordId / minute)
const requestCounts = new Map<string, number>()

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { recordId, responseType = 'base64' } = await req.json()

    if (!recordId) {
      return new Response(
        JSON.stringify({ success: false, error: 'recordId is required', errorCode: 'MISSING_RECORD_ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Rate limit: max 5 requests per recordId per minute
    const count = requestCounts.get(recordId) || 0
    if (count > 5) {
      console.warn(`⚠️ Rate limit exceeded for recordId: ${recordId}`)
      return new Response(
        JSON.stringify({ success: false, error: 'Too many requests', errorCode: 'RATE_LIMITED' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    requestCounts.set(recordId, count + 1)
    setTimeout(() => requestCounts.delete(recordId), 60000)

    // Forward to Lambda Function URL
    const lambdaPayload = { recordId, responseType }
    console.log(`📤 Sending request to Lambda:`, JSON.stringify(lambdaPayload))

    const lambdaRes = await fetch(LAMBDA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lambdaPayload),
    })

    // Lambda Function URL returns the handler's response body directly
    // (no envelope wrapping like Invoke API), so the body IS the result.
    const body = await lambdaRes.json()
    console.log(`📥 Lambda response: success=${body.success}, errorCode=${body.errorCode || 'none'}`)

    // Handle Lambda errors with specific error codes
    if (!body.success) {
      const statusMap: Record<string, number> = {
        'MISSING_RECORD_ID': 400,
        'INVALID_RECORD_ID': 400,
        'MISSING_REQUIRED_FIELDS': 400,
        'RECORD_NOT_FOUND': 404,
        'FIREBERRY_AUTH_ERROR': 401,
        'FIREBERRY_API_ERROR': 502,
        'TEMPLATE_NOT_FOUND': 500,
        'PDF_GENERATION_ERROR': 500,
        'INTERNAL_ERROR': 500,
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: body.error,
          errorCode: body.errorCode,
        }),
        {
          status: statusMap[body.errorCode] || 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Success
    return new Response(
      JSON.stringify({ success: true, data: body.data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', errorCode: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
