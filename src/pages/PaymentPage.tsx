import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-12 px-4 md:px-6 lg:px-8" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            שלום {paymentData.clientName} איזה כיף!
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground">
            ביום {paymentData.depositDate} יופקד לחשבונך החזר מס על סך{" "}
            <span className="font-semibold text-success">{formatCurrency(paymentData.refundAmount)}</span>
          </p>
        </div>

        {/* Payment Details Card */}
        <Card className="shadow-elegant overflow-hidden">
          <CardContent className="p-6 md:p-8 space-y-6">
            {/* Refund Amount */}
            <div className="flex justify-between items-center">
              <span className="text-sm md:text-base text-muted-foreground">סכום החזר:</span>
              <span className="text-lg md:text-xl font-semibold text-success">
                {formatCurrency(paymentData.refundAmount)}
              </span>
            </div>

            <Separator />

            {/* Commission Rate */}
            <div className="flex justify-between items-center">
              <span className="text-sm md:text-base text-muted-foreground">שיעור עמלה:</span>
              <span className="text-lg md:text-xl font-semibold">
                {paymentData.commissionRate}%
              </span>
            </div>

            <Separator />

            {/* Fee Before VAT */}
            <div className="flex justify-between items-center">
              <span className="text-sm md:text-base text-muted-foreground">שכ"ט ללא מעמ:</span>
              <span className="text-lg md:text-xl font-semibold">
                {formatCurrency(paymentData.feeBeforeVAT)}
              </span>
            </div>

            <Separator className="my-6" />

            {/* Total Payment - Highlighted */}
            <div className="bg-primary/5 -mx-6 md:-mx-8 px-6 md:px-8 py-6 flex justify-between items-center border-t-2 border-b-2 border-primary/20">
              <span className="text-base md:text-lg font-bold text-foreground">סכום לתשלום:</span>
              <span className="text-2xl md:text-3xl font-bold text-primary">
                {formatCurrency(paymentData.totalPayment)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* CTA Button */}
        <div className="flex justify-center pt-4">
          <Button
            onClick={handlePayment}
            size="lg"
            variant="gradient"
            className="w-full md:w-auto md:min-w-[300px] text-lg md:text-xl py-6 md:py-7"
          >
            לתשלום
          </Button>
        </div>
      </div>
    </div>
  );
};
