
# Fix: POA PDF Pre-fetch Infinite Loop

## Problem Summary

The current pre-fetch logic in `DocumentsPage.tsx` creates an infinite loop because:

1. The `useEffect` dependency array includes `poaPdfLoading`
2. When a request finishes (`poaPdfLoading` goes from `true` to `false`), it triggers the effect again
3. If the request failed, `poaPdfData` is still `null`, so the condition `!poaPdfData && !poaPdfLoading` passes
4. This triggers another request immediately, creating an infinite loop

This is why you see 50+ boot/shutdown cycles in the edge function logs - it's not the edge function failing, it's the frontend hammering it with requests.

## Solution

Add a `useRef` flag to track whether a fetch has been attempted, preventing re-triggers.

## Implementation

### File: `src/pages/DocumentsPage.tsx`

**Step 1:** Add a ref to track fetch attempts (around line 57):

```typescript
// Pre-fetched POA PDF state
const [poaPdfData, setPoaPdfData] = useState<string | null>(null);
const [poaPdfLoading, setPoaPdfLoading] = useState(false);
const [poaPdfError, setPoaPdfError] = useState<string | null>(null);
const poaFetchAttempted = useRef(false);  // NEW: Track if fetch was attempted
```

**Step 2:** Update the useEffect to use the ref (lines 77-102):

```typescript
// Pre-fetch POA PDF on page load (only if not already signed)
useEffect(() => {
  // Only attempt fetch once per page load
  if (recordId && !poaSigned && !poaFetchAttempted.current) {
    poaFetchAttempted.current = true;  // Mark as attempted immediately
    
    console.log('📄 Pre-fetching POA PDF for recordId:', recordId);
    setPoaPdfLoading(true);
    setPoaPdfError(null);
    
    supabase.functions.invoke('generate-poa-pdf', {
      body: { recordId, responseType: 'base64' }
    })
      .then(({ data, error }) => {
        if (error) throw error;
        if (!data.success) throw new Error(data.error || 'Failed to generate PDF');
        
        console.log('✅ POA PDF pre-fetched successfully');
        setPoaPdfData(data.data.pdf);
      })
      .catch((err) => {
        console.error('❌ POA PDF pre-fetch error:', err);
        setPoaPdfError(err instanceof Error ? err.message : 'שגיאה בטעינת המסמך');
      })
      .finally(() => {
        setPoaPdfLoading(false);
      });
  }
}, [recordId, poaSigned]);  // Remove poaPdfData and poaPdfLoading from dependencies
```

**Step 3:** Add useRef import if not already present:

```typescript
import { useRef } from "react";
```

## Why This Works

| Before | After |
|--------|-------|
| Effect triggers when `poaPdfLoading` changes | Effect only checks `recordId` and `poaSigned` |
| No tracking of previous attempts | `useRef` remembers across re-renders |
| Failed request allows re-trigger | Once attempted, never re-triggers automatically |

## Bonus: Manual Retry Option

If the pre-fetch fails, the `SignableDocumentModal` already has fallback fetch logic. Users can close and re-open the modal to retry. For a better UX, we could add a retry button in the modal's error state, but that's optional for now.

## Testing

After implementation:
1. Open the documents page for recordId `92d0570f-28b0-4176-b5e1-5c29857ea556`
2. Check edge function logs - should see only 1 boot, not 50+
3. Open the POA modal - should display the PDF correctly
