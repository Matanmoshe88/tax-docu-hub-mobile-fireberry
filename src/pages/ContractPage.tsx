import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PortalLayout } from '@/components/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, User, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFireberryData } from '@/hooks/useFireberryData';
import { generateContractText } from '@/lib/contractUtils';

export const ContractPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { clientData, isLoading, recordId, shouldRedirect, redirectTo } = useFireberryData();

  // Disable browser back button
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      window.history.pushState(null, '', window.location.pathname);
      toast({
        title: "ניווט מוגבל",
        description: "אנא השתמש בכפתורי הניווט בעמוד",
        variant: "destructive",
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
        description: "מעביר אותך לדף המסמכים",
      });
      navigate(redirectTo);
    }
  }, [isLoading, shouldRedirect, redirectTo, navigate, toast]);

  const handleNext = () => {
    navigate(`/signature/${recordId}`);
  };

  const handlePrevious = () => {
    navigate('/');
  };

  const contractText = generateContractText(clientData);

  if (isLoading) {
    return (
      <PortalLayout
        currentStep={1}
        totalSteps={4}
        nextLabel="טוען..."
        onNext={() => {}}
      >
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">טוען נתוני לקוח...</p>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout
      currentStep={1}
      totalSteps={4}
      onNext={handleNext}
      onPrevious={handlePrevious}
      nextLabel="אני מסכים להמשך"
      previousLabel="חזור לעמוד הבית"
    >
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="bg-primary/10 p-4 rounded-full">
              <FileText className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">הסכם שירות</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            אנא קרא את הסכם השירות בעיון לפני המעבר לשלב הבא. החוזה מפרט את התנאים והזכויות שלך.
          </p>
        </div>


        {/* Contract Content - Full Width */}
        <div className="w-screen -mx-4 sm:-mx-6 lg:-mx-8 xl:-mx-12">
          <div className="px-4 sm:px-6 lg:px-8 xl:px-12 py-6 bg-background">
            <div className="text-xs sm:text-sm leading-6 sm:leading-7 whitespace-pre-wrap font-hebrew text-right max-w-none">
              {contractText}
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
                  על ידי לחיצה על "אני מסכים להמשך" אתה מאשר שקראת והבנת את תנאי ההסכם ומסכים לכל התנאים המפורטים בו.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
};