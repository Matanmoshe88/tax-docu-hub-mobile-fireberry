
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ClientData {
  firstName: string;
  lastName: string;
  idNumber: string;
  phone: string;
  email: string;
  address: string;
  commissionRate: string;
}

interface FireberrySession {
  timestamp: number;
}

export const useFireberryData = () => {
  const { recordId } = useParams();
  const [clientData, setClientData] = useState<ClientData>({
    firstName: "",
    lastName: "", 
    idNumber: "",
    phone: "",
    email: "",
    address: "",
    commissionRate: ""
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isDataFresh, setIsDataFresh] = useState(false);

  const isSessionExpired = (timestamp: number): boolean => {
    const thirtyMinutesInMs = 30 * 60 * 1000;
    return Date.now() - timestamp > thirtyMinutesInMs;
  };

  const shouldFetchData = (): boolean => {
    // Skip if no recordId or in demo mode
    if (!recordId || recordId === 'demo') {
      return false;
    }

    // Check if session data exists and is not expired
    const fireberrySession = sessionStorage.getItem('fireberrySession');
    const leadData = sessionStorage.getItem('leadData');
    const storedRecordId = sessionStorage.getItem('currentRecordId');

    // If record ID has changed, fetch fresh data
    if (storedRecordId !== recordId) {
      console.log(`🔄 Record ID changed from ${storedRecordId} to ${recordId}, fetching fresh data`);
      return true;
    }

    if (!fireberrySession || !leadData) {
      console.log('🔄 Missing session data, fetching fresh data');
      return true; // Missing data, need to fetch
    }

    try {
      const sessionData: FireberrySession = JSON.parse(fireberrySession);
      if (!sessionData.timestamp || isSessionExpired(sessionData.timestamp)) {
        console.log('🔄 Session expired, fetching fresh data');
        return true; // Session expired, need to refresh
      }
    } catch (error) {
      console.error('Error parsing session data:', error);
      return true; // Invalid session data, need to fetch
    }

    console.log('✅ Using cached session data');
    return false; // Data exists and is fresh
  };

  const fetchFireberryData = async () => {
    // Force fresh data fetch for this record
    console.log('🔄 Forcing fresh data fetch - clearing session storage');
    sessionStorage.removeItem('fireberrySession');
    sessionStorage.removeItem('leadData');
    sessionStorage.removeItem('clientData');
    sessionStorage.removeItem('currentRecordId');
    
    if (!shouldFetchData()) {
      setIsLoading(false);
      loadDataFromSession();
      return;
    }

    try {
      console.log('🔄 Fetching Fireberry data for record:', recordId);
      
      const { data, error } = await supabase.functions.invoke('salesforce-data', {
        body: { leadId: recordId },
      });

      if (error) {
        console.error('❌ Supabase function error:', error);
        toast({
          title: "שגיאה",
          description: "לא ניתן לטעון את נתוני הלקוח",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (!data?.success) {
        console.error('❌ Fireberry data error:', data?.error);
        toast({
          title: "שגיאה",
          description: data?.error || "לא ניתן לטעון את נתוני הלקוח",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const { leadData } = data.data;
      console.log('✅ Fireberry data loaded successfully');
      console.log('📊 API Response data:', { leadData });
      console.log('🔍 DEBUG - Raw Fireberry response:', leadData._debug?.rawResponse);
      console.log('🔍 DEBUG - Available fields:', leadData._debug?.availableFields);
      console.log('🔍 LeadData fields:', Object.keys(leadData || {}));

      // Update client data with Fireberry data using the mapped fields
      console.log('🔍 Raw Fireberry leadData:', JSON.stringify(leadData, null, 2));
      
      const updatedClientData = {
        firstName: leadData.Name ? leadData.Name.split(' ')[0] : '',
        lastName: leadData.Name ? leadData.Name.split(' ').slice(1).join(' ') : '',
        idNumber: leadData.id__c || '',
        phone: leadData.MobilePhone || '',
        email: leadData.Email || '',
        address: leadData.fulladress__c || '',
        commissionRate: leadData.Commission__c ? `${leadData.Commission__c}%` : '22%'
      };

      console.log('📊 Final updatedClientData being set:', updatedClientData);
      setClientData(updatedClientData);

      // Store Fireberry session data with timestamp
      const sessionData: FireberrySession = {
        timestamp: Date.now()
      };

      sessionStorage.setItem('fireberrySession', JSON.stringify(sessionData));
      sessionStorage.setItem('leadData', JSON.stringify(leadData));
      sessionStorage.setItem('clientData', JSON.stringify(updatedClientData));
      sessionStorage.setItem('currentRecordId', recordId || '');

      setIsDataFresh(true);

    } catch (error) {
      console.error('💥 Error fetching Fireberry data:', error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון את נתוני הלקוח",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadDataFromSession = () => {
    const storedClientData = sessionStorage.getItem('clientData');
    if (storedClientData) {
      try {
        const data = JSON.parse(storedClientData);
        setClientData(data);
        setIsDataFresh(true);
      } catch (error) {
        console.error('Error parsing stored client data:', error);
      }
    }
  };

  useEffect(() => {
    fetchFireberryData();
  }, [recordId]);

  return {
    clientData,
    isLoading,
    isDataFresh,
    recordId,
    refetchData: fetchFireberryData
  };
};
