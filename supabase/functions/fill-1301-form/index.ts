import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FormData {
  // Main person
  idNumber: string;
  firstName: string;
  lastName: string;
  // Spouse (optional)
  spouseIdNumber?: string;
  spouseFirstName?: string;
  spouseLastName?: string;
  // Family status: 1=single, 2=married, 3=divorced, 4=widower
  familyStatus: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Fill 1301 Form function called');

    if (req.method !== 'POST') {
      throw new Error('Only POST method is allowed');
    }

    const formData: FormData = await req.json();
    console.log('📝 Form data received:', JSON.stringify(formData, null, 2));

    // Validate required fields
    if (!formData.idNumber || !formData.firstName || !formData.lastName || !formData.familyStatus) {
      throw new Error('Missing required fields: idNumber, firstName, lastName, familyStatus');
    }

    // Initialize Supabase client to fetch assets from storage
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch PDF template from storage
    console.log('📄 Fetching PDF template from storage...');
    const { data: pdfData, error: pdfError } = await supabase.storage
      .from('templates')
      .download('1301-template.pdf');

    if (pdfError || !pdfData) {
      console.error('❌ Failed to fetch PDF template:', pdfError);
      throw new Error('Failed to fetch PDF template from storage');
    }

    // Fetch Hebrew font from storage
    console.log('🔤 Fetching Hebrew font from storage...');
    const { data: fontData, error: fontError } = await supabase.storage
      .from('templates')
      .download('NotoSansHebrew-Regular.ttf');

    if (fontError || !fontData) {
      console.error('❌ Failed to fetch font:', fontError);
      throw new Error('Failed to fetch font from storage');
    }

    // Load PDF and font
    const pdfBytes = await pdfData.arrayBuffer();
    const fontBytes = await fontData.arrayBuffer();

    const pdfDoc = await PDFDocument.load(pdfBytes);
    pdfDoc.registerFontkit(fontkit);

    const hebrewFont = await pdfDoc.embedFont(fontBytes);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    console.log('📐 Page dimensions:', width, 'x', height);

    const fontSize = 9;
    const idFontSize = 11;
    const textColor = rgb(0, 0, 0);

    // Helper to convert Y from top to PDF coordinates
    const yFromTop = (y: number) => height - y;

    // Helper to draw ID number - each digit in separate box
    const drawIdNumber = (id: string, startX: number, y: number, digitSpacing = 15) => {
      const digits = id.toString().split('');
      digits.forEach((digit, index) => {
        firstPage.drawText(digit, {
          x: startX + (index * digitSpacing),
          y: yFromTop(y),
          size: idFontSize,
          font: helveticaFont,
          color: textColor,
        });
      });
    };

    // Helper to draw Hebrew text (RTL) - first letter at X, rest flows left
    const drawHebrewText = (text: string, x: number, y: number) => {
      const textWidth = hebrewFont.widthOfTextAtSize(text, fontSize);
      const firstCharWidth = hebrewFont.widthOfTextAtSize(text[0], fontSize);
      const adjustedX = x - textWidth + firstCharWidth;

      firstPage.drawText(text, {
        x: adjustedX,
        y: yFromTop(y),
        size: fontSize,
        font: hebrewFont,
        color: textColor,
      });
    };

    // Helper to draw checkmark using lines
    const drawCheckmark = (x: number, y: number) => {
      const pdfY = yFromTop(y);
      const size = 8;

      const startX = x;
      const startY = pdfY + size * 0.4;
      const midX = x + size * 0.3;
      const midY = pdfY;
      const endX = x + size;
      const endY = pdfY + size * 0.8;

      firstPage.drawLine({
        start: { x: startX, y: startY },
        end: { x: midX, y: midY },
        thickness: 1.5,
        color: textColor,
      });

      firstPage.drawLine({
        start: { x: midX, y: midY },
        end: { x: endX, y: endY },
        thickness: 1.5,
        color: textColor,
      });
    };

    console.log('🎨 Filling form fields...');

    // ========== MAIN PERSON ==========
    drawIdNumber(formData.idNumber, 261, 445, 15);
    console.log('✅ Main ID filled');

    drawHebrewText(formData.lastName, 403, 460);
    console.log('✅ Main Last name filled');

    drawHebrewText(formData.firstName, 316, 460);
    console.log('✅ Main First name filled');

    // ========== SPOUSE (if provided) ==========
    if (formData.spouseIdNumber) {
      drawIdNumber(formData.spouseIdNumber, 45, 445, 15);
      console.log('✅ Spouse ID filled');
    }

    if (formData.spouseLastName) {
      drawHebrewText(formData.spouseLastName, 188, 460);
      console.log('✅ Spouse Last name filled');
    }

    if (formData.spouseFirstName) {
      drawHebrewText(formData.spouseFirstName, 99, 460);
      console.log('✅ Spouse First name filled');
    }

    // ========== FAMILY STATUS ==========
    const familyStatusPositions: Record<number, { x: number; y: number }> = {
      1: { x: 548, y: 462 },  // Single (רווק)
      2: { x: 498, y: 462 },  // Married (נשוי)
      3: { x: 498, y: 477 },  // Divorced (גרוש)
      4: { x: 547, y: 477 },  // Widower (אלמן)
    };

    const statusPos = familyStatusPositions[formData.familyStatus];
    if (statusPos) {
      drawCheckmark(statusPos.x, statusPos.y);
      console.log('✅ Family status checkmark filled');
    }

    // ========== PERMANENT CHECKMARKS ==========
    drawCheckmark(500, 100);
    drawCheckmark(329, 100);
    drawCheckmark(532, 740);
    console.log('✅ Permanent checkmarks filled');

    // Save the filled PDF
    const filledPdfBytes = await pdfDoc.save();
    console.log('✅ PDF filled successfully');

    // Return the PDF as a downloadable file
    return new Response(filledPdfBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="1301-filled-${formData.idNumber}.pdf"`,
      },
    });

  } catch (error) {
    console.error('💥 Error:', error);
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
