import { jsPDF } from 'jspdf';
import { generateContractText } from './contractUtils';

// Alternative PDF generation using HTML and proper RTL support
const generatePDFFromHTML = async (contractData: any, signatureDataURL: string): Promise<Blob> => {
  console.log('🎯 Generating PDF using HTML approach with proper RTL support');
  console.log('📊 Contract data received:', contractData);
  console.log('🔍 All contractData keys:', Object.keys(contractData));
  console.log('👤 Client object:', contractData.client);
  if (contractData.client) {
    console.log('🔍 Client keys:', Object.keys(contractData.client));
  }
  console.log('📱 Phone fields check:', {
    phone: contractData.phone,
    clientPhone: contractData.client?.phone,
    clientMobilePhone: contractData.client?.mobilePhone,
    MobilePhone: contractData.MobilePhone,
    PersonMobilePhone: contractData.PersonMobilePhone
  });
  console.log('💰 Commission fields check:', {
    commissionRate: contractData.commissionRate,
    clientCommissionRate: contractData.client?.commissionRate,
    clientCommissionRateField: contractData.client?.commission_rate__c,
    commission_rate__c: contractData.commission_rate__c
  });
  
  const clientData = {
    firstName: contractData.firstName || contractData.client?.name?.split(' ')[0] || contractData.client?.firstName || contractData.Name?.split(' ')[0] || '',
    lastName: contractData.lastName || contractData.client?.name?.split(' ').slice(1).join(' ') || contractData.client?.lastName || contractData.Name?.split(' ').slice(1).join(' ') || '',
    idNumber: contractData.idNumber || contractData.client?.id || contractData.client?.idNumber || contractData.PersonalNumber__c || '',
    phone: contractData.phone || contractData.client?.phone || contractData.client?.mobilePhone || contractData.MobilePhone || contractData.PersonMobilePhone || '',
    email: contractData.email || contractData.client?.email || contractData.PersonEmail || '',
    address: contractData.address || contractData.client?.address || contractData.PersonMailingStreet || '',
    commissionRate: contractData.commissionRate || contractData.client?.commissionRate || contractData.client?.commission_rate__c || contractData.commission_rate__c || '22%',
    contractNumber: contractData.contractNumber || contractData.Id || '',
    yearsRange: contractData.yearsRange || '2018-2023'
  };

  console.log('📋 Processed client data:', clientData);

  const contractText = generateContractText(clientData);
  const currentDate = new Date().toLocaleDateString('he-IL');
  
  // Create QuickTax logo as text since we can't access the image file
  const logoHtml = '<div style="color: #2563eb; font-size: 24px; font-weight: bold;">QuickTax</div>';
  
  // Create HTML with proper RTL support and UTF-8 encoding
  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@400;700&display=swap');
        
        * {
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Noto Sans Hebrew', Arial, sans-serif;
          direction: rtl;
          text-align: right;
          margin: 40px;
          padding: 0;
          line-height: 1.6;
          font-size: 12px;
          background: white;
          color: black;
        }
        
        .contract-container {
          max-width: 800px;
          margin: 0 auto;
          direction: rtl;
          text-align: right;
          padding: 30px;
          background: white;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #ddd;
          padding-bottom: 20px;
        }
        
        .logo {
          max-height: 60px;
          max-width: 200px;
        }
        
        .title {
          text-align: center;
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 20px;
        }
        
        .header-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
          font-size: 12px;
        }
        
        .content-section {
          margin-bottom: 15px;
          direction: rtl;
          text-align: right;
        }
        
        .numbered-section {
          font-weight: bold;
          margin-top: 10px;
          margin-bottom: 5px;
        }
        
        .party-section {
          font-weight: bold;
          font-size: 14px;
          margin-top: 10px;
        }
        
        .promissory-note {
          page-break-before: always;
          page-break-inside: avoid;
          text-align: center;
          font-size: 12px;
          font-weight: normal;
          margin-top: 0;
          padding-top: 50px;
          min-height: 90vh;
          height: auto;
          break-inside: avoid;
        }
        
        .promissory-title {
          font-size: 14px;
          font-weight: bold;
          text-align: center;
          margin-bottom: 30px;
          page-break-after: avoid;
        }
        
        .promissory-content {
          margin-top: 30px;
          text-align: right;
          font-size: 12px;
          font-weight: normal;
          page-break-inside: avoid;
          break-inside: avoid;
          orphans: 5;
          widows: 5;
        }
        
        .main-contract {
          page-break-after: always;
        }
        
        .page-break {
          page-break-before: always;
          display: block;
          height: 0;
          margin: 0;
          padding: 0;
        }
        
        .signature-section {
          margin-top: 40px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .signature-line {
          border-bottom: 1px solid black;
          width: 200px;
          height: 50px;
          margin-top: 10px;
        }
        
        .date-section {
          text-align: left;
        }
        
        @media print {
          body { 
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      <div class="contract-container">
        <div class="header">
          ${logoHtml}
          <div>
            <div>תאריך: ${currentDate}</div>
            <div>מספר חוזה: ${clientData.contractNumber || '___________'}</div>
          </div>
        </div>
        
        <div class="title">הסכם שירות להחזרי מס</div>
        
        <div class="main-contract">
          <div class="content">
            ${contractText.split('\n').map(line => {
              const trimmedLine = line.trim();
              if (!trimmedLine) return '<div style="height: 10px;"></div>';
              if (trimmedLine.includes('הסכם שירות להחזרי מס')) return ''; // Skip title
              if (trimmedLine === 'שטר חוב') {
                return '</div></div><div class="page-break"></div><div class="promissory-note"><div class="promissory-title">שטר חוב</div><div class="promissory-content">';
              }
              if (trimmedLine.includes('חתימת עושה השטר:')) {
                return `<div class="content-section">${trimmedLine}</div>
                        <div style="margin: 10px 0;">
                          ${signatureDataURL ? 
                            `<img src="${signatureDataURL}" style="width: 200px; height: 100px;" />` : 
                            '<div style="height: 100px;"></div>'
                          }
                        </div>`;
              }
              if (/^\d+\./.test(trimmedLine)) return `<div class="numbered-section">${trimmedLine}</div>`;
              if (trimmedLine.startsWith('בין:') || trimmedLine.startsWith('לבין:')) {
                return `<div class="party-section">${trimmedLine}</div>`;
              }
              if (trimmedLine.includes('פרטי עושה השטר:')) {
                return `<div class="numbered-section">${trimmedLine}</div>`;
              }
              return `<div class="content-section">${trimmedLine}</div>`;
            }).join('')}
          </div>
          
          <!-- Add signature at bottom of contract -->
          <div style="margin-top: 40px; margin-bottom: 30px;">
            <div style="margin-bottom: 10px;">חתימת הלקוח:</div>
            ${signatureDataURL ? 
              `<img src="${signatureDataURL}" style="width: 200px; height: 100px; border: 1px solid #ccc;" />` : 
              '<div style="border-bottom: 1px solid black; width: 200px; height: 100px;"></div>'
            }
          </div>
        </div>
        
        <div class="page-break"></div>
        
        <div class="promissory-note">
          <div class="promissory-title">שטר חוב</div>
          <div class="promissory-subtitle">שטר חוב להבטחת ביצוע התחייבויות הלקוח</div>
          
          <div class="promissory-content">
            <div class="content-section"><strong>שטר חוב</strong></div>
            <div class="content-section">שנערך ונחתם ביום ${currentDate}</div>
            <div class="content-section">אני הח"מ ${clientData.firstName} ${clientData.lastName} ת"ז ${clientData.idNumber} מתחייב/ת לשלם לפקודת ג'י.אי.אמ גלובל ניהול והשקעות בע"מ ח.פ. 513218453</div>
            
            <div style="height: 15px;"></div>
            <div class="content-section">סך של ____________________₪ (במילים: _________________________________).</div>
            
            <div style="height: 15px;"></div>
            <div class="content-section">סכום שטר זה יהיה צמוד למדד המחירים לצרכן עפ"י תנאי ההצמדה הבאים וישא ריבית כדלקמן:</div>
            <div class="content-section">"המדד" פירושו: מדד המחירים לצרכן (כולל פרות וירקות) המתפרסם ע"י הלשכה המרכזית לסטטיסטיקה, או כל מדד אחר שיפורסם במקומו.</div>
            <div class="content-section">שטר זה הינו סחיר.</div>
            <div class="content-section">"המדד הבסיסי" פירושו: המדד שהיה ידוע במועד החתימה על שטר זה.</div>
            <div class="content-section">"המדד החדש" פירושו: המדד שיפורסם לאחרונה לפני יום הפירעון בפועל של שטר זה.</div>
            <div class="content-section">הריבית" פירושה-ריבית בשיעור הריבית החריגה הנוהגת בחריגה מחח"ד בנק מזרחי-טפחות ואשר לא תפחת משיעור של 14.65% שנתית.</div>
            <div class="content-section">אם במועד הפירעון של שטר זה היה המדד החדש גבוה מהמדד הבסיסי, אשלם את סכום שטר זה כשהוא מוגדל באופן יחסי לשיעור העלייה של המדד החדש לעומת המדד הבסיסי ובצירוף הריבית מיום חתימת שטר זה עד ליום מלא התשלום בפועל. אולם אם המדד החדש יהיה שווה או נמוך מהמדד הבסיסי, אשלם שטר זה כסכומו הנקוב בצירוף הריבית מיום חתימת שטר זה עד ליום מלא התשלום בפועל.</div>
            <div class="content-section">המחזיק בשטר יהיה רשאי למלא בשטר כל פרט החסר בו והוא יהיה פטור מכל החובות המוטלות על מחזיק בשטר, לרבות מהצגה לתשלום, פרוטסט, הודעת אי כיבוד והודעת חילול השטר.</div>
            <div class="content-section">*סכום שימולא בשטר במקרה הצורך לא יעלה על סך העמלה לה זכאית ג'י.אי.אמ גלובל ניהול והשקעות בע"מ מכוח הסכם זה בתוספת עלויות גבייה ודמי טיפול לפי העניין כאמור בהסכם וכן הוצאות משפטיות ושכ"ט עו"ד.</div>
            
            <div style="height: 20px;"></div>
            <div class="content-section"><strong>פרטי עושה השטר:</strong></div>
            
            <div class="content-section">שם מלא: ${clientData.firstName} ${clientData.lastName}, מספר תעודת זהות: ${clientData.idNumber}</div>
            
            <div class="content-section">כתובת: ${clientData.address}</div>
            
            <div style="height: 30px;"></div>
            
            <div style="display: flex; align-items: center; gap: 20px; margin-right: 50px;">
              <span>חתימת עושה השטר: _________________________</span>
              ${signatureDataURL ? 
                `<img src="${signatureDataURL}" style="width: 200px; height: 100px;" />` : 
                ''
              }
            </div>
            </div>
          </div>
        </div>
        
        <div class="signature-section">
          <div>
            <div>חתימת הלקוח:</div>
            ${signatureDataURL ? 
              `<img src="${signatureDataURL}" style="width: 200px; height: 100px; border: 1px solid #ccc;" />` : 
              '<div class="signature-line"></div>'
            }
          </div>
          <div class="date-section">
            <div>תאריך:</div>
            <div>${currentDate}</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  // Use html2canvas and jsPDF for better Hebrew support
  const { jsPDF } = await import('jspdf');
  const html2canvas = (await import('html2canvas')).default;
  
  // Create a temporary element to render the HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  tempDiv.style.width = '800px';
  document.body.appendChild(tempDiv);
  
  try {
    // Hide promissory note for main contract rendering
    const promissoryNote = tempDiv.querySelector('.promissory-note') as HTMLElement;
    const promissoryDisplay = promissoryNote?.style.display || '';
    if (promissoryNote) {
      promissoryNote.style.display = 'none';
    }
    
    // Render main contract
    const mainCanvas = await html2canvas(tempDiv.querySelector('.contract-container') as HTMLElement, {
      allowTaint: true,
      useCORS: true,
      scale: 1.2,
      backgroundColor: '#ffffff',
      width: 800,
      windowWidth: 800
    });
    
    // Show only promissory note for separate rendering
    const mainContract = tempDiv.querySelector('.main-contract') as HTMLElement;
    const headerElement = tempDiv.querySelector('.header') as HTMLElement;
    const titleElement = tempDiv.querySelector('.title') as HTMLElement;
    const signatureElement = tempDiv.querySelector('.signature-section') as HTMLElement;
    
    if (mainContract) mainContract.style.display = 'none';
    if (headerElement) headerElement.style.display = 'none';
    if (titleElement) titleElement.style.display = 'none';
    if (signatureElement) signatureElement.style.display = 'none';
    if (promissoryNote) promissoryNote.style.display = promissoryDisplay;
    
    // Render promissory note
    const promissoryCanvas = await html2canvas(tempDiv.querySelector('.contract-container') as HTMLElement, {
      allowTaint: true,
      useCORS: true,
      scale: 1.2,
      backgroundColor: '#ffffff',
      width: 800,
      windowWidth: 800
    });
    
    // Create PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 295; // A4 height in mm
    
    // Add main contract pages
    const mainImgData = mainCanvas.toDataURL('image/jpeg', 0.7);
    const mainImgHeight = (mainCanvas.height * imgWidth) / mainCanvas.width;
    let heightLeft = mainImgHeight;
    let position = 0;
    
    // Add first page
    pdf.addImage(mainImgData, 'JPEG', 0, position, imgWidth, mainImgHeight);
    heightLeft -= pageHeight;
    
    // Add additional pages if needed for main contract
    while (heightLeft >= 0) {
      position = heightLeft - mainImgHeight;
      pdf.addPage();
      pdf.addImage(mainImgData, 'JPEG', 0, position, imgWidth, mainImgHeight);
      heightLeft -= pageHeight;
    }
    
    // Add new page for promissory note
    pdf.addPage();
    const promissoryImgData = promissoryCanvas.toDataURL('image/jpeg', 0.7);
    const promissoryImgHeight = (promissoryCanvas.height * imgWidth) / promissoryCanvas.width;
    pdf.addImage(promissoryImgData, 'JPEG', 0, 0, imgWidth, promissoryImgHeight);
    
    return pdf.output('blob');
  } finally {
    // Clean up
    document.body.removeChild(tempDiv);
  }
};

// Proper Hebrew text processing
const processHebrewText = (text: string): string => {
  // Simple approach for RTL - reverse the text for Hebrew content
  const hebrewPattern = /[\u0590-\u05FF]/;
  
  if (!hebrewPattern.test(text)) {
    return text;
  }
  
  // For Hebrew text, we need to handle RTL properly
  // This is a simplified approach - split by spaces and reverse words
  const words = text.split(' ');
  return words.reverse().join(' ');
};

export async function generateContractPDF(contractData: any, signatureDataURL: string) {
  console.log('🎯 Using HTML-based PDF generation for better Hebrew support');
  
  // Use the new HTML-based approach for better RTL support
  const blob = await generatePDFFromHTML(contractData, signatureDataURL);
  
  // Also trigger download
  const fileName = `contract_${contractData.idNumber || contractData.client?.idNumber || 'client'}_${Date.now()}.pdf`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  return blob;
}

export async function createAndDownloadPDF(contractData: any, signatureDataURL: string) {
  return await generateContractPDF(contractData, signatureDataURL);
}

export async function generateContractPDFBlob(contractData: any, signatureDataURL: string): Promise<Blob> {
  console.log('🎯 Using HTML-based PDF generation for blob');
  
  // Use the new HTML-based approach for better RTL support
  return await generatePDFFromHTML(contractData, signatureDataURL);
}