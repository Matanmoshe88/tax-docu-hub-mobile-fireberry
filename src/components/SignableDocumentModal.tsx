 import React, { useRef, useState, useEffect } from 'react';
 import {
   Dialog,
   DialogContent,
 } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { PenTool, RotateCcw, Check, FileSignature, Loader2 } from 'lucide-react';
 import { useToast } from '@/hooks/use-toast';
 
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
 }
 
 export const SignableDocumentModal: React.FC<SignableDocumentModalProps> = ({
   open,
   onOpenChange,
   recordId,
   clientData,
   onSigned,
 }) => {
   const canvasRef = useRef<HTMLCanvasElement>(null);
   const [isDrawing, setIsDrawing] = useState(false);
   const [hasSignature, setHasSignature] = useState(false);
   const [isLoadingPdf, setIsLoadingPdf] = useState(true);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [pdfUrl, setPdfUrl] = useState<string | null>(null);
   const { toast } = useToast();
 
   // Create dummy PDF preview on load (simulating the fill-1301-form edge function)
   useEffect(() => {
     if (open) {
       setIsLoadingPdf(true);
       // Simulate loading the PDF from the edge function
       setTimeout(() => {
         // For demo purposes, we'll show a placeholder
         // In production, this will call the fill-1301-form edge function
         setPdfUrl(null); // We'll show a preview placeholder instead
         setIsLoadingPdf(false);
       }, 1000);
     } else {
       // Reset state when modal closes
       setHasSignature(false);
       setPdfUrl(null);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
     }
   }, [open]);
 
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
 
   const handleSign = async () => {
     if (!hasSignature) {
       toast({
         title: "חתימה נדרשת",
         description: "אנא חתום בתיבת החתימה",
         variant: "destructive",
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
       toast({
         title: "החתימה קטנה מדי",
         description: "אנא חתום שוב בצורה ברורה יותר",
         variant: "destructive",
       });
       return;
     }
 
     setIsSubmitting(true);
 
     try {
       // Get signature as data URL
       const signatureDataURL = canvas.toDataURL('image/png');
       
       // TODO: In production, this will:
       // 1. Upload signature to Supabase storage
       // 2. Call fill-1301-form with signature embedded
       // 3. Upload signed PDF to storage
       // 4. Call document-upload to update Fireberry
       // 5. Store audit trail
       
       console.log('📝 POA TaxAuth signature captured');
       console.log('📝 Client data:', clientData);
       console.log('📝 Record ID:', recordId);
       console.log('📝 Signature data URL length:', signatureDataURL.length);
 
       // Simulate processing
       await new Promise(resolve => setTimeout(resolve, 1500));
 
       toast({
         title: "המסמך נחתם בהצלחה! 🎉",
         description: "יפוי כח מס הכנסה נשמר במערכת",
       });
 
       onSigned?.();
       onOpenChange(false);
 
     } catch (error) {
       console.error('💥 POA signing error:', error);
       toast({
         title: "שגיאה בחתימת המסמך",
         description: error instanceof Error ? error.message : "אנא נסה שוב",
         variant: "destructive",
       });
     } finally {
       setIsSubmitting(false);
     }
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[90vh] max-h-[90vh] p-0 flex flex-col overflow-hidden">
        {/* Fixed Header */}
        <div className="flex items-center gap-2 p-4 border-b bg-background shrink-0">
          <div className="flex items-center gap-2 text-xl font-semibold">
             <FileSignature className="h-6 w-6 text-primary" />
             יפוי כח מס הכנסה
          </div>
        </div>
 
        {/* Scrollable PDF Preview Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoadingPdf ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">טוען מסמך...</p>
            </div>
          ) : (
            <div className="bg-muted/30 rounded-lg p-6 border">
              {/* Dummy PDF Preview */}
              <div className="text-center space-y-4">
                <h3 className="text-lg font-semibold">יפוי כח מס הכנסה</h3>
                <p className="text-muted-foreground text-sm">מסמך מספר: POA-{recordId}</p>
                
                <div className="bg-background border rounded-lg p-4 text-right space-y-2 mt-4">
                  <p className="font-medium">פרטי הלקוח:</p>
                  <p>שם: {clientData.firstName} {clientData.lastName}</p>
                  <p>תעודת זהות: {clientData.idNumber}</p>
                  {clientData.phone && <p>טלפון: {clientData.phone}</p>}
                </div>

                <div className="bg-background border rounded-lg p-4 text-right space-y-2 mt-4">
                  <p className="font-medium">הצהרה:</p>
                  <p className="text-sm text-muted-foreground">
                    אני הח"מ מייפה בזה את כוחם של קוויק טקס בע"מ לפעול בשמי מול רשות המיסים
                    לצורך קבלת החזרי מס ו/או הגשת דוחות שנתיים.
                  </p>
                </div>

                {/* Add more content to demonstrate scrolling */}
                <div className="bg-background border rounded-lg p-4 text-right space-y-2 mt-4">
                  <p className="font-medium">תנאים והגבלות:</p>
                  <p className="text-sm text-muted-foreground">
                    יפוי כח זה תקף לתקופה של 12 חודשים מיום החתימה.
                    ניתן לבטל את יפוי הכח בכל עת באמצעות הודעה בכתב.
                  </p>
                </div>
               </div>
            </div>
          )}
        </div>
 
        {/* Sticky Signature Footer */}
        <div className="shrink-0 border-t bg-background shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4 space-y-3">
          {/* Signature pad and buttons row */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch">
            {/* Signature Canvas */}
            <div className="flex-1 relative">
              <div className="flex items-center gap-2 mb-2">
                <PenTool className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">חתימה דיגיטלית</span>
              </div>
              <canvas
                ref={canvasRef}
                width={400}
                height={100}
                className="w-full border-2 border-dashed border-muted-foreground/30 rounded-lg bg-white touch-none cursor-crosshair"
                style={{ height: '80px' }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              {!hasSignature && (
                <div className="absolute bottom-0 left-0 right-0 h-[80px] flex items-center justify-center pointer-events-none">
                  <p className="text-muted-foreground/50 text-sm">חתום כאן</p>
                </div>
              )}
            </div>
 
            {/* Buttons */}
            <div className="flex sm:flex-col gap-2 sm:justify-end shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSignature}
                disabled={!hasSignature || isSubmitting}
                className="gap-1"
              >
                <RotateCcw className="h-4 w-4" />
                נקה
              </Button>
              <Button
                onClick={handleSign}
                disabled={!hasSignature || isSubmitting || isLoadingPdf}
                size="sm"
                className="gap-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    שולח...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    חתום ושלח
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Legal Notice & Cancel */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground flex-1">
              בלחיצה על "חתום ושלח" אני מאשר/ת שקראתי את המסמך ומסכים/ה לתוכנו.
            </p>
             <Button
               variant="outline"
              size="sm"
               onClick={() => onOpenChange(false)}
               disabled={isSubmitting}
             >
               ביטול
             </Button>
           </div>
         </div>
       </DialogContent>
     </Dialog>
   );
 };