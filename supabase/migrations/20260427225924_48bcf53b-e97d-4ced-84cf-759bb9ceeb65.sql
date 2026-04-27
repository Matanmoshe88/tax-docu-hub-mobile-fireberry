CREATE TABLE public.poa_flow_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  record_id text,
  client_id text,
  event text NOT NULL,
  payload jsonb,
  error text,
  user_agent text
);

CREATE INDEX poa_flow_logs_record_id_idx ON public.poa_flow_logs (record_id, created_at DESC);
CREATE INDEX poa_flow_logs_event_idx ON public.poa_flow_logs (event, created_at DESC);

ALTER TABLE public.poa_flow_logs ENABLE ROW LEVEL SECURITY;
-- No policies: only the service-role (used by the log-poa-event edge function) can read/write.