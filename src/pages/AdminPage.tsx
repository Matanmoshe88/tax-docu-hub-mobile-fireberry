import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Settings, Shield, Loader2, CheckCircle2, XCircle } from 'lucide-react';

export const AdminPage: React.FC = () => {
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [otpEnabled, setOtpEnabled] = useState(true);

  // Check session storage for admin auth
  useEffect(() => {
    const adminAuth = sessionStorage.getItem('admin_authenticated');
    if (adminAuth === 'true') {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  // Fetch current settings when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchSettings();
    }
  }, [isAuthenticated]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-settings', {
        body: null,
      });

      if (error) throw error;

      const otpSetting = data.settings?.find((s: any) => s.setting_key === 'otp_enabled');
      if (otpSetting) {
        setOtpEnabled(otpSetting.setting_value?.enabled ?? true);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Try to update a setting to verify password
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-settings', {
        body: {
          setting_key: 'otp_enabled',
          setting_value: { enabled: otpEnabled },
          admin_password: password,
        },
      });

      if (error || data.error) {
        toast({
          title: 'סיסמה שגויה',
          description: 'אנא נסה שוב',
          variant: 'destructive',
        });
        return;
      }

      sessionStorage.setItem('admin_authenticated', 'true');
      setIsAuthenticated(true);
      toast({
        title: 'התחברת בהצלחה',
        description: 'ברוך הבא לפאנל הניהול',
      });
    } catch (error) {
      console.error('Error logging in:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן להתחבר',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpToggle = async (enabled: boolean) => {
    setIsSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-settings', {
        body: {
          setting_key: 'otp_enabled',
          setting_value: { enabled },
          admin_password: password || sessionStorage.getItem('admin_password') || 'quicktax2024',
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setOtpEnabled(enabled);
      toast({
        title: enabled ? 'OTP הופעל' : 'OTP בוטל',
        description: enabled
          ? 'לקוחות יצטרכו לאמת את מספר הטלפון שלהם'
          : 'לקוחות יוכלו להמשיך ללא אימות טלפון',
      });
    } catch (error) {
      console.error('Error updating setting:', error);
      toast({
        title: 'שגיאה בעדכון',
        description: 'לא ניתן לעדכן את ההגדרה',
        variant: 'destructive',
      });
      // Revert the toggle
      setOtpEnabled(!enabled);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-primary/10 p-3 rounded-full">
                <Shield className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle>פאנל ניהול</CardTitle>
            <CardDescription>הזן את סיסמת הניהול כדי להמשיך</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">סיסמה</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="הזן סיסמה"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    מתחבר...
                  </>
                ) : (
                  'התחבר'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="bg-primary/10 p-3 rounded-full">
              <Settings className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">הגדרות מערכת</h1>
          <p className="text-muted-foreground">נהל את הגדרות המערכת של QuickTax</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              אימות OTP
            </CardTitle>
            <CardDescription>
              הפעל או בטל אימות SMS לפני חתימה על החוזה
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="otp-toggle" className="text-base font-medium">
                  אימות טלפון באמצעות SMS
                </Label>
                <p className="text-sm text-muted-foreground">
                  {otpEnabled
                    ? 'לקוחות יצטרכו לאמת את מספר הטלפון שלהם לפני חתימה'
                    : 'לקוחות יוכלו לחתום ללא אימות טלפון'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : otpEnabled ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                )}
                <Switch
                  id="otp-toggle"
                  checked={otpEnabled}
                  onCheckedChange={handleOtpToggle}
                  disabled={isSaving}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => {
              sessionStorage.removeItem('admin_authenticated');
              setIsAuthenticated(false);
              setPassword('');
            }}
          >
            התנתק
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
