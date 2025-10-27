import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
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
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      {/* Logo */}
      <div className="text-center pt-8 pb-4">
        <img 
          src={quicktaxLogo} 
          alt="QuickTax" 
          className="h-24 mx-auto"
        />
      </div>

      {/* Full Page Card */}
      <Card className="flex-1 rounded-t-3xl shadow-elegant border-0 overflow-hidden">
        <CardContent className="p-8 pb-32 space-y-8">
          {/* Greeting */}
          <div className="text-right">
            <p className="text-lg font-medium text-foreground">
              שלום, {paymentData.clientName}
            </p>
          </div>

          {/* Message */}
          <div className="text-center space-y-4">
            <p className="text-base leading-relaxed text-foreground">
              אנו שמחים לבשר לך כי החזר המס שהגשנו עבורך אושר וביום{" "}
              <span className="font-semibold">{paymentData.depositDate}</span> יופקד לחשבונך{" "}
              <span className="font-semibold text-2xl">{formatCurrency(paymentData.refundAmount)}</span>.
            </p>
            
            <p className="text-base text-foreground pt-4">
              יש ללחוץ על הכפתור על מנת להסדיר את התשלום.
            </p>
            
            <p className="text-sm text-muted-foreground pt-2">
              באהבה צוות קוויק טקס.
            </p>
          </div>

          {/* Payment Details */}
          <div className="space-y-4 pt-6">
            <div className="flex justify-between items-center text-base">
              <span className="text-muted-foreground">סכום ההחזר</span>
              <span className="font-medium text-foreground">{formatCurrency(paymentData.refundAmount)}</span>
            </div>

            <div className="flex justify-between items-center text-base">
              <span className="text-muted-foreground">שיעור עמלה</span>
              <span className="font-medium text-foreground">{paymentData.commissionRate}%</span>
            </div>
            
            <div className="flex justify-between items-center text-base">
              <span className="text-muted-foreground">שכ"ט ללא מעמ</span>
              <span className="font-medium text-foreground">{formatCurrency(paymentData.feeBeforeVAT)}</span>
            </div>

            <div className="h-px bg-border my-4" />

            {/* Total */}
            <div className="flex justify-between items-center">
              <span className="text-lg font-medium text-foreground">סכום לתשלום</span>
              <span className="text-3xl font-bold text-foreground">
                {formatCurrency(paymentData.totalPayment)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sticky Glass Button */}
      <div className="fixed bottom-0 left-0 right-0 p-6 backdrop-blur-xl bg-background/80 border-t border-border/50">
        <Button
          onClick={handlePayment}
          className="w-full h-14 text-base font-medium gap-2"
        >
          <ShieldCheck className="w-5 h-5" />
          מעבר לתשלום מאובטח
        </Button>
      </div>
    </div>
  );
};
