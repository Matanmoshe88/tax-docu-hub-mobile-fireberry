
# Fix PDF Display and Scrolling in SignableDocumentModal

## Problem Analysis

Two issues have been identified:

1. **PDF is cut off (30% on the left)**: The `<Page>` component is using a fixed `width={500}` which is too wide for the modal container, especially on smaller screens. The PDF renders at 500px but the container cannot accommodate it, causing horizontal clipping.

2. **Cannot scroll the modal**: The PDF preview container has `overflow-hidden` which prevents scrolling. It should be `overflow-auto` to allow vertical and horizontal scrolling.

## Solution

### 1. Make PDF Width Responsive
Instead of a fixed 500px width, calculate the width dynamically based on the container size. Use a ref to measure the container width and set the PDF page width accordingly.

### 2. Enable Scrolling on PDF Container
Change `overflow-hidden` to `overflow-auto` on the PDF preview area to enable both vertical and horizontal scrolling when needed.

### 3. Add Horizontal Scroll for Wide PDFs
Wrap the PDF in a scrollable container that allows horizontal scrolling if the PDF is wider than the viewport.

---

## Technical Details

### File: `src/components/SignableDocumentModal.tsx`

**Change 1: Add container ref and width state**
```typescript
const containerRef = useRef<HTMLDivElement>(null);
const [containerWidth, setContainerWidth] = useState<number>(0);

// Measure container width
useEffect(() => {
  if (containerRef.current) {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth - 32); // minus padding
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }
}, [open]);
```

**Change 2: Fix overflow on PDF container (line 261)**
```typescript
// FROM:
<div className="flex-1 overflow-hidden p-4">

// TO:
<div ref={containerRef} className="flex-1 overflow-auto p-4">
```

**Change 3: Use dynamic width for Page component (line 304-309)**
```typescript
// FROM:
<Page 
  pageNumber={currentPage} 
  width={500}
  ...
/>

// TO:
<Page 
  pageNumber={currentPage} 
  width={containerWidth > 0 ? Math.min(containerWidth, 550) : undefined}
  ...
/>
```

**Change 4: Ensure Document container allows proper sizing**
```typescript
// Wrap Document in a scrollable container
<div className="w-full overflow-x-auto">
  <Document ...>
    <Page ... />
  </Document>
</div>
```

---

## Expected Result

After these changes:
- The PDF will resize to fit the modal width (with a max of 550px)
- Users can scroll vertically to see the entire PDF page
- If on a very small screen, horizontal scrolling will be available
- The signature footer remains sticky at the bottom

