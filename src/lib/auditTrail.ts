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
  
  // Phone Verification
  otpVerificationTime: string | null;
  otpVerified: boolean;
  
  // Document Timeline
  contractPageEntryTime: string | null;
  signatureTime: string;
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
  
  // Document Integrity
  documentHash: string;
  signatureHash: string;
  
  // Record Reference
  recordId: string;
}

// Session storage keys
const AUDIT_KEYS = {
  OTP_VERIFICATION_TIME: 'audit_otp_verification_time',
  CONTRACT_PAGE_ENTRY: 'audit_contract_page_entry',
  OTP_PHONE: 'audit_otp_phone',
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
 * Generate SHA-256 hash of content
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
 * Parse browser name from user agent
 */
export function getBrowserName(userAgent: string): string {
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
 * Store OTP verification timestamp
 */
export function storeOtpVerificationTime(phone: string): void {
  sessionStorage.setItem(AUDIT_KEYS.OTP_VERIFICATION_TIME, getIsraelTimestamp());
  sessionStorage.setItem(AUDIT_KEYS.OTP_PHONE, phone);
}

/**
 * Get stored OTP verification timestamp
 */
export function getOtpVerificationTime(): string | null {
  return sessionStorage.getItem(AUDIT_KEYS.OTP_VERIFICATION_TIME);
}

/**
 * Store contract page entry timestamp
 */
export function storeContractPageEntry(): void {
  // Only store if not already stored (first entry)
  if (!sessionStorage.getItem(AUDIT_KEYS.CONTRACT_PAGE_ENTRY)) {
    sessionStorage.setItem(AUDIT_KEYS.CONTRACT_PAGE_ENTRY, Date.now().toString());
  }
}

/**
 * Get contract page entry timestamp
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
 * Clear all audit data from session storage
 */
export function clearAuditData(): void {
  Object.values(AUDIT_KEYS).forEach(key => {
    sessionStorage.removeItem(key);
  });
}
