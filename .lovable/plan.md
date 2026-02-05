
# Fix: Sticky Signature Pad with Buttons

## The Problem
Currently, the signature pad and buttons are inside the scrollable content, so when the user scrolls to view the PDF document, they can't see or access the signature area.

## The Solution
Restructure the modal layout so that:
1. **The PDF preview area** scrolls independently at the top
2. **The signature pad + buttons** are fixed/sticky at the bottom and always visible
3. The layout works well on both mobile and desktop

## Visual Layout

```text
+----------------------------------+
|  Header: יפוי כח מס הכנסה         |
+----------------------------------+
|                                  |
|  PDF Preview Area                |
|  (scrollable independently)      |
|                                  |
|                                  |
+----------------------------------+
|  Signature Pad   [נקה] [חתום]   |  <-- STICKY BOTTOM
|  Legal notice text               |
+----------------------------------+
```

## Changes to SignableDocumentModal.tsx

1. **Split the DialogContent into two sections**:
   - Top section: Scrollable content area with the PDF preview
   - Bottom section: Fixed/sticky footer with signature pad and buttons

2. **Rearrange signature section layout**:
   - Signature pad on the left (in RTL, on the right visually)
   - Buttons inline next to the signature pad
   - Compact legal notice below

3. **CSS adjustments**:
   - Use `flex flex-col h-full` on the modal content
   - Make PDF area `flex-1 overflow-y-auto`
   - Make signature footer `sticky bottom-0` with a solid background
   - Add shadow to the sticky footer for visual separation

## Before vs After

**Before:**
- Signature pad hidden when scrolling
- Buttons at the bottom of content
- User must scroll back down to sign

**After:**
- Signature pad always visible at bottom
- Buttons next to signature (inline)
- User can scroll PDF and sign at any time

## Technical Implementation

### File: `src/components/SignableDocumentModal.tsx`

**Key changes:**

1. Remove `overflow-y-auto` from `DialogContent`
2. Add a flex container structure:
   - Header section (fixed)
   - Scrollable PDF content area (`flex-1 overflow-y-auto`)
   - Sticky signature footer (`sticky bottom-0 bg-background shadow-lg`)

3. Signature footer layout:
   - Use `flex` to put signature pad and buttons side-by-side
   - On mobile: Stack vertically with buttons full-width below
   - On desktop: Buttons positioned next to signature pad

4. Add visual separator (shadow) so the sticky footer stands out from scrollable content
