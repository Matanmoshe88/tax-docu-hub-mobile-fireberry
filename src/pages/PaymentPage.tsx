import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Calendar, Percent, FileText, CreditCard } from "lucide-react";

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
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const PaymentPage = () => {
  const { recordId } = useParams();
  const paymentData = getMockPaymentData(recordId || "");

  const handlePayment = () => {
    console.log('Redirecting to CardCom payment for record:', recordId);
    window.location.href = 'https://secure.cardcom.solutions/...';
  };

  return (
    <div className="min-h-screen bg-gradient-subtle py-8 md:py-16 px-4" dir="rtl">
      <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
        {/* Success Badge */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 border border-success/20">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <span className="text-sm font-medium text-success">החזר מס אושר</span>
          </div>
        </div>

        {/* Hero Section */}
        <div className="text-center space-y-4 px-4">
          <div className="inline-block">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-3">
              שלום {paymentData.clientName}!
            </h1>
            <div className="h-1 bg-gradient-primary rounded-full w-1/2 mx-auto"></div>
          </div>
          
          <div className="flex items-center justify-center gap-3 text-lg md:text-xl text-muted-foreground mt-6">
            <Calendar className="w-5 h-5 text-primary" />
            <p className="leading-relaxed">
              ביום <span className="font-semibold text-foreground">{paymentData.depositDate}</span> יופקד לחשבונך
            </p>
          </div>
          
          <div className="inline-block mt-4">
            <div className="bg-success/5 border-2 border-success/20 rounded-2xl px-8 py-4">
              <p className="text-sm text-muted-foreground mb-1">החזר מס</p>
              <p className="text-4xl md:text-5xl font-bold text-success">
                ₪{formatCurrency(paymentData.refundAmount)}
              </p>
            </div>
          </div>
        </div>

        {/* Payment Details Card */}
        <Card className="shadow-elegant border-2 overflow-hidden backdrop-blur-sm bg-card/95">
          <div className="bg-gradient-primary h-2"></div>
          
          <CardContent className="p-8 md:p-10 space-y-6">
            <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              פירוט תשלום
            </h2>

            {/* Refund Amount Row */}
            <div className="flex justify-between items-center py-4 group hover:bg-muted/30 -mx-4 px-4 rounded-lg transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                </div>
                <span className="text-base text-muted-foreground font-medium">סכום החזר</span>
              </div>
              <span className="text-2xl font-bold text-success">
                ₪{formatCurrency(paymentData.refundAmount)}
              </span>
            </div>

            <Separator className="my-2" />

            {/* Commission Rate Row */}
            <div className="flex justify-between items-center py-4 group hover:bg-muted/30 -mx-4 px-4 rounded-lg transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Percent className="w-5 h-5 text-primary" />
                </div>
                <span className="text-base text-muted-foreground font-medium">שיעור עמלה</span>
              </div>
              <span className="text-2xl font-bold text-primary">
                {paymentData.commissionRate}%
              </span>
            </div>

            <Separator className="my-2" />

            {/* Fee Before VAT Row */}
            <div className="flex justify-between items-center py-4 group hover:bg-muted/30 -mx-4 px-4 rounded-lg transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <FileText className="w-5 h-5 text-foreground" />
                </div>
                <span className="text-base text-muted-foreground font-medium">שכ״ט ללא מע״מ</span>
              </div>
              <span className="text-2xl font-bold text-foreground">
                ₪{formatCurrency(paymentData.feeBeforeVAT)}
              </span>
            </div>

            <Separator className="my-6" />

            {/* Total Payment - Highlighted */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-primary opacity-5 rounded-2xl blur-xl"></div>
              <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-2 border-primary/30 rounded-2xl p-6 md:p-8">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <CreditCard className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">סכום לתשלום</p>
                      <p className="text-xs text-muted-foreground/70">סכום סופי לחיוב</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-4xl md:text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                      ₪{formatCurrency(paymentData.totalPayment)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA Button */}
        <div className="flex flex-col items-center gap-4 pt-4">
          <Button
            onClick={handlePayment}
            size="lg"
            variant="gradient"
            className="w-full md:w-auto md:min-w-[400px] h-16 text-xl font-bold shadow-glow hover:shadow-glow hover:scale-105 transition-all duration-300"
          >
            <CreditCard className="w-6 h-6 ml-2" />
            מעבר לתשלום מאובטח
          </Button>
          
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4 text-success" />
            תשלום מאובטח באמצעות CardCom
          </p>
        </div>

        {/* Trust Indicators */}
        <div className="flex justify-center gap-8 pt-6 pb-4 opacity-60">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">256-bit</div>
            <div className="text-xs text-muted-foreground">הצפנה</div>
          </div>
          <Separator orientation="vertical" className="h-12" />
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">PCI DSS</div>
            <div className="text-xs text-muted-foreground">מאושר</div>
          </div>
          <Separator orientation="vertical" className="h-12" />
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">SSL</div>
            <div className="text-xs text-muted-foreground">מאובטח</div>
          </div>
        </div>
      </div>
    </div>
  );
};
