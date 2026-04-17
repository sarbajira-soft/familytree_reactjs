import {
  OTP_LENGTH,
  isValidOtp,
  sanitizeOtpInput,
  sanitizePincodeInput,
} from './inputSanitizers';

describe('inputSanitizers', () => {
  test('sanitizeOtpInput keeps digits only and max length', () => {
    expect(sanitizeOtpInput('12a3-45!67')).toBe('123456');
    expect(sanitizeOtpInput('9'.repeat(OTP_LENGTH + 3))).toBe('999999');
  });

  test('isValidOtp validates strict 6-digit OTP', () => {
    expect(isValidOtp('123456')).toBe(true);
    expect(isValidOtp('12345')).toBe(false);
    expect(isValidOtp('12a456')).toBe(false);
  });

  test('sanitizePincodeInput keeps digits only and max length 6', () => {
    expect(sanitizePincodeInput('60A00!12')).toBe('600012');
  });
});
