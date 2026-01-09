-- Create OTP codes table
CREATE TABLE public.otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  verified BOOLEAN DEFAULT false
);

-- Index for faster lookups
CREATE INDEX idx_otp_codes_phone ON public.otp_codes(phone);

-- Enable RLS (edge functions with service role can manage)
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Create system settings table for feature flags
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for checking if OTP is enabled)
CREATE POLICY "Allow public read" ON public.system_settings
  FOR SELECT USING (true);

-- Insert default OTP setting (enabled by default)
INSERT INTO public.system_settings (setting_key, setting_value)
VALUES ('otp_enabled', '{"enabled": true}');