import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DocumentUpdateRequest {
  docid: string;
   documentType: 'id_photo' | 'bank_statement' | 'appendix' | 'drivers_license' | 'poa_tax_auth';
  documentUrl: string;
}

// Map document types to Fireberry field names
const DOCUMENT_FIELD_MAPPING = {
  'id_photo': 'pcfsystemfield719',
  'bank_statement': 'pcfsystemfield967', 
  'appendix': 'pcfsystemfield977',
   'drivers_license': 'pcfsystemfield978',
   'poa_tax_auth': 'pcfsystemfield984'
};

async function updateDocumentUrl(
  docid: string,
  documentType: string,
  documentUrl: string
): Promise<any> {
  console.log(`🔄 Updating document URL for docid: ${docid}, type: ${documentType}`);
  
  const tokenId = Deno.env.get('FIREBERRY_TOKEN_ID');
  if (!tokenId) {
    throw new Error('Missing FIREBERRY_TOKEN_ID environment variable');
  }

  const fieldName = DOCUMENT_FIELD_MAPPING[documentType as keyof typeof DOCUMENT_FIELD_MAPPING];
  if (!fieldName) {
    throw new Error(`Invalid document type: ${documentType}`);
  }

  // Create JSON payload for PUT request
  const payload = {
    [fieldName]: documentUrl
  };

  if (Deno.env.get('ENVIRONMENT') === 'development') {
    console.log('📝 JSON payload being sent:', payload);
    console.log('🎯 Target URL:', `https://api.powerlink.co.il/api/record/1004/${docid}`);
  }

  const response = await fetch(`https://api.powerlink.co.il/api/record/1004/${docid}`, {
    method: 'PUT',
    headers: {
      'TokenId': tokenId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Fireberry document update failed:', response.status, errorText);
    throw new Error(`Failed to update document: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('✅ Document URL updated successfully in Fireberry:', result);
  return result;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('🔄 Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Document upload function called');
    console.log('📝 Request method:', req.method);
    console.log('📝 Request headers:', Object.fromEntries(req.headers.entries()));

    if (req.method !== 'POST') {
      throw new Error('Only POST method is allowed');
    }

    const body = await req.json() as DocumentUpdateRequest;
    if (Deno.env.get('ENVIRONMENT') === 'development') {
      console.log('📝 Request body:', JSON.stringify(body, null, 2));
    }

    const { documentType, documentUrl } = body;
    const recordId = (body as any).recordId as string | undefined;
    let docid = body.docid;

    if (!documentType || !documentUrl || (!docid && !recordId)) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields: documentType, documentUrl and docid or recordId' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    if (!docid && recordId) {
      if (!/^[0-9a-f-]{36}$/i.test(recordId)) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid recordId' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
        });
      }
      const q = await fetch('https://api.powerlink.co.il/api/query', {
        method: 'POST',
        headers: { 'TokenId': Deno.env.get('FIREBERRY_TOKEN_ID') || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objecttype: '1004',
          page_size: 50,
          page_number: 1,
          query: `(pcfsystemfield693 = ${recordId})`,
          fields: 'customobject1004id,createdon',
          sort_by: 'createdon',
          sort_type: 'desc',
        }),
      });
      const qj = await q.json().catch(() => null) as any;
      docid = qj?.data?.Data?.[0]?.customobject1004id;
      console.log(`🔎 Resolved docid by recordId: ${docid || 'none'}`);
      if (!docid) {
        return new Response(JSON.stringify({ success: false, error: 'No Fireberry document found for this record' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404,
        });
      }
    }

    console.log('🔄 Starting document URL update...');

    // Update document URL in Fireberry
    const updateResult = await updateDocumentUrl(
      docid,
      documentType,
      documentUrl
    );

    const response = {
      success: true,
      message: 'Document URL updated successfully in Fireberry',
      docid,
      documentType,
      documentUrl,
      updateResult
    };

    if (Deno.env.get('ENVIRONMENT') === 'development') {
      console.log('🎉 Document URL update completed successfully:', response);
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('💥 Document URL update error:', error);
    
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