-- Create audit_trails table for storing complete audit records
CREATE TABLE public.audit_trails (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  record_id text NOT NULL,
  document_id text,
  
  -- Client Identity
  client_name text,
  client_id text,
  client_phone text,
  masked_phone text,
  
  -- Phone Verification (SMS Sending - InforUMobile 3rd party)
  sms_sent_time timestamptz,
  sms_provider_message_id text,
  sms_provider_status text,
  
  -- Phone Verification (OTP Entry & Verification)
  otp_code_entered text,
  otp_verified boolean DEFAULT false,
  otp_verification_time timestamptz,
  
  -- Document Timeline (Supabase server timestamps - 3rd party)
  contract_viewed_at timestamptz,
  signature_submitted_at timestamptz,
  time_spent_reading_seconds integer,
  
  -- Device & Session Info
  ip_address text,
  masked_ip_address text,
  user_agent text,
  browser_name text,
  operating_system text,
  screen_resolution text,
  timezone text,
  language text,
  
  -- Document Integrity (SHA256 hashes of actual bytes)
  pdf_hash text,
  signature_hash text,
  
  -- Storage References
  pdf_storage_path text,
  signature_storage_path text,
  pdf_public_url text,
  signature_public_url text,
  
  -- Metadata (Supabase server timestamp - 3rd party)
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_trails ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups by record_id
CREATE INDEX idx_audit_trails_record_id ON public.audit_trails(record_id);

-- Create index for lookups by client_id
CREATE INDEX idx_audit_trails_client_id ON public.audit_trails(client_id);

-- No public access - only service role can insert via edge function
-- This ensures all inserts go through our controlled edge function