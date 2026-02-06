import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument, rgb, StandardFonts, type PDFFont } from "https://esm.sh/pdf-lib@1.17.1?pin=v135";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1?pin=v135";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3?pin=v135";

const VERSION = "v6.2.0-segment-rendering";

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

// Check if character is Hebrew
function isHebrewChar(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= 0x0590 && code <= 0x05FF;
}

// Check if text contains Hebrew characters
function hasHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

// Split text into segments of Hebrew and non-Hebrew characters
function splitIntoSegments(text: string): Array<{ text: string; isHebrew: boolean }> {
  const segments: Array<{ text: string; isHebrew: boolean }> = [];
  let currentSegment = '';
  let currentIsHebrew: boolean | null = null;
  
  for (const char of text) {
    const charIsHebrew = isHebrewChar(char);
    
    if (currentIsHebrew === null) {
      currentIsHebrew = charIsHebrew;
      currentSegment = char;
    } else if (charIsHebrew === currentIsHebrew) {
      currentSegment += char;
    } else {
      if (currentSegment) {
        segments.push({ text: currentSegment, isHebrew: currentIsHebrew });
      }
      currentSegment = char;
      currentIsHebrew = charIsHebrew;
    }
  }
  
  if (currentSegment) {
    segments.push({ text: currentSegment, isHebrew: currentIsHebrew! });
  }
  
  return segments;
}

// Draw audit trail page on the PDF with proper font handling
// Hebrew text uses hebrewFont, numbers/Latin use latinFont
async function addAuditTrailPage(
  pdfDoc: PDFDocument, 
  auditData: AuditData, 
  hebrewFont: PDFFont,
  latinFont: PDFFont,
  latinBoldFont: PDFFont
): Promise<void> {
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
  const { width, height } = page.getSize();
  
  let y = height - 50;
  const margin = 50;
  const lineHeight = 18;
  const rightEdge = width - margin;
  
  // Helper to draw mixed Hebrew/Latin text from right edge
  // Splits text into segments and renders each with appropriate font
  const drawMixedText = (text: string, yPos: number, size: number = 11, color = rgb(0, 0, 0)) => {
    // For pure Latin/numbers, use latin font left-aligned
    if (!hasHebrew(text)) {
      page.drawText(text, { x: margin, y: yPos, size, font: latinFont, color });
      return;
    }
    
    // Split into segments and render from right to left
    const segments = splitIntoSegments(text);
    let xPos = rightEdge;
    
    // Calculate total width first, then render from right
    for (const segment of segments) {
      const font = segment.isHebrew ? hebrewFont : latinFont;
      const segmentWidth = font.widthOfTextAtSize(segment.text, size);
      xPos -= segmentWidth;
      page.drawText(segment.text, { x: xPos, y: yPos, size, font, color });
    }
  };
  
  // Helper to draw Latin text left-aligned
  const drawLatinText = (text: string, x: number, yPos: number, size: number = 11, font = latinFont, color = rgb(0, 0, 0)) => {
    page.drawText(text, { x, y: yPos, size, font, color });
  };
  
  // Helper to draw a line
  const drawLine = (x1: number, y1: number, x2: number, thickness: number = 1, color = rgb(0.8, 0.8, 0.8)) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y1 }, thickness, color });
  };
  
  // Helper for Hebrew label with value - combines and renders as mixed text
  const drawLabelValue = (label: string, value: string, yPos: number, size: number = 11) => {
    const fullText = label + value;
    drawMixedText(fullText, yPos, size);
  };
  
  // Title (Hebrew)
  drawMixedText('פרוטוקול אימות חתימה דיגיטלית', y, 18, rgb(0.15, 0.38, 0.93));
  y -= 25;
  drawMixedText('מסלול ביקורת - יפוי כח מס הכנסה', y, 12, rgb(0.4, 0.4, 0.4));
  y -= 10;
  drawLine(margin, y, width - margin, 2, rgb(0.15, 0.38, 0.93));
  y -= 30;
  
  // Client Identity Section
  drawMixedText('פרטי הלקוח', y, 14, rgb(0.12, 0.25, 0.69));
  y -= 20;
  
  if (auditData.clientName) {
    drawLabelValue('שם מלא: ', auditData.clientName, y);
    y -= lineHeight;
  }
  if (auditData.clientId) {
    drawLabelValue('מספר זהות: ', auditData.clientId, y);
    y -= lineHeight;
  }
  if (auditData.clientPhone) {
    drawLabelValue('טלפון: ', auditData.clientPhone, y);
    y -= lineHeight;
  }
  y -= 15;
  
  // Phone Verification Section
  const otpColor = auditData.otpVerified ? rgb(0.09, 0.40, 0.21) : rgb(0.86, 0.15, 0.15);
  drawMixedText('אימות טלפון (OTP)', y, 14, otpColor);
  y -= 20;
  
  if (auditData.smsSentTime) {
    drawLabelValue('SMS נשלח: ', formatIsoToIsrael(auditData.smsSentTime), y);
    y -= lineHeight;
    drawMixedText('(נשלח על ידי צד ג׳ - InforUMobile)', y, 9, rgb(0.02, 0.52, 0.40));
    y -= lineHeight;
    if (auditData.smsProviderStatusId !== undefined) {
      const statusText = `${auditData.smsProviderStatusId} - ${auditData.smsProviderStatusDescription || 'הצלחה'}`;
      drawLabelValue('סטטוס: ', statusText, y, 9);
      y -= lineHeight;
    }
  }
  if (auditData.otpCodeEntered) {
    drawLabelValue('קוד שהוזן: ', auditData.otpCodeEntered, y);
    y -= lineHeight;
  }
  if (auditData.otpVerificationTime) {
    drawLabelValue('OTP אומת: ', formatIsoToIsrael(auditData.otpVerificationTime), y);
    y -= lineHeight;
  }
  const verifyStatus = auditData.otpVerified ? 'אומת בהצלחה' : 'לא אומת';
  drawMixedText(`סטטוס אימות: ${verifyStatus}`, y, 11, otpColor);
  y -= 25;
  
  // Document Timeline Section
  drawMixedText('ציר זמן המסמך', y, 14, rgb(0.43, 0.16, 0.84));
  y -= 20;
  
  if (auditData.contractViewedAt) {
    drawLabelValue('המסמך נצפה: ', formatIsoToIsrael(auditData.contractViewedAt), y);
    y -= lineHeight;
  }
  if (auditData.signatureSubmittedAt) {
    drawLabelValue('החתימה נשלחה: ', formatIsoToIsrael(auditData.signatureSubmittedAt), y);
    y -= lineHeight;
  }
  if (auditData.timeSpentReadingSeconds) {
    drawLabelValue('זמן קריאה: ', formatDuration(auditData.timeSpentReadingSeconds), y);
    y -= lineHeight;
  }
  y -= 15;
  
  // Device & Session Info Section
  drawMixedText('פרטי מכשיר וחיבור', y, 14, rgb(0.85, 0.62, 0.04));
  y -= 20;
  
  if (auditData.ipAddress) {
    drawLabelValue('כתובת IP: ', auditData.ipAddress, y);
    y -= lineHeight;
  }
  if (auditData.browserName) {
    drawLabelValue('דפדפן: ', auditData.browserName, y);
    y -= lineHeight;
  }
  if (auditData.operatingSystem) {
    drawLabelValue('מערכת הפעלה: ', auditData.operatingSystem, y);
    y -= lineHeight;
  }
  if (auditData.screenResolution) {
    drawLabelValue('רזולוציית מסך: ', auditData.screenResolution, y);
    y -= lineHeight;
  }
  if (auditData.timezone) {
    drawLabelValue('אזור זמן: ', auditData.timezone, y);
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
    drawLatinText(`Record ID: ${auditData.recordId}`, margin + 10, y - 15, 10, latinFont, rgb(0.4, 0.45, 0.53));
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
  drawMixedText('תהליך חתימה', y - 20, 12, rgb(0.12, 0.25, 0.69));
  drawMixedText('פרוטוקול זה מתעד את תהליך החתימה הדיגיטלית על מסמך יפוי כח מס הכנסה.', y - 38, 10);
  y -= 80;
  
  // Footer
  drawLine(margin, y, width - margin);
  y -= 15;
  drawMixedText('נוצר על ידי מערכת החתימה הדיגיטלית של QuickTax', y, 9, rgb(0.58, 0.64, 0.72));
  y -= 12;
  drawMixedText('כל הזמנים מוצגים באזור הזמן של ישראל (Asia/Jerusalem)', y, 9, rgb(0.58, 0.64, 0.72));
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

    // Default position: x:257, y:560 (from top)
    const position = signaturePosition || { x: 257, y: 560 };
    // Default size: 150x75 (bigger signature)
    const size = signatureSize || { width: 150, height: 75 };

    console.log(`🔖 VERSION: ${VERSION}`);

    console.log('📍 Signature position:', position);
    console.log('📐 Signature size:', size);

    // Decode PDF from base64
    const pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
    console.log('📄 PDF bytes length:', pdfBytes.length);

    // Load the PDF document
    const pdfDoc = await PDFDocument.load(pdfBytes);
    console.log('✅ PDF loaded successfully');

    // Register fontkit for custom fonts
    pdfDoc.registerFontkit(fontkit);

    // Load Hebrew font from Supabase storage (for audit trail)
    let hebrewFont: PDFFont | null = null;
    let latinFont: PDFFont;
    let latinBoldFont: PDFFont;

    if (auditData) {
      console.log('📋 Loading Hebrew font for audit trail...');
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { data: fontData, error: fontError } = await supabase.storage
        .from('templates')
        .download('NotoSansHebrew-Regular.ttf');

      if (fontError || !fontData) {
        console.error('❌ Failed to load Hebrew font:', fontError);
        throw new Error('Failed to load Hebrew font for audit trail');
      }

      const fontBytes = await fontData.arrayBuffer();
      console.log('📦 Font bytes size:', fontBytes.byteLength);
      
      // Log first few bytes to verify it's a valid TTF file
      const fontView = new Uint8Array(fontBytes);
      const header = Array.from(fontView.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ');
      console.log('📦 Font header bytes:', header);
      console.log('📦 Expected TTF header: 00 01 00 00 (or 4F 54 54 4F for OTF)');
      
      // Disable subsetting to ensure all Hebrew glyphs are included
      hebrewFont = await pdfDoc.embedFont(fontBytes, { subset: false });
      
      // Log font details
      console.log('✅ Hebrew font embedded successfully');
      console.log('📝 Font name:', hebrewFont.name);
      console.log('📝 Font encoding:', hebrewFont.encodeText ? 'Custom' : 'Standard');
    }

    // Always load Latin fonts
    latinFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    latinBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

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
    if (auditData && hebrewFont) {
      console.log('📋 Adding audit trail page...');
      await addAuditTrailPage(pdfDoc, auditData, hebrewFont, latinFont, latinBoldFont);
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
