import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FireberryOpportunity {
  pcfsystemfield509: string; // first name
  pcfsystemfield511: string; // last name
  pcfsystemfield515: string; // id number
  pcfsystemfield703: number; // commission
  pcfsystemfield527: string; // city
  pcfsystemfield530: string; // street
  pcfsystemfield532: string; // home number
  pcfsystemfield1260: string; // contract session timestamp
}

interface LeadData {
  Id: string;
  Name: string;
  id__c: string;
  MobilePhone: string;
  Commission__c: number;
  fulladress__c: string;
  ContractSessionTimestamp: string;
}

interface FireberryDataResponse {
  success: boolean;
  data?: {
    leadData: LeadData;
    shouldRedirect?: boolean;
    redirectTo?: string;
  };
  error?: string;
}

async function getOpportunityData(opportunityId: string): Promise<LeadData> {
  console.log(`📋 Fetching opportunity data for: ${opportunityId}`);
  
  const tokenId = Deno.env.get('FIREBERRY_TOKEN_ID');
  if (!tokenId) {
    throw new Error('Missing FIREBERRY_TOKEN_ID environment variable');
  }

  const response = await fetch(
    `https://api.fireberry.com/api/record/Opportunity/${opportunityId}`,
    {
      headers: {
        'TokenID': tokenId,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch opportunity data: ${response.status} - ${errorText}`);
  }

  const opportunityData = await response.json() as any;
  console.log('✅ Opportunity data fetched successfully');
  console.log('🔍 Raw Fireberry response:', JSON.stringify(opportunityData, null, 2));
  console.log('🔍 Available fields:', Object.keys(opportunityData));

  // Extract the actual record data from the nested response
  const record = opportunityData.data?.Record || {};
  console.log('🔍 Extracted record:', JSON.stringify(record, null, 2));

  // Map Fireberry fields to our LeadData interface using correct field names
  const leadData: LeadData = {
    Id: opportunityId,
    Name: `${record.pcfsystemfield509 || ''} ${record.pcfsystemfield511 || ''}`.trim(),
    id__c: record.pcfsystemfield515 || '',
    MobilePhone: '', // Not available in this response
    Commission__c: (record.pcfsystemfield703 || 23) - 1, // Always subtract 1 from commission
    fulladress__c: '', // Address removed per user request
    ContractSessionTimestamp: record.pcfsystemfield1260 || '',
  };

  console.log('🔍 Final mapped leadData:', JSON.stringify(leadData, null, 2));

  return leadData;
}

async function queryExistingDocument(recordId: string, contractSessionTimestamp: string): Promise<string | null> {
  console.log(`🔍 Querying existing document for recordId: ${recordId}, contractSessionTimestamp: ${contractSessionTimestamp}`);
  
  const tokenId = Deno.env.get('FIREBERRY_TOKEN_ID');
  if (!tokenId) {
    throw new Error('Missing FIREBERRY_TOKEN_ID environment variable');
  }

  const response = await fetch('https://api.powerlink.co.il/api/query', {
    method: 'POST',
    headers: {
      'TokenID': tokenId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      "objecttype": "1004",
      "sort_type": "desc",
      "query": `(pcfsystemfield693 = ${recordId} AND pcfsystemfield979 = ${contractSessionTimestamp})`,
      "fields": "customobject1004id"
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to query existing document: ${response.status} - ${errorText}`);
  }

  const queryResult = await response.json() as any;
  console.log('🔍 Document query result:', JSON.stringify(queryResult, null, 2));

  // Check if any documents were found
  if (queryResult.data && queryResult.data.length > 0) {
    const documentId = queryResult.data[0].customobject1004id;
    console.log(`✅ Found existing document with ID: ${documentId}`);
    return documentId;
  }

  console.log('❌ No existing document found');
  return null;
}

async function createNewDocument(recordId: string, contractSessionTimestamp: string): Promise<void> {
  console.log(`📝 Creating new document for recordId: ${recordId}`);
  
  const tokenId = Deno.env.get('FIREBERRY_TOKEN_ID');
  if (!tokenId) {
    throw new Error('Missing FIREBERRY_TOKEN_ID environment variable');
  }

  const response = await fetch('https://api.fireberry.com/api/record/1004', {
    method: 'POST',
    headers: {
      'TokenID': tokenId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pcfsystemfield693: recordId,
      pcfsystemfield979: contractSessionTimestamp,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create document: ${response.status} - ${errorText}`);
  }

  const result = await response.json() as any;
  console.log('✅ Document created successfully:', JSON.stringify(result, null, 2));
}

async function fetchDocumentDetails(documentId: string): Promise<string | null> {
  console.log(`📋 Fetching document details for ID: ${documentId}`);
  
  const tokenId = Deno.env.get('FIREBERRY_TOKEN_ID');
  if (!tokenId) {
    throw new Error('Missing FIREBERRY_TOKEN_ID environment variable');
  }

  const response = await fetch(`https://api.fireberry.com/api/record/1004/${documentId}`, {
    method: 'GET',
    headers: {
      'TokenID': tokenId,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch document details: ${response.status} - ${errorText}`);
  }

  const documentData = await response.json() as any;
  console.log('🔍 Document details:', JSON.stringify(documentData, null, 2));

  // Extract the contract field (pcfsystemfield725)
  const record = documentData.data?.Record || {};
  const contractField = record.pcfsystemfield725 || '';
  
  console.log(`🔍 Contract field value: ${contractField}`);
  return contractField;
}

serve(async (req) => {
  console.log('🚀 Fireberry data function called');
  console.log(`📝 Request method: ${req.method}`);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('🔄 Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    // Get leadId from request body
    const body = await req.json().catch(() => ({}));
    const leadId = body.leadId;
    
    if (!leadId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Lead ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log(`🔄 Processing opportunity ID: ${leadId}`);

    // Fetch opportunity data from Fireberry
    const leadData = await getOpportunityData(leadId);

    // Check if there's an existing document with the same contract session
    const existingDocumentId = await queryExistingDocument(leadId, leadData.ContractSessionTimestamp);

    let shouldRedirect = false;
    let redirectTo = '';

    if (!existingDocumentId) {
      // No existing document found, create a new one
      console.log('📝 No existing document found, creating new document');
      await createNewDocument(leadId, leadData.ContractSessionTimestamp);
      console.log('✅ New document created, staying on contract screen');
    } else {
      // Document exists, fetch its details to check if contract is already signed
      console.log('📋 Existing document found, checking contract status');
      const contractField = await fetchDocumentDetails(existingDocumentId);
      
      if (contractField && contractField.trim() !== '') {
        // Contract is already signed, redirect to documents screen
        console.log('✅ Contract already signed, redirecting to documents screen');
        shouldRedirect = true;
        redirectTo = `/documents/${leadId}`;
      } else {
        // Contract not signed yet, stay on contract screen
        console.log('📝 Contract not signed yet, staying on contract screen');
      }
    }

    const response: FireberryDataResponse = {
      success: true,
      data: {
        leadData,
        shouldRedirect,
        redirectTo,
      }
    };

    console.log('🎉 Fireberry data fetch completed successfully');

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('💥 Fireberry data fetch error:', error);
    
    const response: FireberryDataResponse = {
      success: false,
      error: error.message,
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});