
# Plan: Comprehensive POA Signing Logs (Production-Safe)

## Goal

Answer "at what point did the POA process fail?" for any session, by emitting structured events at every milestone — captured in:
1. **Microsoft Clarity custom events** (so the "Key events" column in the Clarity session list lights up per session)
2. **A persistent `poa_flow_logs` table in Supabase** (so we can query failures even when Clarity playback is unavailable)
3. **Browser console** — only in development; silenced in production builds

All logging is **non-blocking, fire-and-forget, and never throws**, so it cannot slow down or break the signing flow.

## Production safety guarantees

| Concern | Mitigation |
|---|---|
| User sees logs in DevTools | Console output is gated by `import.meta.env.DEV`. In production builds, no `[POA]` console output is emitted. |
| Sensitive data in logs | We log only: `recordId`, `clientId` (already sent to Clarity today via `identify`), event name, step number, and a sanitized error message. **Never** log: signature image data, full PDF base64, OTP codes, phone numbers, IP, or full error stacks. A `sanitize()` helper truncates strings >200 chars and strips known PII keys. |
| Performance — extra network requests | DB log calls use `supabase.functions.invoke` fire-and-forget (no `await`), wrapped in `try/catch` that swallows errors. Clarity calls are synchronous but trivial (already loaded). No request blocks the signing flow. |
| Performance — bundle size | One small utility file (~2KB), no new deps. |
| Failure of the logger breaks the flow | Every logger call is inside `try/catch`. A failure in `logPoaEvent` cannot propagate. |
| Log spam / cost | Events are discrete milestones (≈10–15 per session), not continuous. DB table has a simple retention path (described below). |
| RLS leakage | The `poa_flow_logs` table has RLS enabled with **no public policies**. Only the service-role edge function can insert; only admins can read via SQL editor. Frontend never reads from it. |

## What gets tracked

Every event records: `event` name, `recordId`, `clientId`, `step` number, optional sanitized `error`, `created_at`.

| # | Event | Where it fires |
|---|---|---|
| 1 | `poa_page_loaded` | DocumentsPage mount with recordId |
| 2 | `poa_prefetch_started` | Pre-fetch effect begins |
| 3 | `poa_prefetch_succeeded` / `poa_prefetch_failed` | generate-poa-pdf returns |
| 4 | `poa_modal_opened` | User clicks "חתום" |
| 5 | `poa_pdf_rendered` / `poa_pdf_render_failed` | react-pdf load callback |
| 6 | `poa_signature_started` | First stroke on canvas |
| 7 | `poa_signature_cleared` | Clear button |
| 8 | `poa_sign_clicked` | "אישור" pressed |
| 9 | `poa_signature_too_small` | Validation rejected |
| 10 | `poa_signature_uploaded` / `poa_signature_upload_failed` | Step 2 |
| 11 | `poa_pdf_signed` / `poa_pdf_sign_failed` | Step 3 (sign-poa-pdf) |
| 12 | `poa_signed_pdf_uploaded` / `poa_signed_pdf_upload_failed` | Step 4 |
| 13 | `poa_fireberry_updated` / `poa_fireberry_update_failed` | Step 5 |
| 14 | `poa_flow_completed` | All steps done |
| 15 | `poa_modal_closed_unsigned` | Modal closed without success |

## Implementation

### 1. New utility: `src/lib/poaLogger.ts`

```ts
// Pseudocode shape
let context = { recordId: '', clientId: '' };
const isDev = import.meta.env.DEV;

export function setPoaContext(c) { context = { ...context, ...c }; }

export function logPoaEvent(event, payload?, error?) {
  try {
    const safe = sanitize(payload);
    const errMsg = error ? String(error?.message || error).slice(0, 300) : undefined;

    if (isDev) console.log(`[POA] ${event}`, { ...context, ...safe, error: errMsg });

    // Clarity custom event — shows in "Key events" column
    (window as any).clarity?.("event", event);
    if (errMsg) (window as any).clarity?.("set", "poa_last_error_step", event);

    // Fire-and-forget DB persist (no await, no throw)
    supabase.functions.invoke('log-poa-event', {
      body: { event, ...context, payload: safe, error: errMsg }
    }).catch(() => {}); // silently ignore
  } catch { /* never break the flow */ }
}
```

`sanitize()` removes/truncates: anything containing `pdf`, `signature`, `base64`, `code`, `otp`, `phone`, `ip` keys; clamps strings to 200 chars.

### 2. New edge function: `supabase/functions/log-poa-event/index.ts`

- CORS headers (matches existing functions)
- Validates body with Zod (`event` required, others optional)
- Inserts into `poa_flow_logs` using service-role client
- Always returns 200, even on insert failure (logging must never surface errors)
- No JWT required (logging only — no sensitive reads)

### 3. New DB table: `poa_flow_logs`

Created via migration:

```sql
create table public.poa_flow_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  record_id text,
  client_id text,
  event text not null,
  payload jsonb,
  error text,
  user_agent text
);
create index poa_flow_logs_record_id_idx on public.poa_flow_logs (record_id, created_at desc);
create index poa_flow_logs_event_idx on public.poa_flow_logs (event, created_at desc);

alter table public.poa_flow_logs enable row level security;
-- No policies = nobody can read/write via anon/auth keys.
-- Only service-role (used in the log-poa-event function) bypasses RLS.
```

Retention: optional follow-up — a scheduled cleanup of rows older than 90 days. Not built now; flagged for later.

### 4. Wire into the existing flow

- **`src/hooks/useFireberryData.ts`** — after the existing `clarity("identify", ...)` call, also call `setPoaContext({ recordId, clientId: idNumber })`.
- **`src/pages/DocumentsPage.tsx`** — emit `poa_page_loaded`, `poa_prefetch_started`, `poa_prefetch_succeeded|failed`, `poa_modal_opened`.
- **`src/components/SignableDocumentModal.tsx`** — emit modal/render/signature/step events alongside the existing `console.log('✅ Step N…')` lines (we don't remove existing logs; they're already there and harmless).

No existing behavior changes — only additive observability.

## How this answers the failure-point question

For any failed session:
- **In Clarity**: open the user's session — the "Key events" column shows the exact sequence (e.g. `poa_modal_opened → poa_pdf_rendered → poa_sign_clicked → poa_pdf_sign_failed`).
- **In SQL** (when Clarity playback is white/unavailable):
  ```sql
  select created_at, event, error from poa_flow_logs
  where record_id = '<id>' order by created_at;
  ```

## Out of scope

- No retry logic.
- No changes to Clarity dashboard masking.
- No automatic log retention job (can be added later).
