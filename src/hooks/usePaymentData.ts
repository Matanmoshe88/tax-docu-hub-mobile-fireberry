import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PaymentData {
  clientName: string;
  depositDate: string;
  refundAmount: number;
  commissionRate: number;
  feeBeforeVAT: number;
  totalPayment: number;
}

export const usePaymentData = (recordId: string | undefined) => {
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPaymentData = async () => {
      if (!recordId) {
        setError('No record ID provided');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const { data, error: functionError } = await supabase.functions.invoke('payment-data', {
          body: { recordId },
        });

        if (functionError) {
          throw functionError;
        }

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch payment data');
        }

        setPaymentData(data.data);
      } catch (err) {
        console.error('Error fetching payment data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch payment data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPaymentData();
  }, [recordId]);

  return { paymentData, isLoading, error };
};
