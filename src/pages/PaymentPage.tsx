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
  const { paymentData, isLoading, error } = usePaymentData(recordId);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isIframeLoading, setIsIframeLoading] = useState(true);

  // Force a true fresh load once per open (works in in-app browsers like WhatsApp)
  useEffect(() => {
    let lastReload = 0;
    const GUARD_MS = 1500;

    const forceReload = () => {
      const now = Date.now();
      if (now - lastReload < GUARD_MS) return;
      lastReload = now;
      const next = new URL(window.location.href);
      next.searchParams.set('__fresh', String(now));
      sessionStorage.setItem('__fresh_last', String(now));
      window.location.replace(next.toString());
    };

    const url = new URL(window.location.href);
    const currentFresh = url.searchParams.get('__fresh');
    const lastFresh = sessionStorage.getItem('__fresh_last') || '';

    const navEntries = performance.getEntriesByType('navigation') as any;
    const navType = navEntries && navEntries[0] ? navEntries[0].type : undefined;

    // On first open (true navigation) with no __fresh param — append and hard reload
    if (navType === 'navigate' && !currentFresh) {
      forceReload();
      return;
    }

    // If missing or stale __fresh — hard reload
    if (!currentFresh || currentFresh !== lastFresh) {
      forceReload();
      return;
    }

    // If page restored from bfcache or becomes visible again — guarded hard reload
    const onPageShow = (event: any) => {
      if (event && event.persisted) {
        forceReload();
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        forceReload();
      }
    };

    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const isInApp = /WhatsApp|FB_IAB|FBAN|FBAV|Instagram|Line|Twitter|TikTok|Snapchat|Telegram/i.test(navigator.userAgent);

  const handlePayment = () => {
    if (!paymentData?.paymentUrl) return;

    // Add cache-busting timestamp to payment URL
    const url = paymentData.paymentUrl;
    const freshUrl = `${url}${url.includes('?') ? '&' : '?'}ts=${Date.now()}`;

    // Open externally in in-app browsers to avoid restoring CardCom on next open
    if (isInApp) {
      const win = window.open(freshUrl, '_blank', 'noopener,noreferrer');
      if (!win) {
        // Fallback to in-app drawer if popup blocked
        setIsDrawerOpen(true);
        setIsIframeLoading(true);
        setTimeout(() => {
          const iframe = document.querySelector('iframe[title="CardCom Payment"]') as HTMLIFrameElement | null;
          if (iframe) iframe.src = freshUrl;
        }, 100);
      }
      return;
    }

    // Default: open in drawer iframe
    setIsDrawerOpen(true);
    setIsIframeLoading(true);
    setTimeout(() => {
      const iframe = document.querySelector('iframe[title="CardCom Payment"]') as HTMLIFrameElement | null;
      if (iframe) iframe.src = freshUrl;
    }, 100);
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
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePayment(); }}
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
                src={`${paymentData.paymentUrl}${paymentData.paymentUrl.includes('?') ? '&' : '?'}ts=${Date.now()}`}
                className="w-full h-full border-0"
                title="CardCom Payment"
                allow="payment"
                onLoad={() => setIsIframeLoading(false)}
                key={Date.now()}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};
