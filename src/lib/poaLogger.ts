/**
 * POA Flow Logger — production-safe observability.
 *
 * - Console output is gated by import.meta.env.DEV (no logs in prod build).
 * - Sends a Microsoft Clarity custom event for each milestone (visible in
 *   the Clarity session list "Key events" column).
 * - Fire-and-forget DB persist via the `log-poa-event` edge function.
 * - Never throws, never blocks the calling code.
 */
import { supabase } from "@/integrations/supabase/client";

type Ctx = { recordId?: string; clientId?: string };

let context: Ctx = {};
const isDev = !!import.meta.env.DEV;

// Keys we never want to persist (PII / huge payloads).
const PII_KEYS = new Set([
  "pdf",
  "pdfData",
  "pdfBase64",
  "signature",
  "signatureDataUrl",
  "signatureDataURL",
  "base64",
  "code",
  "otp",
  "otpCode",
  "phone",
  "mobilePhone",
  "ip",
  "ipAddress",
  "email",
]);

function sanitize(input: unknown): Record<string, unknown> | undefined {
  if (input == null) return undefined;
  if (typeof input !== "object") return { value: String(input).slice(0, 200) };
  const out: Record<string, unknown> = {};
  try {
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (PII_KEYS.has(k)) continue;
      if (v == null) {
        out[k] = v;
      } else if (typeof v === "string") {
        out[k] = v.length > 200 ? v.slice(0, 200) + "…" : v;
      } else if (typeof v === "number" || typeof v === "boolean") {
        out[k] = v;
      } else {
        // Skip nested objects / arrays — keep payload tiny and safe.
        out[k] = `[${typeof v}]`;
      }
    }
  } catch {
    return undefined;
  }
  return out;
}

export function setPoaContext(c: Ctx): void {
  context = { ...context, ...c };
}

export function logPoaEvent(
  event: string,
  payload?: Record<string, unknown>,
  error?: unknown
): void {
  try {
    const safePayload = sanitize(payload);
    const errMsg = error
      ? String((error as { message?: string })?.message || error).slice(0, 300)
      : undefined;

    if (isDev) {
      // eslint-disable-next-line no-console
      console.log(`[POA] ${event}`, { ...context, ...safePayload, error: errMsg });
    }

    // Clarity custom event — shows up in the "Key events" column per session.
    try {
      const w = window as unknown as { clarity?: (...args: unknown[]) => void };
      if (typeof w.clarity === "function") {
        w.clarity("event", event);
        if (errMsg) w.clarity("set", "poa_last_error_step", event);
      }
    } catch { /* ignore */ }

    // Fire-and-forget DB persist. Never await, never throw.
    try {
      void supabase.functions
        .invoke("log-poa-event", {
          body: {
            event,
            recordId: context.recordId,
            clientId: context.clientId,
            payload: safePayload,
            error: errMsg,
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          },
        })
        .catch(() => { /* swallow */ });
    } catch { /* ignore */ }
  } catch {
    /* logger must never break the flow */
  }
}
