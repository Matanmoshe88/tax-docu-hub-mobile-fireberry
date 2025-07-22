import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// FORCE REDEPLOY - 2025-07-22T14:15

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

interface DocumentStatus {
  'id-card': boolean;
  'drivers-license': boolean;
  'id-appendix': boolean;
  'account-management': boolean;
}

interface FireberryDataResponse {
  success: boolean;
  data?: {
    leadData: LeadData;
    shouldRedirect: boolean;
    redirectTo: string;
    documentId?: string | null;
    documentStatus?: DocumentStatus;
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

  // Try different query formats to find what works with the API
  const queryAttempts = [
    // Attempt 1: Without parentheses and with exact string matching
    {
      "objecttype": "1004",
      "sort_type": "desc", 
      "query": `pcfsystemfield693='${recordId}' AND pcfsystemfield979='${contractSessionTimestamp}'`,
      "fields": "customobject1004id"
    },
    // Attempt 2: Try with LIKE operator
    {
      "objecttype": "1004",
      "sort_type": "desc",
      "query": `pcfsystemfield693 LIKE '${recordId}' AND pcfsystemfield979 LIKE '${contractSessionTimestamp}'`,
      "fields": "customobject1004id"
    },
    // Attempt 3: Query only by recordId first
    {
      "objecttype": "1004", 
      "sort_type": "desc",
      "query": `pcfsystemfield693='${recordId}'`,
      "fields": "customobject1004id,pcfsystemfield979"
    }
  ];

  for (let i = 0; i < queryAttempts.length; i++) {
    try {
      console.log(`📤 Query attempt ${i + 1}:`, JSON.stringify(queryAttempts[i], null, 2));

      const response = await fetch('https://api.powerlink.co.il/api/query', {
        method: 'POST',
        headers: {
          'TokenID': tokenId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(queryAttempts[i]),
      });

      console.log(`📥 Query attempt ${i + 1} - Response Status: ${response.status}`);

      if (response.ok) {
        const queryResult = await response.json() as any;
        console.log(`📥 Query attempt ${i + 1} - Response:`, JSON.stringify(queryResult, null, 2));

        if (queryResult.data && queryResult.data.Data && queryResult.data.Data.length > 0) {
          // If this was the recordId-only query, check timestamps manually
          if (i === 2) {
            const matchingDoc = queryResult.data.Data.find((doc: any) => 
              doc.pcfsystemfield979 === contractSessionTimestamp
            );
            if (matchingDoc) {
              console.log(`✅ Found matching document: ${matchingDoc.customobject1004id}`);
              return matchingDoc.customobject1004id;
            } else {
              console.log(`❌ No matching timestamp found in ${queryResult.data.Data.length} documents`);
              return null;
            }
          } else {
            // Direct match
            const documentId = queryResult.data.Data[0].customobject1004id;
            console.log(`✅ Found existing document: ${documentId}`);
            return documentId;
          }
        } else {
          console.log(`❌ No documents found with attempt ${i + 1}`);
          if (i === queryAttempts.length - 1) {
            return null;
          }
        }
      } else {
        const errorText = await response.text();
        console.error(`❌ Query attempt ${i + 1} failed: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error(`❌ Query attempt ${i + 1} error:`, error);
    }
  }

  console.log('❌ All query attempts failed');
  return null;
}

async function createNewDocument(recordId: string, contractSessionTimestamp: string, leadData: LeadData): Promise<void> {
  console.log(`📝 Creating new document for recordId: ${recordId}`);
  
  const tokenId = Deno.env.get('FIREBERRY_TOKEN_ID');
  if (!tokenId) {
    throw new Error('Missing FIREBERRY_TOKEN_ID environment variable');
  }

  // Extract first and last names from the leadData.Name
  const nameParts = leadData.Name.trim().split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  
  // Create the name field as requested: "החזר מס first name last name"
  const documentName = `החזר מס ${firstName} ${lastName}`.trim();
  console.log(`📝 Document name will be: "${documentName}"`);
  console.log(`📝 Extracted names - First: "${firstName}", Last: "${lastName}"`);

  const response = await fetch('https://api.fireberry.com/api/record/1004', {
    method: 'POST',
    headers: {
      'TokenID': tokenId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pcfsystemfield693: recordId,
      pcfsystemfield979: contractSessionTimestamp,
      name: documentName,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create document: ${response.status} - ${errorText}`);
  }

  const result = await response.json() as any;
  console.log('✅ Document created successfully:', JSON.stringify(result, null, 2));
}

async function fetchDocumentDetails(documentId: string): Promise<{contractField: string | null, documentStatus: DocumentStatus}> {
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

  // Extract the record data
  const record = documentData.data?.Record || {};
  const contractField = record.pcfsystemfield725 || '';
  
  // Extract document status from the record
  const documentStatus: DocumentStatus = {
    'id-card': !!(record.pcfsystemfield719),
    'drivers-license': !!(record.pcfsystemfield978),
    'id-appendix': !!(record.pcfsystemfield977),
    'account-management': !!(record.pcfsystemfield967),
  };

  console.log(`🔍 Contract field value: ${contractField}`);
  console.log(`🔍 Document status:`, documentStatus);
  
  return { contractField, documentStatus };
}

serve(async (req) => {
  console.log('🚀🚀🚀 SALESFORCE DATA FUNCTION CALLED - DETAILED LOGGING VERSION - 2025-07-22T14:13 🚀🚀🚀');
  console.log('🚀 Fireberry data function called - v2 with detailed logging');
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
    let documentId = existingDocumentId;
    let documentStatus: DocumentStatus = {
      'id-card': false,
      'drivers-license': false,
      'id-appendix': false,
      'account-management': false,
    };

    if (!existingDocumentId) {
      // No existing document found, create a new one
      console.log('📝 No existing document found, creating new document');
      await createNewDocument(leadId, leadData.ContractSessionTimestamp, leadData);
      console.log('✅ New document created, staying on contract screen');
      
      // Query again to get the newly created document ID
      documentId = await queryExistingDocument(leadId, leadData.ContractSessionTimestamp);
      console.log('📋 Retrieved new document ID:', documentId);
    } else {
      // Document exists, fetch its details to check if contract is already signed
      console.log('📋 Existing document found, checking contract status');
      const documentDetails = await fetchDocumentDetails(existingDocumentId);
      const contractField = documentDetails.contractField;
      documentStatus = documentDetails.documentStatus;
      
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
        documentId: documentId, // Add the document ID to the response
        documentStatus: documentStatus // Add the document status to the response
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