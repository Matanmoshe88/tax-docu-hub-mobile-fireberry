import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PortalLayout } from '@/components/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  Clock, 
  Phone, 
  Mail, 
  FileText,
  Download,
  Home
} from 'lucide-react';
import { useFireberryData } from '@/hooks/useFireberryData';

export const FinishPage: React.FC = () => {
  const navigate = useNavigate();
  const { recordId } = useFireberryData();

  const nextSteps = [
    {
      title: "בדיקת זכאות",
      description: "צוות המומחים שלנו יבדוק את המסמכים תוך 1-2 ימי עסקים",
      status: "pending",
      timeframe: "1-3 ימי עסקים"
    },
    {
      title: "הגשת בקשה לרשויות",
      description: "במידה ואתה זכאי, נגיש בקשה להחזר מס בשמך",
      status: "pending",
      timeframe: ""
    },
    {
      title: "קבלת החזר המס",
      description: "הכסף יועבר ישירות לחשבון הבנק שלך",
      status: "pending",
      timeframe: ""
    }
  ];

  const contactInfo = {
    phone: "03-1234567",
    email: "support@quicktax.co.il",
    hours: "ראשון-חמישי: 9:00-18:00"
  };

  const handleGoHome = () => {
    navigate('/');
  };

  const handleDownloadSummary = () => {
    // TODO: Generate and download PDF summary
    console.log('Downloading summary for record:', recordId);
  };

  return (
    <PortalLayout
      currentStep={4}
      totalSteps={4}
      showNavigation={false}
    >
      <div className="space-y-6 animate-fade-in">
        {/* Success Header */}
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="bg-success/10 p-6 rounded-full animate-pulse-glow">
              <CheckCircle className="h-16 w-16 text-success" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-foreground">הושלם בהצלחה!</h1>
            <p className="text-xl text-muted-foreground">
              ההסכם נחתם והמסמכים הועלו למערכת
            </p>
          </div>
          <div className="flex justify-center">
            <Badge variant="secondary" className="text-lg px-4 py-2">
              מספר תיק: {recordId?.slice(-8).toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Process Summary */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              סיכום התהליך
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-success/5 rounded-lg border border-success/20">
                <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
                <h3 className="font-semibold">הסכם נחתם</h3>
                <p className="text-sm text-muted-foreground">חתימה דיגיטלית</p>
              </div>
              <div className="text-center p-4 bg-success/5 rounded-lg border border-success/20">
                <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
                <h3 className="font-semibold">מסמכים הועלו</h3>
                <p className="text-sm text-muted-foreground">כל המסמכים הנדרשים</p>
              </div>
              <div className="text-center p-4 bg-primary/5 rounded-lg border border-primary/20">
                <Clock className="h-8 w-8 text-primary mx-auto mb-2" />
                <h3 className="font-semibold">בבדיקה</h3>
                <p className="text-sm text-muted-foreground">צוות המומחים</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>השלבים הבאים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {nextSteps.map((step, index) => (
                <div key={index} className="flex items-start gap-4 p-4 rounded-lg border border-border/50">
                  <div className="bg-primary/10 p-2 rounded-full mt-1">
                    <span className="text-primary font-bold text-sm">{index + 1}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{step.title}</h3>
                      <Badge variant="outline" className="text-xs">
                        {step.timeframe}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>צור קשר</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <Phone className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">{contactInfo.phone}</div>
                  <div className="text-sm text-muted-foreground">טלפון</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <Mail className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">{contactInfo.email}</div>
                  <div className="text-sm text-muted-foreground">אימייל</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <Clock className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">{contactInfo.hours}</div>
                  <div className="text-sm text-muted-foreground">שעות פעילות</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            variant="outline"
            onClick={handleDownloadSummary}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            הורד סיכום
          </Button>
          <Button
            onClick={handleGoHome}
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            חזור לעמוד הבית
          </Button>
        </div>

        {/* Important Notice */}
        <Card className="border-warning shadow-card">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <h3 className="font-semibold text-warning">הערה חשובה</h3>
              <p className="text-sm text-muted-foreground">
                נשלח אליך אימייל עם פרטי התהליך ומספר התיק. אנא שמור על מספר התיק לצורך מעקב.
                אם יש לך שאלות, תוכל לפנות אלינו בכל עת.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
};
