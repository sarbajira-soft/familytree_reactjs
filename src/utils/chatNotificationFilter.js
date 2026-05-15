const normalizeText = (value) => String(value || '').trim().toLowerCase();

const matchesAny = (value, patterns) => patterns.some((pattern) => pattern.test(value));

const CHAT_TYPE_PATTERNS = [
  /chat/,
  /conversation/,
  /direct[_\s-]?message/,
  /group[_\s-]?message/,
  /room[_\s-]?message/,
  /new[_\s-]?message/,
];

const CHAT_TEXT_PATTERNS = [
  /\bnew message\b/,
  /\bsent (you )?(a )?message\b/,
  /\bmessage in (the )?(chat|room)\b/,
  /\bchat message\b/,
  /\broom message\b/,
];

export const isChatOrRoomNotification = (notification = {}) => {
  const type = normalizeText(notification?.type);
  const title = normalizeText(notification?.title);
  const message = normalizeText(notification?.message);
  const data =
    notification?.data && typeof notification.data === 'object' ? notification.data : {};
  const targetUrl = normalizeText(
    data?.targetUrl || data?.url || data?.path || notification?.targetUrl,
  );

  if (data?.conversationId || data?.roomId || data?.messageId) {
    return true;
  }

  if (targetUrl.startsWith('/chat') || targetUrl.includes('/chat/')) {
    return true;
  }

  if (matchesAny(type, CHAT_TYPE_PATTERNS)) {
    return true;
  }

  return matchesAny(`${title} ${message}`.trim(), CHAT_TEXT_PATTERNS);
};

export const filterNonChatNotifications = (notifications = []) =>
  (Array.isArray(notifications) ? notifications : []).filter(
    (notification) => !isChatOrRoomNotification(notification),
  );

export const countUnreadNonChatNotifications = (notifications = []) =>
  filterNonChatNotifications(notifications).reduce((total, notification) => {
    const isRead =
      typeof notification?.read === 'boolean'
        ? notification.read
        : Boolean(notification?.isRead);
    return isRead ? total : total + 1;
  }, 0);
