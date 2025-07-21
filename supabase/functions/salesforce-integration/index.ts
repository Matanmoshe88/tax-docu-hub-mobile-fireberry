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

async function testFireberryAPI(): Promise<any> {
  console.log('🧪 Testing Fireberry API with minimal data');
  
  const tokenId = Deno.env.get('FIREBERRY_TOKEN_ID');
  if (!tokenId) {
    throw new Error('Missing FIREBERRY_TOKEN_ID environment variable');
  }

  // Try with just the required fields
  const formData = new FormData();
  formData.append('name', 'Test Document');
  
  console.log('📝 Test form data being sent:', {
    name: 'Test Document'
  });

  const response = await fetch('https://api.powerlink.co.il/api/record/1004', {
    method: 'POST',
    headers: {
      'TokenID': tokenId,
    },
    body: formData,
  });

  const responseText = await response.text();
  console.log('🔍 API Response Status:', response.status);
  console.log('🔍 API Response Headers:', Object.fromEntries(response.headers.entries()));
  console.log('🔍 API Response Body:', responseText);

  if (!response.ok) {
    throw new Error(`API Test failed: ${response.status} - ${responseText}`);
  }

  return JSON.parse(responseText);
}

async function uploadDocumentToFireberry(
  recordId: string,
  signatureUrl: string,
  contractUrl: string
): Promise<any> {
  console.log(`🔄 Creating new document record in Fireberry for record: ${recordId}`);
  
  const tokenId = Deno.env.get('FIREBERRY_TOKEN_ID');
  if (!tokenId) {
    throw new Error('Missing FIREBERRY_TOKEN_ID environment variable');
  }

  // Create form data for new record
  const formData = new FormData();
  formData.append('pcfsystemfield693', recordId); // Record ID field
  formData.append('name', 'חוזה חתום - מס הכנסה');
  
  // Add URLs with correct field names
  if (signatureUrl) {
    formData.append('pcfsystemfield975', signatureUrl); // Signature URL field
  }
  if (contractUrl) {
    formData.append('pcfsystemfield725', contractUrl); // Contract URL field
  }

  console.log('📝 Form data being sent:', {
    pcfsystemfield693: recordId,
    name: 'חוזה חתום - מס הכנסה',
    pcfsystemfield975: signatureUrl,
    pcfsystemfield725: contractUrl
  });

  const response = await fetch('https://api.powerlink.co.il/api/record/1004', {
    method: 'POST',
    headers: {
      'TokenID': tokenId,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Fireberry document creation failed:', response.status, errorText);
    throw new Error(`Failed to create document: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('✅ Document created successfully in Fireberry:', result);
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

    // Check if this is a test request
    if (recordId === 'TEST') {
      console.log('🧪 Running Fireberry API test...');
      const testResult = await testFireberryAPI();
      return new Response(JSON.stringify({
        success: true,
        message: 'Test completed successfully',
        testResult
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

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