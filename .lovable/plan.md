

# Clarity User Identification with Israeli ID Number

## Overview
Add Microsoft Clarity's Identify API call to tag session recordings with the client's Israeli ID number (תעודת זהות), enabling you to search for specific client recordings.

## Technical Implementation

### File: `src/hooks/useFireberryData.ts`

**Location**: After line 212 (after `setIsDataFresh(true)`)

**Code to add**:
```typescript
// Identify user in Microsoft Clarity for session tracking
if (typeof window !== 'undefined' && (window as any).clarity && updatedClientData.idNumber) {
  const fullName = `${updatedClientData.firstName} ${updatedClientData.lastName}`.trim();
  (window as any).clarity("identify", updatedClientData.idNumber, null, null, fullName || "Unknown");
  console.log('📊 Clarity user identified by ID:', updatedClientData.idNumber, fullName);
}
```

## How to Search in Clarity

1. Go to **Clarity Dashboard** → **Recordings**
2. Click **Filters** → **Custom User ID**
3. Enter the client's Israeli ID number (e.g., `123456789`)
4. View all session recordings for that client

## What Gets Sent to Clarity

| Field | Value | Example |
|-------|-------|---------|
| Custom User ID | Client's ID number | `123456789` |
| Friendly Name | Client's full name | `ישראל ישראלי` |

## Privacy Note
- Only the ID number and name are sent to Clarity
- Clarity automatically hashes the ID before storage
- No phone, address, or other sensitive data is transmitted

