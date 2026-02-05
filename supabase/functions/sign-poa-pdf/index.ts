import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuditData {
  clientName?: string;
  clientId?: string;
  clientPhone?: string;
  smsSentTime?: string;
  smsProviderStatusId?: number;
  smsProviderStatusDescription?: string;
  otpCodeEntered?: string;
  otpVerified?: boolean;
  otpVerificationTime?: string;
  contractViewedAt?: string;
  signatureSubmittedAt?: string;
  timeSpentReadingSeconds?: number;
  ipAddress?: string;
  browserName?: string;
  operatingSystem?: string;
  screenResolution?: string;
  timezone?: string;
  recordId?: string;
}

interface SignPdfRequest {
  pdfBase64: string;
  signatureDataUrl: string;
  signaturePosition?: { x: number; y: number };
  signatureSize?: { width: number; height: number };
  auditData?: AuditData;
}

// Format ISO timestamp to Israel display format
function formatIsoToIsrael(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// Format seconds to human-readable duration in Hebrew
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} שניות`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) return `${minutes} דקות`;
  return `${minutes} דקות ו-${remainingSeconds} שניות`;
}

// Draw audit trail page on the PDF
async function addAuditTrailPage(pdfDoc: PDFDocument, auditData: AuditData): Promise<void> {
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
  const { width, height } = page.getSize();
  
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  let y = height - 50;
  const margin = 50;
  const lineHeight = 18;
  
  // Helper to draw text
  const drawText = (text: string, x: number, yPos: number, size: number = 11, font = helvetica, color = rgb(0, 0, 0)) => {
    page.drawText(text, { x, y: yPos, size, font, color });
  };
  
  // Helper to draw a line
  const drawLine = (x1: number, y1: number, x2: number, thickness: number = 1, color = rgb(0.8, 0.8, 0.8)) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y1 }, thickness, color });
  };
  
  // Title
  drawText('Digital Signature Verification Protocol', margin, y, 18, helveticaBold, rgb(0.15, 0.38, 0.93));
  y -= 25;
  drawText('Audit Trail - POA Tax Authority Document', margin, y, 12, helvetica, rgb(0.4, 0.4, 0.4));
  y -= 10;
  drawLine(margin, y, width - margin, 2, rgb(0.15, 0.38, 0.93));
  y -= 30;
  
  // Client Identity Section
  drawText('Client Identity', margin, y, 14, helveticaBold, rgb(0.12, 0.25, 0.69));
  y -= 20;
  
  if (auditData.clientName) {
    drawText(`Full Name: ${auditData.clientName}`, margin + 10, y);
    y -= lineHeight;
  }
  if (auditData.clientId) {
    drawText(`ID Number: ${auditData.clientId}`, margin + 10, y);
    y -= lineHeight;
  }
  if (auditData.clientPhone) {
    drawText(`Phone: ${auditData.clientPhone}`, margin + 10, y);
    y -= lineHeight;
  }
  y -= 15;
  
  // Phone Verification Section
  const otpColor = auditData.otpVerified ? rgb(0.09, 0.40, 0.21) : rgb(0.86, 0.15, 0.15);
  drawText('Phone Verification (OTP)', margin, y, 14, helveticaBold, otpColor);
  y -= 20;
  
  if (auditData.smsSentTime) {
    drawText(`SMS Sent: ${formatIsoToIsrael(auditData.smsSentTime)}`, margin + 10, y);
    y -= lineHeight;
    drawText('(Sent via 3rd party - InforUMobile)', margin + 10, y, 9, helvetica, rgb(0.02, 0.52, 0.40));
    y -= lineHeight;
    if (auditData.smsProviderStatusId !== undefined) {
      drawText(`Status: ${auditData.smsProviderStatusId} - ${auditData.smsProviderStatusDescription || 'Success'}`, margin + 10, y, 9);
      y -= lineHeight;
    }
  }
  if (auditData.otpCodeEntered) {
    drawText(`Code Entered: ${auditData.otpCodeEntered}`, margin + 10, y);
    y -= lineHeight;
  }
  if (auditData.otpVerificationTime) {
    drawText(`OTP Verified: ${formatIsoToIsrael(auditData.otpVerificationTime)}`, margin + 10, y);
    y -= lineHeight;
  }
  drawText(`Verification Status: ${auditData.otpVerified ? 'Verified Successfully' : 'Not Verified'}`, margin + 10, y, 11, helveticaBold, otpColor);
  y -= 25;
  
  // Document Timeline Section
  drawText('Document Timeline', margin, y, 14, helveticaBold, rgb(0.43, 0.16, 0.84));
  y -= 20;
  
  if (auditData.contractViewedAt) {
    drawText(`Document Viewed: ${formatIsoToIsrael(auditData.contractViewedAt)}`, margin + 10, y);
    y -= lineHeight;
  }
  if (auditData.signatureSubmittedAt) {
    drawText(`Signature Submitted: ${formatIsoToIsrael(auditData.signatureSubmittedAt)}`, margin + 10, y, 11, helveticaBold, rgb(0.15, 0.38, 0.93));
    y -= lineHeight;
  }
  if (auditData.timeSpentReadingSeconds) {
    drawText(`Time Spent Reading: ${formatDuration(auditData.timeSpentReadingSeconds)}`, margin + 10, y);
    y -= lineHeight;
  }
  y -= 15;
  
  // Device & Session Info Section
  drawText('Device & Connection Details', margin, y, 14, helveticaBold, rgb(0.85, 0.62, 0.04));
  y -= 20;
  
  if (auditData.ipAddress) {
    drawText(`IP Address: ${auditData.ipAddress}`, margin + 10, y);
    y -= lineHeight;
  }
  if (auditData.browserName) {
    drawText(`Browser: ${auditData.browserName}`, margin + 10, y);
    y -= lineHeight;
  }
  if (auditData.operatingSystem) {
    drawText(`Operating System: ${auditData.operatingSystem}`, margin + 10, y);
    y -= lineHeight;
  }
  if (auditData.screenResolution) {
    drawText(`Screen Resolution: ${auditData.screenResolution}`, margin + 10, y);
    y -= lineHeight;
  }
  if (auditData.timezone) {
    drawText(`Timezone: ${auditData.timezone}`, margin + 10, y);
    y -= lineHeight;
  }
  y -= 15;
  
  // Record Reference
  if (auditData.recordId) {
    page.drawRectangle({
      x: margin,
      y: y - 25,
      width: width - 2 * margin,
      height: 30,
      color: rgb(0.95, 0.96, 0.98),
      borderColor: rgb(0.8, 0.85, 0.9),
      borderWidth: 1,
    });
    drawText(`Record ID: ${auditData.recordId}`, margin + 10, y - 15, 10, helvetica, rgb(0.4, 0.45, 0.53));
    y -= 45;
  }
  
  // Legal Declaration
  page.drawRectangle({
    x: margin,
    y: y - 60,
    width: width - 2 * margin,
    height: 55,
    color: rgb(0.94, 0.96, 1),
    borderColor: rgb(0.15, 0.38, 0.93),
    borderWidth: 2,
  });
  drawText('Signing Process', margin + 10, y - 20, 12, helveticaBold, rgb(0.12, 0.25, 0.69));
  drawText('This protocol documents the digital signature process for the POA document.', margin + 10, y - 38, 10);
  y -= 80;
  
  // Footer
  drawLine(margin, y, width - margin);
  y -= 15;
  drawText('Generated by QuickTax Digital Signature System', margin, y, 9, helvetica, rgb(0.58, 0.64, 0.72));
  y -= 12;
  drawText('All times displayed in Israel timezone (Asia/Jerusalem)', margin, y, 9, helvetica, rgb(0.58, 0.64, 0.72));
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Sign POA PDF function called');

    if (req.method !== 'POST') {
      throw new Error('Only POST method is allowed');
    }

    const body: SignPdfRequest = await req.json();
    const { pdfBase64, signatureDataUrl, signaturePosition, signatureSize, auditData } = body;

    if (!pdfBase64) {
      throw new Error('Missing required field: pdfBase64');
    }

    if (!signatureDataUrl) {
      throw new Error('Missing required field: signatureDataUrl');
    }

    console.log('📝 PDF base64 length:', pdfBase64.length);
    console.log('📝 Signature data URL length:', signatureDataUrl.length);
    console.log('📋 Audit data provided:', !!auditData);

    // Default position: x:257, y:430 (from top) - bottom of signature will be at 490px
    const position = signaturePosition || { x: 257, y: 430 };
    // Default size: 120x60
    const size = signatureSize || { width: 120, height: 60 };

    console.log('📍 Signature position:', position);
    console.log('📐 Signature size:', size);

    // Decode PDF from base64
    const pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
    console.log('📄 PDF bytes length:', pdfBytes.length);

    // Load the PDF document
    const pdfDoc = await PDFDocument.load(pdfBytes);
    console.log('✅ PDF loaded successfully');

    // Extract signature image bytes from data URL
    // Format: data:image/png;base64,iVBORw0KGgo...
    const signatureBase64 = signatureDataUrl.split(',')[1];
    if (!signatureBase64) {
      throw new Error('Invalid signature data URL format');
    }

    const signatureBytes = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));
    console.log('🖊️ Signature bytes length:', signatureBytes.length);

    // Embed the signature image
    const signatureImage = await pdfDoc.embedPng(signatureBytes);
    console.log('✅ Signature image embedded');

    // Get the first page
    const pages = pdfDoc.getPages();
    if (pages.length === 0) {
      throw new Error('PDF has no pages');
    }
    const firstPage = pages[0];
    const { height: pageHeight } = firstPage.getSize();

    console.log('📐 Page height:', pageHeight);

    // Convert y coordinate from top to PDF coordinates (bottom-left origin)
    const pdfY = pageHeight - position.y - size.height;

    console.log('📍 Drawing signature at PDF coordinates:', { x: position.x, y: pdfY });

    // Draw the signature on the first page
    firstPage.drawImage(signatureImage, {
      x: position.x,
      y: pdfY,
      width: size.width,
      height: size.height,
    });

    console.log('✅ Signature drawn on PDF');

    // Add audit trail page if audit data is provided
    if (auditData) {
      console.log('📋 Adding audit trail page...');
      await addAuditTrailPage(pdfDoc, auditData);
      console.log('✅ Audit trail page added');
    }

    // Save the signed PDF
    const signedPdfBytes = await pdfDoc.save();
    console.log('✅ Signed PDF saved, bytes:', signedPdfBytes.length);

    // Convert to base64 using chunked approach to avoid stack overflow
    const chunkSize = 8192;
    let binary = "";
    for (let i = 0; i < signedPdfBytes.length; i += chunkSize) {
      const chunk = signedPdfBytes.subarray(i, Math.min(i + chunkSize, signedPdfBytes.length));
      for (let j = 0; j < chunk.length; j++) {
        binary += String.fromCharCode(chunk[j]);
      }
    }
    const signedPdfBase64 = btoa(binary);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          signedPdf: signedPdfBase64,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('💥 Sign PDF error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
