import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SignPdfRequest {
  pdfBase64: string;
  signatureDataUrl: string;
  signaturePosition?: { x: number; y: number };
  signatureSize?: { width: number; height: number };
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
    const { pdfBase64, signatureDataUrl, signaturePosition, signatureSize } = body;

    if (!pdfBase64) {
      throw new Error('Missing required field: pdfBase64');
    }

    if (!signatureDataUrl) {
      throw new Error('Missing required field: signatureDataUrl');
    }

    console.log('📝 PDF base64 length:', pdfBase64.length);
    console.log('📝 Signature data URL length:', signatureDataUrl.length);

    // Default position: x:257, y:490 (from top)
    const position = signaturePosition || { x: 257, y: 490 };
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

    // Save the signed PDF
    const signedPdfBytes = await pdfDoc.save();
    console.log('✅ Signed PDF saved, bytes:', signedPdfBytes.length);

    // Convert to base64
    const signedPdfBase64 = btoa(String.fromCharCode(...signedPdfBytes));

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
