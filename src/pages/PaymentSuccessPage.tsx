import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import quicktaxLogo from "@/assets/quicktax-logo.png";

export const PaymentSuccessPage = () => {
  const navigate = useNavigate();
  const { recordId } = useParams();

  const handleContinue = () => {
    navigate(`/finish/${recordId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-lg shadow-elegant">
        <CardContent className="p-6 md:p-8">
          {/* Logo */}
          <div className="flex justify-center mb-6 md:mb-8">
            <img
              src={quicktaxLogo}
              alt="QuickTax"
              className="h-12 md:h-16 object-contain"
            />
          </div>

          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 md:w-14 md:h-14 text-success" />
            </div>
          </div>

          {/* Success Messages */}
          <div className="text-center space-y-3 md:space-y-4 mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-success">
              התשלום בוצע בהצלחה!
            </h1>
            
            <p className="text-base md:text-lg text-foreground">
              חשבונית תשלח לאימייל שלך בדקות הקרובות
            </p>
            
            <p className="text-sm md:text-base text-muted-foreground pt-2">
              תודה שבחרת בקוויק טקס
            </p>
            
            <p className="text-xs md:text-sm text-muted-foreground">
              באהבה צוות קוויק טקס ❤️
            </p>
          </div>

          {/* Continue Button */}
          <Button
            onClick={handleContinue}
            className="w-full"
            variant="success"
            size="lg"
          >
            המשך
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccessPage;
