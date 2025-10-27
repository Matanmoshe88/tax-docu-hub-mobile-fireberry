import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import quicktaxLogo from "@/assets/quicktax-logo.png";

interface PaymentData {
  clientName: string;
  depositDate: string;
  refundAmount: number;
  commissionRate: number;
  feeBeforeVAT: number;
  totalPayment: number;
}

const getMockPaymentData = (recordId: string): PaymentData => {
  const refundAmount = 12500;
  const commissionRate = 25;
  const feeBeforeVAT = refundAmount * (commissionRate / 100);
  
  return {
    clientName: "יוסי כהן",
    depositDate: "15/02/2025",
    refundAmount,
    commissionRate,
    feeBeforeVAT,
    totalPayment: feeBeforeVAT,
  };
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const PaymentPage = () => {
  const { recordId } = useParams();
  const paymentData = getMockPaymentData(recordId || "");

  const handlePayment = () => {
    // TODO: Integrate with CardCom payment provider
    console.log('Redirecting to CardCom payment for record:', recordId);
    window.location.href = 'https://secure.cardcom.solutions/...'; // Placeholder
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <img 
            src={quicktaxLogo} 
            alt="QuickTax" 
            className="h-16 mx-auto"
          />
        </div>

        {/* Payment Card */}
        <Card className="shadow-card border-0 overflow-hidden">
          <CardContent className="p-8 space-y-6">
            {/* Client Name */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">שלום</p>
              <h1 className="text-2xl font-semibold text-foreground">{paymentData.clientName}</h1>
            </div>

            {/* Deposit Info */}
            <div className="text-center py-4 px-4 bg-muted/40 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">
                ביום {paymentData.depositDate} יופקד לחשבונך
              </p>
              <p className="text-3xl font-bold text-foreground">
                {formatCurrency(paymentData.refundAmount)}
              </p>
            </div>

            {/* Payment Details */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">שיעור עמלה</span>
                <span className="font-medium text-foreground">{paymentData.commissionRate}%</span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">שכ"ט ללא מעמ</span>
                <span className="font-medium text-foreground">{formatCurrency(paymentData.feeBeforeVAT)}</span>
              </div>

              <div className="h-px bg-border my-4" />

              {/* Total */}
              <div className="flex justify-between items-center">
                <span className="text-base font-medium text-foreground">סכום לתשלום</span>
                <span className="text-2xl font-bold text-foreground">
                  {formatCurrency(paymentData.totalPayment)}
                </span>
              </div>
            </div>

            {/* Payment Button */}
            <Button
              onClick={handlePayment}
              className="w-full h-12 text-base font-medium mt-6"
            >
              לתשלום
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
