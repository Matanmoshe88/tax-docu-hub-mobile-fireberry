import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
import { format, parseISO } from "date-fns";
import { he } from "date-fns/locale";
import quicktaxLogo from "@/assets/quicktax-logo.png";
import { usePaymentData } from "@/hooks/usePaymentData";
import { LoadingOverlay } from "@/components/LoadingOverlay";

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (dateString: string): string => {
  try {
    const date = parseISO(dateString);
    return format(date, 'd MMMM yyyy', { locale: he });
  } catch {
    return dateString;
  }
};

export const PaymentPage = () => {
  const { recordId } = useParams();
  const { paymentData, isLoading, error } = usePaymentData(recordId);

  const handlePayment = () => {
    // TODO: Integrate with CardCom payment provider
    console.log('Redirecting to CardCom payment for record:', recordId);
    window.location.href = 'https://secure.cardcom.solutions/...'; // Placeholder
  };

  if (isLoading) {
    return <LoadingOverlay isVisible={true} />;
  }

  if (error || !paymentData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <Card className="p-8">
          <p className="text-destructive">שגיאה בטעינת נתוני התשלום</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      {/* Logo */}
      <div className="pt-3 pr-6">
        <img 
          src={quicktaxLogo} 
          alt="QuickTax" 
          className="h-24"
        />
      </div>

      {/* Full Page Card */}
      <Card className="flex-1 rounded-t-3xl shadow-elegant border-0 overflow-hidden mt-2">
        <CardContent className="p-8 pb-32 space-y-8">
          {/* Greeting */}
          <div className="text-center">
            <p className="text-lg font-medium text-foreground">
              שלום, {paymentData.clientName}
            </p>
          </div>

          {/* Message */}
          <div className="text-center space-y-4">
            <p className="text-base leading-relaxed text-foreground">
              אנו שמחים לבשר לך כי החזר המס שהגשנו עבורך אושר וביום{" "}
              <span className="font-semibold">{formatDate(paymentData.depositDate)}</span> יופקד לחשבונך{" "}
              <span className="font-semibold text-2xl">{formatCurrency(paymentData.refundAmount)}</span>.
            </p>
            
            <p className="text-base text-foreground pt-4">
              יש ללחוץ על הכפתור על מנת להסדיר את התשלום.
            </p>
            
            <p className="text-sm text-muted-foreground pt-2">
              באהבה צוות קוויק טקס ❤️
            </p>
          </div>

          {/* Payment Details */}
          <div className="space-y-4 pt-6 max-w-sm mx-auto">
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

            <div className="flex justify-between items-center text-base">
              <span className="text-muted-foreground">מע״מ</span>
              <span className="font-medium text-foreground">{formatCurrency(paymentData.totalPayment - paymentData.feeBeforeVAT)}</span>
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
          className="w-full h-16 text-lg font-medium gap-2 bg-primary/90 hover:bg-primary backdrop-blur-md"
        >
          <ShieldCheck className="w-5 h-5" />
          מעבר לתשלום מאובטח
        </Button>
      </div>
    </div>
  );
};
