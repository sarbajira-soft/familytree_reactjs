/* global importScripts, firebase */

importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

const params = new URLSearchParams(self.location.search);

const firebaseConfig = {
  apiKey: params.get('apiKey') || '',
  authDomain: params.get('authDomain') || '',
  projectId: params.get('projectId') || '',
  storageBucket: params.get('storageBucket') || '',
  messagingSenderId: params.get('messagingSenderId') || '',
  appId: params.get('appId') || '',
};

const hasMinimumConfig =
  !!firebaseConfig.apiKey &&
  !!firebaseConfig.projectId &&
  !!firebaseConfig.messagingSenderId &&
  !!firebaseConfig.appId;

const resolveTargetUrl = (data = {}) => {
  const explicitTarget = String(
    data?.path || data?.deepLink || data?.link || data?.url || '',
  ).trim();
  if (explicitTarget) {
    return /^https?:\/\//i.test(explicitTarget)
      ? explicitTarget
      : new URL(explicitTarget, self.location.origin).toString();
  }

  const conversationId = String(data?.conversationId || '').trim();
  const familyCode = String(data?.familyCode || '').trim();
  if (conversationId) {
    return new URL(
      `/chat/${encodeURIComponent(conversationId)}${
        familyCode ? `?familyCode=${encodeURIComponent(familyCode)}` : ''
      }`,
      self.location.origin,
    ).toString();
  }

  const type = String(data?.type || '').trim().toUpperCase();
  switch (type) {
    case 'FAMILY_JOIN_REQUEST':
    case 'FAMILY_ASSOCIATION_REQUEST':
      return new URL('/pending-request', self.location.origin).toString();
    case 'FAMILY_ASSOCIATION_ACCEPTED':
    case 'FAMILY_ASSOCIATION_REJECTED':
      return new URL('/linked-family-trees', self.location.origin).toString();
    case 'FAMILY_MEMBER_APPROVED':
    case 'FAMILY_JOIN_REJECTED':
      return new URL('/my-family', self.location.origin).toString();
    default:
      return new URL('/dashboard', self.location.origin).toString();
  }
};

if (hasMinimumConfig && self.firebase && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const payloadData = payload?.data || {};
    const notification = payload?.notification || {};
    const title = String(notification.title || payloadData.title || 'FamilySS Notification').trim();
    const body = String(notification.body || payloadData.body || '').trim();
    const targetUrl = resolveTargetUrl(payloadData);

    self.registration.showNotification(title, {
      body,
      icon: String(payloadData.icon || '/logo.png').trim() || '/logo.png',
      badge: String(payloadData.badge || '/logo.png').trim() || '/logo.png',
      tag:
        String(payloadData.tag || '').trim() ||
        `familyss-${String(payloadData.notificationId || payloadData.messageId || Date.now())}`,
      data: {
        ...payloadData,
        targetUrl,
      },
    });
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification?.data || {};
  const targetUrl = String(data?.targetUrl || '').trim() || resolveTargetUrl(data);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const matchingClient = clients.find(
        (client) =>
          client.url.startsWith(self.location.origin) && 'focus' in client,
      );

      if (matchingClient) {
        matchingClient.postMessage({
          type: 'push-notification-click',
          targetUrl,
          data,
        });
        return matchingClient.focus().then(() => {
          if ('navigate' in matchingClient) {
            return matchingClient.navigate(targetUrl);
          }
          return undefined;
        });
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});
