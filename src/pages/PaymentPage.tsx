import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Lock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { he } from "date-fns/locale";
import quicktaxLogo from "@/assets/quicktax-logo.png";
import { usePaymentData } from "@/hooks/usePaymentData";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

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
  const { paymentData, isLoading, error, refetch } = usePaymentData(recordId);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(Date.now());

  useEffect(() => {
    // 1. One-time URL cache-busting for in-app browsers (especially WhatsApp)
    const isInApp = /WhatsApp|FBAN|FBAV|FB_IAB|Instagram|Line|Twitter|TikTok|Snapchat|Telegram/i.test(navigator.userAgent);
    
    if (isInApp) {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('_t')) {
        console.log('[Cache-Bust] Adding timestamp to URL for in-app browser');
        url.searchParams.set('_t', Date.now().toString());
        window.location.replace(url.toString());
        return; // Page will reload with new URL
      }
    }

    // 2. Handle visibility change (user returns to app from background)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Cache-Bust] Page visible - closing drawer and refetching');
        setIsDrawerOpen(false); // Close drawer to show main page
        setIsIframeLoading(true); // Reset loading state
        setIframeKey(Date.now()); // New iframe when drawer reopens
        refetch(); // Fetch fresh data
      }
    };

    // 3. Handle page restoration from bfcache (back-forward cache)
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.log('[Cache-Bust] Page restored from bfcache - forcing reload');
        window.location.reload();
      }
    };

    // 4. Handle focus (user returns to tab/window)
    const handleFocus = () => {
      console.log('[Cache-Bust] Page focused - closing drawer and refetching');
      setIsDrawerOpen(false);
      setIframeKey(Date.now());
      refetch();
    };

    // Register all event listeners
    console.log('[Cache-Bust] Registering event listeners');
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('focus', handleFocus);

    // Cleanup
    return () => {
      console.log('[Cache-Bust] Cleaning up event listeners');
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refetch]);

  const handlePayment = () => {
    console.log('[Cache-Bust] Opening drawer with fresh iframe');
    setIframeKey(Date.now()); // Generate new key
    setIsDrawerOpen(true);
    setIsIframeLoading(true);
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

  const isPaid = paymentData.paymentStatus !== 1;

  return (
    <div className="min-h-screen bg-background flex flex-col relative" dir="rtl">
      {/* Logo */}
      <div className="pt-2 pr-4 md:pt-3 md:pr-6">
        <img 
          src={quicktaxLogo} 
          alt="QuickTax" 
          className="h-16 md:h-24"
        />
      </div>

      {/* Full Page Card */}
      <Card className={`flex-1 rounded-t-3xl shadow-elegant border-0 overflow-hidden mt-1 md:mt-2 ${isPaid ? 'blur-sm' : ''}`}>
        <CardContent className="p-4 pb-24 space-y-4 md:p-8 md:pb-32 md:space-y-8">
          {/* Greeting */}
          <div className="text-center">
            <p className="text-base md:text-lg font-medium text-foreground">
              שלום, {paymentData.clientName}
            </p>
          </div>

          {/* Message */}
          <div className="text-center space-y-2 md:space-y-4">
            <p className="text-sm md:text-base leading-relaxed text-foreground">
              אנו שמחים לבשר לך כי החזר המס שהגשנו עבורך אושר וביום{" "}
              <span className="font-semibold">{formatDate(paymentData.depositDate)}</span> יופקד לחשבונך{" "}
              <span className="font-semibold text-xl md:text-2xl">{formatCurrency(paymentData.refundAmount)}</span>.
            </p>
          </div>

          {/* Payment Details */}
          <div className="space-y-2 md:space-y-4 pt-3 md:pt-6 max-w-sm mx-auto">
            <div className="flex justify-between items-center text-sm md:text-base">
              <span className="text-muted-foreground">סכום ההחזר</span>
              <span className="font-medium text-foreground">{formatCurrency(paymentData.refundAmount)}</span>
            </div>

            <div className="flex justify-between items-center text-sm md:text-base">
              <span className="text-muted-foreground">שיעור עמלה</span>
              <span className="font-medium text-foreground">{paymentData.commissionRate}%</span>
            </div>
            
            <div className="flex justify-between items-center text-sm md:text-base">
              <span className="text-muted-foreground">שכ"ט ללא מעמ</span>
              <span className="font-medium text-foreground">{formatCurrency(paymentData.feeBeforeVAT)}</span>
            </div>

            <div className="flex justify-between items-center text-sm md:text-base">
              <span className="text-muted-foreground">מע״מ</span>
              <span className="font-medium text-foreground">{formatCurrency(paymentData.totalPayment - paymentData.feeBeforeVAT)}</span>
            </div>

            <div className="h-px bg-border my-2 md:my-4" />

            {/* Total */}
            <div className="flex justify-between items-center">
              <span className="text-base md:text-lg font-medium text-foreground">סכום לתשלום</span>
              <span className="text-2xl md:text-3xl font-bold text-foreground">
                {formatCurrency(paymentData.totalPayment)}
              </span>
            </div>
          </div>

          {/* Payment Instructions */}
          <div className="text-center space-y-2 md:space-y-3 pt-4 md:pt-6">
            <p className="text-sm md:text-base text-foreground">
              יש ללחוץ על הכפתור על מנת להסדיר את התשלום.
            </p>
            
            <p className="text-xs md:text-sm text-muted-foreground">
              באהבה צוות קוויק טקס ❤️
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Sticky Glass Button or Paid Overlay */}
      {isPaid ? (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-success/10 backdrop-blur-md border border-success/30 text-success px-10 py-8 rounded-3xl shadow-xl flex flex-col items-center gap-4 animate-scale-in">
            <Lock className="w-12 h-12 md:w-16 md:h-16 text-success" />
            <span className="text-2xl md:text-3xl font-semibold">שולם</span>
          </div>
        </div>
      ) : (
        <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 backdrop-blur-xl bg-background/80 border-t border-border/50">
          <Button
            onClick={handlePayment}
            className="w-full h-14 md:h-16 text-base md:text-lg font-medium gap-2 bg-primary/90 hover:bg-primary backdrop-blur-md"
          >
            <ShieldCheck className="w-5 h-5" />
            מעבר לתשלום מאובטח
          </Button>
        </div>
      )}

      {/* Payment Drawer */}
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent className="h-[90vh]">
          <DrawerHeader>
            <DrawerTitle className="text-center">תשלום מאובטח</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-hidden relative">
            {isIframeLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-brand-blue animate-dot-bounce-1"></div>
                  <div className="w-3 h-3 rounded-full bg-brand-green animate-dot-bounce-2"></div>
                  <div className="w-3 h-3 rounded-full bg-brand-yellow animate-dot-bounce-3"></div>
                </div>
              </div>
            )}
            {paymentData?.paymentUrl && (
              <iframe
                key={iframeKey}
                src={`${paymentData.paymentUrl}${paymentData.paymentUrl.includes('?') ? '&' : '?'}ts=${iframeKey}`}
                className="w-full h-full border-0"
                title="CardCom Payment"
                allow="payment"
                onLoad={() => setIsIframeLoading(false)}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};
