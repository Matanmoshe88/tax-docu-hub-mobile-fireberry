import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PaymentData {
  clientName: string;
  refundAmount: number;
  depositDate: string;
  commissionRate: number;
  feeBeforeVAT: number;
  totalPayment: number;
  paymentUrl: string;
  paymentStatus: number;
}

export const usePaymentData = (recordId?: string) => {
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refetch function that can be called manually
  const refetch = useCallback(async () => {
    if (!recordId) {
      setError('No record ID provided');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Fetching payment data for recordId:', recordId);

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

      console.log('Payment data fetched successfully:', data.data);
      setPaymentData(data.data);
    } catch (err) {
      console.error('Error fetching payment data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch payment data');
    } finally {
      setIsLoading(false);
    }
  }, [recordId]);

  // Fetch on mount and when recordId changes
  useEffect(() => {
    refetch();
  }, [refetch]);

  return { paymentData, isLoading, error, refetch };
};