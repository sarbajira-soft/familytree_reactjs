/**
 * Chat Feature Constants
 * Isolated module — does not affect any existing flows.
 */

export const CHAT_API_ENDPOINTS = {
  families: '/chat/families',
  unreadCount: '/chat/unread/count',
  conversations: '/chat/conversations',
  conversation: (id) => `/chat/conversations/${id}`,
  deleteConversation: (id, familyCode) =>
    `/chat/conversations/${id}?familyCode=${encodeURIComponent(familyCode)}`,
  conversationMessages: (id) => `/chat/conversations/${id}/messages`,
  sendMessage: (id) => `/chat/conversations/${id}/messages`,
  sendMedia: (id) => `/chat/conversations/${id}/media`,
  markRead: (id) => `/chat/conversations/${id}/read`,
  deleteMessage: (msgId, familyCode) =>
    `/chat/messages/${msgId}?familyCode=${encodeURIComponent(familyCode)}`,
  rooms: '/chat/rooms',
  room: (roomId) => `/chat/rooms/${roomId}`,
  deleteRoom: (roomId, familyCode) =>
    `/chat/rooms/${roomId}?familyCode=${encodeURIComponent(familyCode)}`,
  roomPin: (roomId) => `/chat/rooms/${roomId}/pin`,
  roomMembers: (roomId) => `/chat/rooms/${roomId}/members`,
  roomMember: (roomId, userId, familyCode) =>
    `/chat/rooms/${roomId}/members/${userId}?familyCode=${encodeURIComponent(familyCode)}`,
  leaveRoom: (roomId) => `/chat/rooms/${roomId}/leave`,
  muteConversation: (id) => `/chat/conversations/${id}/mute`,
  reportMessage: (msgId) => `/chat/messages/${msgId}/report`,
  deviceTokens: '/notifications/device-tokens',
  familyMembers: (familyCode) => `/family/member/${encodeURIComponent(familyCode)}`,
};

export const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  VOICE: 'voice',
  SYSTEM: 'system',
  TOMBSTONE: 'tombstone',
};

export const ROOM_TYPES = {
  GENERAL: 'general',
  ANNOUNCEMENTS: 'announcements',
  EVENT: 'event',
  CUSTOM: 'custom',
};

export const CONVERSATION_TYPES = {
  DIRECT: 'direct',
  GROUP: 'group',
};

export const CONVERSATION_STATES = {
  ACTIVE: 'active',
  READ_ONLY: 'read_only',
  REVOKED: 'revoked',
  ARCHIVED: 'archived',
};

export const CONVERSATION_AVAILABILITY_REASONS = {
  ACCOUNT_PENDING_DELETION: 'account_pending_deletion',
  ACCOUNT_SUSPENDED: 'account_suspended',
  ACCOUNT_UNAVAILABLE: 'account_unavailable',
  ANNOUNCEMENT_ADMIN_ONLY: 'announcement_admin_only',
  FAMILY_CONNECTION_LOST: 'family_connection_lost',
  PARTICIPANT_BLOCKED: 'participant_blocked',
  PARTICIPANT_PENDING_DELETION: 'participant_pending_deletion',
  PARTICIPANT_SUSPENDED: 'participant_suspended',
  PARTICIPANT_UNAVAILABLE: 'participant_unavailable',
  ROOM_ARCHIVED: 'room_archived',
};

export const CHAT_LIMITS = {
  MAX_FILE_SIZE_MB: 10,
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
  MESSAGES_PER_PAGE: 30,
  MAX_GROUP_MEMBERS: 100,
  GROUP_WARNING_THRESHOLD: 90,
  DELETE_WINDOW_MS: 60 * 60 * 1000, // 1 hour
  TYPING_TIMEOUT_MS: 3000,
  MAX_REPORTS_PER_DAY: 5,
};

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const ALLOWED_AUDIO_TYPES = ['audio/mp4', 'audio/webm'];
export const ALLOWED_MEDIA_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_AUDIO_TYPES];

export const REPORT_REASONS = [
  { id: 'spam', label: 'Spam or misleading' },
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'hate_speech', label: 'Hate speech' },
  { id: 'violence', label: 'Violence or threats' },
  { id: 'other', label: 'Other' },
];

export const CHAT_SOCKET_EVENTS = {
  // Client → Server
  JOIN_CONVERSATION: 'join-conversation',
  LEAVE_CONVERSATION: 'leave-conversation',
  SEND_MESSAGE: 'send-message',
  TYPING_START: 'typing-start',
  TYPING_STOP: 'typing-stop',
  MARK_READ: 'mark-read',
  // Server → Client
  NEW_MESSAGE: 'new-message',
  MESSAGE_DELETED: 'message-deleted',
  TYPING: 'typing',
  READ_RECEIPT: 'read-receipt',
  MESSAGE_PINNED: 'message-pinned',
  MESSAGE_UNPINNED: 'message-unpinned',
  MEMBER_JOINED: 'member-joined',
  MEMBER_REMOVED: 'member-removed',
  ROOM_UPDATED: 'room-updated',
  CONVERSATION_REMOVED: 'conversation-removed',
  UNREAD_CHAT_COUNT: 'unread-chat-count',
};
