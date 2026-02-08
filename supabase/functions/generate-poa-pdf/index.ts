/**
 * Supabase Edge Function: generate-poa-pdf
 *
 * Generates Power of Attorney PDF (Form 2279/א5) by invoking AWS Lambda.
 *
 * ENDPOINT: POST /functions/v1/generate-poa-pdf
 *
 * REQUEST:
 *   {
 *     "recordId": "3b419d18-...",  // Fireberry Opportunity ID (required)
 *     "responseType": "base64"      // Optional: "base64" (default) or "url"
 *   }
 *
 * RESPONSE (success):
 *   {
 *     "success": true,
 *     "data": {
 *       "pdf": "JVBERi0xLjQK...",  // base64 encoded PDF
 *       "filename": "poa-3b419d18.pdf",
 *       "contentType": "application/pdf"
 *     }
 *   }
 *
 * ERROR CODES:
 *   - MISSING_RECORD_ID (400)
 *   - INVALID_RECORD_ID (400)
 *   - MISSING_REQUIRED_FIELDS (400)
 *   - RECORD_NOT_FOUND (404)
 *   - FIREBERRY_AUTH_ERROR (401)
 *   - FIREBERRY_API_ERROR (502)
 *   - TEMPLATE_NOT_FOUND (500)
 *   - PDF_GENERATION_ERROR (500)
 *   - INTERNAL_ERROR (500)
 *
 * REQUIRED SECRETS:
 *   - AWS_ACCESS_KEY_ID
 *   - AWS_SECRET_ACCESS_KEY
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { LambdaClient, InvokeCommand } from 'npm:@aws-sdk/client-lambda'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limiting to prevent infinite loop attacks
const requestCounts = new Map<string, number>();

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { recordId, responseType = 'base64' } = await req.json()

    // Rate limit: max 5 requests per recordId per minute
    const count = requestCounts.get(recordId) || 0;
    if (count > 5) {
      console.warn(`⚠️ Rate limit exceeded for recordId: ${recordId}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Too many requests', errorCode: 'RATE_LIMITED' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    requestCounts.set(recordId, count + 1);
    setTimeout(() => requestCounts.delete(recordId), 60000);

    if (!recordId) {
      return new Response(
        JSON.stringify({ success: false, error: 'recordId is required', errorCode: 'MISSING_RECORD_ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Lambda client with credentials from secrets
    const lambda = new LambdaClient({
      region: 'eu-west-2',
      credentials: {
        accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY')!,
      },
    })

    // Log the request being sent to Lambda
    const lambdaPayload = { recordId, responseType };
    console.log(`📤 Sending request to Lambda:`, JSON.stringify(lambdaPayload));

    // Invoke Lambda
    const response = await lambda.send(new InvokeCommand({
      FunctionName: 'powerOfAttorneyPdfGenerator',
      Payload: JSON.stringify(lambdaPayload),
    }))

    // Parse Lambda response
    const lambdaResultRaw = new TextDecoder().decode(response.Payload);
    console.log(`📥 Raw Lambda response:`, lambdaResultRaw);
    
    const lambdaResult = JSON.parse(lambdaResultRaw);
    console.log(`📥 Lambda statusCode: ${lambdaResult.statusCode}`);
    
    const body = JSON.parse(lambdaResult.body);
    console.log(`📥 Lambda body success: ${body.success}, errorCode: ${body.errorCode || 'none'}`)

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
          errorCode: body.errorCode
        }),
        {
          status: statusMap[body.errorCode] || 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Return success response
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
