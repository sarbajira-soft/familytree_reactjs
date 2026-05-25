import { authFetchResponse } from '../utils/authFetch';
import { getToken } from '../utils/auth';
import { CHAT_API_ENDPOINTS } from '../constants/chat.constants';
import {
  getActivePushConversationId,
  getOrCreatePushInstallationId,
  clearStoredPushDeviceState,
  getStoredPushDeviceState,
  setStoredPushDeviceState,
} from '../utils/pushDeviceState';

let webPushPromise = null;
let nativePushPromise = null;
let nativePushCleanup = null;
let webOnMessageUnsubscribe = null;
let serviceWorkerMessageCleanup = null;
let firebaseAppPromise = null;
let webMessagingContextPromise = null;
let pushRefreshCleanup = null;
let pushRefreshIntervalId = null;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const FIREBASE_MESSAGING_SW_PATH = '/firebase-messaging-sw.js';
const FIREBASE_ENV_KEYS = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'VITE_FIREBASE_APP_ID',
  vapidKey: 'VITE_FIREBASE_VAPID_KEY',
};

const readFirebaseEnv = (key) => String(import.meta.env[key] || '').trim();

const getFirebaseConfig = () => ({
  apiKey: readFirebaseEnv(FIREBASE_ENV_KEYS.apiKey),
  authDomain: readFirebaseEnv(FIREBASE_ENV_KEYS.authDomain),
  projectId: readFirebaseEnv(FIREBASE_ENV_KEYS.projectId),
  storageBucket: readFirebaseEnv(FIREBASE_ENV_KEYS.storageBucket),
  messagingSenderId: readFirebaseEnv(FIREBASE_ENV_KEYS.messagingSenderId),
  appId: readFirebaseEnv(FIREBASE_ENV_KEYS.appId),
});

const hasFirebaseMessagingConfig = () => {
  const config = getFirebaseConfig();
  return (
    !!config.apiKey &&
    !!config.projectId &&
    !!config.appId &&
    !!config.messagingSenderId &&
    !!readFirebaseEnv(FIREBASE_ENV_KEYS.vapidKey)
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

const resolvePushTarget = (data = {}) => {
  const explicitTarget = String(
    data?.path || data?.deepLink || data?.link || data?.url || '',
  ).trim();
  if (explicitTarget) {
    return explicitTarget;
  }

  const conversationId = String(data?.conversationId || '').trim();
  const familyCode = String(data?.familyCode || '').trim();
  if (conversationId) {
    return `/chat/${encodeURIComponent(conversationId)}${
      familyCode ? `?familyCode=${encodeURIComponent(familyCode)}` : ''
    }`;
  }

  const eventId = String(data?.eventId || '').trim();
  if (eventId) {
    return '/events';
  }

  const type = String(data?.type || '').trim().toUpperCase();
  switch (type) {
    case 'FAMILY_JOIN_REQUEST':
    case 'FAMILY_ASSOCIATION_REQUEST':
      return '/pending-request';
    case 'FAMILY_ASSOCIATION_ACCEPTED':
    case 'FAMILY_ASSOCIATION_REJECTED':
      return '/linked-family-trees';
    case 'FAMILY_MEMBER_APPROVED':
    case 'FAMILY_JOIN_REJECTED':
      return '/my-family';
    default:
      return '/dashboard';
  }
};

const navigateToPushTarget = (targetUrl) => {
  if (typeof window === 'undefined' || !targetUrl) {
    return;
  }

  const absoluteUrl = /^https?:\/\//i.test(targetUrl)
    ? targetUrl
    : new URL(targetUrl, window.location.origin).toString();

  if (window.location.href !== absoluteUrl) {
    window.location.assign(absoluteUrl);
  }
};

const isDocumentVisible = () =>
  typeof document !== 'undefined' && document.visibilityState === 'visible';

const getNotificationRuntimeData = (payload = {}) =>
  payload?.data && typeof payload.data === 'object' ? payload.data : {};

const shouldSuppressConversationPush = (data = {}) => {
  const activeConversationId = getActivePushConversationId();
  const payloadConversationId = Number(data?.conversationId || 0);

  const shouldSuppress =
    Number(activeConversationId || 0) > 0 &&
    payloadConversationId > 0 &&
    Number(activeConversationId) === payloadConversationId;

  if (shouldSuppress) {
    console.debug(
      `[ChatPush] push suppressed because active conversation matches payload conversation=${payloadConversationId}`,
    );
  }

  return shouldSuppress;
};

const showNativeForegroundNotification = async (notification) => {
  const data = getNotificationRuntimeData(notification);
  if (shouldSuppressConversationPush(data)) {
    return;
  }

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    let permissionStatus = await LocalNotifications.checkPermissions();
    if (permissionStatus?.display === 'prompt') {
      permissionStatus = await LocalNotifications.requestPermissions();
    }

    if (permissionStatus?.display !== 'granted') {
      return;
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          id: Number(data?.notificationId || data?.messageId || Date.now()),
          title: String(notification?.title || data?.title || 'FamilySS Notification').trim(),
          body: String(notification?.body || data?.body || '').trim(),
          extra: {
            ...data,
            targetUrl: resolvePushTarget(data),
          },
          smallIcon: 'ic_launcher_foreground',
        },
      ],
    });
  } catch (error) {
    console.warn('Chat native foreground notification failed:', error);
  }
};

const showBrowserNotification = ({ title, body, data = {} }) => {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  ) {
    return;
  }

  const safeTitle = String(title || data?.title || 'FamilySS Notification').trim();
  if (!safeTitle) {
    return;
  }

  const notification = new Notification(safeTitle, {
    body: String(body || data?.body || '').trim(),
    icon: String(data?.icon || '/logo.png').trim() || '/logo.png',
    tag:
      String(data?.tag || '').trim() ||
      `familyss-${String(data?.notificationId || data?.messageId || Date.now())}`,
    data: {
      ...data,
      targetUrl: resolvePushTarget(data),
    },
  });

  notification.onclick = () => {
    window.focus?.();
    navigateToPushTarget(notification.data?.targetUrl || resolvePushTarget(data));
    notification.close();
  };
};

const ensureServiceWorkerMessageListener = () => {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    serviceWorkerMessageCleanup
  ) {
    return;
  }

  const handleMessage = (event) => {
    const type = String(event?.data?.type || '').trim();
    if (type !== 'chat-notification-click' && type !== 'push-notification-click') {
      return;
    }

    const targetUrl =
      String(event?.data?.targetUrl || '').trim() ||
      resolvePushTarget(event?.data?.data || {});

    if (targetUrl) {
      navigateToPushTarget(targetUrl);
    }
  };

  navigator.serviceWorker.addEventListener('message', handleMessage);
  serviceWorkerMessageCleanup = () => {
    navigator.serviceWorker.removeEventListener('message', handleMessage);
    serviceWorkerMessageCleanup = null;
  };
};

const clearPushRefreshLoop = async () => {
  if (pushRefreshIntervalId) {
    clearInterval(pushRefreshIntervalId);
    pushRefreshIntervalId = null;
  }

  try {
    await pushRefreshCleanup?.();
  } catch (error) {
    console.warn('Push refresh listener cleanup failed:', error);
  } finally {
    pushRefreshCleanup = null;
  }
};

const cleanupRuntimePushListeners = async () => {
  await clearPushRefreshLoop();

  try {
    if (typeof webOnMessageUnsubscribe === 'function') {
      webOnMessageUnsubscribe();
    }
  } catch (error) {
    console.warn('Chat web push listener cleanup failed:', error);
  } finally {
    webOnMessageUnsubscribe = null;
  }

  try {
    await nativePushCleanup?.();
  } catch (error) {
    console.warn('Chat native push listener cleanup failed:', error);
  } finally {
    nativePushCleanup = null;
    nativePushPromise = null;
  }

  webPushPromise = null;
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

  ensureServiceWorkerMessageListener();

  return navigator.serviceWorker.register(buildServiceWorkerUrl(), {
    scope: '/',
  });
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
    const {
      getMessaging,
      getToken: getMessagingToken,
      onMessage,
    } = await import('firebase/messaging');

    return {
      getMessagingToken,
      messaging: getMessaging(firebaseApp),
      onMessage,
      serviceWorkerRegistration: registration,
    };
  })().catch((error) => {
    webMessagingContextPromise = null;
    throw error;
  });

  return webMessagingContextPromise;
};

const registerToken = async (token, platform, deviceId = '') => {
  if (!token || !platform) {
    return;
  }

  const normalizedToken = String(token || '').trim();
  const normalizedPlatform = String(platform || '').trim().toLowerCase();
  const normalizedDeviceId = String(deviceId || '').trim();
  const storedState = getStoredPushDeviceState();
  const previousToken = String(storedState?.token || '').trim();

  if (
    storedState?.token === normalizedToken &&
    storedState?.platform === normalizedPlatform &&
    storedState?.deviceId === normalizedDeviceId
  ) {
    return;
  }

  if (
    previousToken &&
    previousToken !== normalizedToken &&
    storedState?.deviceId === normalizedDeviceId
  ) {
    console.info(
      `Push token rotation detected for device ${normalizedDeviceId} on ${normalizedPlatform}`,
    );
  } else {
    console.info(
      `Registering push token for device ${normalizedDeviceId} on ${normalizedPlatform}`,
    );
  }

  await authFetchResponse(CHAT_API_ENDPOINTS.deviceTokens, {
    method: 'POST',
    body: JSON.stringify({
      token: normalizedToken,
      platform: normalizedPlatform,
      deviceId: normalizedDeviceId,
    }),
  });

  setStoredPushDeviceState({
    token: normalizedToken,
    platform: normalizedPlatform,
    deviceId: normalizedDeviceId,
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

    if (!webOnMessageUnsubscribe) {
      webOnMessageUnsubscribe = context.onMessage(context.messaging, (payload) => {
        const payloadData = getNotificationRuntimeData(payload);
        if (!isDocumentVisible() || shouldSuppressConversationPush(payloadData)) {
          return;
        }

        showBrowserNotification({
          title: payloadData?.title,
          body: payloadData?.body,
          data: payloadData,
        });
      });
    }

    const token = await context.getMessagingToken(context.messaging, {
      vapidKey: readFirebaseEnv(FIREBASE_ENV_KEYS.vapidKey),
      serviceWorkerRegistration: context.serviceWorkerRegistration || undefined,
    });

    if (token) {
      await registerToken(token, 'web', getOrCreatePushInstallationId());
    }
  })().catch((error) => {
    webPushPromise = null;
    console.warn('Chat web push registration failed:', error);
  });

  return webPushPromise;
};

export const initializeNativeChatPush = async () => {
  try {
    const [{ Capacitor }, { PushNotifications }, localNotificationsModule] = await Promise.all([
      import('@capacitor/core'),
      import('@capacitor/push-notifications'),
      import('@capacitor/local-notifications').catch(() => null),
    ]);
    const LocalNotifications = localNotificationsModule?.LocalNotifications || null;

    if (!Capacitor?.isNativePlatform?.()) {
      return () => {};
    }

    if (nativePushPromise) {
      return nativePushPromise;
    }

    nativePushPromise = (async () => {
      let permissionStatus = await PushNotifications.checkPermissions();
      if (permissionStatus?.receive === 'prompt') {
        permissionStatus = await PushNotifications.requestPermissions();
      }

      if (permissionStatus?.receive !== 'granted') {
        return () => {};
      }

      const registrationListener = await PushNotifications.addListener(
        'registration',
        async (token) => {
          await registerToken(token?.value, 'android', getOrCreatePushInstallationId());
        },
      );
      const registrationErrorListener = await PushNotifications.addListener(
        'registrationError',
        (error) => {
          console.warn('Chat native push registration failed:', error);
        },
      );
      const pushReceivedListener = await PushNotifications.addListener(
        'pushNotificationReceived',
        async (notification) => {
          window.dispatchEvent(
            new CustomEvent('familyss:push-received', {
              detail: notification,
            }),
          );
          if (LocalNotifications) {
            await showNativeForegroundNotification(notification);
          }
        },
      );
      const actionPerformedListener = await PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (event) => {
          const data = event?.notification?.data || {};
          navigateToPushTarget(resolvePushTarget(data));
        },
      );
      const localNotificationActionListener = LocalNotifications
        ? await LocalNotifications.addListener(
            'localNotificationActionPerformed',
            (event) => {
              const data = event?.notification?.extra || {};
              navigateToPushTarget(
                String(data?.targetUrl || '').trim() || resolvePushTarget(data),
              );
            },
          )
        : null;

      await PushNotifications.register();

      nativePushCleanup = async () => {
        await registrationListener?.remove?.();
        await registrationErrorListener?.remove?.();
        await pushReceivedListener?.remove?.();
        await actionPerformedListener?.remove?.();
        await localNotificationActionListener?.remove?.();
      };

      return nativePushCleanup;
    })().catch((error) => {
      nativePushPromise = null;
      throw error;
    });

    return nativePushPromise;
  } catch (error) {
    console.warn('Chat native push is unavailable:', error);
    return () => {};
  }
};

const unregisterDeviceTokenFromBackend = async (state, authToken) => {
  if (!authToken || !state?.deviceId || !API_BASE_URL) {
    return;
  }

  await fetch(`${API_BASE_URL}${CHAT_API_ENDPOINTS.deviceTokens}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ deviceId: state?.deviceId || '' }),
  });
};

export const removeCurrentChatPushRegistration = async () => {
  const storedState = getStoredPushDeviceState();

  try {
    const authToken = getToken();
    if (storedState && authToken) {
      await unregisterDeviceTokenFromBackend(storedState, authToken);
    }
  } catch (error) {
    console.warn('Chat push backend cleanup failed:', error);
  }

  await cleanupRuntimePushListeners();

  clearStoredPushDeviceState();
  webPushPromise = null;
  webMessagingContextPromise = null;
};

export const refreshChatPushRegistration = async () => {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor?.isNativePlatform?.()) {
      if (!nativePushPromise) {
        await initializeNativeChatPush();
      }
      const { PushNotifications } = await import('@capacitor/push-notifications');
      await PushNotifications.register();
      return;
    }

    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      Notification.permission !== 'granted'
    ) {
      return;
    }

    const context = await getWebMessagingContext();
    if (!context?.messaging) {
      return;
    }

    const token = await context.getMessagingToken(context.messaging, {
      vapidKey: readFirebaseEnv(FIREBASE_ENV_KEYS.vapidKey),
      serviceWorkerRegistration: context.serviceWorkerRegistration || undefined,
    });

    if (token) {
      await registerToken(token, 'web', getOrCreatePushInstallationId());
    }
  } catch (error) {
    console.warn('Chat push token refresh failed:', error);
  }
};

const ensurePushRefreshLoop = async () => {
  if (pushRefreshCleanup || pushRefreshIntervalId) {
    return;
  }

  const refreshIfVisible = () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return;
    }
    void refreshChatPushRegistration();
  };

  const focusHandler = () => {
    refreshIfVisible();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('focus', focusHandler);
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', refreshIfVisible);
  }

  try {
    const { App } = await import('@capacitor/app');
    const appStateListener = await App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        void refreshChatPushRegistration();
      }
    });

    pushRefreshCleanup = async () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', focusHandler);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', refreshIfVisible);
      }
      await appStateListener?.remove?.();
      pushRefreshCleanup = null;
    };
  } catch {
    pushRefreshCleanup = async () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', focusHandler);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', refreshIfVisible);
      }
      pushRefreshCleanup = null;
    };
  }

  pushRefreshIntervalId = window.setInterval(() => {
    refreshIfVisible();
  }, 6 * 60 * 60 * 1000);
};

export const initializeChatPush = async () => {
  const { Capacitor } = await import('@capacitor/core');
  const nativeCleanup = Capacitor?.isNativePlatform?.()
    ? await initializeNativeChatPush()
    : null;

  if (!Capacitor?.isNativePlatform?.()) {
    await initializeWebChatPush();
  }

  await ensurePushRefreshLoop();

  return async () => {
    await nativeCleanup?.();
    await cleanupRuntimePushListeners();
  };
};
