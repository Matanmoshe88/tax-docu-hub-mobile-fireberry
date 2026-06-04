import React, { useRef, useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PenTool, RotateCcw, Check, FileSignature, Loader2, AlertCircle, ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { logPoaEvent } from '@/lib/poaLogger';
import { 
  getSmsData, 
  getOtpVerificationData, 
  getContractViewedAtIso, 
  calculateReadingTime, 
  captureDeviceInfo 
} from '@/lib/auditTrail';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
interface SignableDocumentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: string;
  clientData: {
    firstName: string;
    lastName: string;
    idNumber: string;
    phone?: string;
  };
  onSigned?: () => void;
  // Pre-fetched PDF data props
  prefetchedPdfData?: string | null;
  prefetchedPdfLoading?: boolean;
  prefetchedPdfError?: string | null;
  // Document configuration (defaults to POA so existing usage is unchanged).
  // Pass these to reuse this modal for another document (e.g. the 1301 report).
  documentTitle?: string;
  generateFunctionName?: string;
  signFunctionName?: string;
  documentType?: string;
  // Prefix for the uploaded signature/signed-PDF filenames in Supabase storage.
  // Defaults to 'poa' so POA files keep their existing names.
  filePrefix?: string;
}
export const SignableDocumentModal: React.FC<SignableDocumentModalProps> = ({
  open,
  onOpenChange,
  recordId,
  clientData,
  onSigned,
  prefetchedPdfData,
  prefetchedPdfLoading,
  prefetchedPdfError,
  documentTitle = 'יפוי כח מס הכנסה',
  generateFunctionName = 'generate-poa-pdf',
  signFunctionName = 'sign-poa-pdf',
  documentType = 'poa_tax_auth',
  filePrefix = 'poa'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  // Per-page signature boxes (from generate-1301-pdf). Empty for single-page POA.
  const [pdfPages, setPdfPages] = useState<Array<{ page: number; year?: number; signature: { x: number; y: number; width: number; height: number } }> | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [pdfScale, setPdfScale] = useState<number>(1);
  const {
    toast
  } = useToast();

  // Measure container width for responsive PDF sizing
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth - 32); // minus padding
      }
    };
    if (open) {
      // Initial measurement after a brief delay to ensure container is rendered
      setTimeout(updateWidth, 100);
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }
  }, [open]);

  // Use pre-fetched PDF if available, otherwise fetch when modal opens
  useEffect(() => {
    if (open && recordId) {
      // Check if we have pre-fetched data
      if (prefetchedPdfData) {
        console.log('✅ Using pre-fetched POA PDF');
        setPdfData(prefetchedPdfData);
        setIsLoadingPdf(false);
        setPdfError(null);
        return;
      }
      
      // Check if pre-fetch is still loading
      if (prefetchedPdfLoading) {
        console.log('⏳ Pre-fetch in progress, waiting...');
        setIsLoadingPdf(true);
        setPdfError(null);
        return;
      }
      
      // Check if pre-fetch had an error
      if (prefetchedPdfError) {
        console.log('⚠️ Pre-fetch failed, attempting direct fetch...');
      }
      
      // Fallback: fetch directly if no pre-fetched data available
      setIsLoadingPdf(true);
      setPdfError(null);
      const fetchPdf = async () => {
        try {
          console.log(`📄 Fetching ${documentTitle} PDF for recordId:`, recordId);
          const { data, error } = await supabase.functions.invoke(generateFunctionName, {
            body: { recordId, responseType: 'base64' }
          });
          if (error) throw error;
          if (!data.success) throw new Error(data.error || 'Failed to generate PDF');

          console.log('✅ PDF loaded successfully');
          setPdfData(data.data.pdf);
          if (data.data.pages) setPdfPages(data.data.pages);
        } catch (err) {
          console.error('❌ PDF fetch error:', err);
          setPdfError(err instanceof Error ? err.message : 'שגיאה בטעינת המסמך');
        } finally {
          setIsLoadingPdf(false);
        }
      };
      fetchPdf();
    } else if (!open) {
      // Reset state when modal closes
      setHasSignature(false);
      setPdfData(null);
      setPdfPages(null);
      setPdfError(null);
      setCurrentPage(1);
      setNumPages(0);
      setPdfScale(1);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    }
  }, [open, recordId, prefetchedPdfData, prefetchedPdfLoading, prefetchedPdfError]);
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
    ctx.strokeStyle = '#1e40af';
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasSignature) logPoaEvent('poa_signature_started');
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
    logPoaEvent('poa_signature_cleared');
  };
  // Helper: Convert base64 to Blob
  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  // Helper: Upload signature to Supabase storage
  const uploadSignatureToStorage = async (signatureBlob: Blob): Promise<string> => {
    const timestamp = Date.now();
    const fileName = `${filePrefix}-signature-${recordId}-${timestamp}.png`;
    
    const { data, error } = await supabase.storage
      .from('signatures')
      .upload(fileName, signatureBlob, {
        contentType: 'image/png',
        upsert: false
      });

    if (error) {
      console.error('❌ Signature upload error:', error);
      throw new Error('שגיאה בהעלאת החתימה');
    }

    const { data: publicUrl } = supabase.storage
      .from('signatures')
      .getPublicUrl(data.path);

    console.log('✅ Signature uploaded:', publicUrl.publicUrl);
    return publicUrl.publicUrl;
  };

  // Helper: Call sign-poa-pdf edge function with audit trail
  const signPdfWithSignature = async (unsignedPdfBase64: string, signatureDataUrl: string): Promise<string> => {
    console.log('🖊️ Calling sign-poa-pdf edge function...');
    
    // Gather audit data from session storage
    const smsData = getSmsData();
    const otpData = getOtpVerificationData();
    const deviceInfo = captureDeviceInfo();
    const contractViewedAt = getContractViewedAtIso();
    const timeSpentReading = calculateReadingTime();
    
    // Get IP address
    let ipAddress = '';
    try {
      const { data: ipData } = await supabase.functions.invoke('get-client-ip');
      ipAddress = ipData?.ip || '';
    } catch (err) {
      console.warn('Could not get IP address:', err);
    }

    const auditData = {
      clientName: `${clientData.firstName} ${clientData.lastName}`,
      clientId: clientData.idNumber,
      clientPhone: clientData.phone || otpData.phone || '',
      smsSentTime: smsData.smsSentTime,
      smsProviderStatusId: smsData.smsProviderStatusId ?? undefined,
      smsProviderStatusDescription: smsData.smsProviderStatusDescription ?? undefined,
      otpCodeEntered: otpData.codeEntered,
      otpVerified: !!otpData.verificationTimeIso,
      otpVerificationTime: otpData.verificationTimeIso,
      contractViewedAt,
      signatureSubmittedAt: new Date().toISOString(),
      timeSpentReadingSeconds: timeSpentReading,
      ipAddress,
      browserName: deviceInfo.browserName,
      operatingSystem: deviceInfo.operatingSystem,
      screenResolution: deviceInfo.screenResolution,
      timezone: deviceInfo.timezone,
      recordId,
    };

    console.log('📋 Audit data for POA:', auditData);
    
    // Multi-page documents (e.g. 1301) provide per-page signature boxes → stamp
    // the same signature on every page. Single-page POA uses a fixed position.
    const signBody = (pdfPages && pdfPages.length > 0)
      ? { pdfBase64: unsignedPdfBase64, signatureDataUrl, pages: pdfPages, auditData }
      : { pdfBase64: unsignedPdfBase64, signatureDataUrl, signaturePosition: { x: 232, y: 445 }, signatureSize: { width: 150, height: 75 }, auditData };

    const { data, error } = await supabase.functions.invoke(signFunctionName, {
      body: signBody
    });

    if (error) {
      console.error('❌ Sign PDF error:', error);
      throw new Error('שגיאה בחתימת המסמך');
    }

    if (!data.success) {
      throw new Error(data.error || 'שגיאה בחתימת המסמך');
    }

    console.log('✅ PDF signed with audit trail');
    return data.data.signedPdf;
  };

  // Helper: Upload signed PDF to Supabase storage
  const uploadSignedPdfToStorage = async (pdfBlob: Blob): Promise<string> => {
    const timestamp = Date.now();
    const fileName = `${filePrefix}-signed-${recordId}-${timestamp}.pdf`;
    
    const { data, error } = await supabase.storage
      .from('signatures')
      .upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (error) {
      console.error('❌ PDF upload error:', error);
      throw new Error('שגיאה בהעלאת המסמך החתום');
    }

    const { data: publicUrl } = supabase.storage
      .from('signatures')
      .getPublicUrl(data.path);

    console.log('✅ Signed PDF uploaded:', publicUrl.publicUrl);
    return publicUrl.publicUrl;
  };

  // Helper: Update Fireberry with document URL
  const updateFireberryDocument = async (pdfUrl: string): Promise<void> => {
    const docid = sessionStorage.getItem('docid');
    
    if (!docid) {
      console.warn('⚠️ No docid found in sessionStorage - skipping Fireberry update');
      return;
    }

    console.log('📤 Updating Fireberry document...', { docid, pdfUrl });

    const { data, error } = await supabase.functions.invoke('document-upload', {
      body: {
        docid,
        documentType: documentType,
        documentUrl: pdfUrl
      }
    });

    if (error) {
      console.error('❌ Fireberry update error:', error);
      // Don't throw - document is still saved to storage
      toast({
        title: "אזהרה",
        description: "המסמך נשמר אך לא עודכן במערכת הניהול",
        variant: "destructive"
      });
      return;
    }

    console.log('✅ Fireberry updated successfully:', data);
  };

  const handleSign = async () => {
    logPoaEvent('poa_sign_clicked');
    if (!hasSignature) {
      toast({
        title: "חתימה נדרשת",
        description: "אנא חתום בתיבת החתימה",
        variant: "destructive"
      });
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check signature size
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let pixelCount = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) pixelCount++;
    }

    if (pixelCount < 100) {
      logPoaEvent('poa_signature_too_small', { pixelCount });
      toast({
        title: "החתימה קטנה מדי",
        description: "אנא חתום שוב בצורה ברורה יותר",
        variant: "destructive"
      });
      return;
    }

    if (!pdfData) {
      toast({
        title: "שגיאה",
        description: "המסמך לא נטען כראוי",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('📝 Starting POA signing flow...');
      console.log('📝 Record ID:', recordId);

      // 1. Get signature as data URL
      const signatureDataURL = canvas.toDataURL('image/png');
      console.log('✅ Step 1: Signature captured');

      // 2. Convert to blob and upload signature
      const signatureBlob = await fetch(signatureDataURL).then(r => r.blob());
      try {
        await uploadSignatureToStorage(signatureBlob);
        logPoaEvent('poa_signature_uploaded');
      } catch (err) {
        logPoaEvent('poa_signature_upload_failed', undefined, err);
        throw err;
      }
      console.log('✅ Step 2: Signature uploaded to storage');

      // 3. Sign the PDF with signature overlay
      let signedPdfBase64: string;
      try {
        signedPdfBase64 = await signPdfWithSignature(pdfData, signatureDataURL);
        logPoaEvent('poa_pdf_signed');
      } catch (err) {
        logPoaEvent('poa_pdf_sign_failed', undefined, err);
        throw err;
      }
      console.log('✅ Step 3: PDF signed');

      // 4. Upload signed PDF to storage
      const signedPdfBlob = base64ToBlob(signedPdfBase64, 'application/pdf');
      let signedPdfUrl: string;
      try {
        signedPdfUrl = await uploadSignedPdfToStorage(signedPdfBlob);
        logPoaEvent('poa_signed_pdf_uploaded');
      } catch (err) {
        logPoaEvent('poa_signed_pdf_upload_failed', undefined, err);
        throw err;
      }
      console.log('✅ Step 4: Signed PDF uploaded');

      // 5. Update Fireberry
      try {
        await updateFireberryDocument(signedPdfUrl);
        logPoaEvent('poa_fireberry_updated');
      } catch (err) {
        logPoaEvent('poa_fireberry_update_failed', undefined, err);
        throw err;
      }
      console.log('✅ Step 5: Fireberry updated');

      // 6. Success!
      logPoaEvent('poa_flow_completed');
      toast({
        title: "המסמך נחתם בהצלחה! 🎉",
        description: `${documentTitle} נשמר במערכת`
      });

      onSigned?.();
      onOpenChange(false);

    } catch (error) {
      console.error('💥 POA signing error:', error);
      toast({
        title: "שגיאה בחתימת המסמך",
        description: error instanceof Error ? error.message : "אנא נסה שוב",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  return <Dialog open={open} onOpenChange={isSubmitting ? undefined : onOpenChange}>
      <DialogContent className="max-w-2xl h-[90vh] max-h-[90vh] p-0 flex flex-col overflow-hidden" style={{ touchAction: 'pan-x pan-y' }}>
        {/* Loading Overlay - blocks all interaction during submission */}
        {isSubmitting && (
          <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium text-foreground">שולח את המסמך החתום...</p>
            <p className="text-sm text-muted-foreground">אנא המתן</p>
          </div>
        )}
        
        {/* Fixed Header with close button and zoom controls */}
        <div className="flex items-center justify-between p-4 border-b bg-background shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-xl font-semibold">
               <FileSignature className="h-6 w-6 text-primary" />
               {documentTitle}
            </div>
            {/* Zoom Controls - inline with header */}
            {pdfData && !isLoadingPdf && !pdfError && (
              <div className="flex items-center gap-1 mr-2">
                <div className="flex items-center gap-0.5 bg-muted/80 rounded-lg px-1.5 py-0.5">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPdfScale(s => Math.max(0.5, s - 0.25))} disabled={pdfScale <= 0.5}>
                    <ZoomOut className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-xs w-8 text-center font-medium">{Math.round(pdfScale * 100)}%</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPdfScale(s => Math.min(2, s + 0.25))} disabled={pdfScale >= 2}>
                    <ZoomIn className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {numPages > 1 && (
                  <div className="flex items-center gap-0.5 bg-muted/80 rounded-lg px-1.5 py-0.5">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-xs w-10 text-center font-medium">{currentPage}/{numPages}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))} disabled={currentPage >= numPages}>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="h-8 w-8">
            <X className="h-5 w-5" />
          </Button>
        </div>
 
        {/* Scrollable PDF Preview Area - improved scrolling for zoomed content */}
        <div ref={containerRef} className="flex-1 overflow-auto p-4 relative" style={{ WebkitOverflowScrolling: 'touch' }}>

          {isLoadingPdf ? <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">טוען מסמך...</p>
            </div> : pdfError ? <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <p className="text-destructive font-medium">שגיאה בטעינת המסמך</p>
              <p className="text-sm text-muted-foreground text-center max-w-md">{pdfError}</p>
              <Button variant="outline" size="sm" onClick={() => {
            setIsLoadingPdf(true);
            setPdfError(null);
            setTimeout(() => {
              const event = new CustomEvent('refetch-pdf');
              window.dispatchEvent(event);
            }, 100);
          }}>
                נסה שוב
              </Button>
            </div> : pdfData ? <div className="flex flex-col items-center w-full min-w-fit">
              <div className="w-full overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className="inline-block min-w-full" style={{ width: pdfScale > 1 ? `${Math.min(containerWidth, 550) * pdfScale}px` : 'auto' }}>
                  <Document file={`data:application/pdf;base64,${pdfData}`} onLoadSuccess={({
                numPages
              }) => { setNumPages(numPages); logPoaEvent('poa_pdf_rendered', { numPages }); }} onLoadError={error => {
                console.error('PDF load error:', error);
                setPdfError('שגיאה בטעינת המסמך');
                logPoaEvent('poa_pdf_render_failed', undefined, error);
              }} loading={<div className="flex items-center justify-center min-h-[300px]">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>} className="flex justify-center">
                    <Page pageNumber={currentPage} width={containerWidth > 0 ? Math.min(containerWidth, 550) * pdfScale : undefined} renderTextLayer={true} renderAnnotationLayer={true} />
                  </Document>
                </div>
              </div>
            </div> : null}
        </div>
 
        {/* Sticky Signature Footer */}
        <div className="shrink-0 border-t bg-background shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4 space-y-3" style={{ touchAction: 'pan-x pan-y', transform: 'translateZ(0)' }}>
          {/* Signature pad and buttons */}
          <div className="flex flex-col gap-3">
            {/* Signature Canvas */}
            <div className="relative">
              <canvas ref={canvasRef} width={400} height={200} className="w-full border-2 border-dashed border-muted-foreground/30 rounded-lg bg-white touch-none cursor-crosshair" style={{
                height: '160px'
              }} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
              {!hasSignature && <div className="absolute bottom-0 left-0 right-0 h-[160px] flex items-center justify-center pointer-events-none">
                  <p className="text-muted-foreground/50 text-sm">חתום כאן</p>
                </div>}
            </div>
 
            {/* Buttons - חתום ושלח centered, נקה on right */}
            <div className="relative flex items-center justify-center">
              <Button onClick={handleSign} disabled={!hasSignature || isSubmitting || isLoadingPdf} size="sm" className="gap-1">
                {isSubmitting ? <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    שולח...
                  </> : <>
                    <Check className="h-4 w-4" />
                    חתום ושלח
                  </>}
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSignature} disabled={!hasSignature || isSubmitting} className="gap-1 absolute left-0">
                <RotateCcw className="h-4 w-4" />
                נקה
              </Button>
            </div>
          </div>

          {/* Legal Notice */}
          <p className="text-xs text-muted-foreground text-center whitespace-nowrap overflow-hidden text-ellipsis">
            בלחיצה על "חתום ושלח" הנני מאשר/ת קריאת המסמך והסכמה לתוכנו.
          </p>
         </div>
       </DialogContent>
     </Dialog>;
};