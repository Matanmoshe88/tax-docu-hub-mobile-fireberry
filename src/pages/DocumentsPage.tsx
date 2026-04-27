import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PortalLayout } from '@/components/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  CreditCard, 
  FileText,
  Lock,
  Unlock,
  Eye,
  Download,
  FileSignature,
  PenTool
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createAndDownloadPDF } from '@/lib/pdfGenerator';
import { supabase } from '@/integrations/supabase/client';
import { useFireberryData } from '@/hooks/useFireberryData';
import { jsPDF } from 'jspdf';
 import { SignableDocumentModal } from '@/components/SignableDocumentModal';
import { logPoaEvent } from '@/lib/poaLogger';

interface Document {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  required: boolean;
  uploaded: boolean;
  locked: boolean;
  file?: File;
  alternative?: string;
  salesforceType: string;
  salesforceName: string;
}

interface DocumentsSingle {
  Id: string;
  DocumentType__c: string;
  Status__c: string;
  doc_url__c: string;
  CreatedDate: string;
}

export const DocumentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { clientData, isLoading, recordId, isDataFresh } = useFireberryData();
  const { toast } = useToast();
  
   // State for POA TaxAuth signable document
   const [poaModalOpen, setPoaModalOpen] = useState(false);
   const [poaSigned, setPoaSigned] = useState(false);
   
   // Pre-fetched POA PDF state
   const [poaPdfData, setPoaPdfData] = useState<string | null>(null);
   const [poaPdfLoading, setPoaPdfLoading] = useState(false);
   const [poaPdfError, setPoaPdfError] = useState<string | null>(null);
   const poaFetchAttempted = useRef(false);  // Track if fetch was attempted to prevent infinite loop
 
   // Load POA signed status from session storage on mount
   useEffect(() => {
     const documentsStatus = sessionStorage.getItem('documentsStatus');
     if (documentsStatus) {
       try {
         const status = JSON.parse(documentsStatus);
         if (status['poa-signed']) {
           console.log('✅ POA already signed (from Fireberry status)');
           setPoaSigned(true);
         }
       } catch (error) {
         console.error('Error parsing POA status:', error);
       }
     }
   }, [recordId, isDataFresh]);
   
   // Pre-fetch POA PDF on page load (only if not already signed)
   useEffect(() => {
     // Only attempt fetch once per page load to prevent infinite loop
     if (recordId && !poaSigned && !poaFetchAttempted.current) {
       poaFetchAttempted.current = true;  // Mark as attempted immediately
       
       console.log('📄 Pre-fetching POA PDF for recordId:', recordId);
       logPoaEvent('poa_page_loaded', { recordId });
       logPoaEvent('poa_prefetch_started');
       setPoaPdfLoading(true);
       setPoaPdfError(null);
       
       supabase.functions.invoke('generate-poa-pdf', {
         body: { recordId, responseType: 'base64' }
       })
         .then(({ data, error }) => {
           if (error) throw error;
           if (!data.success) throw new Error(data.error || 'Failed to generate PDF');
           
           console.log('✅ POA PDF pre-fetched successfully');
           setPoaPdfData(data.data.pdf);
           logPoaEvent('poa_prefetch_succeeded');
         })
         .catch((err) => {
           console.error('❌ POA PDF pre-fetch error:', err);
           setPoaPdfError(err instanceof Error ? err.message : 'שגיאה בטעינת המסמך');
           logPoaEvent('poa_prefetch_failed', undefined, err);
         })
         .finally(() => {
           setPoaPdfLoading(false);
         });
     }
   }, [recordId, poaSigned]);  // Removed poaPdfData and poaPdfLoading to prevent re-triggers
 
  const [documents, setDocuments] = useState<Document[]>([
    {
      id: 'id-card',
      title: 'תעודת זהות',
      description: 'צילום ברור של תעודת הזהות',
      icon: CreditCard,
      required: true,
      uploaded: false,
      locked: false,
      salesforceType: 'צילום תז קדימה',
      salesforceName: 'תעודת זהות'
    },
    {
      id: 'id-supplement',
      title: 'ספח תז',
      description: 'ספח תעודת הזהות (אם יש)',
      icon: FileText,
      required: false,
      uploaded: false,
      locked: false,
      salesforceType: 'ספח תז',
      salesforceName: 'ספח'
    },
    {
      id: 'bank-statement',
      title: 'אישור ניהול חשבון בנק',
      description: 'אישור מהבנק על ניהול חשבון עדכני',
      icon: FileText,
      required: true,
      uploaded: false,
      locked: false,
      salesforceType: 'אישור ניהול חשבון',
      salesforceName: 'אישור ניהול חשבון'
    }
  ]);

  // Get docid from session storage (set during contract creation)
  const getDocId = () => {
    return sessionStorage.getItem('docid') || '';
  };

  // Map document IDs to Fireberry document types
  const getDocumentType = (docId: string): string => {
    const mapping: Record<string, string> = {
      'id-card': 'id_photo',
      'id-supplement': 'appendix',
      'bank-statement': 'bank_statement'
    };
    return mapping[docId] || '';
  };

  // Load document status from session storage when data changes
  useEffect(() => {
    console.log('📋 DocumentsPage recordId from useSalesforceData:', recordId);
    console.log('📋 DocId for Fireberry updates:', getDocId());
    
    const documentsStatus = sessionStorage.getItem('documentsStatus');
    console.log('📋 Raw documentsStatus from session:', documentsStatus);
    
    if (documentsStatus) {
      try {
        const documentStatus = JSON.parse(documentsStatus);
        console.log('📄 Loading document status from Fireberry:', documentStatus);
        
        // Map Fireberry document status to local document IDs
        const statusMapping = {
          'id-card': 'id-card',
          'id-appendix': 'id-supplement',
          'account-management': 'bank-statement'
        };
        
        // Update document status based on Fireberry data
        setDocuments(prev => prev.map(doc => {
          const fireberryKey = Object.keys(statusMapping).find(key => 
            statusMapping[key as keyof typeof statusMapping] === doc.id
          ) as keyof typeof documentStatus;
          
          if (fireberryKey && documentStatus[fireberryKey]) {
            console.log(`✅ Marking ${doc.id} as uploaded (from Fireberry status)`);
            return {
              ...doc,
              uploaded: true,
              locked: true
            };
          }
          
          return doc;
        }));
      } catch (error) {
        console.error('Error parsing documents status:', error);
      }
    } else {
      console.log('📄 No documentsStatus found in session storage');
    }
  }, [recordId, isDataFresh]); // Re-run when recordId or fresh data changes

  const hasIdentityDocument = documents.some(doc => 
    doc.id === 'id-card' && doc.uploaded
  );
  
  const hasBankStatement = documents.some(doc => 
    doc.id === 'bank-statement' && doc.uploaded
  );
  
  const canFinish = hasIdentityDocument && hasBankStatement;

  // Compress image function
  const compressImage = (img: HTMLImageElement, quality: number = 0.8, maxWidth: number = 1200): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) throw new Error('Could not get canvas context');

    // Calculate new dimensions while maintaining aspect ratio
    let { width, height } = img;
    
    if (width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }

    canvas.width = width;
    canvas.height = height;

    // Draw compressed image
    ctx.drawImage(img, 0, 0, width, height);
    
    return canvas;
  };

  // Convert image to PDF function with compression
  const convertImageToPDF = async (imageFile: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          console.log(`🔄 Compressing ${imageFile.name}...`);
          
          // Compress the image first
          const compressedCanvas = compressImage(img, 0.8, 1200);
          
          // Convert canvas to data URL for PDF
          const compressedDataURL = compressedCanvas.toDataURL('image/jpeg', 0.8);
          
          console.log(`✅ Image compressed from ${img.width}x${img.height} to ${compressedCanvas.width}x${compressedCanvas.height}`);

          // Create a new PDF document
          const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
          });

          // Calculate dimensions to fit the image properly within A4
          const pdfWidth = 210; // A4 width in mm
          const pdfHeight = 297; // A4 height in mm
          const margin = 10; // 10mm margin
          const maxWidth = pdfWidth - (margin * 2);
          const maxHeight = pdfHeight - (margin * 2);

          // Calculate scaling to maintain aspect ratio
          const imgRatio = compressedCanvas.width / compressedCanvas.height;
          let finalWidth = maxWidth;
          let finalHeight = maxWidth / imgRatio;

          // If height exceeds max, scale by height instead
          if (finalHeight > maxHeight) {
            finalHeight = maxHeight;
            finalWidth = maxHeight * imgRatio;
          }

          // Center the image
          const x = (pdfWidth - finalWidth) / 2;
          const y = (pdfHeight - finalHeight) / 2;

          // Add compressed image to PDF
          pdf.addImage(compressedDataURL, 'JPEG', x, y, finalWidth, finalHeight);

          // Convert PDF to blob with compression
          const pdfBlob = pdf.output('blob');
          
          // Create a new File object with PDF extension
          const pdfFileName = imageFile.name.replace(/\.(jpg|jpeg|png)$/i, '.pdf');
          const pdfFile = new File([pdfBlob], pdfFileName, { 
            type: 'application/pdf' 
          });

          console.log(`✅ Converted and compressed ${imageFile.name} to PDF (${pdfFile.name})`);
          resolve(pdfFile);
        } catch (error) {
          console.error('❌ Error converting image to PDF:', error);
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      // Create object URL from file and set as image source
      img.src = URL.createObjectURL(imageFile);
    });
  };

  const uploadDocumentToStorage = async (file: File, docId: string): Promise<string> => {
    console.log('🔄 Uploading document to Supabase storage...');
    
    const fileName = `document-${docId}-${recordId}-${Date.now()}.${file.name.split('.').pop()}`;
    
    const { data, error } = await supabase.storage
      .from('signatures')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false
      });

    if (error) {
      console.error('❌ Storage upload error:', error);
      throw new Error(`Failed to upload document: ${error.message}`);
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('signatures')
      .getPublicUrl(fileName);

    if (import.meta.env.DEV) {
      console.log('✅ Document uploaded to storage:', publicUrl);
    }
    return publicUrl;
  };

  const sendDocumentToFireberry = async (documentUrl: string, contractUrl: string) => {
    if (import.meta.env.DEV) {
      console.log('🔄 Sending document to Fireberry...');
    }
    
    const { data, error } = await supabase.functions.invoke('salesforce-integration', {
      body: {
        recordId: recordId,
        signatureUrl: documentUrl,
        contractUrl: contractUrl
      }
    });

    if (error) {
      console.error('❌ Integration error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    console.log('✅ Document sent successfully:', data);
    return data;
  };

  const handleFileUpload = async (docId: string, file: File) => {
    const document = documents.find(doc => doc.id === docId);
    if (!document) return;

    try {
      toast({
        title: "מעלה קובץ...",
        description: "מעלה את הקובץ לשירות האחסון",
      });

      // Upload to storage
      const documentUrl = await uploadDocumentToStorage(file, docId);

      // Send to Fireberry if docid exists
      const docid = getDocId();
      const documentType = getDocumentType(docId);
      
      if (docid && documentType) {
        toast({
          title: "שולח קובץ...",
          description: "מעבד את הקובץ",
        });

        const { data, error } = await supabase.functions.invoke('document-upload', {
          body: {
            docid: docid,
            documentType: documentType,
            documentUrl: documentUrl
          }
        });

        if (error) {
          console.error('❌ Document upload to Fireberry error:', error);
          throw new Error(`Failed to update document in Fireberry: ${error.message}`);
        }

        if (import.meta.env.DEV) {
          console.log('✅ Document URL updated in Fireberry:', data);
        }
      } else {
        if (import.meta.env.DEV) {
          console.log('⚠️ No docid found or invalid document type, skipping Fireberry update');
        }
      }

      // Update local state
      setDocuments(prev => prev.map(doc => 
        doc.id === docId 
          ? { ...doc, file, uploaded: true, locked: true }
          : doc
      ));

      toast({
        title: "הקובץ הועלה בהצלחה! 🎉",
        description: `${document.title} נשמר במערכת בהצלחה`,
      });

    } catch (error) {
      console.error('💥 Document upload error:', error);
      
      toast({
        title: "שגיאה בהעלאת הקובץ",
        description: error instanceof Error ? error.message : "אנא נסה שוב",
        variant: "destructive",
      });
    }
  };

  const handleFileInputChange = async (docId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "סוג קובץ לא נתמך",
          description: "אנא העלה קבצי PDF, JPG או PNG בלבד",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "הקובץ גדול מדי",
          description: "גודל הקובץ לא יכול לעלות על 5MB",
          variant: "destructive",
        });
        return;
      }

      // Check if file is an image and convert to PDF
      let fileToUpload = file;
      
      if (file.type === 'image/jpeg' || file.type === 'image/png') {
        try {
          toast({
            title: "ממיר ומדחס תמונה ל-PDF...",
            description: "התמונה תומרת ומדחסת לפורמט PDF",
          });
          
          console.log(`🔄 Converting and compressing ${file.name} (${file.type}) to PDF...`);
          fileToUpload = await convertImageToPDF(file);
          
          toast({
            title: "ההמרה והדחיסה הושלמו בהצלחה",
            description: "התמונה הומרה ודוחסה לפורמט PDF",
          });
        } catch (error) {
          console.error('❌ Error converting image to PDF:', error);
          toast({
            title: "שגיאה בהמרת הקובץ",
            description: "לא ניתן להמיר את התמונה ל-PDF. אנא נסה שוב.",
            variant: "destructive",
          });
          return;
        }
      }

      handleFileUpload(docId, fileToUpload);
    }
  };

  const unlockDocument = (docId: string) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === docId 
        ? { ...doc, locked: false }
        : doc
    ));
  };

  const removeDocument = (docId: string) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === docId 
        ? { ...doc, uploaded: false, file: undefined, locked: false }
        : doc
    ));
  };

  const getRequirementText = (doc: Document) => {
    if (doc.required) {
      if (doc.alternative) {
        const altDoc = documents.find(d => d.id === doc.alternative);
        if (altDoc?.uploaded) {
          return 'רשות'; // Alternative uploaded, this becomes optional
        }
      }
      return 'נדרש';
    }
    return 'רשות';
  };

  const handleNext = () => {
    if (!canFinish) {
      toast({
        title: "חסרים מסמכים נדרשים",
        description: "אנא העלה תעודת זהות או רישיון נהיגה + אישור ניהול חשבון",
        variant: "destructive",
      });
      return;
    }

    navigate(`/finish/${recordId}`);
  };

  const handlePrevious = () => {
    // Don't allow going back - document is already signed
    return;
  };

  const handleDownloadPDF = async () => {
    try {
      // Get signature from localStorage (saved in SignaturePage)
      const signature = localStorage.getItem(`signature-${recordId}`);
      
      // Use the real clientData from Salesforce
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
        sections: [
          { title: 'סעיף 1 - השירות', content: 'החברה מתחייבת לבצע החזרי מס עבור הלקוח' },
          { title: 'סעיף 2 - התשלום', content: `שיעור העמלה: ${clientData.commissionRate}` }
        ],
        debtAmount: '10,000'
      };

      await createAndDownloadPDF(contractData, signature || '');
      
      toast({
        title: "PDF נוצר בהצלחה",
        description: "הקובץ הורד למחשב שלך",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "שגיאה ביצירת PDF",
        description: "אנא נסה שוב",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <PortalLayout
        currentStep={3}
        totalSteps={4}
        onNext={undefined}
        onPrevious={undefined}
      >
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">טוען נתוני מסמכים...</p>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout
      currentStep={3}
      totalSteps={4}
      onNext={handleNext}
      onPrevious={undefined}
      nextLabel="סיום העלאת מסמכים"
      previousLabel={undefined}
      isNextDisabled={!canFinish}
    >
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="bg-primary/10 p-4 rounded-full">
              <Upload className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">העלאת מסמכים</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            אנא העלה את המסמכים הנדרשים. הקבצים נשמרים בצורה מוצפנת ובטוחה.
          </p>
        </div>

        {/* Documents List */}
        <div className="space-y-4">
           {/* POA TaxAuth Signable Document Card */}
           <Card 
             className={`shadow-card hover:shadow-lg transition-all relative ${
               poaSigned ? 'ring-2 ring-success/20 bg-success/5' : 'ring-2 ring-primary/30 bg-primary/5 hover:ring-primary/50 cursor-pointer'
             }`}
             onClick={() => !poaSigned && setPoaModalOpen(true)}
           >
             {/* Locked overlay when signed - same design as other documents */}
             {poaSigned && (
               <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg z-10 flex items-center justify-center">
                 <div className="text-center space-y-2">
                   <div className="flex justify-center">
                     <Lock className="h-8 w-8 text-success" />
                   </div>
                   <h3 className="font-semibold text-lg">יפוי כח מס הכנסה</h3>
                   <p className="text-sm text-muted-foreground">המסמך נחתם בהצלחה</p>
                 </div>
               </div>
             )}
             
             <CardContent className="p-6">
               <div className="flex items-start gap-4">
                 <div className={`p-3 rounded-lg ${poaSigned ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
                   <FileSignature className="h-6 w-6" />
                 </div>
                 
                 <div className="flex-1">
                   <div className="flex items-start justify-between">
                     <div>
                       <div className="flex items-center gap-2">
                         <h3 className="font-semibold text-lg">יפוי כח מס הכנסה</h3>
                       </div>
                       <div className="flex items-center gap-2 mt-1">
                         <PenTool className="h-4 w-4 text-primary" />
                         <span className="text-primary font-medium text-sm">לחץ לחתימה</span>
                       </div>
                       <Badge variant="outline" className="text-xs mt-2 border-primary/30 text-primary">
                         נדרש חתימה
                       </Badge>
                     </div>
                     
                     <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                       <PenTool className="h-4 w-4 text-primary" />
                     </div>
                   </div>
                 </div>
               </div>
             </CardContent>
           </Card>
 
          {documents.map((doc) => (
            <Card 
              key={doc.id} 
              className={`shadow-card hover:shadow-lg transition-all relative ${
                doc.uploaded && doc.locked ? 'ring-2 ring-success/20 bg-success/5' : ''
              }`}
            >
              {doc.uploaded && doc.locked && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg z-10 flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <div className="flex justify-center">
                      <Lock className="h-8 w-8 text-success" />
                    </div>
                    <h3 className="font-semibold text-lg">{doc.title}</h3>
                    <p className="text-sm text-muted-foreground">הקובץ הועלה בהצלחה</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => unlockDocument(doc.id)}
                      className="mt-2"
                    >
                      <Unlock className="h-4 w-4 mr-2" />
                      ערוך שוב
                    </Button>
                  </div>
                </div>
              )}
              
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10 text-primary">
                    <doc.icon className="h-6 w-6" />
                  </div>
                  
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{doc.title}</h3>
                        </div>
                        <p className="text-muted-foreground text-sm mt-1">{doc.description}</p>
                        <div className="text-xs text-muted-foreground mt-2">
                          {getRequirementText(doc)}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {doc.uploaded && !doc.locked && (
                          <Badge variant="success" className="text-xs">הועלה</Badge>
                        )}
                      </div>
                    </div>

                    {(!doc.uploaded || !doc.locked) && (
                      <div>
                        <input
                          type="file"
                          id={`file-${doc.id}`}
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileInputChange(doc.id, e)}
                        />
                        <Button
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => document.getElementById(`file-${doc.id}`)?.click()}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {doc.uploaded ? 'החלף קובץ' : 'העלה קובץ'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Upload Guidelines */}
        <Card className="border-primary/20 bg-primary/5 shadow-card">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <h3 className="font-semibold text-primary">הנחיות להעלאת קבצים</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• קבצים מותרים: PDF, JPG, PNG</li>
                <li>• גודל מקסימלי: 5MB לקובץ</li>
                <li>• תעודת זהות ורישיון נהיגה הם חלופיים (מספיק אחד מהם)</li>
                <li>• אישור ניהול חשבון בנק - נדרש</li>
                <li>• ספח תז - רשות</li>
                <li>• המידע יישמר בצורה מוצפנת ובטוחה</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* PDF Download */}
        <Card className="border-success/20 bg-success/5 shadow-card">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <h3 className="font-semibold text-success">הורדת הסכם PDF</h3>
              <p className="text-sm text-muted-foreground">
                לחץ כדי להוריד את ההסכם הסופי עם החתימה בפורמט PDF
              </p>
              <Button
                onClick={handleDownloadPDF}
                className="w-full sm:w-auto"
                variant="default"
              >
                <Download className="h-4 w-4 mr-2" />
                הורד הסכם PDF
              </Button>
            </div>
          </CardContent>
        </Card>

         {/* Signable Document Modal */}
         <SignableDocumentModal
           open={poaModalOpen}
           onOpenChange={setPoaModalOpen}
           recordId={recordId || ''}
           clientData={{
             firstName: clientData?.firstName || '',
             lastName: clientData?.lastName || '',
             idNumber: clientData?.idNumber || '',
             phone: clientData?.phone,
           }}
           onSigned={() => setPoaSigned(true)}
           prefetchedPdfData={poaPdfData}
           prefetchedPdfLoading={poaPdfLoading}
           prefetchedPdfError={poaPdfError}
         />
      </div>
    </PortalLayout>
  );
};
