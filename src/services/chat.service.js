import { authFetchResponse } from '../utils/authFetch';
import {
  CHAT_API_ENDPOINTS,
  CHAT_LIMITS,
  CONVERSATION_STATES,
  MESSAGE_TYPES,
  ROOM_TYPES,
} from '../constants/chat.constants';

const minute = 60 * 1000;
const hour = 60 * minute;
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

const normalizeFamilyCode = (familyCode) =>
  String(familyCode || '').trim().toUpperCase();

const normalizeMembershipType = (value) =>
  String(value || 'member').trim().toLowerCase();

const resolveChatAssetUrl = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  if (
    /^https?:\/\//i.test(raw) ||
    raw.startsWith('data:') ||
    raw.startsWith('blob:')
  ) {
    return raw;
  }

  if (!API_BASE_URL) {
    return raw;
  }

  if (raw.startsWith('/')) {
    return `${API_BASE_URL}${raw}`;
  }

  if (raw.startsWith('uploads/')) {
    return `${API_BASE_URL}/${raw}`;
  }

  if (raw.startsWith('profile/') || raw.startsWith('family/') || raw.startsWith('chat/')) {
    return `${API_BASE_URL}/uploads/${raw}`;
  }

  return raw;
};

const requireFamilyCode = (familyCode, action) => {
  const normalizedFamilyCode = normalizeFamilyCode(familyCode);
  if (!normalizedFamilyCode) {
    throw new Error(`familyCode is required to ${action}`);
  }

  return normalizedFamilyCode;
};

const parseJson = async (response) => {
  try {
    return await response.json();
  } catch (_) {
    return null;
  }
};

const getNestedArray = (payload, key) => {
  if (Array.isArray(payload?.[key])) {
    return payload[key];
  }
  if (Array.isArray(payload?.data?.[key])) {
    return payload.data[key];
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  return [];
};

const normalizeParticipant = (participant) => ({
  userId: Number(participant?.userId || participant?.id || 0),
  firstName: participant?.firstName || '',
  lastName: participant?.lastName || '',
  name: participant?.name || '',
  profileUrl: resolveChatAssetUrl(
    participant?.profileUrl || participant?.profileImage || '',
  ),
});

const getChatMemberPreferenceScore = (member = {}, familyCode = '') => {
  const normalizedFamilyCode = normalizeFamilyCode(familyCode);
  const memberTypeRank = {
    member: 0,
    associated: 1,
    linked: 2,
  };
  const membershipType = String(member?.membershipType || 'member').trim().toLowerCase();
  const sourceFamilyPenalty =
    normalizeFamilyCode(member?.sourceFamilyCode) === normalizedFamilyCode ? 0 : 10;
  const rolePenalty = member?.isFamilyAdmin ? -1 : 0;

  return (memberTypeRank[membershipType] ?? 20) + sourceFamilyPenalty + rolePenalty;
};

const dedupeFamilyMembersForChat = (members = [], familyCode = '') => {
  const uniqueMembers = new Map();

  members.forEach((member) => {
    const userId = Number(member?.userId || 0);
    if (!userId) {
      return;
    }

    const existingMember = uniqueMembers.get(userId);
    if (!existingMember) {
      uniqueMembers.set(userId, member);
      return;
    }

    if (
      getChatMemberPreferenceScore(member, familyCode) <
      getChatMemberPreferenceScore(existingMember, familyCode)
    ) {
      uniqueMembers.set(userId, member);
    }
  });

  return Array.from(uniqueMembers.values());
};
const normalizeFamilyMember = (member = {}, familyCode = '') => {
  const user = member?.user || {};
  const profile = user?.userProfile || {};
  const userId = Number(user?.id || member?.userId || member?.memberId || 0);
  const firstName = profile?.firstName || '';
  const lastName = profile?.lastName || '';
  const name =
    String(user?.fullName || '').trim() ||
    [firstName, lastName].filter(Boolean).join(' ').trim() ||
    'Family Member';

  return {
    id: Number(member?.id || userId || 0),
    userId,
    firstName,
    lastName,
    name,
    profileUrl: resolveChatAssetUrl(user?.profileImage || profile?.profile || ''),
    familyRole: member?.familyRole || 'Member',
    isFamilyAdmin: Boolean(member?.isFamilyAdmin),
    isAppUser: Boolean(user?.isAppUser),
    userStatus: Number(user?.status || 0),
    membershipType: member?.membershipType || 'member',
    isNotInTree: Boolean(member?.isNotInTree),
    familyCode: normalizeFamilyCode(member?.familyCode || familyCode),
    sourceFamilyCode: normalizeFamilyCode(
      member?.sourceFamilyCode || profile?.familyCode || member?.familyCode || familyCode,
    ),
    blockStatus: member?.blockStatus || {
      isBlockedByMe: false,
      isBlockedByThem: false,
    },
  };
};

export const getChatMemberBadges = (member = {}) => {
  const membershipType = normalizeMembershipType(member?.membershipType);
  const badges = [];

  if (membershipType === 'associated') {
    badges.push({
      key: 'associated',
      label: 'A',
      title: 'Associated member',
      className: 'chat-member-chip--associated',
    });
  }

  if (membershipType === 'linked') {
    badges.push({
      key: 'linked',
      label: 'L',
      title: 'Linked member',
      className: 'chat-member-chip--linked',
    });
  }

  if (membershipType === 'member' && Boolean(member?.isNotInTree)) {
    badges.push({
      key: 'not-in-tree',
      label: 'MNT',
      title: 'Member not in tree',
      className: 'chat-member-chip--not-in-tree',
    });
  }

  return badges;
};

export const getChatMemberMetaText = (member = {}) => {
  const metadata = [member?.familyRole || 'Family member'];
  const sourceFamilyCode = normalizeFamilyCode(member?.sourceFamilyCode);
  const familyCode = normalizeFamilyCode(member?.familyCode);

  if (sourceFamilyCode && sourceFamilyCode !== familyCode) {
    metadata.push(sourceFamilyCode);
  }

  return metadata.join(' · ');
};

const normalizeConversation = (conversation = {}) => ({
  id: Number(conversation?.id || 0),
  familyCode: conversation?.familyCode || '',
  type: conversation?.type || 'direct',
  conversationType:
    conversation?.conversationType ||
    (String(conversation?.type || '').trim().toLowerCase() === 'direct'
      ? 'direct'
      : conversation?.conversationState === CONVERSATION_STATES.ARCHIVED
        ? 'archived'
        : 'family'),
  conversationState: conversation?.conversationState || CONVERSATION_STATES.ACTIVE,
  canSend:
    typeof conversation?.canSend === 'boolean'
      ? conversation.canSend
      : true,
  availabilityReason: conversation?.availabilityReason || null,
  canPin: Boolean(conversation?.canPin),
  isFamilyCanonical: Boolean(conversation?.isFamilyCanonical),
  createdAt: conversation?.createdAt || null,
  updatedAt: conversation?.updatedAt || null,
  participants: Array.isArray(conversation?.participants)
    ? conversation.participants.map(normalizeParticipant)
    : [],
  lastMessage: conversation?.lastMessage
    ? {
        id: Number(conversation.lastMessage.id || 0),
      content: conversation.lastMessage.content || '',
      createdAt: conversation.lastMessage.createdAt || null,
      senderId: Number(conversation.lastMessage.senderId || 0),
      senderName: conversation.lastMessage.senderName || '',
      messageType: conversation.lastMessage.messageType || MESSAGE_TYPES.TEXT,
      mediaUrl: conversation.lastMessage.mediaUrl || '',
    }
    : null,
  unreadCount: Number(conversation?.unreadCount || 0),
  isMuted: Boolean(conversation?.isMuted),
  relationship: conversation?.relationship || '',
  roomId: Number(conversation?.roomId || 0) || null,
  roomType: conversation?.roomType || null,
  roomName: conversation?.roomName || null,
  roomAvatarUrl: resolveChatAssetUrl(conversation?.roomAvatarUrl || ''),
  roomMembers: Array.isArray(conversation?.roomMembers)
    ? conversation.roomMembers.map(normalizeParticipant)
    : [],
  roomMemberIds: Array.isArray(conversation?.roomMemberIds)
    ? conversation.roomMemberIds
        .map((memberId) => Number(memberId || 0))
        .filter((memberId) => memberId > 0)
    : [],
  canManageRoom: Boolean(conversation?.canManageRoom),
  canLeaveRoom: Boolean(conversation?.canLeaveRoom),
  memberCount: Number(conversation?.memberCount || 0),
  eventId: Number(conversation?.eventId || 0) || null,
  pinnedMessage: conversation?.pinnedMessage || null,
  counterpartyStatus: conversation?.counterpartyStatus || null,
});

export const getChatFamilies = async () => {
  const response = await authFetchResponse(CHAT_API_ENDPOINTS.families, {
    method: 'GET',
  });
  const json = await parseJson(response);
  return {
    families: getNestedArray(json, 'families'),
  };
};

export const createConversation = async (familyCode, participantUserId) => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'create a conversation',
  );
  const response = await authFetchResponse(CHAT_API_ENDPOINTS.conversations, {
    method: 'POST',
    body: JSON.stringify({
      familyCode: normalizedFamilyCode,
      participantUserId,
    }),
  });
  const json = await parseJson(response);
  return normalizeConversation(json?.data || json || {});
};

export const getConversations = async (familyCode) => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'load conversations',
  );
  const response = await authFetchResponse(
    `${CHAT_API_ENDPOINTS.conversations}?familyCode=${encodeURIComponent(normalizedFamilyCode)}`,
    {
      method: 'GET',
    },
  );
  const json = await parseJson(response);
  return {
    conversations: getNestedArray(json, 'conversations').map(normalizeConversation),
  };
};

export const getRooms = async (familyCode) => {
  const normalizedFamilyCode = requireFamilyCode(familyCode, 'load rooms');
  const response = await authFetchResponse(
    `${CHAT_API_ENDPOINTS.rooms}?familyCode=${encodeURIComponent(normalizedFamilyCode)}`,
    {
      method: 'GET',
    },
  );
  const json = await parseJson(response);
  return {
    rooms: getNestedArray(json, 'rooms').map(normalizeConversation),
  };
};

export const getConversation = async (conversationId, familyCode) => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'load conversation details',
  );
  const response = await authFetchResponse(
    `${CHAT_API_ENDPOINTS.conversation(conversationId)}?familyCode=${encodeURIComponent(normalizedFamilyCode)}`,
    {
      method: 'GET',
    },
  );
  const json = await parseJson(response);
  return normalizeConversation(json?.data || json || {});
};

export const getFamilyMembersForChat = async (familyCode) => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'load family members for chat',
  );
  const response = await authFetchResponse(
    CHAT_API_ENDPOINTS.familyMembers(normalizedFamilyCode),
    {
      method: 'GET',
    },
  );
  const json = await parseJson(response);
  const members = dedupeFamilyMembersForChat(
    getNestedArray(json, 'data')
      .map((member) => normalizeFamilyMember(member, normalizedFamilyCode))
      .filter(
        (member) =>
          member.userId > 0 && member.isAppUser && Number(member.userStatus || 0) === 1,
      ),
    normalizedFamilyCode,
  );

  return {
    members,
  };
};

export const getMessages = async (
  conversationId,
  cursor,
  _currentUserId = null,
  familyCode,
) => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'load conversation messages',
  );
  const params = new URLSearchParams();
  params.set('familyCode', normalizedFamilyCode);
  if (cursor?.beforeCreatedAt) params.set('beforeCreatedAt', cursor.beforeCreatedAt);
  if (cursor?.beforeId) params.set('beforeId', String(cursor.beforeId));
  params.set('limit', String(cursor?.limit || CHAT_LIMITS.MESSAGES_PER_PAGE));

  const response = await authFetchResponse(
    `${CHAT_API_ENDPOINTS.conversationMessages(conversationId)}?${params.toString()}`,
    {
      method: 'GET',
    },
  );
  const json = await parseJson(response);
  const messages = Array.isArray(json?.messages)
    ? json.messages
    : Array.isArray(json?.data?.messages)
      ? json.data.messages
      : [];

  return {
    messages,
    nextCursor: json?.nextCursor || json?.data?.nextCursor || null,
    hasMore: Boolean(json?.hasMore ?? json?.data?.hasMore),
  };
};

export const sendTextMessage = async (conversationId, familyCode, content, options = {}) => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'send a message',
  );
  const response = await authFetchResponse(CHAT_API_ENDPOINTS.sendMessage(conversationId), {
    method: 'POST',
    body: JSON.stringify({
      familyCode: normalizedFamilyCode,
      content,
      replyToId: options?.replyTo?.id || options?.replyToId || null,
      mentionedUserIds: options?.mentionedUserIds || [],
    }),
  });
  return parseJson(response);
};

export const sendMediaMessage = async (conversationId, familyCode, file, options = {}) => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'send media',
  );
  const formData = new FormData();
  formData.append('file', file);
  formData.append('familyCode', normalizedFamilyCode);
  if (options?.content) {
    formData.append('content', options.content);
  }
  if (options?.replyTo?.id || options?.replyToId) {
    formData.append('replyToId', String(options?.replyTo?.id || options?.replyToId));
  }
  if (Array.isArray(options?.mentionedUserIds) && options.mentionedUserIds.length > 0) {
    formData.append('mentionedUserIds', JSON.stringify(options.mentionedUserIds));
  }

  const response = await authFetchResponse(CHAT_API_ENDPOINTS.sendMedia(conversationId), {
    method: 'POST',
    body: formData,
  });
  return parseJson(response);
};

export const markConversationRead = async (conversationId, familyCode, readAt = null) => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'mark a conversation as read',
  );
  const response = await authFetchResponse(CHAT_API_ENDPOINTS.markRead(conversationId), {
    method: 'PATCH',
    body: JSON.stringify({
      familyCode: normalizedFamilyCode,
      ...(readAt ? { readAt } : {}),
    }),
  });
  return parseJson(response);
};

export const deleteMessage = async (messageId, familyCode) => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'delete a message',
  );
  const response = await authFetchResponse(
    CHAT_API_ENDPOINTS.deleteMessage(messageId, normalizedFamilyCode),
    {
      method: 'DELETE',
    },
  );
  return parseJson(response);
};

export const toggleMute = async (conversationId, familyCode, isMuted) => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'change mute settings',
  );
  const response = await authFetchResponse(CHAT_API_ENDPOINTS.muteConversation(conversationId), {
    method: 'PATCH',
    body: JSON.stringify({
      familyCode: normalizedFamilyCode,
      isMuted: !Boolean(isMuted),
    }),
  });
  const json = await parseJson(response);
  return json?.data || json || { success: true, isMuted: !Boolean(isMuted) };
};

export const deleteConversation = async (conversationId, familyCode) => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'delete a conversation',
  );
  const response = await authFetchResponse(
    CHAT_API_ENDPOINTS.deleteConversation(conversationId, normalizedFamilyCode),
    {
      method: 'DELETE',
    },
  );
  return parseJson(response);
};

export const reportMessage = async (messageId, familyCode, reason, description = '') => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'report a message',
  );
  const response = await authFetchResponse(CHAT_API_ENDPOINTS.reportMessage(messageId), {
    method: 'POST',
    body: JSON.stringify({
      familyCode: normalizedFamilyCode,
      reason,
      description,
    }),
  });
  return parseJson(response);
};

export const getUnreadChatCount = async () => {
  const response = await authFetchResponse(CHAT_API_ENDPOINTS.unreadCount, {
    method: 'GET',
  });
  const json = await parseJson(response);
  return {
    count: Number(json?.count ?? json?.data?.count ?? 0),
  };
};

export const getMessagePreviewText = (message) => {
  if (!message) return 'No messages yet';

  const content = String(message?.content || '').trim();
  if (content) {
    return content;
  }

  switch (String(message?.messageType || '')) {
    case MESSAGE_TYPES.IMAGE:
      return 'Photo';
    case MESSAGE_TYPES.VOICE:
      return 'Voice message';
    case MESSAGE_TYPES.SYSTEM:
      return 'System message';
    case MESSAGE_TYPES.TOMBSTONE:
      return 'Message unavailable';
    default:
      return message?.mediaUrl ? 'Attachment' : 'No messages yet';
  }
};

export const createEventRoom = async (familyCode, eventId) => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'create an event room',
  );
  const response = await authFetchResponse(CHAT_API_ENDPOINTS.rooms, {
    method: 'POST',
    body: JSON.stringify({
      familyCode: normalizedFamilyCode,
      eventId,
      roomType: ROOM_TYPES.EVENT,
    }),
  });
  const json = await parseJson(response);
  return normalizeConversation(json?.data || json || {});
};

export const createRoomConversation = async (
  familyCode,
  roomName,
  memberIds = [],
  roomType = ROOM_TYPES.CUSTOM,
) => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'create a room',
  );
  const response = await authFetchResponse(CHAT_API_ENDPOINTS.rooms, {
    method: 'POST',
    body: JSON.stringify({
      familyCode: normalizedFamilyCode,
      roomName,
      roomType,
      memberIds,
    }),
  });
  const json = await parseJson(response);
  return normalizeConversation(json?.data || json || {});
};

export const addMembersToRoom = async (roomId, familyCode, memberIds = []) => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'add members to a room',
  );
  const response = await authFetchResponse(CHAT_API_ENDPOINTS.roomMembers(roomId), {
    method: 'POST',
    body: JSON.stringify({
      familyCode: normalizedFamilyCode,
      memberIds,
    }),
  });
  const json = await parseJson(response);
  return normalizeConversation(json?.data || json || {});
};

export const removeMemberFromRoom = async (roomId, familyCode, memberId) => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'remove a member from a room',
  );
  const response = await authFetchResponse(
    CHAT_API_ENDPOINTS.roomMember(roomId, memberId, normalizedFamilyCode),
    {
      method: 'DELETE',
    },
  );
  const json = await parseJson(response);
  return normalizeConversation(json?.data || json || {});
};

export const updateRoomConversation = async (roomId, familyCode, options = {}) => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'update a room',
  );
  const formData = new FormData();
  formData.append('familyCode', normalizedFamilyCode);

  if (options?.roomName) {
    formData.append('roomName', String(options.roomName).trim());
  }
  if (typeof options?.removeAvatar !== 'undefined') {
    formData.append('removeAvatar', String(Boolean(options.removeAvatar)));
  }
  if (options?.file) {
    formData.append('file', options.file);
  }

  const response = await authFetchResponse(CHAT_API_ENDPOINTS.room(roomId), {
    method: 'PATCH',
    body: formData,
  });
  const json = await parseJson(response);
  return normalizeConversation(json?.data || json || {});
};

export const leaveRoomConversation = async (roomId, familyCode) => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'leave a room',
  );
  const response = await authFetchResponse(CHAT_API_ENDPOINTS.leaveRoom(roomId), {
    method: 'POST',
    body: JSON.stringify({
      familyCode: normalizedFamilyCode,
    }),
  });
  return parseJson(response);
};

export const deleteRoomConversation = async (roomId, familyCode) => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'delete a room',
  );
  const response = await authFetchResponse(
    CHAT_API_ENDPOINTS.deleteRoom(roomId, normalizedFamilyCode),
    {
      method: 'DELETE',
    },
  );
  return parseJson(response);
};

export const formatMessageTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now2 = new Date();
  const diffMs = now2 - date;
  const diffMins = Math.floor(diffMs / minute);
  const diffHours = Math.floor(diffMs / hour);
  const diffDays = Math.floor(diffMs / (24 * hour));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export const formatFullTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

export const formatDateSeparator = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
};

export const getInitials = (firstName, lastName) => {
  const f = (firstName || '').charAt(0).toUpperCase();
  const l = (lastName || '').charAt(0).toUpperCase();
  return f + l || '?';
};

export const getRoomIcon = (roomType) => {
  switch (roomType) {
    case ROOM_TYPES.GENERAL:
      return '💬';
    case ROOM_TYPES.ANNOUNCEMENTS:
      return '📢';
    case ROOM_TYPES.EVENT:
      return '🎉';
    case ROOM_TYPES.CUSTOM:
      return '✨';
    default:
      return '💬';
  }
};

export const canDeleteMessage = (message, currentUserId) => {
  if (!message || message.isDeleted) return false;
  if (Number(message.senderId) !== Number(currentUserId)) return false;
  const elapsed = Date.now() - new Date(message.createdAt).getTime();
  return elapsed <= CHAT_LIMITS.DELETE_WINDOW_MS;
};
