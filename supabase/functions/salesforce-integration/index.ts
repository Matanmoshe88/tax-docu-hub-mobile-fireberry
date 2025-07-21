import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DocumentUploadRequest {
  recordId: string;
  signatureUrl: string;
  contractUrl: string;
}

async function uploadDocumentToFireberry(
  recordId: string,
  signatureUrl: string,
  contractUrl: string
): Promise<any> {
  console.log(`🔄 Updating Fireberry record with signature and contract URLs: ${recordId}`);
  
  const tokenId = Deno.env.get('FIREBERRY_TOKEN_ID');
  if (!tokenId) {
    throw new Error('Missing FIREBERRY_TOKEN_ID environment variable');
  }

  // Create form data to update the existing opportunity record
  const formData = new FormData();
  formData.append('pcfsystemfield976', signatureUrl); // Signature URL field
  formData.append('pcfsystemfield725', contractUrl);  // Contract URL field

  // Update the existing opportunity record (table 1003 for opportunities)
  const response = await fetch(`https://api.powerlink.co.il/api/record/1003/${recordId}`, {
    method: 'PUT',
    headers: {
      'TokenID': tokenId,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Fireberry record update failed:', response.status, errorText);
    throw new Error(`Failed to update record: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('✅ Record updated successfully in Fireberry:', result);
  return result;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('🔄 Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Fireberry document upload function called');
    console.log('📝 Request method:', req.method);
    console.log('📝 Request headers:', Object.fromEntries(req.headers.entries()));

    if (req.method !== 'POST') {
      throw new Error('Only POST method is allowed');
    }

    const body = await req.json() as DocumentUploadRequest;
    console.log('📝 Request body:', JSON.stringify(body, null, 2));

    const { recordId, signatureUrl, contractUrl } = body;

    if (!recordId || !signatureUrl || !contractUrl) {
      throw new Error('Missing required fields: recordId, signatureUrl, contractUrl');
    }

    console.log('🔄 Starting Fireberry document upload...');

    // Upload document to Fireberry
    const uploadResult = await uploadDocumentToFireberry(
      recordId, 
      signatureUrl, 
      contractUrl
    );

    const response = {
      success: true,
      message: 'Document uploaded successfully to Fireberry',
      fireberryId: uploadResult.id,
      recordId,
      signatureUrl,
      contractUrl,
    };

    console.log('🎉 Fireberry document upload completed successfully:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('💥 Fireberry document upload error:', error);
    
    const errorResponse = {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(errorResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});