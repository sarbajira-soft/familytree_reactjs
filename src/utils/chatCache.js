let conversationList = [];
let roomList = [];
const conversationsById = new Map();
const messagesByConversationId = new Map();

const cloneParticipant = (participant = {}) => ({
  ...participant,
});

const cloneReply = (reply = null) => {
  if (!reply || typeof reply !== 'object') {
    return reply ?? null;
  }

  return {
    ...reply,
  };
};

const cloneMessage = (message = {}) => ({
  ...message,
  replyTo: cloneReply(message?.replyTo),
  sharePayload:
    message?.sharePayload && typeof message.sharePayload === 'object'
      ? { ...message.sharePayload }
      : message?.sharePayload ?? null,
});

const cloneMessages = (messages = []) =>
  (Array.isArray(messages) ? messages : []).map(cloneMessage);

const cloneConversation = (conversation = {}) => ({
  ...conversation,
  participants: Array.isArray(conversation?.participants)
    ? conversation.participants.map(cloneParticipant)
    : [],
  lastMessage: conversation?.lastMessage
    ? {
        ...conversation.lastMessage,
      }
    : null,
  pinnedMessage: cloneReply(conversation?.pinnedMessage),
});

const cloneConversations = (conversations = []) =>
  (Array.isArray(conversations) ? conversations : []).map(cloneConversation);

const toTimestamp = (value) => {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
};

const sortMessages = (messages = []) =>
  [...messages].sort((left, right) => {
    const byDate = toTimestamp(left?.createdAt) - toTimestamp(right?.createdAt);
    if (byDate !== 0) {
      return byDate;
    }

    return Number(left?.id || 0) - Number(right?.id || 0);
  });

const sortConversations = (conversations = []) =>
  [...conversations].sort((left, right) => {
    const leftTs =
      toTimestamp(left?.lastMessage?.createdAt) ||
      toTimestamp(left?.updatedAt) ||
      toTimestamp(left?.createdAt);
    const rightTs =
      toTimestamp(right?.lastMessage?.createdAt) ||
      toTimestamp(right?.updatedAt) ||
      toTimestamp(right?.createdAt);

    return rightTs - leftTs;
  });

const mergeConversation = (current = {}, next = {}) => ({
  ...current,
  ...next,
  participants: Array.isArray(next?.participants)
    ? next.participants.map(cloneParticipant)
    : Array.isArray(current?.participants)
      ? current.participants.map(cloneParticipant)
      : [],
  lastMessage: next?.lastMessage
    ? { ...next.lastMessage }
    : current?.lastMessage
      ? { ...current.lastMessage }
      : null,
  pinnedMessage: next?.pinnedMessage
    ? cloneReply(next.pinnedMessage)
    : cloneReply(current?.pinnedMessage),
});

const isRoomConversation = (conversation = {}) =>
  Boolean(
    conversation?.roomId ||
      conversation?.roomType ||
      String(conversation?.type || '').trim().toLowerCase() === 'group',
  );

const setConversationDetailInternal = (conversation = {}) => {
  const conversationId = Number(conversation?.id || 0);
  if (!conversationId) {
    return;
  }

  const current = conversationsById.get(conversationId) || {};
  conversationsById.set(conversationId, mergeConversation(current, conversation));
};

const upsertListEntry = (list = [], conversation = {}) => {
  const nextConversation = cloneConversation(conversation);
  const nextList = cloneConversations(list);
  const existingIndex = nextList.findIndex(
    (entry) => Number(entry?.id || 0) === Number(nextConversation?.id || 0),
  );

  if (existingIndex >= 0) {
    nextList[existingIndex] = mergeConversation(nextList[existingIndex], nextConversation);
  } else {
    nextList.unshift(nextConversation);
  }

  return sortConversations(nextList);
};

const removeConversationFromList = (list = [], conversationId) =>
  cloneConversations(list).filter(
    (entry) => Number(entry?.id || 0) !== Number(conversationId || 0),
  );

const setListForConversationType = (isRoom, conversations = []) => {
  const nextList = sortConversations(cloneConversations(conversations));
  if (isRoom) {
    roomList = nextList;
  } else {
    conversationList = nextList;
  }
  nextList.forEach(setConversationDetailInternal);
  return cloneConversations(nextList);
};

export const clearChatCache = () => {
  conversationList = [];
  roomList = [];
  conversationsById.clear();
  messagesByConversationId.clear();
};

export const getCachedConversations = () => cloneConversations(conversationList);

export const cacheConversations = (_familyCode, conversations = []) =>
  setListForConversationType(false, conversations);

export const getCachedRooms = () => cloneConversations(roomList);

export const cacheRooms = (_familyCode, rooms = []) => setListForConversationType(true, rooms);

export const getCachedConversation = (conversationId) => {
  const key = Number(conversationId || 0);
  if (!key) return null;
  const conversation = conversationsById.get(key);
  return conversation ? cloneConversation(conversation) : null;
};

export const cacheConversation = (conversation = {}) => {
  const conversationId = Number(conversation?.id || 0);
  if (!conversationId) {
    return null;
  }

  const previousConversation = conversationsById.get(conversationId) || {};
  const previousWasRoomConversation = isRoomConversation(previousConversation);
  setConversationDetailInternal(conversation);
  const mergedConversation = conversationsById.get(conversationId);
  const nextIsRoomConversation = isRoomConversation(mergedConversation);

  if (nextIsRoomConversation) {
    roomList = upsertListEntry(roomList, mergedConversation);
    conversationList = removeConversationFromList(conversationList, conversationId);
  } else {
    conversationList = upsertListEntry(conversationList, mergedConversation);
    roomList = removeConversationFromList(roomList, conversationId);
  }

  if (previousWasRoomConversation !== nextIsRoomConversation) {
    if (previousWasRoomConversation) {
      roomList = removeConversationFromList(roomList, conversationId);
    } else {
      conversationList = removeConversationFromList(conversationList, conversationId);
    }
  }

  return cloneConversation(mergedConversation);
};

export const removeCachedConversation = (conversationId) => {
  const key = Number(conversationId || 0);
  if (!key) {
    return;
  }

  conversationList = removeConversationFromList(conversationList, key);
  roomList = removeConversationFromList(roomList, key);
  conversationsById.delete(key);
  messagesByConversationId.delete(key);
};

export const getCachedMessages = (conversationId) => {
  const key = Number(conversationId || 0);
  if (!key) return [];
  return cloneMessages(messagesByConversationId.get(key) || []);
};

export const cacheMessages = (conversationId, messages = []) => {
  const key = Number(conversationId || 0);
  if (!key) return [];
  const nextMessages = sortMessages(cloneMessages(messages));
  messagesByConversationId.set(key, nextMessages);
  return cloneMessages(nextMessages);
};

export const upsertCachedMessage = (conversationId, message = {}) => {
  const key = Number(conversationId || 0);
  if (!key || !message) return [];

  const currentMessages = messagesByConversationId.get(key) || [];
  const nextMessage = cloneMessage(message);
  const nextMessages = cloneMessages(currentMessages);
  const existingIndex = nextMessages.findIndex(
    (entry) => Number(entry?.id || 0) === Number(nextMessage?.id || 0),
  );

  if (existingIndex >= 0) {
    nextMessages[existingIndex] = {
      ...nextMessages[existingIndex],
      ...nextMessage,
      replyTo: cloneReply(nextMessage?.replyTo) ?? cloneReply(nextMessages[existingIndex]?.replyTo),
    };
  } else {
    nextMessages.push(nextMessage);
  }

  const sortedMessages = sortMessages(nextMessages);
  messagesByConversationId.set(key, sortedMessages);
  return cloneMessages(sortedMessages);
};

export const replaceCachedMessage = (conversationId, targetId, nextMessage = {}) => {
  const key = Number(conversationId || 0);
  if (!key) return [];

  const currentMessages = cloneMessages(messagesByConversationId.get(key) || []);
  const existingIndex = currentMessages.findIndex(
    (entry) => Number(entry?.id || 0) === Number(targetId || 0),
  );

  if (existingIndex >= 0) {
    currentMessages[existingIndex] = cloneMessage(nextMessage);
  } else {
    currentMessages.push(cloneMessage(nextMessage));
  }

  const sortedMessages = sortMessages(currentMessages);
  messagesByConversationId.set(key, sortedMessages);
  return cloneMessages(sortedMessages);
};

export const markCachedMessageFailed = (conversationId, messageId) => {
  const key = Number(conversationId || 0);
  if (!key) return [];

  const currentMessages = cloneMessages(messagesByConversationId.get(key) || []);
  const existingIndex = currentMessages.findIndex(
    (entry) => Number(entry?.id || 0) === Number(messageId || 0),
  );

  if (existingIndex < 0) {
    return cloneMessages(currentMessages);
  }

  currentMessages[existingIndex] = {
    ...currentMessages[existingIndex],
    sendStatus: 'failed',
  };

  messagesByConversationId.set(key, currentMessages);
  return cloneMessages(currentMessages);
};

export const cacheConversationMessage = (
  familyCode,
  conversationId,
  message,
  options = {},
) => {
  if (!message) return null;

  const hydratedConversation =
    options?.conversation && typeof options.conversation === 'object'
      ? cloneConversation(options.conversation)
      : null;
  const existingConversation = getCachedConversation(conversationId);
  const fallbackConversation =
    existingConversation ||
    hydratedConversation ||
    (message?.type || message?.roomId || message?.roomType
      ? {
          id: Number(conversationId || 0),
          familyCode: String(familyCode || '').trim().toUpperCase(),
          type: message?.type || 'direct',
          conversationType: message?.conversationType || null,
          roomId: Number(message?.roomId || 0) || null,
          roomType: message?.roomType || null,
          roomName: message?.roomName || null,
          roomAvatarUrl: message?.roomAvatarUrl || '',
          relationshipLabel: message?.relationshipLabel || null,
        }
      : null);

  if (!fallbackConversation) {
    return null;
  }

  const nextConversation = {
    ...fallbackConversation,
    familyCode:
      fallbackConversation.familyCode || String(familyCode || '').trim().toUpperCase(),
    type: fallbackConversation?.type || message?.type || 'direct',
    conversationType:
      fallbackConversation?.conversationType || message?.conversationType || null,
    roomId:
      Number(fallbackConversation?.roomId || 0) ||
      Number(message?.roomId || 0) ||
      null,
    roomType: fallbackConversation?.roomType || message?.roomType || null,
    roomName: fallbackConversation?.roomName || message?.roomName || null,
    roomAvatarUrl:
      fallbackConversation?.roomAvatarUrl || message?.roomAvatarUrl || '',
    relationshipLabel:
      fallbackConversation?.relationshipLabel || message?.relationshipLabel || null,
    lastMessage: {
      id: Number(message?.id || 0),
      content: message?.content || '',
      createdAt: message?.createdAt || new Date().toISOString(),
      senderId: Number(message?.senderId || 0),
      senderName: message?.senderName || '',
      messageType: message?.messageType || 'text',
      mediaUrl: message?.mediaUrl || '',
    },
    unreadCount:
      typeof options?.unreadCount === 'number'
        ? Number(options.unreadCount)
        : options?.clearUnread
          ? 0
          : Number(fallbackConversation?.unreadCount || 0),
  };

  return cacheConversation(nextConversation);
};

export const markCachedConversationRead = (...args) => {
  const conversationId =
    args.length > 1 ? Number(args[1] || 0) : Number(args[0] || 0);
  const conversation = getCachedConversation(conversationId);
  if (!conversation) return null;

  return cacheConversation({
    ...conversation,
    unreadCount: 0,
  });
};
