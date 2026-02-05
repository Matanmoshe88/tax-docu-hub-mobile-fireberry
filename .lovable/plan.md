

# Plan: Adjust Signature Position So Bottom Edge is at 490px

## Current Situation

- **Current y value**: 490 (top of signature)
- **Signature height**: 60
- **Bottom of signature currently at**: 550px from top

## Required Change

To place the **bottom** of the signature at 490px from the top:

| Setting | Current | New |
|---------|---------|-----|
| y position | 490 | 430 |
| Signature bottom | 550px | 490px |

**Formula**: New y = 490 - 60 (height) = 430

## File to Modify

**`supabase/functions/sign-poa-pdf/index.ts`**

Change line 47:
```typescript
// Before
const position = signaturePosition || { x: 257, y: 490 };

// After  
const position = signaturePosition || { x: 257, y: 430 };
```

## Visual Representation

```text
Page Top (0px)
    |
    |  ... content ...
    |
    v
430px -------- Top of signature
    |          [SIGNATURE]
    |          [  IMAGE  ]
490px -------- Bottom of signature (where you want it)
    |
    |  ... content ...
    |
    v
Page Bottom
```

## Summary

Single line change: update default y from 490 to 430, so the signature's bottom edge aligns at the 490px mark from the top of the page.

