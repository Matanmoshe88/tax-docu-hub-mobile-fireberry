import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PaymentData {
  clientName: string;
  depositDate: string;
  refundAmount: number;
  commissionRate: number;
  feeBeforeVAT: number;
  totalPayment: number;
  paymentStatus: number;
  paymentUrl: string;
}

export const usePaymentData = (recordId: string | undefined) => {
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!recordId) {
      setError('No record ID provided');
      setIsLoading(false);
      return;
    }

    try {
      console.log('Fetching payment data with cache-busting for recordId:', recordId);
      setIsLoading(true);
      setError(null);

      const { data, error: functionError } = await supabase.functions.invoke('payment-data', {
        body: { 
          recordId,
          _t: Date.now() // Cache-busting timestamp
        },
        headers: { 
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      if (functionError) {
        console.error('Function error:', functionError);
        throw functionError;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch payment data');
      }

      console.log('Fresh payment data fetched:', data.data);
      setPaymentData(data.data);
    } catch (err) {
      console.error('Error fetching payment data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch payment data');
    } finally {
      setIsLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { paymentData, isLoading, error, refetch };
};
