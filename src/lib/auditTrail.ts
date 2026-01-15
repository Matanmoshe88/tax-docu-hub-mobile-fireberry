/**
 * Audit Trail Utility
 * Captures device info, timestamps, and generates document hashes for non-repudiation
 */

export interface AuditData {
  // Client Identity
  clientName: string;
  clientId: string;
  clientPhone: string;
  maskedPhone: string;
  
  // Phone Verification - SMS Sending (InforUMobile 3rd party)
  smsSentTime: string | null;
  smsMessageId: string | null;
  smsProviderStatus: string | null;
  smsProviderStatusId: number | null;
  smsProviderStatusDescription: string | null;
  
  // Phone Verification - OTP Entry & Verification
  otpCodeEntered: string | null;
  otpVerified: boolean;
  otpVerificationTime: string | null;
  
  // Document Timeline
  contractPageEntryTime: string | null;
  contractViewedAt: string | null; // ISO timestamp for DB
  signatureTime: string;
  signatureSubmittedAt: string | null; // Server timestamp (3rd party)
  timeSpentReadingSeconds: number | null;
  
  // Device & Session Info
  ipAddress: string;
  maskedIpAddress: string;
  userAgent: string;
  browserName: string;
  operatingSystem: string;
  screenResolution: string;
  timezone: string;
  language: string;
  
  // Document Integrity (SHA256 hashes of actual bytes)
  pdfHash: string | null;
  signatureHash: string | null;
  
  // Legacy hashes (for PDF display, based on text content)
  documentHash: string;
  legacySignatureHash: string;
  
  // Storage References
  pdfStoragePath: string | null;
  signatureStoragePath: string | null;
  pdfPublicUrl: string | null;
  signaturePublicUrl: string | null;
  
  // Record Reference
  recordId: string;
  documentId: string | null;
}

// Session storage keys
const AUDIT_KEYS = {
  OTP_VERIFICATION_TIME: 'audit_otp_verification_time',
  OTP_VERIFICATION_TIME_ISO: 'audit_otp_verification_time_iso',
  CONTRACT_PAGE_ENTRY: 'audit_contract_page_entry',
  CONTRACT_VIEWED_AT_ISO: 'audit_contract_viewed_at_iso',
  OTP_PHONE: 'audit_otp_phone',
  SMS_SENT_TIME: 'audit_sms_sent_time',
  SMS_MESSAGE_ID: 'audit_sms_message_id',
  SMS_PROVIDER_STATUS: 'audit_sms_provider_status',
  SMS_PROVIDER_STATUS_ID: 'audit_sms_provider_status_id',
  SMS_PROVIDER_STATUS_DESC: 'audit_sms_provider_status_desc',
  OTP_CODE_ENTERED: 'audit_otp_code_entered',
} as const;

/**
 * Get current timestamp in Israel timezone (Asia/Jerusalem)
 */
export function getIsraelTimestamp(): string {
  const now = new Date();
  return now.toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Get ISO timestamp in Israel timezone
 */
export function getIsraelISOTimestamp(): string {
  const now = new Date();
  // Format for Israel timezone
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };
  
  const formatter = new Intl.DateTimeFormat('en-CA', options);
  const parts = formatter.formatToParts(now);
  
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  const hour = parts.find(p => p.type === 'hour')?.value;
  const minute = parts.find(p => p.type === 'minute')?.value;
  const second = parts.find(p => p.type === 'second')?.value;
  
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

/**
 * Mask phone number for display (show last 3 digits only)
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return '***';
  return '*'.repeat(phone.length - 3) + phone.slice(-3);
}

/**
 * Mask IP address (hide last octet)
 */
export function maskIpAddress(ip: string): string {
  if (!ip) return '***';
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.*`;
  }
  // Handle IPv6 or other formats
  return ip.slice(0, -3) + '***';
}

/**
 * Generate SHA-256 hash of string content
 */
export async function generateHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Generate SHA-256 hash from binary data (ArrayBuffer or Uint8Array)
 * This is used for hashing actual file bytes (PDF, images)
 */
export async function generateHashFromBytes(bytes: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Parse browser name from user agent
 */
export function getBrowserName(userAgent: string): string {
  // Check for in-app browsers first (they also contain Chrome/Safari in their UA)
  if (userAgent.includes('WhatsApp')) return 'WhatsApp Browser';
  if (userAgent.includes('Instagram')) return 'Instagram Browser';
  if (userAgent.includes('FBAN') || userAgent.includes('FBAV')) return 'Facebook Browser';
  if (userAgent.includes('Telegram')) return 'Telegram Browser';
  if (userAgent.includes('Line/')) return 'LINE Browser';
  
  // Standard browsers
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('SamsungBrowser')) return 'Samsung Browser';
  if (userAgent.includes('Opera') || userAgent.includes('OPR')) return 'Opera';
  if (userAgent.includes('Trident')) return 'Internet Explorer';
  if (userAgent.includes('Edge')) return 'Edge (Legacy)';
  if (userAgent.includes('Edg')) return 'Microsoft Edge';
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Safari')) return 'Safari';
  return 'Unknown';
}

/**
 * Parse operating system from user agent
 */
export function getOperatingSystem(userAgent: string): string {
  if (userAgent.includes('Windows NT 10')) return 'Windows 10/11';
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac OS X')) return 'macOS';
  if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('Linux')) return 'Linux';
  return 'Unknown';
}

/**
 * Capture current device information
 */
export function captureDeviceInfo(): {
  userAgent: string;
  browserName: string;
  operatingSystem: string;
  screenResolution: string;
  timezone: string;
  language: string;
} {
  const userAgent = navigator.userAgent;
  return {
    userAgent,
    browserName: getBrowserName(userAgent),
    operatingSystem: getOperatingSystem(userAgent),
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
  };
}

/**
 * Store SMS sent data from InforUMobile response (3rd party)
 */
export function storeSmsData(
  smsSentTime: string, 
  messageId: string | null, 
  providerStatus: string,
  providerStatusId?: number,
  providerStatusDescription?: string
): void {
  sessionStorage.setItem(AUDIT_KEYS.SMS_SENT_TIME, smsSentTime);
  if (messageId) {
    sessionStorage.setItem(AUDIT_KEYS.SMS_MESSAGE_ID, messageId);
  }
  sessionStorage.setItem(AUDIT_KEYS.SMS_PROVIDER_STATUS, providerStatus);
  if (providerStatusId !== undefined) {
    sessionStorage.setItem(AUDIT_KEYS.SMS_PROVIDER_STATUS_ID, providerStatusId.toString());
  }
  if (providerStatusDescription) {
    sessionStorage.setItem(AUDIT_KEYS.SMS_PROVIDER_STATUS_DESC, providerStatusDescription);
  }
}

/**
 * Get stored SMS sent time
 */
export function getSmsData(): { 
  smsSentTime: string | null; 
  smsMessageId: string | null; 
  smsProviderStatus: string | null;
  smsProviderStatusId: number | null;
  smsProviderStatusDescription: string | null;
} {
  const statusId = sessionStorage.getItem(AUDIT_KEYS.SMS_PROVIDER_STATUS_ID);
  return {
    smsSentTime: sessionStorage.getItem(AUDIT_KEYS.SMS_SENT_TIME),
    smsMessageId: sessionStorage.getItem(AUDIT_KEYS.SMS_MESSAGE_ID),
    smsProviderStatus: sessionStorage.getItem(AUDIT_KEYS.SMS_PROVIDER_STATUS),
    smsProviderStatusId: statusId ? parseInt(statusId, 10) : null,
    smsProviderStatusDescription: sessionStorage.getItem(AUDIT_KEYS.SMS_PROVIDER_STATUS_DESC),
  };
}

/**
 * Store OTP verification data from server response (3rd party)
 */
export function storeOtpVerificationData(
  phone: string, 
  verificationTime: string, 
  codeEntered: string
): void {
  // Store display time
  sessionStorage.setItem(AUDIT_KEYS.OTP_VERIFICATION_TIME, getIsraelTimestamp());
  // Store ISO time from server (3rd party timestamp)
  sessionStorage.setItem(AUDIT_KEYS.OTP_VERIFICATION_TIME_ISO, verificationTime);
  sessionStorage.setItem(AUDIT_KEYS.OTP_PHONE, phone);
  sessionStorage.setItem(AUDIT_KEYS.OTP_CODE_ENTERED, codeEntered);
}

/**
 * Legacy: Store OTP verification timestamp (for backward compatibility)
 */
export function storeOtpVerificationTime(phone: string): void {
  sessionStorage.setItem(AUDIT_KEYS.OTP_VERIFICATION_TIME, getIsraelTimestamp());
  sessionStorage.setItem(AUDIT_KEYS.OTP_PHONE, phone);
}

/**
 * Get stored OTP verification timestamp (display format)
 */
export function getOtpVerificationTime(): string | null {
  return sessionStorage.getItem(AUDIT_KEYS.OTP_VERIFICATION_TIME);
}

/**
 * Get stored OTP verification data
 */
export function getOtpVerificationData(): { 
  verificationTime: string | null; 
  verificationTimeIso: string | null;
  codeEntered: string | null;
  phone: string | null;
} {
  return {
    verificationTime: sessionStorage.getItem(AUDIT_KEYS.OTP_VERIFICATION_TIME),
    verificationTimeIso: sessionStorage.getItem(AUDIT_KEYS.OTP_VERIFICATION_TIME_ISO),
    codeEntered: sessionStorage.getItem(AUDIT_KEYS.OTP_CODE_ENTERED),
    phone: sessionStorage.getItem(AUDIT_KEYS.OTP_PHONE),
  };
}

/**
 * Store contract page entry timestamp with server-like ISO format
 */
export function storeContractPageEntry(): void {
  // Only store if not already stored (first entry)
  if (!sessionStorage.getItem(AUDIT_KEYS.CONTRACT_PAGE_ENTRY)) {
    sessionStorage.setItem(AUDIT_KEYS.CONTRACT_PAGE_ENTRY, Date.now().toString());
    sessionStorage.setItem(AUDIT_KEYS.CONTRACT_VIEWED_AT_ISO, new Date().toISOString());
  }
}

/**
 * Get contract page entry timestamp (display format)
 */
export function getContractPageEntryTime(): string | null {
  const entryMs = sessionStorage.getItem(AUDIT_KEYS.CONTRACT_PAGE_ENTRY);
  if (!entryMs) return null;
  
  const date = new Date(parseInt(entryMs, 10));
  return date.toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Get contract viewed at ISO timestamp
 */
export function getContractViewedAtIso(): string | null {
  return sessionStorage.getItem(AUDIT_KEYS.CONTRACT_VIEWED_AT_ISO);
}

/**
 * Calculate time spent reading the contract (in seconds)
 */
export function calculateReadingTime(): number | null {
  const entryMs = sessionStorage.getItem(AUDIT_KEYS.CONTRACT_PAGE_ENTRY);
  if (!entryMs) return null;
  
  const entryTime = parseInt(entryMs, 10);
  const now = Date.now();
  return Math.round((now - entryTime) / 1000);
}

/**
 * Format seconds to human-readable duration
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} שניות`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) return `${minutes} דקות`;
  return `${minutes} דקות ו-${remainingSeconds} שניות`;
}

/**
 * Format ISO timestamp to Israel display format
 */
export function formatIsoToIsrael(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Clear all audit data from session storage
 */
export function clearAuditData(): void {
  Object.values(AUDIT_KEYS).forEach(key => {
    sessionStorage.removeItem(key);
  });
}