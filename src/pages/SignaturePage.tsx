import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PortalLayout } from '@/components/PortalLayout';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PenTool, RotateCcw, Check, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useFireberryData } from '@/hooks/useFireberryData';
import { generateContractPDFBlob } from '@/lib/pdfGenerator';
import { generateContractText } from '@/lib/contractUtils';
import {
  AuditData,
  captureDeviceInfo,
  getIsraelTimestamp,
  maskPhone,
  maskIpAddress,
  generateHash,
  generateHashFromBytes,
  getOtpVerificationTime,
  getContractPageEntryTime,
  getContractViewedAtIso,
  calculateReadingTime,
  getSmsData,
  getOtpVerificationData,
} from '@/lib/auditTrail';

export const SignaturePage: React.FC = () => {
  const navigate = useNavigate();
  const { clientData, recordId, documentId } = useFireberryData();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigned, setIsSigned] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [accessValidated, setAccessValidated] = useState(false);
  const { toast } = useToast();

  // Disable browser back button completely
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

  // Access validation guard - check contract page entry and OTP verification
  useEffect(() => {
    const validateAccess = async () => {
      // Check if contract page was visited (required for audit trail)
      const contractPageEntry = sessionStorage.getItem('audit_contract_page_entry');
      if (!contractPageEntry) {
        toast({
          title: "יש לקרוא את ההסכם",
          description: "יש לעבור דרך עמוד ההסכם לפני החתימה",
          variant: "destructive"
        });
        navigate(`/contract/${recordId}`);
        return;
      }

      try {
        // Check OTP setting
        const { data } = await supabase.functions.invoke('get-settings', { body: null });
        const otpEnabled = data?.settings?.find((s: any) => s.setting_key === 'otp_enabled')?.setting_value?.enabled ?? true;
        
        // Check if OTP was verified (using the audit trail key)
        const otpVerificationTime = sessionStorage.getItem('audit_otp_verification_time');
        
        if (otpEnabled && !otpVerificationTime) {
          toast({
            title: "נדרש אימות טלפון",
            description: "יש לאמת את מספר הטלפון לפני החתימה",
            variant: "destructive"
          });
          navigate(`/contract/${recordId}`);
          return;
        }
        
        setAccessValidated(true);
      } catch (error) {
        console.error('Error validating access:', error);
        // On error, redirect to be safe
        navigate(`/contract/${recordId}`);
      }
    };
    
    if (recordId) {
      validateAccess();
    }
  }, [recordId, navigate, toast]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    let clientX, clientY;
    
    if ('touches' in e) {
      e.preventDefault();
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let clientX, clientY;
    
    if ('touches' in e) {
      e.preventDefault();
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e40af'; // Blue color for pen-like appearance
    ctx.lineTo(x, y);
    ctx.stroke();
    
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const uploadSignatureToStorage = async (signatureBlob: Blob): Promise<string> => {
    if (import.meta.env.DEV) {
      console.log('🔄 Uploading signature to Supabase storage...');
    }
    
    const fileName = `signature-${recordId}-${Date.now()}.png`;
    
    const { data, error } = await supabase.storage
      .from('signatures')
      .upload(fileName, signatureBlob, {
        contentType: 'image/png',
        upsert: false
      });

    if (error) {
      if (import.meta.env.DEV) {
        console.error('❌ Storage upload error:', error);
      }
      throw new Error(`Failed to upload signature: ${error.message}`);
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('signatures')
      .getPublicUrl(fileName);

    if (import.meta.env.DEV) {
      console.log('✅ Signature uploaded successfully:', publicUrl);
    }
    return publicUrl;
  };

  const callFireberryIntegration = async (signatureUrl: string, contractUrl: string) => {
    if (import.meta.env.DEV) {
      console.log('🔄 Calling Fireberry integration...');
    }
    
    const { data, error } = await supabase.functions.invoke('salesforce-integration', {
      body: {
        recordId: recordId,
        signatureUrl,
        contractUrl,
        documentId: documentId // Use existing document ID
      }
    });

    if (error) {
      if (import.meta.env.DEV) {
        console.error('❌ Salesforce integration error:', error);
      }
      throw new Error(`Salesforce integration failed: ${error.message}`);
    }

    if (import.meta.env.DEV) {
      console.log('✅ Salesforce integration successful:', data);
    }
    
    // Store docid for document uploads
    if (data?.docid) {
      sessionStorage.setItem('docid', data.docid);
      if (import.meta.env.DEV) {
        console.log('📝 Stored docid for document uploads:', data.docid);
      }
    }
    
    return data;
  };

  const getClientIp = async (): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke('get-client-ip');
      if (error) throw error;
      return data?.ip || 'Unknown';
    } catch (error) {
      console.error('Failed to get client IP:', error);
      return 'Unknown';
    }
  };

  const collectAuditData = async (signatureDataURL: string, signatureBlob: Blob, pdfBlob: Blob | null = null): Promise<AuditData> => {
    const deviceInfo = captureDeviceInfo();
    const signatureTime = getIsraelTimestamp();
    const ipAddress = await getClientIp();
    
    // Get SMS and OTP data from session storage
    const smsData = getSmsData();
    const otpData = getOtpVerificationData();
    
    // Generate legacy hashes (for PDF display, based on text content)
    const contractText = generateContractText(clientData);
    const documentHash = await generateHash(contractText);
    const legacySignatureHash = await generateHash(signatureDataURL);
    
    // Generate verifiable hashes from actual bytes
    const signatureBytes = await signatureBlob.arrayBuffer();
    const signatureHash = await generateHashFromBytes(signatureBytes);
    
    let pdfHash: string | null = null;
    if (pdfBlob) {
      const pdfBytes = await pdfBlob.arrayBuffer();
      pdfHash = await generateHashFromBytes(pdfBytes);
    }
    
    return {
      // Client Identity
      clientName: `${clientData.firstName} ${clientData.lastName}`,
      clientId: clientData.idNumber || '',
      clientPhone: clientData.phone || '',
      maskedPhone: maskPhone(clientData.phone || ''),
      
      // Phone Verification - SMS Sending (InforUMobile 3rd party)
      smsSentTime: smsData.smsSentTime,
      smsMessageId: smsData.smsMessageId,
      smsProviderStatus: smsData.smsProviderStatus,
      smsProviderStatusId: smsData.smsProviderStatusId,
      smsProviderStatusDescription: smsData.smsProviderStatusDescription,
      
      // Phone Verification - OTP Entry & Verification
      otpCodeEntered: otpData.codeEntered,
      otpVerified: !!otpData.verificationTime,
      otpVerificationTime: otpData.verificationTimeIso,
      
      // Document Timeline
      contractPageEntryTime: getContractPageEntryTime(),
      contractViewedAt: getContractViewedAtIso(),
      signatureTime,
      signatureSubmittedAt: null, // Will be set by server
      timeSpentReadingSeconds: calculateReadingTime(),
      
      // Device & Session Info
      ipAddress,
      maskedIpAddress: maskIpAddress(ipAddress),
      userAgent: deviceInfo.userAgent,
      browserName: deviceInfo.browserName,
      operatingSystem: deviceInfo.operatingSystem,
      screenResolution: deviceInfo.screenResolution,
      timezone: deviceInfo.timezone,
      language: deviceInfo.language,
      
      // Document Integrity (SHA256 hashes of actual bytes)
      pdfHash,
      signatureHash,
      
      // Legacy hashes (for PDF display)
      documentHash,
      legacySignatureHash,
      
      // Storage References (will be filled after upload)
      pdfStoragePath: null,
      signatureStoragePath: null,
      pdfPublicUrl: null,
      signaturePublicUrl: null,
      
      // Record Reference
      recordId: recordId || '',
      documentId: documentId || null,
    };
  };

  const generateSignedContract = async (signatureDataURL: string, auditData: AuditData): Promise<Blob> => {
    if (import.meta.env.DEV) {
      console.log('🔄 Generating signed contract PDF with audit trail...');
    }
    
    // Transform data to match new API structure
    const contractData = {
      contractNumber: recordId || '12345',
      company: {
        name: 'קוויק טקס (ג\'י.אי.אמ גלובל)',
        id: '513218453',
        address: 'רחוב הרצל 123, תל אביב'
      },
      client: {
        name: `${clientData.firstName} ${clientData.lastName}`,
        id: clientData.idNumber,
        phone: clientData.phone,
        email: clientData.email,
        address: clientData.address,
        commissionRate: clientData.commissionRate
      },
      yearsRange: clientData.yearsRange,
      sections: [
        { title: 'סעיף 1 - השירות', content: 'החברה מתחייבת לבצע החזרי מס עבור הלקוח' },
        { title: 'סעיף 2 - התשלום', content: `שיעור העמלה: ${clientData.commissionRate}` },
        { title: 'סעיף 3 - תנאים', content: 'הלקוח מתחייב לספק את כל המסמכים הנדרשים' }
      ],
      debtAmount: '10,000',
      auditData, // Pass audit data to PDF generator
    };

    // Use the new PDF generator
    const pdf = await generateContractPDFBlob(contractData, signatureDataURL);
    return pdf;
  };

  const handleNext = async () => {
    if (!hasSignature) {
      toast({
        title: "חתימה נדרשת",
        description: "אנא חתום בתיבת החתימה לפני המעבר לשלב הבא",
        variant: "destructive",
      });
      return;
    }

    // Check signature size
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let pixelCount = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) pixelCount++;
    }
    
    if (pixelCount < 100) {
      toast({
        title: "החתימה קטנה מדי",
        description: "אנא חתום שוב בצורה ברורה יותר",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    setShowLoading(true);
    
    try {
      console.log('🚀 Starting signature submission process...');
      
      // Convert canvas to blob
      const signatureDataURL = canvas.toDataURL('image/png');
      const response = await fetch(signatureDataURL);
      const signatureBlob = await response.blob();
      
      // Save signature locally (for PDF generation)
      localStorage.setItem(`signature-${recordId}`, signatureDataURL);
      localStorage.setItem(`clientData-${recordId}`, JSON.stringify(clientData));
      
      if (import.meta.env.DEV) {
        console.log('✅ Signature saved to localStorage');
      }

      // Upload signature to Supabase storage
      if (import.meta.env.DEV) {
        toast({
          title: "מעלה חתימה...",
          description: "מעלה את החתימה לשירות האחסון",
        });
      }
      
      const signatureUrl = await uploadSignatureToStorage(signatureBlob);
      const signatureStoragePath = `signature-${recordId}-${Date.now()}.png`;
      if (import.meta.env.DEV) {
        console.log('✅ Signature uploaded to storage:', signatureUrl);
      }

      // Collect initial audit data (without PDF hash yet)
      console.log('📋 Collecting audit trail data...');
      let auditData = await collectAuditData(signatureDataURL, signatureBlob);
      auditData.signatureStoragePath = signatureStoragePath;
      auditData.signaturePublicUrl = signatureUrl;
      console.log('✅ Audit data collected:', auditData);

      // STEP 1: Store audit trail FIRST to get server timestamp
      console.log('📋 Storing initial audit trail to get server timestamp...');
      const { data: auditResult, error: auditError } = await supabase.functions.invoke('store-audit-trail', {
        body: auditData
      });

      if (auditError) {
        console.error('❌ Failed to store audit trail:', auditError);
        throw new Error('Failed to store audit trail');
      }
      
      console.log('✅ Initial audit trail stored:', auditResult);
      
      // Update audit data with server-side signature timestamp
      if (auditResult?.signatureSubmittedAt) {
        auditData.signatureSubmittedAt = auditResult.signatureSubmittedAt;
        console.log('✅ Server signature timestamp received:', auditResult.signatureSubmittedAt);
      }

      // STEP 2: Generate signed contract with audit trail (now includes server timestamp)
      if (import.meta.env.DEV) {
        toast({
          title: "יוצר הסכם חתום...",
          description: "מכין את ההסכם עם החתימה ונתוני אימות",
        });
      }
      
      const contractBlob = await generateSignedContract(signatureDataURL, auditData);
      
      // Calculate PDF hash from actual bytes
      const pdfBytes = await contractBlob.arrayBuffer();
      auditData.pdfHash = await generateHashFromBytes(pdfBytes);
      console.log('✅ PDF hash generated:', auditData.pdfHash);
      
      // Upload contract to storage
      const contractFileName = `contract-${recordId}-${Date.now()}.pdf`;
      const { data: contractData, error: contractError } = await supabase.storage
        .from('signatures')
        .upload(contractFileName, contractBlob, {
          contentType: 'application/pdf',
          upsert: false
        });

      if (contractError) {
        throw new Error(`Failed to upload contract: ${contractError.message}`);
      }

      const { data: { publicUrl: contractUrl } } = supabase.storage
        .from('signatures')
        .getPublicUrl(contractFileName);

      // Update audit data with storage references
      auditData.pdfStoragePath = contractFileName;
      auditData.pdfPublicUrl = contractUrl;

      // STEP 3: Update audit trail with PDF info
      console.log('📋 Updating audit trail with PDF info...');
      const { data: updateResult, error: updateError } = await supabase.functions.invoke('store-audit-trail', {
        body: {
          auditTrailId: auditResult.auditTrailId,
          pdfHash: auditData.pdfHash,
          pdfStoragePath: auditData.pdfStoragePath,
          pdfPublicUrl: auditData.pdfPublicUrl,
        }
      });

      if (updateError) {
        console.error('❌ Failed to update audit trail with PDF info:', updateError);
        // Don't fail the whole process for this
      } else {
        console.log('✅ Audit trail updated with PDF info:', updateResult);
      }

      // Send signature and contract to Fireberry
      if (import.meta.env.DEV) {
        toast({
          title: "שומר חתימה...",
          description: "מעבד את החתימה וההסכם",
        });
      }
      
      const fireberryResult = await callFireberryIntegration(signatureUrl, contractUrl);
      if (import.meta.env.DEV) {
        console.log('✅ Documents uploaded to Fireberry:', fireberryResult);
      }
      
      setIsSigned(true);
      if (import.meta.env.DEV) {
        toast({
          title: "החתימה נשמרה בהצלחה! 🎉",
          description: "החתימה נשלחה למערכת והמעבר לשלב הבא",
        });
      }
      
      // Keep loading animation for a moment before navigation
      await new Promise(resolve => setTimeout(resolve, 1500));
      setShowLoading(false);
      navigate(`/documents/${recordId}`);
      
    } catch (error) {
      console.error('💥 Signature submission error:', error);
      
      toast({
        title: "שגיאה בשמירת החתימה",
        description: error instanceof Error ? error.message : "אנא נסה שוב",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setShowLoading(false);
    }
  };

  const handlePrevious = () => {
    navigate(`/contract/${recordId}`);
  };

  // Show loading while validating access
  if (!accessValidated) {
    return (
      <PortalLayout currentStep={2} totalSteps={4} nextLabel="מאמת..." onNext={() => {}}>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">מאמת הרשאות גישה...</p>
        </div>
      </PortalLayout>
    );
  }

  return (
    <>
      <LoadingOverlay isVisible={showLoading} />
      <PortalLayout
      currentStep={2}
      totalSteps={4}
      onNext={handleNext}
      onPrevious={handlePrevious}
      nextLabel={isSubmitting ? "שומר..." : "שמור והמשך"}
      previousLabel="חזור להסכם"
      isNextDisabled={isSubmitting}
    >
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="bg-primary/10 p-4 rounded-full">
              <PenTool className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">חתימה על ההסכם</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            אנא חתום בתיבת החתימה למטה כדי לאשר את הסכמתך לתנאי ההסכם.
          </p>
        </div>

        {/* Signature Card */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <PenTool className="h-5 w-5" />
                תיבת חתימה
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearSignature}
                disabled={!hasSignature}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                נקה חתימה
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/10 p-4">
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={300}
                  className="w-full h-72 cursor-crosshair border border-border rounded bg-white touch-none"
                  style={{ touchAction: 'none' }}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>
              
              <div className="text-center text-sm text-muted-foreground">
                חתום בתיבה למעלה באמצעות העכבר או המגע במסך (במכשיר נייד)
              </div>

              {hasSignature && (
                <div className="flex items-center justify-center gap-2 text-success">
                  <Check className="h-4 w-4" />
                  <span className="text-sm font-medium">החתימה נרשמה בהצלחה</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Legal Notice */}
        <Card className="border-primary/20 bg-primary/5 shadow-card">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <h3 className="font-semibold text-primary">הצהרה משפטית</h3>
              <p className="text-sm text-muted-foreground">
                החתימה הדיגיטלית שלך מהווה הסכמה מלאה לכל תנאי ההסכם ובעלת תוקף משפטי.
                החתימה תישמר במערכת באופן מוצפן ובטוח.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
    </>
  );
};
