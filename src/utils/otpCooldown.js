export const OTP_SENT_STORAGE_KEY = "otp_sent_time";
export const OTP_RESEND_COOLDOWN_MS = 30 * 1000;

export function markOtpSent(now = Date.now()) {
  localStorage.setItem(OTP_SENT_STORAGE_KEY, String(now));
}

export function readOtpSecondsLeft(now = Date.now()) {
  const otpSent = Number.parseInt(
    localStorage.getItem(OTP_SENT_STORAGE_KEY) || "",
    10,
  );

  if (!otpSent) return 0;

  const diff = OTP_RESEND_COOLDOWN_MS - (now - otpSent);
  if (diff <= 0) return 0;
  return Math.ceil(diff / 1000);
}
