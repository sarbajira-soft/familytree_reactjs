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

if (hasMinimumConfig && self.firebase && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const data = payload?.data || {};

    if (data?.conversationId || data?.roomId || data?.messageId) {
      return;
    }
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification?.data || {};
  const conversationId = String(data?.conversationId || '').trim();
  const familyCode = String(data?.familyCode || '').trim();
  const targetPath = conversationId
    ? `/chat/${encodeURIComponent(conversationId)}${
        familyCode ? `?familyCode=${encodeURIComponent(familyCode)}` : ''
      }`
    : '/chat';
  const targetUrl = new URL(targetPath, self.location.origin).toString();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const matchingClient = clients.find(
        (client) =>
          client.url.startsWith(self.location.origin) && 'focus' in client,
      );

      if (matchingClient) {
        matchingClient.postMessage({
          type: 'chat-notification-click',
          targetUrl,
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
