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
}

interface LeadData {
  Id: string;
  Name: string;
  id__c: string;
  MobilePhone: string;
  Commission__c: number;
  fulladress__c: string;
}

interface FireberryDataResponse {
  success: boolean;
  data?: {
    leadData: LeadData;
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

  // Map Fireberry fields to our LeadData interface
  const leadData: LeadData = {
    Id: opportunityId,
    Name: `${opportunityData.pcfsystemfield509 || ''} ${opportunityData.pcfsystemfield511 || ''}`.trim(),
    id__c: opportunityData.pcfsystemfield515 || '',
    MobilePhone: '', // Not available in Fireberry response
    Commission__c: opportunityData.pcfsystemfield703 || 22,
    fulladress__c: `${opportunityData.pcfsystemfield530 || ''} ${opportunityData.pcfsystemfield532 || ''}, ${opportunityData.pcfsystemfield527 || ''}`.trim(),
  };

  console.log('🔍 Mapped leadData:', JSON.stringify(leadData, null, 2));

  return leadData;
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

    const response: FireberryDataResponse = {
      success: true,
      data: {
        leadData,
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