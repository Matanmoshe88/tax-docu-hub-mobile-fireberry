

# Add generate-poa-pdf Edge Function to Codebase

## Overview
Add the `generate-poa-pdf` edge function code to the project's `supabase/functions/` directory so it's synced with the codebase. This function generates Power of Attorney PDF (Form 2279/א5) by invoking an AWS Lambda function.

## What the Function Does
- Receives a Fireberry Opportunity `recordId`
- Invokes AWS Lambda (`powerOfAttorneyPdfGenerator`) to generate the POA PDF
- Returns base64-encoded PDF or URL based on `responseType` parameter

## Implementation

### 1. Create Edge Function File
**File**: `supabase/functions/generate-poa-pdf/index.ts`

Add the complete code you provided with proper documentation header.

### 2. Update Config (if needed)
**File**: `supabase/config.toml`

Add configuration to disable JWT verification (since it uses CORS headers for auth):
```toml
[functions.generate-poa-pdf]
verify_jwt = false
```

## Required Secrets (Already Configured)
The following secrets are already set in your Supabase project:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

## API Reference

| Field | Description |
|-------|-------------|
| **Endpoint** | `POST /functions/v1/generate-poa-pdf` |
| **Request Body** | `{ recordId: string, responseType?: "base64" \| "url" }` |
| **Success Response** | `{ success: true, data: { pdf, filename, contentType } }` |

## Error Codes
| Code | HTTP Status | Description |
|------|-------------|-------------|
| MISSING_RECORD_ID | 400 | No recordId provided |
| RECORD_NOT_FOUND | 404 | Fireberry record not found |
| FIREBERRY_AUTH_ERROR | 401 | Fireberry authentication failed |
| PDF_GENERATION_ERROR | 500 | Lambda failed to generate PDF |

