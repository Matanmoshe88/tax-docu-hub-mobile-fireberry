import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PortalLayout } from '@/components/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, User, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFireberryData } from '@/hooks/useFireberryData';
import { generateContractText } from '@/lib/contractUtils';
import { OtpVerification } from '@/components/OtpVerification';
import { supabase } from '@/integrations/supabase/client';
import { storeContractPageEntry } from '@/lib/auditTrail';
export const ContractPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const {
    clientData,
    isLoading,
    recordId,
    shouldRedirect,
    redirectTo
  } = useFireberryData();
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpEnabled, setOtpEnabled] = useState(true);
  const [checkingOtpSetting, setCheckingOtpSetting] = useState(true);

  // Check if OTP is enabled on mount
  useEffect(() => {
    const checkOtpSetting = async () => {
      try {
        const {
          data,
          error
        } = await supabase.functions.invoke('get-settings', {
          body: null
        });
        if (!error && data?.settings) {
          const otpSetting = data.settings.find((s: any) => s.setting_key === 'otp_enabled');
          if (otpSetting) {
            setOtpEnabled(otpSetting.setting_value?.enabled ?? true);
          }
        }
      } catch (error) {
        console.error('Error checking OTP setting:', error);
        // Default to enabled if can't fetch
      } finally {
        setCheckingOtpSetting(false);
      }
    };
    checkOtpSetting();
  }, []);

  // Store contract page entry time for audit trail
  useEffect(() => {
    if (!isLoading && !checkingOtpSetting) {
      storeContractPageEntry();
    }
  }, [isLoading, checkingOtpSetting]);

  // Disable browser back button
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      window.history.pushState(null, '', window.location.pathname);
      toast({
        title: "ניווט מוגבל",
        description: "אנא השתמש בכפתורי הניווט בעמוד",
        variant: "destructive"
      });
    };
    window.history.pushState(null, '', window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [toast]);

  // Handle redirect if contract is already signed
  useEffect(() => {
    if (!isLoading && shouldRedirect && redirectTo) {
      console.log('📍 Contract already signed, redirecting to:', redirectTo);
      toast({
        title: "החוזה כבר נחתם",
        description: "מעביר אותך לדף המסמכים"
      });
      navigate(redirectTo);
    }
  }, [isLoading, shouldRedirect, redirectTo, navigate, toast]);
  const handleNext = () => {
    // Check if already verified in this session
    const otpVerified = sessionStorage.getItem(`otp_verified_${recordId}`);
    if (otpEnabled && !otpVerified) {
      // Show OTP modal
      setShowOtpModal(true);
    } else {
      // Navigate directly
      navigate(`/signature/${recordId}`);
    }
  };
  const handleOtpVerified = () => {
    // Store verification in session
    sessionStorage.setItem(`otp_verified_${recordId}`, 'true');
    setShowOtpModal(false);
    navigate(`/signature/${recordId}`);
  };
  const contractText = generateContractText(clientData);
  if (isLoading || checkingOtpSetting) {
    return <PortalLayout currentStep={1} totalSteps={4} nextLabel="טוען..." onNext={() => {}}>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">טוען נתוני לקוח...</p>
        </div>
      </PortalLayout>;
  }
  return <>
      <PortalLayout currentStep={1} totalSteps={4} onNext={handleNext} nextLabel="עבור לחתימה">
        <div className="space-y-4 sm:space-y-6 animate-fade-in">
          {/* Header - compact on mobile */}
          <div className="text-center space-y-2 sm:space-y-4">
            {/* Icon hidden on mobile */}
            
            
            <p className="text-xs sm:text-base text-muted-foreground max-w-2xl mx-auto px-2">
              אנא קרא את ההסכם בעיון לפני המעבר לשלב הבא
            </p>
          </div>

          {/* Contract Content - Formatted */}
          <div className="w-screen -mx-4 sm:-mx-6 lg:-mx-8 xl:-mx-12">
            <div className="px-4 sm:px-6 lg:px-8 xl:px-12 py-4 sm:py-6 bg-background">
              <div className="font-hebrew text-right max-w-none space-y-3">
                {contractText.split('\n').map((line, index) => {
                const trimmed = line.trim();

                // Empty lines as small spacers
                if (!trimmed) return <div key={index} className="h-1 sm:h-2" />;

                // Main title
                if (trimmed.includes('הסכם שירות להחזרי מס')) {
                  return <h2 key={index} className="text-base sm:text-lg font-bold text-center text-primary py-2 sm:py-3 border-b-2 border-primary/20 mb-3">
                        {trimmed}
                      </h2>;
                }

                // Party sections (בין / לבין)
                if (trimmed.startsWith('בין :') || trimmed.startsWith('לבין:')) {
                  return <div key={index} className="bg-primary/5 border-r-4 border-primary p-3 my-2 rounded-l-md">
                        <p className="text-sm sm:text-base font-semibold">{trimmed}</p>
                      </div>;
                }

                // Numbered sections (1., 2., etc.)
                const numberedMatch = trimmed.match(/^(\d+)\.\s*(.*)$/);
                if (numberedMatch) {
                  const [, num, content] = numberedMatch;
                  return <div key={index} className="my-3 sm:my-4">
                        <div className="flex gap-2 sm:gap-3 items-start">
                          <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                            {num}
                          </span>
                          <p className="text-xs sm:text-sm leading-6 sm:leading-7 flex-1">{content}</p>
                        </div>
                      </div>;
                }

                // Sub-points with letters (א., ב., etc.)
                if (/^[א-ת]\./.test(trimmed)) {
                  return <div key={index} className="mr-6 sm:mr-8 my-1">
                        <p className="text-xs sm:text-sm leading-6 sm:leading-7 text-muted-foreground">{trimmed}</p>
                      </div>;
                }

                // Special highlighted text
                if (trimmed.includes('ככל והלקוח לא יהיה ימצא זכאי להחזר')) {
                  return <p key={index} className="text-xs sm:text-sm leading-6 sm:leading-7 my-1 sm:my-2 font-bold text-destructive">
                        {trimmed}
                      </p>;
                }

                // Regular paragraphs
                return <p key={index} className="text-xs sm:text-sm leading-6 sm:leading-7 my-1 sm:my-2">
                      {trimmed}
                    </p>;
              })}
              </div>
            </div>
          </div>

          {/* Promissory Note Section */}
          <div className="w-screen -mx-4 sm:-mx-6 lg:-mx-8 xl:-mx-12 mt-8">
            <div className="px-4 sm:px-6 lg:px-8 xl:px-12 py-6 bg-muted/20 border-t-2 border-primary/20">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-foreground mb-2">שטר חוב</h2>
                <p className="text-muted-foreground">שטר חוב להבטחת ביצוע התחייבויות הלקוח</p>
              </div>
              <div className="text-xs sm:text-sm leading-6 sm:leading-7 whitespace-pre-wrap font-hebrew text-right max-w-none">
                {`שטר חוב
שנערך ונחתם ביום
אני הח"מ מתחייב/ת לשלם לפקודת ג'י.אי.אמ גלובל ניהול והשקעות בע"מ ח.פ. 513218453 

סך של ____________________₪ (במילים: _________________________________). 

סכום שטר זה יהיה צמוד למדד המחירים לצרכן עפ"י תנאי ההצמדה הבאים וישא ריבית כדלקמן:
"המדד" פירושו: מדד המחירים לצרכן (כולל פרות וירקות) המתפרסם ע"י הלשכה המרכזית לסטטיסטיקה, או כל מדד אחר שיפורסם במקומו.
שטר זה הינו סחיר.
"המדד הבסיסי" פירושו: המדד שהיה ידוע במועד החתימה על שטר זה.
"המדד החדש" פירושו: המדד שיפורסם לאחרונה לפני יום הפירעון בפועל של שטר זה.
הריבית" פירושה-ריבית בשיעור הריבית החריגה הנוהגת בחריגה מחח"ד בנק מזרחי-טפחות ואשר לא תפחת משיעור של 14.65% שנתית.
אם במועד הפירעון של שטר זה היה המדד החדש גבוה מהמדד הבסיסי, אשלם את סכום שטר זה כשהוא מוגדל באופן יחסי לשיעור העלייה של המדד החדש לעומת המדד הבסיסי ובצירוף הריבית מיום חתימת שטר זה עד ליום מלא התשלום בפועל. אולם אם המדד החדש יהיה שווה או נמוך מהמדד הבסיסי, אשלם שטר זה כסכומו הנקוב בצירוף הריבית מיום חתימת שטר זה עד ליום מלא התשלום בפועל. 
המחזיק בשטר יהיה רשאי למלא בשטר כל פרט החסר בו והוא יהיה פטור מכל החובות המוטלות על מחזיק בשטר, לרבות מהצגה לתשלום, פרוטסט, הודעת אי כיבוד והודעת חילול השטר.
*סכום שימולא בשטר במקרה הצורך לא יעלה על סך העמלה לה זכאית ג'י.אי.אמ גלובל ניהול והשקעות בע"מ מכוח הסכם זה בתוספת עלויות גבייה ודמי טיפול לפי העניין כאמור בהסכם וכן הוצאות משפטיות ושכ"ט עו"ד.

פרטי עושה השטר:

שם מלא: ${clientData.firstName} ${clientData.lastName}     מספר תעודת זהות: ${clientData.idNumber}


        

חתימת עושה השטר: _________________________`}
              </div>
            </div>
          </div>

          {/* Important Notice */}
          <Card className="border-warning shadow-card">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="bg-warning/10 p-2 rounded-full mt-1">
                  <FileText className="h-4 w-4 text-warning" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-warning">שים לב</h3>
                  <p className="text-sm text-muted-foreground">
                    על ידי לחיצה על "עבור לחתימה" אתה מאשר שקראת והבנת את תנאי ההסכם ומסכים לכל התנאים המפורטים בו.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </PortalLayout>

      <OtpVerification isOpen={showOtpModal} onClose={() => setShowOtpModal(false)} onVerified={handleOtpVerified} phoneNumber={clientData.phone || ''} />
    </>;
};