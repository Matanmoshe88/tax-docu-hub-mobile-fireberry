

# Plan: Create sign-poa-pdf Edge Function and Implement Full Signing Flow

## Overview

This plan implements the complete POA (Power of Attorney - יפוי כח מס הכנסה) signing workflow by:
1. Creating a new `sign-poa-pdf` edge function that overlays a signature image on the generated PDF at position x:257, y:490
2. Updating `SignableDocumentModal.tsx` to implement the full signing flow with Fireberry integration

---

## Architecture Flow

```text
User signs on canvas
        |
        v
Upload signature to Supabase Storage (signatures bucket)
        |
        v
Call generate-poa-pdf (get unsigned PDF base64)
        |
        v
Call sign-poa-pdf (overlay signature at x:257, y:490)
        |
        v
Upload signed PDF to Supabase Storage (signatures bucket)
        |
        v
Get docid from sessionStorage
        |
        v
Call document-upload (update Fireberry pcfsystemfield717)
        |
        v
Show success toast and close modal
```

---

## Implementation Steps

### Step 1: Create `sign-poa-pdf` Edge Function

**New file: `supabase/functions/sign-poa-pdf/index.ts`**

This edge function will:
- Accept unsigned PDF (base64) and signature image (base64 data URL)
- Use `pdf-lib` (same as `fill-1301-form`) to overlay the signature
- Place signature at coordinates x:257, y:490 (user-specified position)
- Return signed PDF as base64

**Request body:**
```json
{
  "pdfBase64": "JVBERi0xLjQK...",
  "signatureDataUrl": "data:image/png;base64,iVBORw0KGgo...",
  "signaturePosition": { "x": 257, "y": 490 },
  "signatureSize": { "width": 120, "height": 60 }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "signedPdf": "JVBERi0xLjQK...",
    "filename": "poa-signed-{recordId}.pdf"
  }
}
```

**Key implementation details:**
- Uses `pdf-lib` library (already used in `fill-1301-form`)
- Converts base64 data URL to bytes using `Uint8Array`
- Uses `pdfDoc.embedPng()` to embed the signature image
- Uses `page.drawImage()` to place signature at specified coordinates
- Coordinate system: y:490 from top (will be converted to PDF coordinates)

### Step 2: Update `supabase/config.toml`

Add configuration for the new edge function:
```toml
[functions.sign-poa-pdf]
verify_jwt = false
```

### Step 3: Update `SignableDocumentModal.tsx`

Replace the placeholder `handleSign` function with the complete implementation:

**New helper functions to add:**

1. `uploadSignatureToStorage(signatureBlob: Blob): Promise<string>`
   - Uploads signature PNG to `signatures` bucket
   - Returns public URL
   - Pattern: `poa-signature-{recordId}-{timestamp}.png`

2. `signPdfWithSignature(pdfBase64: string, signatureDataUrl: string): Promise<string>`
   - Calls `sign-poa-pdf` edge function
   - Returns signed PDF base64

3. `uploadSignedPdfToStorage(pdfBlob: Blob): Promise<string>`
   - Uploads signed PDF to `signatures` bucket
   - Returns public URL
   - Pattern: `poa-signed-{recordId}-{timestamp}.pdf`

4. `updateFireberryDocument(pdfUrl: string): Promise<void>`
   - Gets `docid` from sessionStorage
   - Calls `document-upload` edge function with type `poa_tax_auth`

**Updated `handleSign` flow:**
```typescript
const handleSign = async () => {
  // 1. Validate signature (existing code)
  
  // 2. Convert canvas to blob
  const signatureDataURL = canvas.toDataURL('image/png');
  const signatureBlob = await fetch(signatureDataURL).then(r => r.blob());
  
  // 3. Upload signature to storage
  const signatureUrl = await uploadSignatureToStorage(signatureBlob);
  
  // 4. Get unsigned PDF (already fetched as pdfData state)
  
  // 5. Sign the PDF
  const signedPdfBase64 = await signPdfWithSignature(pdfData, signatureDataURL);
  
  // 6. Convert and upload signed PDF
  const signedPdfBlob = base64ToBlob(signedPdfBase64, 'application/pdf');
  const signedPdfUrl = await uploadSignedPdfToStorage(signedPdfBlob);
  
  // 7. Update Fireberry
  await updateFireberryDocument(signedPdfUrl);
  
  // 8. Success!
  toast({ title: "המסמך נחתם בהצלחה! 🎉" });
  onSigned?.();
  onOpenChange(false);
}
```

---

## Technical Details

### Edge Function: sign-poa-pdf

```text
File: supabase/functions/sign-poa-pdf/index.ts

Libraries:
- pdf-lib@1.17.1 (same as fill-1301-form)
- Deno standard library for HTTP

Signature placement:
- x: 257 (from left edge)
- y: 490 (from top, converted to PDF coordinates)
- Recommended size: width ~120px, height ~60px (proportional to canvas)

PDF coordinate conversion:
- PDF origin is bottom-left
- Formula: pdfY = pageHeight - yFromTop
```

### Storage Paths

| Asset | Bucket | Pattern |
|-------|--------|---------|
| Signature PNG | signatures | `poa-signature-{recordId}-{timestamp}.png` |
| Signed PDF | signatures | `poa-signed-{recordId}-{timestamp}.pdf` |

### Fireberry Integration

- Document type: `poa_tax_auth`
- Field: `pcfsystemfield717`
- Uses existing `document-upload` edge function
- Requires `docid` from sessionStorage (set during contract signing flow)

### Error Handling

The implementation will handle these scenarios:
1. **Storage upload failure** - Retry logic + user-friendly error message
2. **PDF signing failure** - Show specific error from edge function
3. **Missing docid** - Show warning but still save to storage (graceful degradation)
4. **Fireberry API error** - Log error but don't block user (document is still saved)

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/sign-poa-pdf/index.ts` | Create | New edge function for PDF signature overlay |
| `supabase/config.toml` | Modify | Add sign-poa-pdf configuration |
| `src/components/SignableDocumentModal.tsx` | Modify | Implement full signing flow |

---

## Summary

This implementation creates a complete signing flow that:
1. Captures the user's signature on canvas
2. Uploads signature image to Supabase Storage
3. Overlays signature on the POA PDF at position x:257, y:490 using pdf-lib
4. Uploads the signed PDF to Supabase Storage
5. Updates Fireberry field `pcfsystemfield717` with the document URL
6. Provides user feedback throughout the process

The solution follows existing patterns in the codebase (from `fill-1301-form` and `SignaturePage.tsx`) and uses the established storage buckets and Fireberry integration endpoints.

