import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";
import quicktaxLogo from "@/assets/quicktax-logo.png";

export const PaymentFailedPage = () => {
  const navigate = useNavigate();
  const { recordId } = useParams();

  const handleTryAgain = () => {
    navigate(`/payment?recordId=${recordId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-destructive/5 flex items-center justify-center p-4" dir="rtl">
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

          {/* Error Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="w-12 h-12 md:w-14 md:h-14 text-destructive" />
            </div>
          </div>

          {/* Error Messages */}
          <div className="text-center space-y-3 md:space-y-4 mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-destructive">
              התשלום נכשל
            </h1>
            
            <p className="text-base md:text-lg text-foreground">
              כרטיס האשראי נדחה
            </p>
            
            <p className="text-sm md:text-base text-muted-foreground pt-2">
              אנא ודא שפרטי הכרטיס נכונים ונסה שנית
            </p>
            
            <p className="text-xs md:text-sm text-muted-foreground">
              לשאלות ובעיות, צור קשר עם צוות קוויק טקס
            </p>
          </div>

          {/* Try Again Button */}
          <Button
            onClick={handleTryAgain}
            className="w-full"
            variant="destructive"
            size="lg"
          >
            נסה שוב
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentFailedPage;
