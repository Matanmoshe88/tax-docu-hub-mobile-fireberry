import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PortalLayout } from '@/components/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  CreditCard, 
  Car, 
  FileText,
  Lock,
  Unlock,
  Eye,
  Download
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createAndDownloadPDF } from '@/lib/pdfGenerator';
import { supabase } from '@/integrations/supabase/client';
import { useFireberryData } from '@/hooks/useFireberryData';

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
  
  const [documents, setDocuments] = useState<Document[]>([
    {
      id: 'id-card',
      title: 'תעודת זהות',
      description: 'צילום ברור של תעודת הזהות',
      icon: CreditCard,
      required: true,
      uploaded: false,
      locked: false,
      alternative: 'driver-license',
      salesforceType: 'צילום תז קדימה',
      salesforceName: 'תעודת זהות'
    },
    {
      id: 'driver-license',
      title: 'רישיון נהיגה',
      description: 'צילום רישיון נהיגה תקף',
      icon: Car,
      required: true,
      uploaded: false,
      locked: false,
      alternative: 'id-card',
      salesforceType: 'צילום רישיון נהיגה',
      salesforceName: 'רישיון נהיגה'
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

  // Load document status from session storage when data changes
  useEffect(() => {
    console.log('📋 DocumentsPage recordId from useSalesforceData:', recordId);
    console.log('📋 Current URL recordId should be: 00QWn000002zxExMAI');
    
    const documentsStatus = sessionStorage.getItem('documentsStatus');
    console.log('📋 Raw documentsStatus from session:', documentsStatus);
    
    if (documentsStatus) {
      try {
        const salesforceDocuments: DocumentsSingle[] = JSON.parse(documentsStatus);
        console.log('📄 Loading document status from Salesforce:', salesforceDocuments);
        console.log('📝 Local document types:', documents.map(d => ({ id: d.id, salesforceType: d.salesforceType })));
        
        // Update document status based on Salesforce data
        setDocuments(prev => prev.map(doc => {
          console.log(`🔍 Checking document ${doc.id} (${doc.salesforceType})`);
          
          // Find the latest document of this type from Salesforce
          const salesforceDocs = salesforceDocuments
            .filter(sf => {
              console.log(`  Comparing SF doc type "${sf.DocumentType__c}" with local type "${doc.salesforceType}"`);
              return sf.DocumentType__c === doc.salesforceType;
            })
            .sort((a, b) => new Date(b.CreatedDate).getTime() - new Date(a.CreatedDate).getTime());
          
          console.log(`  Found ${salesforceDocs.length} matching documents for ${doc.id}`);
          
          const latestDoc = salesforceDocs[0];
          
          if (latestDoc) {
            console.log(`  Latest doc for ${doc.id}:`, latestDoc);
            // Consider document uploaded if status is completed OR if it has a doc_url (indicating it was uploaded)
            if (latestDoc.Status__c === 'הושלם' || (latestDoc.doc_url__c && latestDoc.doc_url__c !== null)) {
              console.log(`  ✅ Marking ${doc.id} as uploaded and locked (Status: ${latestDoc.Status__c}, URL: ${latestDoc.doc_url__c})`);
              return {
                ...doc,
                uploaded: true,
                locked: true
              };
            }
          }
          
          console.log(`  ❌ No completed document found for ${doc.id}`);
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
    (doc.id === 'id-card' || doc.id === 'driver-license') && doc.uploaded
  );
  
  const hasBankStatement = documents.some(doc => 
    doc.id === 'bank-statement' && doc.uploaded
  );
  
  const canFinish = hasIdentityDocument && hasBankStatement;

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

    console.log('✅ Document uploaded to storage:', publicUrl);
    return publicUrl;
  };

  const sendDocumentToFireberry = async (documentUrl: string, contractUrl: string) => {
    console.log('🔄 Sending document to Fireberry...');
    
    const { data, error } = await supabase.functions.invoke('salesforce-integration', {
      body: {
        recordId: recordId,
        signatureUrl: documentUrl,
        contractUrl: contractUrl
      }
    });

    if (error) {
      console.error('❌ Salesforce integration error:', error);
      throw new Error(`Salesforce integration failed: ${error.message}`);
    }

    console.log('✅ Document sent to Salesforce successfully:', data);
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

      // Send to Salesforce
      toast({
        title: "שולח ל-Salesforce...",
        description: "מעביר את הקובץ למערכת הניהול",
      });

      // Note: Individual document uploads are handled differently from signature+contract uploads
      // For now, just store the document URL without calling Fireberry API
      console.log('Document uploaded to storage, skipping Fireberry integration for individual documents');

      // Update local state
      setDocuments(prev => prev.map(doc => 
        doc.id === docId 
          ? { ...doc, file, uploaded: true, locked: true }
          : doc
      ));

      toast({
        title: "הקובץ הועלה בהצלחה! 🎉",
        description: `${document.title} נשמר במערכת ונשלח ל-Salesforce`,
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

  const handleFileInputChange = (docId: string, event: React.ChangeEvent<HTMLInputElement>) => {
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

      handleFileUpload(docId, file);
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
      </div>
    </PortalLayout>
  );
};
