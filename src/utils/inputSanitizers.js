export const OTP_LENGTH = 6;

export function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

export function sanitizeOtpInput(value) {
  return digitsOnly(value).slice(0, OTP_LENGTH);
}

export function isValidOtp(otp) {
  return /^\d{6}$/.test(String(otp || '').trim());
}

export function sanitizePincodeInput(value) {
  return digitsOnly(value).slice(0, 6);
}

export function isValidPincode(value) {
  return /^\d{6}$/.test(String(value || '').trim());
}

export function extractDigitsFromClipboardEvent(event) {
  const raw = event?.clipboardData?.getData?.('text') || '';
  return digitsOnly(raw);
}
