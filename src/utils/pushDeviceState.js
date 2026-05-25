const PUSH_DEVICE_STATE_KEY = 'chatPushDeviceState';
const PUSH_INSTALLATION_ID_KEY = 'chatPushInstallationId';
const PUSH_SESSION_ID_KEY = 'chatPushSessionId';
const ACTIVE_CHAT_CONVERSATION_KEY = 'chatActiveConversationId';

const canUseStorage = () => typeof window !== 'undefined' && !!window.localStorage;
const canUseCryptoRandomUuid = () =>
  typeof globalThis !== 'undefined' &&
  !!globalThis.crypto &&
  typeof globalThis.crypto.randomUUID === 'function';

const createInstallationId = () => {
  if (canUseCryptoRandomUuid()) {
    return globalThis.crypto.randomUUID();
  }

  return `familyss-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

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

export const getOrCreatePushInstallationId = () => {
  if (!canUseStorage()) {
    return createInstallationId();
  }

  try {
    const existingInstallationId = String(
      window.localStorage.getItem(PUSH_INSTALLATION_ID_KEY) || '',
    ).trim();
    if (existingInstallationId) {
      return existingInstallationId;
    }

    const nextInstallationId = createInstallationId();
    window.localStorage.setItem(PUSH_INSTALLATION_ID_KEY, nextInstallationId);
    return nextInstallationId;
  } catch (error) {
    console.warn('Failed to resolve push installation id:', error);
    return createInstallationId();
  }
};

export const getOrCreatePushSessionId = () => {
  if (!canUseStorage()) {
    return createInstallationId();
  }

  try {
    const existingSessionId = String(
      window.sessionStorage.getItem(PUSH_SESSION_ID_KEY) || '',
    ).trim();
    if (existingSessionId) {
      return existingSessionId;
    }

    const nextSessionId = createInstallationId();
    window.sessionStorage.setItem(PUSH_SESSION_ID_KEY, nextSessionId);
    return nextSessionId;
  } catch (error) {
    console.warn('Failed to resolve push session id:', error);
    return createInstallationId();
  }
};

export const getCurrentPushPlatform = () => {
  try {
    if (typeof window === 'undefined') {
      return 'web';
    }

    const hasCapacitor = typeof window !== 'undefined' && !!window.Capacitor;
    const isNativePlatform =
      hasCapacitor && typeof window.Capacitor?.isNativePlatform === 'function'
        ? window.Capacitor.isNativePlatform()
        : false;

    return isNativePlatform ? 'android' : 'web';
  } catch (error) {
    console.warn('Failed to detect push platform:', error);
    return 'web';
  }
};

export const setActivePushConversationId = (conversationId) => {
  if (!canUseStorage()) return;

  const normalizedConversationId = Number(conversationId || 0);
  if (!normalizedConversationId) {
    window.sessionStorage.removeItem(ACTIVE_CHAT_CONVERSATION_KEY);
    return;
  }

  window.sessionStorage.setItem(
    ACTIVE_CHAT_CONVERSATION_KEY,
    String(normalizedConversationId),
  );
};

export const clearActivePushConversationId = (conversationId = null) => {
  if (!canUseStorage()) return;

  if (!conversationId) {
    window.sessionStorage.removeItem(ACTIVE_CHAT_CONVERSATION_KEY);
    return;
  }

  const currentConversationId = getActivePushConversationId();
  if (currentConversationId === Number(conversationId)) {
    window.sessionStorage.removeItem(ACTIVE_CHAT_CONVERSATION_KEY);
  }
};

export const getActivePushConversationId = () => {
  if (!canUseStorage()) return null;

  const value = Number(window.sessionStorage.getItem(ACTIVE_CHAT_CONVERSATION_KEY) || 0);
  return value > 0 ? value : null;
};
