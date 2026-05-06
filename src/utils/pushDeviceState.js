const PUSH_DEVICE_STATE_KEY = 'chatPushDeviceState';

const canUseStorage = () => typeof window !== 'undefined' && !!window.localStorage;

export const getStoredPushDeviceState = () => {
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(PUSH_DEVICE_STATE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return {
      token: String(parsed.token || '').trim(),
      platform: String(parsed.platform || '').trim().toLowerCase(),
      deviceId: String(parsed.deviceId || '').trim(),
      registeredAt: parsed.registeredAt || null,
    };
  } catch (error) {
    console.warn('Failed to read push device state:', error);
    return null;
  }
};

export const setStoredPushDeviceState = (state) => {
  if (!canUseStorage()) return;

  const token = String(state?.token || '').trim();
  const platform = String(state?.platform || '').trim().toLowerCase();
  const deviceId = String(state?.deviceId || '').trim();

  if (!token || !platform) {
    return;
  }

  window.localStorage.setItem(
    PUSH_DEVICE_STATE_KEY,
    JSON.stringify({
      token,
      platform,
      deviceId,
      registeredAt: state?.registeredAt || new Date().toISOString(),
    }),
  );
};

export const clearStoredPushDeviceState = () => {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(PUSH_DEVICE_STATE_KEY);
};
