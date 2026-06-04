/**
 * Supabase Edge Function: sign-1301-pdf
 *
 * Stamps the client's signature onto the merged 1301 PDF and appends an audit
 * trail page — the 1301 counterpart of sign-poa-pdf.
 *
 * KEY DIFFERENCE FROM sign-poa-pdf — MULTI-PAGE, "SIGN ONCE → STAMP ALL":
 *   The 1301 output has one page per signed tax year. The client signs ONCE; this
 *   function stamps that SAME signature image on EVERY page, at each page's own
 *   signature box. The boxes come from the `pages[]` array that form1301Generator
 *   returned (already in PDF points, bottom-left origin — so NO y-flip is needed,
 *   unlike POA which converts from a top-based coordinate).
 *
 * REQUEST:
 *   {
 *     "pdfBase64": "...",                 // the unsigned merged 1301 PDF
 *     "signatureDataUrl": "data:image/png;base64,...",
 *     "pages": [ { "page":1, "year":2025, "signature":{x,y,width,height} }, ... ],
 *     "auditData": { ... }                // same shape as sign-poa-pdf
 *   }
 *
 * RESPONSE: { "success": true, "data": { "signedPdf": "<base64>" } }
 *
 * The signature image keeps its aspect ratio: it is drawn box.width wide with a
 * proportional height, its bottom-left anchored at the box's (x, y). To make a
 * signature bigger/smaller or move it, adjust that year's `signature` box in the
 * Lambda's coordinateMaps/<year>.mjs.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument, rgb, StandardFonts, type PDFFont } from "https://esm.sh/pdf-lib@1.17.1?pin=v135";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1?pin=v135";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3?pin=v135";

const VERSION = "1301-v1.0.0";

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

interface SignatureBox { x: number; y: number; width: number; height: number; }
interface PageInfo { page: number; year?: number; signature: SignatureBox; }

interface Sign1301Request {
  pdfBase64: string;
  signatureDataUrl: string;
  pages: PageInfo[];
  auditData?: AuditData;
}

// ── audit-trail formatting helpers (identical approach to sign-poa-pdf) ──
function formatIsoToIsrael(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} שניות`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return rem === 0 ? `${minutes} דקות` : `${minutes} דקות ו-${rem} שניות`;
}
function isHebrewChar(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= 0x0590 && code <= 0x05FF;
}
function hasHebrew(text: string): boolean { return /[֐-׿]/.test(text); }
function splitIntoSegments(text: string): Array<{ text: string; isHebrew: boolean }> {
  const segments: Array<{ text: string; isHebrew: boolean }> = [];
  let cur = ''; let curHeb: boolean | null = null;
  for (const ch of text) {
    const heb = isHebrewChar(ch);
    if (curHeb === null) { curHeb = heb; cur = ch; }
    else if (heb === curHeb) { cur += ch; }
    else { if (cur) segments.push({ text: cur, isHebrew: curHeb }); cur = ch; curHeb = heb; }
  }
  if (cur) segments.push({ text: cur, isHebrew: curHeb! });
  return segments;
}

async function addAuditTrailPage(
  pdfDoc: PDFDocument, auditData: AuditData,
  hebrewFont: PDFFont, latinFont: PDFFont, _latinBoldFont: PDFFont,
): Promise<void> {
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  let y = height - 50;
  const margin = 50;
  const lineHeight = 18;
  const rightEdge = width - margin;

  const drawLatinText = (text: string, x: number, yPos: number, size = 11, font = latinFont, color = rgb(0, 0, 0)) =>
    page.drawText(text, { x, y: yPos, size, font, color });
  const drawLine = (x1: number, y1: number, x2: number, thickness = 1, color = rgb(0.8, 0.8, 0.8)) =>
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y1 }, thickness, color });
  const drawMixedText = (text: string, yPos: number, size = 11, color = rgb(0, 0, 0)) => {
    if (!hasHebrew(text)) { page.drawText(text, { x: margin, y: yPos, size, font: latinFont, color }); return; }
    let xPos = rightEdge;
    for (const seg of splitIntoSegments(text)) {
      const font = seg.isHebrew ? hebrewFont : latinFont;
      xPos -= font.widthOfTextAtSize(seg.text, size);
      page.drawText(seg.text, { x: xPos, y: yPos, size, font, color });
    }
  };
  const drawLabelValue = (label: string, value: string, yPos: number, size = 11) => {
    let xPos = rightEdge;
    for (const seg of [...splitIntoSegments(label), ...splitIntoSegments(value)]) {
      const font = seg.isHebrew ? hebrewFont : latinFont;
      xPos -= font.widthOfTextAtSize(seg.text, size);
      page.drawText(seg.text, { x: xPos, y: yPos, size, font, color: rgb(0, 0, 0) });
    }
  };

  drawMixedText('פרוטוקול אימות חתימה דיגיטלית', y, 18, rgb(0.15, 0.38, 0.93)); y -= 25;
  drawMixedText('מסלול ביקורת - דוח 1301 לחתימה', y, 12, rgb(0.4, 0.4, 0.4)); y -= 10;
  drawLine(margin, y, width - margin, 2, rgb(0.15, 0.38, 0.93)); y -= 30;

  drawMixedText('פרטי הלקוח', y, 14, rgb(0.12, 0.25, 0.69)); y -= 20;
  if (auditData.clientName) { drawLabelValue('שם מלא: ', auditData.clientName, y); y -= lineHeight; }
  if (auditData.clientId) { drawLabelValue('מספר זהות: ', auditData.clientId, y); y -= lineHeight; }
  if (auditData.clientPhone) { drawLabelValue('טלפון: ', auditData.clientPhone, y); y -= lineHeight; }
  y -= 15;

  const otpColor = auditData.otpVerified ? rgb(0.09, 0.40, 0.21) : rgb(0.86, 0.15, 0.15);
  drawMixedText('אימות טלפון (OTP)', y, 14, otpColor); y -= 20;
  if (auditData.smsSentTime) {
    drawLabelValue('SMS נשלח: ', formatIsoToIsrael(auditData.smsSentTime), y); y -= lineHeight;
    drawMixedText('(נשלח על ידי צד ג׳ - InforUMobile)', y, 9, rgb(0.02, 0.52, 0.40)); y -= lineHeight;
    if (auditData.smsProviderStatusId !== undefined) {
      drawLabelValue('סטטוס: ', `${auditData.smsProviderStatusId} - ${auditData.smsProviderStatusDescription || 'הצלחה'}`, y, 9); y -= lineHeight;
    }
  }
  if (auditData.otpCodeEntered) { drawLabelValue('קוד שהוזן: ', auditData.otpCodeEntered, y); y -= lineHeight; }
  if (auditData.otpVerificationTime) { drawLabelValue('OTP אומת: ', formatIsoToIsrael(auditData.otpVerificationTime), y); y -= lineHeight; }
  drawMixedText(`סטטוס אימות: ${auditData.otpVerified ? 'אומת בהצלחה' : 'לא אומת'}`, y, 11, otpColor); y -= 25;

  drawMixedText('ציר זמן המסמך', y, 14, rgb(0.43, 0.16, 0.84)); y -= 20;
  if (auditData.contractViewedAt) { drawLabelValue('המסמך נצפה: ', formatIsoToIsrael(auditData.contractViewedAt), y); y -= lineHeight; }
  if (auditData.signatureSubmittedAt) { drawLabelValue('החתימה נשלחה: ', formatIsoToIsrael(auditData.signatureSubmittedAt), y); y -= lineHeight; }
  if (auditData.timeSpentReadingSeconds) { drawLabelValue('זמן קריאה: ', formatDuration(auditData.timeSpentReadingSeconds), y); y -= lineHeight; }
  y -= 15;

  drawMixedText('פרטי מכשיר וחיבור', y, 14, rgb(0.85, 0.62, 0.04)); y -= 20;
  if (auditData.ipAddress) { drawLabelValue('כתובת IP: ', auditData.ipAddress, y); y -= lineHeight; }
  if (auditData.browserName) { drawLabelValue('דפדפן: ', auditData.browserName, y); y -= lineHeight; }
  if (auditData.operatingSystem) { drawLabelValue('מערכת הפעלה: ', auditData.operatingSystem, y); y -= lineHeight; }
  if (auditData.screenResolution) { drawLabelValue('רזולוציית מסך: ', auditData.screenResolution, y); y -= lineHeight; }
  if (auditData.timezone) { drawLabelValue('אזור זמן: ', auditData.timezone, y); y -= lineHeight; }
  y -= 15;

  if (auditData.recordId) {
    page.drawRectangle({ x: margin, y: y - 25, width: width - 2 * margin, height: 30, color: rgb(0.95, 0.96, 0.98), borderColor: rgb(0.8, 0.85, 0.9), borderWidth: 1 });
    drawLatinText(`Record ID: ${auditData.recordId}`, margin + 10, y - 15, 10, latinFont, rgb(0.4, 0.45, 0.53));
    y -= 45;
  }

  page.drawRectangle({ x: margin, y: y - 60, width: width - 2 * margin, height: 55, color: rgb(0.94, 0.96, 1), borderColor: rgb(0.15, 0.38, 0.93), borderWidth: 2 });
  drawMixedText('תהליך חתימה', y - 20, 12, rgb(0.12, 0.25, 0.69));
  drawMixedText('פרוטוקול זה מתעד את תהליך החתימה הדיגיטלית על דוח 1301.', y - 38, 10);
  y -= 80;

  drawLine(margin, y, width - margin); y -= 15;
  drawMixedText('נוצר על ידי מערכת החתימה הדיגיטלית של QuickTax', y, 9, rgb(0.58, 0.64, 0.72)); y -= 12;
  drawMixedText('כל הזמנים מוצגים באזור הזמן של ישראל (Asia/Jerusalem)', y, 9, rgb(0.58, 0.64, 0.72));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    console.log(`🚀 sign-1301-pdf ${VERSION}`);
    if (req.method !== 'POST') throw new Error('Only POST method is allowed');

    const body: Sign1301Request = await req.json();
    const { pdfBase64, signatureDataUrl, pages, auditData } = body;

    if (!pdfBase64) throw new Error('Missing required field: pdfBase64');
    if (!signatureDataUrl) throw new Error('Missing required field: signatureDataUrl');
    if (!Array.isArray(pages) || pages.length === 0) throw new Error('Missing required field: pages[]');

    // Decode + load the merged PDF
    const pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
    const pdfDoc = await PDFDocument.load(pdfBytes);
    pdfDoc.registerFontkit(fontkit);

    // Fonts for the audit page (Hebrew from storage, Latin standard)
    let hebrewFont: PDFFont | null = null;
    const latinFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const latinBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    if (auditData) {
      const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
      const { data: fontData, error: fontError } = await supabase.storage.from('templates').download('NotoSansHebrew-Regular.ttf');
      if (fontError || !fontData) throw new Error('Failed to load Hebrew font for audit trail');
      hebrewFont = await pdfDoc.embedFont(await fontData.arrayBuffer(), { subset: false });
    }

    // Embed the signature image
    const signatureBase64 = signatureDataUrl.split(',')[1];
    if (!signatureBase64) throw new Error('Invalid signature data URL format');
    const signatureBytes = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));
    const signatureImage = await pdfDoc.embedPng(signatureBytes);
    const imgAspect = signatureImage.height / signatureImage.width;

    // Stamp the SAME signature on EVERY page at its own box (bottom-left, no flip)
    const docPages = pdfDoc.getPages();
    for (const info of pages) {
      const idx = (info.page ?? 0) - 1;
      if (idx < 0 || idx >= docPages.length || !info.signature) continue;
      const box = info.signature;
      const drawWidth = box.width;
      const drawHeight = drawWidth * imgAspect; // keep aspect ratio
      docPages[idx].drawImage(signatureImage, { x: box.x, y: box.y, width: drawWidth, height: drawHeight });
    }
    console.log(`✅ Signature stamped on ${pages.length} page(s)`);

    // Append the audit-trail page
    if (auditData && hebrewFont) {
      await addAuditTrailPage(pdfDoc, auditData, hebrewFont, latinFont, latinBoldFont);
      console.log('✅ Audit trail page added');
    }

    const signedPdfBytes = await pdfDoc.save();

    // Chunked base64 (avoid stack overflow)
    const chunkSize = 8192;
    let binary = "";
    for (let i = 0; i < signedPdfBytes.length; i += chunkSize) {
      const chunk = signedPdfBytes.subarray(i, Math.min(i + chunkSize, signedPdfBytes.length));
      for (let j = 0; j < chunk.length; j++) binary += String.fromCharCode(chunk[j]);
    }
    const signedPdfBase64 = btoa(binary);

    return new Response(JSON.stringify({ success: true, data: { signedPdf: signedPdfBase64 } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('💥 sign-1301-pdf error:', error);
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
