import { authFetchResponse } from '../utils/authFetch';
import {
  CHAT_API_ENDPOINTS,
  CHAT_LIMITS,
  CHAT_SOCKET_EVENTS,
  CONVERSATION_STATES,
  MESSAGE_TYPES,
  ROOM_TYPES,
} from '../constants/chat.constants';

const minute = 60 * 1000;
const hour = 60 * minute;
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const CHAT_SOCKET_ACK_TIMEOUT_MS = 10000;

const normalizeFamilyCode = (familyCode) =>
  String(familyCode || '').trim().toUpperCase();

const normalizeMembershipType = (value) =>
  String(value || 'member').trim().toLowerCase();

const normalizeRelationshipLabel = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'family' || normalized === 'linked' || normalized === 'associated') {
    return normalized;
  }
  return '';
};

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

const createSocketRequestError = (message, status = 500) => {
  const error = new Error(message);
  error.status = Number(status || 500);
  return error;
};

const normalizeSocketActionLabel = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\b(a|an|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const unwrapSocketGatewayResponse = (response, fallbackEventName = '') => {
  if (
    response &&
    typeof response === 'object' &&
    typeof response?.event === 'string' &&
    Object.prototype.hasOwnProperty.call(response, 'data')
  ) {
    return {
      eventName: String(response.event || '').trim(),
      payload: response.data,
    };
  }

  return {
    eventName: fallbackEventName,
    payload: response,
  };
};

export const emitChatSocketEvent = async (
  socket,
  eventName,
  successEventName,
  payload,
  actionLabel = 'complete chat action',
  matcher = null,
  fallbackSuccessEventNames = [],
) => {
  if (!socket?.connected) {
    throw createSocketRequestError('Chat socket is not connected', 503);
  }

  return new Promise((resolve, reject) => {
    const clientRequestId =
      String(payload?.clientRequestId || '').trim() ||
      `${eventName}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
    const payloadWithRequestId = {
      ...(payload || {}),
      clientRequestId,
    };
    const normalizedActionLabel = normalizeSocketActionLabel(actionLabel);
    const matchesPayload =
      typeof matcher === 'function' ? matcher : () => true;
    const normalizedFallbackSuccessEventNames = Array.from(
      new Set(
        (Array.isArray(fallbackSuccessEventNames)
          ? fallbackSuccessEventNames
          : [fallbackSuccessEventNames]
        )
          .map((name) => String(name || '').trim())
          .filter(Boolean),
      ),
    );
    const fallbackSuccessHandlers = new Map();
    let settled = false;

    const resolveIfMatchingSuccess = (
      response,
      expectedEventName = successEventName,
      options = {},
    ) => {
      const requireClientRequestId = Boolean(options?.requireClientRequestId);
      const { eventName, payload } = unwrapSocketGatewayResponse(
        response,
        expectedEventName,
      );
      if (eventName && eventName !== expectedEventName) {
        return false;
      }
      if (
        requireClientRequestId &&
        String(payload?.clientRequestId || '').trim() !== clientRequestId
      ) {
        return false;
      }
      if (
        payload?.clientRequestId &&
        String(payload.clientRequestId) !== clientRequestId
      ) {
        return false;
      }
      if (!matchesPayload(payload)) {
        return false;
      }

      settled = true;
      cleanup();
      resolve(payload);
      return true;
    };

    const rejectIfMatchingError = (response) => {
      const { eventName, payload } = unwrapSocketGatewayResponse(
        response,
        CHAT_SOCKET_EVENTS.CHAT_ERROR,
      );
      if (eventName && eventName !== CHAT_SOCKET_EVENTS.CHAT_ERROR) {
        return false;
      }
      const errorClientRequestId = String(payload?.clientRequestId || '').trim();
      if (errorClientRequestId) {
        if (errorClientRequestId !== clientRequestId) {
          return false;
        }
      } else {
        const errorAction = normalizeSocketActionLabel(payload?.action);
        if (errorAction && errorAction !== normalizedActionLabel) {
          return false;
        }
      }

      settled = true;
      cleanup();
      reject(
        createSocketRequestError(
          payload?.message || `Unable to ${actionLabel}`,
          payload?.status || 500,
        ),
      );
      return true;
    };

    const cleanup = () => {
      clearTimeout(timeoutId);
      socket.off(successEventName, handleSuccess);
      socket.off(CHAT_SOCKET_EVENTS.CHAT_ERROR, handleError);
      fallbackSuccessHandlers.forEach((handler, fallbackEventName) => {
        socket.off(fallbackEventName, handler);
      });
    };

    const handleSuccess = (response) => {
      resolveIfMatchingSuccess(response);
    };

    const createFallbackSuccessHandler = (fallbackEventName) => (response) => {
      resolveIfMatchingSuccess(response, fallbackEventName, {
        requireClientRequestId: true,
      });
    };

    const handleError = (response) => {
      rejectIfMatchingError(response);
    };

    const handleAck = (response) => {
      if (settled) {
        return;
      }

      if (rejectIfMatchingError(response)) {
        return;
      }

      resolveIfMatchingSuccess(response);
    };

    const timeoutId = setTimeout(() => {
      if (settled) {
        return;
      }

      cleanup();
      reject(
        createSocketRequestError(
          `Chat socket timed out while trying to ${actionLabel}`,
          504,
        ),
      );
    }, CHAT_SOCKET_ACK_TIMEOUT_MS);

    socket.on(successEventName, handleSuccess);
    socket.on(CHAT_SOCKET_EVENTS.CHAT_ERROR, handleError);
    normalizedFallbackSuccessEventNames.forEach((fallbackEventName) => {
      const handler = createFallbackSuccessHandler(fallbackEventName);
      fallbackSuccessHandlers.set(fallbackEventName, handler);
      socket.on(fallbackEventName, handler);
    });
    socket.emit(eventName, payloadWithRequestId, handleAck);
  });
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
  isOnline: Boolean(participant?.isOnline),
  lastSeenAt: participant?.lastSeenAt || null,
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
  const firstName = member?.firstName || profile?.firstName || '';
  const lastName = member?.lastName || profile?.lastName || '';
  const name =
    String(member?.name || user?.fullName || '').trim() ||
    [firstName, lastName].filter(Boolean).join(' ').trim() ||
    'Family Member';
  const relationshipLabel = normalizeRelationshipLabel(
    member?.relationshipLabel || member?.membershipType,
  );
  const membershipType =
    member?.membershipType ||
    (relationshipLabel === 'family' ? 'member' : relationshipLabel || 'member');

  return {
    id: Number(member?.id || userId || 0),
    userId,
    firstName,
    lastName,
    name,
    profileUrl: resolveChatAssetUrl(
      member?.profileUrl || user?.profileImage || profile?.profile || '',
    ),
    familyRole: member?.familyRole || 'Member',
    isFamilyAdmin: Boolean(member?.isFamilyAdmin),
    isAppUser:
      typeof member?.isAppUser === 'boolean' ? member.isAppUser : Boolean(user?.isAppUser),
    userStatus: Number(member?.userStatus || user?.status || 0),
    membershipType,
    relationshipLabel: relationshipLabel || (membershipType === 'member' ? 'family' : membershipType),
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
  relationshipLabel: normalizeRelationshipLabel(
    conversation?.relationshipLabel || conversation?.relationship,
  ),
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

const normalizeMessageResponse = (payload) => payload?.data || payload || null;

export const getReachableContacts = async () => {
  const response = await authFetchResponse(CHAT_API_ENDPOINTS.contacts, {
    method: 'GET',
  });
  const json = await parseJson(response);
  const contacts = getNestedArray(json, 'contacts')
    .map((contact) => normalizeFamilyMember(contact))
    .filter(
      (contact) =>
        contact.userId > 0 && contact.isAppUser && Number(contact.userStatus || 0) === 1,
    );

  return {
    contacts,
    familyContacts: contacts.filter(
      (contact) => normalizeRelationshipLabel(contact?.relationshipLabel) === 'family',
    ),
    linkedContacts: contacts.filter(
      (contact) => normalizeRelationshipLabel(contact?.relationshipLabel) === 'linked',
    ),
    associatedContacts: contacts.filter(
      (contact) => normalizeRelationshipLabel(contact?.relationshipLabel) === 'associated',
    ),
  };
};

export const createConversation = async (familyCodeOrParticipantUserId, maybeParticipantUserId) => {
  const hasLegacyFamilyScopeArg = typeof familyCodeOrParticipantUserId === 'string';
  const normalizedFamilyCode = hasLegacyFamilyScopeArg
    ? normalizeFamilyCode(familyCodeOrParticipantUserId)
    : '';
  const participantUserId = Number(
    hasLegacyFamilyScopeArg ? maybeParticipantUserId : familyCodeOrParticipantUserId,
  );
  const response = await authFetchResponse(CHAT_API_ENDPOINTS.conversations, {
    method: 'POST',
    body: JSON.stringify({
      ...(normalizedFamilyCode ? { familyCode: normalizedFamilyCode } : {}),
      participantUserId,
    }),
  });
  const json = await parseJson(response);
  return normalizeConversation(json?.data || json || {});
};

export const getConversations = async () => {
  const response = await authFetchResponse(CHAT_API_ENDPOINTS.conversations, {
    method: 'GET',
  });
  const json = await parseJson(response);
  return {
    conversations: getNestedArray(json, 'conversations').map(normalizeConversation),
  };
};

export const getRooms = async () => {
  const response = await authFetchResponse(CHAT_API_ENDPOINTS.rooms, {
    method: 'GET',
  });
  const json = await parseJson(response);
  return {
    rooms: getNestedArray(json, 'rooms').map(normalizeConversation),
  };
};

export const getConversation = async (conversationId) => {
  const response = await authFetchResponse(CHAT_API_ENDPOINTS.conversation(conversationId), {
    method: 'GET',
  });
  const json = await parseJson(response);
  return normalizeConversation(json?.data || json || {});
};

export const getFamilyMembersForChat = async () => getReachableContacts();

export const getMessages = async (conversationId, cursor) => {
  const params = new URLSearchParams();
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
  const json = await parseJson(response);
  return normalizeMessageResponse(json);
};

export const sendTextMessageSocket = async (
  socket,
  conversationId,
  familyCode,
  content,
  options = {},
) => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'send a message',
  );
  return emitChatSocketEvent(
    socket,
    CHAT_SOCKET_EVENTS.SEND_MESSAGE,
    'message-sent',
    {
      conversationId: Number(conversationId),
      familyCode: normalizedFamilyCode,
      content,
      clientRequestId: options?.clientRequestId || undefined,
      replyToId: options?.replyTo?.id || options?.replyToId || null,
      mentionedUserIds: options?.mentionedUserIds || [],
    },
    'send a message',
    (response) => Number(response?.conversationId || 0) === Number(conversationId || 0),
    [CHAT_SOCKET_EVENTS.NEW_MESSAGE],
  );
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
  const json = await parseJson(response);
  return normalizeMessageResponse(json);
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

export const markConversationReadSocket = async (
  socket,
  conversationId,
  familyCode,
  readAt = null,
) => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'mark a conversation as read',
  );
  return emitChatSocketEvent(
    socket,
    CHAT_SOCKET_EVENTS.MARK_READ,
    'marked-read',
    {
      conversationId: Number(conversationId),
      familyCode: normalizedFamilyCode,
      ...(readAt ? { readAt } : {}),
    },
    'mark a conversation as read',
    (response) => Number(response?.conversationId || 0) === Number(conversationId || 0),
  );
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

export const deleteMessageSocket = async (socket, messageId, familyCode) => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'delete a message',
  );
  return emitChatSocketEvent(
    socket,
    CHAT_SOCKET_EVENTS.DELETE_MESSAGE,
    'message-delete-confirmed',
    {
      messageId: Number(messageId),
      familyCode: normalizedFamilyCode,
    },
    'delete a message',
    (response) => Number(response?.messageId || 0) === Number(messageId || 0),
  );
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

export const toggleMuteSocket = async (socket, conversationId, familyCode, isMuted) => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'change mute settings',
  );
  return emitChatSocketEvent(
    socket,
    CHAT_SOCKET_EVENTS.TOGGLE_MUTE,
    'mute-updated',
    {
      conversationId: Number(conversationId),
      familyCode: normalizedFamilyCode,
      isMuted: !Boolean(isMuted),
    },
    'change mute settings',
    (response) => Number(response?.conversationId || 0) === Number(conversationId || 0),
  );
};

export const deleteConversation = async (conversationId, familyCode) => {
  return hideConversation(conversationId, familyCode);
};

export const hideConversation = async (conversationId, familyCode) => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'delete a conversation',
  );
  const response = await authFetchResponse(CHAT_API_ENDPOINTS.hideConversation(conversationId), {
    method: 'POST',
    body: JSON.stringify({
      familyCode: normalizedFamilyCode,
    }),
  });
  const json = await parseJson(response);
  return json?.data || json || { success: true };
};

export const deleteConversationSocket = async (socket, conversationId, familyCode) => {
  return emitChatSocketEvent(
    socket,
    CHAT_SOCKET_EVENTS.DELETE_CONVERSATION,
    'conversation-delete-confirmed',
    {
      conversationId: Number(conversationId),
      familyCode: requireFamilyCode(
        familyCode,
        'delete a conversation',
      ),
    },
    'delete a conversation',
    (response) => Number(response?.conversationId || 0) === Number(conversationId || 0),
    [CHAT_SOCKET_EVENTS.CONVERSATION_HIDDEN],
  );
};

export const hideConversationSocket = async (socket, conversationId, familyCode) => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'delete a conversation',
  );
  return emitChatSocketEvent(
    socket,
    CHAT_SOCKET_EVENTS.HIDE_CONVERSATION,
    CHAT_SOCKET_EVENTS.CONVERSATION_HIDDEN,
    {
      conversationId: Number(conversationId),
      familyCode: normalizedFamilyCode,
    },
    'delete a conversation',
    (response) => Number(response?.conversationId || 0) === Number(conversationId || 0),
  );
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
    totalCount: Number(json?.totalCount ?? json?.data?.totalCount ?? json?.count ?? 0),
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

export const addMembersToRoomSocket = async (socket, roomId, familyCode, memberIds = []) => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'add members to a room',
  );
  const response = await emitChatSocketEvent(
    socket,
    CHAT_SOCKET_EVENTS.ADD_ROOM_MEMBERS,
    'room-members-added',
    {
      roomId: Number(roomId),
      familyCode: normalizedFamilyCode,
      memberIds,
    },
    'add members to a room',
    (conversation) => Number(conversation?.roomId || 0) === Number(roomId || 0),
  );
  return normalizeConversation(response || {});
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

export const removeMemberFromRoomSocket = async (socket, roomId, familyCode, memberId) => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'remove a member from a room',
  );
  const response = await emitChatSocketEvent(
    socket,
    CHAT_SOCKET_EVENTS.REMOVE_ROOM_MEMBER,
    'room-member-removed',
    {
      roomId: Number(roomId),
      familyCode: normalizedFamilyCode,
      memberId: Number(memberId),
    },
    'remove a member from a room',
    (conversation) => Number(conversation?.roomId || 0) === Number(roomId || 0),
  );
  return normalizeConversation(response || {});
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

export const leaveRoomConversationSocket = async (socket, roomId, familyCode) => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'leave a room',
  );
  return emitChatSocketEvent(
    socket,
    CHAT_SOCKET_EVENTS.LEAVE_ROOM,
    'room-left',
    {
      roomId: Number(roomId),
      familyCode: normalizedFamilyCode,
    },
    'leave a room',
    (response) => Number(response?.roomId || 0) === Number(roomId || 0),
  );
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

export const deleteRoomConversationSocket = async (socket, roomId, familyCode) => {
  const normalizedFamilyCode = requireFamilyCode(
    familyCode,
    'delete a room',
  );
  return emitChatSocketEvent(
    socket,
    CHAT_SOCKET_EVENTS.DELETE_ROOM,
    'room-delete-confirmed',
    {
      roomId: Number(roomId),
      familyCode: normalizedFamilyCode,
    },
    'delete a room',
    (response) => Number(response?.roomId || 0) === Number(roomId || 0),
  );
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
