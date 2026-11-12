/**
 * Hardcoded customer support WhatsApp number for VaultWorld Store (with 91 country code).
 */
export const HARDCODED_SUPPORT_WHATSAPP = '919142408286';

/**
 * Normalizes an Indian or international phone string into digits for wa.me links.
 */
export function formatWhatsAppPhoneDigits(phone: string): string {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }
  return digits || HARDCODED_SUPPORT_WHATSAPP;
}

/**
 * Builds a wa.me URL for WhatsApp support, defaulting to the hardcoded store support number.
 */
export function buildSupportWhatsAppUrl(message: string, phoneNumber?: string): string {
  const cleanPhone = phoneNumber
    ? formatWhatsAppPhoneDigits(phoneNumber)
    : HARDCODED_SUPPORT_WHATSAPP;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
