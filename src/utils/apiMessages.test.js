import { UI_MESSAGES } from './apiMessages';

describe('UI_MESSAGES', () => {
  test('contains distinct add and replace success labels', () => {
    expect(UI_MESSAGES.MEMBER_ADDED_SUCCESS).toMatch(/added/i);
    expect(UI_MESSAGES.MEMBER_REPLACED_SUCCESS).toMatch(/replaced/i);
    expect(UI_MESSAGES.MEMBER_ADDED_SUCCESS).not.toBe(UI_MESSAGES.MEMBER_REPLACED_SUCCESS);
  });

  test('contains invalid OTP message copy', () => {
    expect(UI_MESSAGES.INVALID_OTP).toBe('Invalid OTP. Please try again.');
  });
});
