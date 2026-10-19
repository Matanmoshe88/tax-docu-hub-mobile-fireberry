# Client 309683654 (record 6c5196dc-238a-468b-b1cd-6359b91b4933): what we found and how to fix it

## What we found (checked in our system)
- **Contract: she never signed it in our system.** We have no contract signature, no signed contract file, and no audit trail for this record. She went straight to the documents page.
- **1301 form: signed at 10:43 Israel time.** All files are stored and were sent to Fireberry, which matches what you see there.
- **POA (power of attorney): signed at 10:44.** The signed POA file exists in our storage, and our log says the Fireberry update ran. But Fireberry doesn't show it, so the update probably went through without actually attaching the file (most likely the missing document link, `docid`, that comes from the contract step).
- **ID photo:** uploaded at 11:12, and it's in Fireberry.

## Plan
1. **Recover the POA now.** Look up her 1004 document record in Fireberry and attach the signed POA file we already have (`poa-signed-6c5196dc-...-1792395843545.pdf`) to the POA field. Then check that it shows up.
2. **The contract.** We can't create a signed contract she never signed. Send her the contract link again (`/contract/6c5196dc-238a-468b-b1cd-6359b91b4933`) so she can read it, verify with the SMS code and sign.
3. **Stop this from happening again:**
   - Block the documents page (POA, 1301, uploads) until the contract is signed for that record. The server checks this, so the browser can't skip it.
   - Make the Fireberry POA update fail loudly when there's no document link or Fireberry rejects it. The client gets a retry option, and the failure is logged as an error, not as a success.
   - Fix the logging order so "Fireberry updated" is recorded only after Fireberry confirms the update.

## Technical details
- `document-upload` edge function: look up the docid on the server by recordId when the browser doesn't send one. Return a 4xx error when no docid is found or Fireberry returns an error.
- `SignableDocumentModal.tsx` / `DocumentsPage.tsx`: log `poa_fireberry_updated` only when the request succeeds. Add a `poa_fireberry_failed` event with the error. On page load, check for an `audit_trails` row for the recordId (through an edge function) and send the client to the contract page if there isn't one.
