-- signing_jobs — durable record of every 1301 signing event ("the logbook").
--
-- One row per client signing. The row is written SYNCHRONOUSLY when the client
-- taps "חתום ושלח" (before the green light), and contains everything needed to
-- assemble the signed documents: pointer to the unsigned PDF, pointer to the
-- signature image, the per-page signature boxes, and the audit metadata.
--
-- The heavy work (stamping, audit page, splitting, Fireberry records) happens in
-- the background (submit-1301-signature, EdgeRuntime.waitUntil) and advances
-- `status`: received → processing → completed (or failed).
--
-- Self-healing: check-1301-signed re-triggers jobs stuck in received/processing
-- for >3 minutes or failed with attempts < 5. Re-runs are idempotent (existing
-- Fireberry 1046 records for the Opportunity are deleted before re-creating).
--
-- Access: service role only (RLS enabled, no policies) — only edge functions
-- read/write this table.

create table public.signing_jobs (
  id uuid primary key default gen_random_uuid(),
  record_id text not null,                       -- Fireberry Opportunity id
  document_type text not null default 'form_1301',
  status text not null default 'received'
    check (status in ('received', 'processing', 'completed', 'failed')),
  unsigned_pdf_path text not null,               -- storage path in 'signatures' bucket
  signature_path text,                           -- storage path of the signature PNG
  pages jsonb not null,                          -- per-page signature boxes (from form1301Generator)
  audit_data jsonb,                              -- audit metadata (IP stamped server-side)
  signed_pdf_url text,                           -- public URL of the signed merged PDF (set on completion)
  error text,                                    -- last error message (set on failure)
  attempts int not null default 0,               -- processing attempts (retry cap = 5)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index signing_jobs_record_id_idx on public.signing_jobs (record_id);

alter table public.signing_jobs enable row level security;
-- No policies on purpose: only the service role (edge functions) may access.
