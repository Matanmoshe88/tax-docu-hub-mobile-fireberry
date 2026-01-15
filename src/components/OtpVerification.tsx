import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Phone } from 'lucide-react';
import { storeSmsData, storeOtpVerificationData } from '@/lib/auditTrail';

interface OtpVerificationProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
  phoneNumber: string;
}

export const OtpVerification: React.FC<OtpVerificationProps> = ({
  isOpen,
  onClose,
  onVerified,
  phoneNumber,
}) => {
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [expiryCountdown, setExpiryCountdown] = useState(0);
  const hasAutoSent = useRef(false);

  // Mask phone number for display
  const maskedPhone = phoneNumber
    ? phoneNumber.replace(/(\d{3})(\d{4})(\d+)/, '$1****$3')
    : '';

  // Resend cooldown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Code expiry timer
  useEffect(() => {
    if (expiryCountdown > 0) {
      const timer = setTimeout(() => setExpiryCountdown(expiryCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [expiryCountdown]);

  const sendOtp = useCallback(async () => {
    if (!phoneNumber) {
      toast({
        title: 'שגיאה',
        description: 'מספר טלפון חסר. אנא פנה לתמיכה.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { phone: phoneNumber },
      });

      if (error) throw error;

      if (data.success) {
        setCodeSent(true);
        setCountdown(15); // 15 second cooldown for resend
        setExpiryCountdown(300); // 5 minute expiry
        
        // Store SMS data from InforUMobile response (3rd party)
        if (data.smsSentTime) {
          storeSmsData(
            data.smsSentTime,
            data.smsMessageId || null,
            data.smsProviderStatus || 'אושר על ידי צד ג - InforUMobile'
          );
        }
        
        toast({
          title: 'קוד נשלח',
          description: `קוד אימות נשלח למספר ${maskedPhone}`,
        });
      } else {
        throw new Error(data.error || 'Failed to send OTP');
      }
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      toast({
        title: 'שגיאה בשליחת קוד',
        description: error.message || 'לא ניתן לשלוח את הקוד. אנא נסה שוב.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  }, [phoneNumber, maskedPhone, toast]);

  const verifyOtp = useCallback(async (otpCode: string) => {
    if (otpCode.length !== 6) return;

    setIsVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { phone: phoneNumber, code: otpCode },
      });

      if (error) throw error;

      if (data.valid) {
        // Store OTP verification data from server response (3rd party timestamps)
        storeOtpVerificationData(
          phoneNumber,
          data.verificationTime || new Date().toISOString(),
          data.codeEntered || otpCode
        );
        
        toast({
          title: 'אימות הצליח',
          description: 'הקוד אומת בהצלחה',
        });
        onVerified();
      } else if (data.expired) {
        toast({
          title: 'הקוד פג תוקף',
          description: 'אנא בקש קוד חדש',
          variant: 'destructive',
        });
        setCode('');
        setExpiryCountdown(0);
      } else {
        toast({
          title: 'קוד שגוי',
          description: 'הקוד שהוזן אינו נכון. אנא נסה שוב.',
          variant: 'destructive',
        });
        setCode('');
      }
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      toast({
        title: 'שגיאה באימות',
        description: error.message || 'לא ניתן לאמת את הקוד. אנא נסה שוב.',
        variant: 'destructive',
      });
      setCode('');
    } finally {
      setIsVerifying(false);
    }
  }, [phoneNumber, toast, onVerified]);

  // Reset state when dialog opens and auto-send OTP
  useEffect(() => {
    if (isOpen) {
      setCode('');
      setCodeSent(false);
      setCountdown(0);
      setExpiryCountdown(0);
      hasAutoSent.current = false;
    }
  }, [isOpen]);

  // Auto-send OTP when modal opens
  useEffect(() => {
    if (isOpen && phoneNumber && !hasAutoSent.current && !isSending && !codeSent) {
      hasAutoSent.current = true;
      // Small delay to ensure modal is rendered
      const timer = setTimeout(() => {
        sendOtp();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, phoneNumber, isSending, codeSent, sendOtp]);

  // Auto-verify when 6 digits are entered
  useEffect(() => {
    if (code.length === 6 && !isVerifying && codeSent) {
      verifyOtp(code);
    }
  }, [code, isVerifying, codeSent, verifyOtp]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-center flex items-center justify-center gap-2">
            <Phone className="h-5 w-5" />
            אימות מספר טלפון
          </DialogTitle>
          <DialogDescription className="text-center">
            {codeSent
              ? <>הזן את הקוד שנשלח למספר <span dir="ltr">{maskedPhone}</span></>
              : <>שולח קוד אימות למספר <span dir="ltr">{maskedPhone}</span></>}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          {!codeSent ? (
            // Loading state while auto-sending
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-muted-foreground">שולח קוד אימות...</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-4">
                <InputOTP
                  value={code}
                  onChange={setCode}
                  maxLength={6}
                  disabled={isVerifying}
                  autoFocus
                >
                  <InputOTPGroup className="gap-2" dir="ltr">
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>

                {isVerifying && (
                  <div className="flex items-center gap-2 text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">מאמת קוד...</span>
                  </div>
                )}

                {expiryCountdown > 0 && !isVerifying && (
                  <p className="text-sm text-muted-foreground">
                    הקוד יפוג בעוד {formatTime(expiryCountdown)}
                  </p>
                )}
              </div>

              <Button
                variant="outline"
                onClick={sendOtp}
                disabled={countdown > 0 || isSending}
                className="w-full"
              >
                {isSending ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    שולח...
                  </>
                ) : countdown > 0 ? (
                  `שלח שוב בעוד ${countdown} שניות`
                ) : (
                  'שלח קוד חדש'
                )}
              </Button>
            </>
          )}

          <Button variant="ghost" onClick={onClose} className="w-full">
            ביטול
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};