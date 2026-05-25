import { authFetchResponse } from '../utils/authFetch';
import { getToken } from '../utils/auth';
import { CHAT_API_ENDPOINTS } from '../constants/chat.constants';
import {
  clearStoredPushDeviceState,
  getStoredPushDeviceState,
  setStoredPushDeviceState,
} from '../utils/pushDeviceState';

let webPushPromise = null;
let nativePushCleanup = null;
let firebaseAppPromise = null;
let webMessagingContextPromise = null;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const FIREBASE_MESSAGING_SW_PATH = '/firebase-messaging-sw.js';

const getFirebaseConfig = () => ({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

const hasFirebaseMessagingConfig = () => {
  const config = getFirebaseConfig();
  return (
    !!config.apiKey &&
    !!config.projectId &&
    !!config.appId &&
    !!config.messagingSenderId &&
    !!import.meta.env.VITE_FIREBASE_VAPID_KEY
  );
};

const buildServiceWorkerUrl = () => {
  const config = getFirebaseConfig();
  const params = new URLSearchParams();

  Object.entries(config).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return query ? `${FIREBASE_MESSAGING_SW_PATH}?${query}` : FIREBASE_MESSAGING_SW_PATH;
};

const getFirebaseApp = async () => {
  if (!hasFirebaseMessagingConfig()) {
    return null;
  }

  if (firebaseAppPromise) {
    return firebaseAppPromise;
  }

  firebaseAppPromise = (async () => {
    const { getApp, getApps, initializeApp } = await import('firebase/app');
    return getApps().length > 0 ? getApp() : initializeApp(getFirebaseConfig());
  })().catch((error) => {
    firebaseAppPromise = null;
    throw error;
  });

  return firebaseAppPromise;
};

const ensureFirebaseMessagingServiceWorker = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  const registration = await navigator.serviceWorker.register(buildServiceWorkerUrl(), {
    scope: '/',
  });

  return registration;
};

const getWebMessagingContext = async () => {
  if (!hasFirebaseMessagingConfig()) {
    return null;
  }

  if (webMessagingContextPromise) {
    return webMessagingContextPromise;
  }

  webMessagingContextPromise = (async () => {
    const firebaseApp = await getFirebaseApp();
    if (!firebaseApp) {
      return null;
    }

    const registration = await ensureFirebaseMessagingServiceWorker();
    const { deleteToken, getMessaging, getToken: getMessagingToken } = await import(
      'firebase/messaging'
    );

    return {
      deleteToken,
      getMessagingToken,
      messaging: getMessaging(firebaseApp),
      serviceWorkerRegistration: registration,
    };
  })().catch((error) => {
    webMessagingContextPromise = null;
    throw error;
  });

  return webMessagingContextPromise;
};

const registerToken = async (token, platform, deviceId = '') => {
  if (!token || !platform) return;
  await authFetchResponse(CHAT_API_ENDPOINTS.deviceTokens, {
    method: 'POST',
    body: JSON.stringify({
      token,
      platform,
      deviceId,
    }),
  });

  setStoredPushDeviceState({
    token,
    platform,
    deviceId,
  });
};

export const initializeWebChatPush = async () => {
  if (
    !hasFirebaseMessagingConfig() ||
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    !('serviceWorker' in navigator)
  ) {
    return;
  }

  if (webPushPromise) {
    return webPushPromise;
  }

  webPushPromise = (async () => {
    const permission =
      Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;

    if (permission !== 'granted') {
      return;
    }

    const context = await getWebMessagingContext();
    if (!context?.messaging) {
      return;
    }

    const token = await context.getMessagingToken(context.messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: context.serviceWorkerRegistration || undefined,
    });

    if (token) {
      await registerToken(token, 'web', navigator.userAgent.slice(0, 180));
    }
  })().catch((error) => {
    console.warn('Chat web push registration failed:', error);
  });

  return webPushPromise;
};

export const initializeNativeChatPush = async () => {
  try {
    const [{ Capacitor }, { PushNotifications }] = await Promise.all([
      import('@capacitor/core'),
      import('@capacitor/push-notifications'),
    ]);

    if (!Capacitor?.isNativePlatform?.()) {
      return () => {};
    }

    const permission = await PushNotifications.requestPermissions();
    if (permission?.receive !== 'granted') {
      return () => {};
    }

    const registrationListener = await PushNotifications.addListener(
      'registration',
      async (token) => {
        await registerToken(token?.value, 'android', 'capacitor-android');
      },
    );
    const registrationErrorListener = await PushNotifications.addListener(
      'registrationError',
      (error) => {
        console.warn('Chat native push registration failed:', error);
      },
    );

    await PushNotifications.register();

    nativePushCleanup = async () => {
      await registrationListener?.remove?.();
      await registrationErrorListener?.remove?.();
    };

    return nativePushCleanup;
  } catch (error) {
    console.warn('Chat native push is unavailable:', error);
    return () => {};
  }
};

const unregisterDeviceTokenFromBackend = async (state, authToken) => {
  if (!authToken || (!state?.token && !state?.deviceId) || !API_BASE_URL) {
    return;
  }

  await fetch(`${API_BASE_URL}${CHAT_API_ENDPOINTS.deviceTokens}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(
      state?.token ? { token: state.token } : { deviceId: state?.deviceId || '' },
    ),
  });
};

export const removeCurrentChatPushRegistration = async () => {
  const storedState = getStoredPushDeviceState();
  if (!storedState) {
    return;
  }

  try {
    const authToken = getToken();
    if (authToken) {
      await unregisterDeviceTokenFromBackend(storedState, authToken);
    }
  } catch (error) {
    console.warn('Chat push backend cleanup failed:', error);
  }

  try {
    if (storedState.platform === 'web') {
      const context = await getWebMessagingContext();
      if (context?.deleteToken && context?.messaging) {
        await context.deleteToken(context.messaging);
      }
    }
  } catch (error) {
    console.warn('Chat web push token cleanup failed:', error);
  }

  try {
    if (storedState.platform === 'android') {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      if (typeof PushNotifications?.unregister === 'function') {
        await PushNotifications.unregister();
      }
    }
  } catch (error) {
    console.warn('Chat native push token cleanup failed:', error);
  }

  clearStoredPushDeviceState();
  webPushPromise = null;
  webMessagingContextPromise = null;
};

export const initializeChatPush = async () => {
  const nativeCleanup = await initializeNativeChatPush();
  await initializeWebChatPush();
  return async () => {
    await nativeCleanup?.();
    await nativePushCleanup?.();
  };
};
