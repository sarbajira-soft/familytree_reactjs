const conversationListsByFamily = new Map();
const roomListsByFamily = new Map();
const conversationsById = new Map();
const messagesByConversationId = new Map();

const normalizeFamilyCode = (familyCode) =>
  String(familyCode || '').trim().toUpperCase();

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

const upsertConversationListEntry = (list = [], conversation = {}) => {
  const nextConversation = cloneConversation(conversation);
  const nextList = cloneConversations(list);
  const existingIndex = nextList.findIndex(
    (entry) => Number(entry?.id || 0) === Number(nextConversation?.id || 0),
  );

  if (existingIndex >= 0) {
    nextList[existingIndex] = mergeConversation(
      nextList[existingIndex],
      nextConversation,
    );
  } else {
    nextList.unshift(nextConversation);
  }

  return sortConversations(nextList);
};

const setConversationDetailInternal = (conversation = {}) => {
  const conversationId = Number(conversation?.id || 0);
  if (!conversationId) return;

  const current = conversationsById.get(conversationId) || {};
  conversationsById.set(conversationId, mergeConversation(current, conversation));
};

const getListMap = (isRoom = false) =>
  isRoom ? roomListsByFamily : conversationListsByFamily;

export const clearChatCache = () => {
  conversationListsByFamily.clear();
  roomListsByFamily.clear();
  conversationsById.clear();
  messagesByConversationId.clear();
};

export const getCachedConversations = (familyCode) => {
  const key = normalizeFamilyCode(familyCode);
  return cloneConversations(conversationListsByFamily.get(key) || []);
};

export const cacheConversations = (familyCode, conversations = []) => {
  const key = normalizeFamilyCode(familyCode);
  const next = sortConversations(cloneConversations(conversations));
  conversationListsByFamily.set(key, next);
  next.forEach(setConversationDetailInternal);
  return cloneConversations(next);
};

export const getCachedRooms = (familyCode) => {
  const key = normalizeFamilyCode(familyCode);
  return cloneConversations(roomListsByFamily.get(key) || []);
};

export const cacheRooms = (familyCode, rooms = []) => {
  const key = normalizeFamilyCode(familyCode);
  const next = sortConversations(cloneConversations(rooms));
  roomListsByFamily.set(key, next);
  next.forEach(setConversationDetailInternal);
  return cloneConversations(next);
};

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

  setConversationDetailInternal(conversation);
  const mergedConversation = conversationsById.get(conversationId);
  const familyCode = normalizeFamilyCode(mergedConversation?.familyCode);
  const isRoomConversation = Boolean(
    mergedConversation?.roomId || mergedConversation?.roomType || mergedConversation?.type === 'group',
  );

  if (familyCode) {
    const listMap = getListMap(isRoomConversation);
    const currentList = listMap.get(familyCode) || [];
    listMap.set(
      familyCode,
      upsertConversationListEntry(currentList, mergedConversation),
    );
  }

  return cloneConversation(mergedConversation);
};

export const removeCachedConversation = (conversationId, familyCode = '') => {
  const key = Number(conversationId || 0);
  if (!key) {
    return;
  }

  const cachedConversation = conversationsById.get(key) || {};
  const normalizedFamilyCode = normalizeFamilyCode(
    familyCode || cachedConversation?.familyCode,
  );

  if (normalizedFamilyCode) {
    const nextConversationList = cloneConversations(
      conversationListsByFamily.get(normalizedFamilyCode) || [],
    ).filter((entry) => Number(entry?.id || 0) !== key);
    const nextRoomList = cloneConversations(
      roomListsByFamily.get(normalizedFamilyCode) || [],
    ).filter((entry) => Number(entry?.id || 0) !== key);
    conversationListsByFamily.set(normalizedFamilyCode, nextConversationList);
    roomListsByFamily.set(normalizedFamilyCode, nextRoomList);
  }

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

  const conversation = getCachedConversation(conversationId) || {
    id: Number(conversationId || 0),
    familyCode: normalizeFamilyCode(familyCode),
  };

  const nextConversation = {
    ...conversation,
    familyCode: conversation.familyCode || normalizeFamilyCode(familyCode),
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
          : Number(conversation?.unreadCount || 0),
  };

  return cacheConversation(nextConversation);
};

export const markCachedConversationRead = (familyCode, conversationId) => {
  const conversation = getCachedConversation(conversationId);
  if (!conversation) return null;

  return cacheConversation({
    ...conversation,
    familyCode: conversation.familyCode || normalizeFamilyCode(familyCode),
    unreadCount: 0,
  });
};
