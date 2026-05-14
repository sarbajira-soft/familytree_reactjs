import React from 'react';
import { Categories } from 'emoji-picker-react';
import {
  CONVERSATION_TYPES,
  MESSAGE_TYPES,
} from '../../constants/chat.constants';

export const normalizeFamilyCode = (value) =>
  String(value || '').trim().toUpperCase();

export const toConversationType = (conversation) =>
  conversation?.type === CONVERSATION_TYPES.GROUP ||
  conversation?.roomId ||
  conversation?.roomType
    ? CONVERSATION_TYPES.GROUP
    : CONVERSATION_TYPES.DIRECT;

export const isSameConversation = (left, right) =>
  Number(left || 0) === Number(right || 0);

export const isUnavailableConversationError = (error) => {
  const status = Number(error?.status || 0);
  return status === 403 || status === 404;
};

export const getMessageReplyPreview = (message) => {
  const messageId = Number(message?.id || 0);
  if (!messageId) {
    return null;
  }

  return {
    id: messageId,
    content: message?.content || '',
    senderName: message?.senderName || '',
  };
};

export const getMessageReplyId = (message) =>
  Number(message?.replyTo?.id || message?.replyToId || 0) || null;

export const createOptimisticTextMessage = ({
  id,
  conversationId,
  clientRequestId,
  senderId,
  senderName,
  senderAvatar,
  content,
  createdAt,
  replyTo,
}) => ({
  id: Number(id || 0),
  conversationId: Number(conversationId || 0),
  senderId: Number(senderId || 0),
  senderName: senderName || 'You',
  senderAvatar: senderAvatar || '',
  content,
  createdAt,
  updatedAt: createdAt,
  messageType: MESSAGE_TYPES.TEXT,
  mediaUrl: '',
  isDeleted: false,
  deletedAt: null,
  deliveredAt: null,
  readAt: null,
  clientRequestId: clientRequestId || '',
  replyTo: replyTo || null,
  sendStatus: 'sending',
});

export const getComposerAttachmentKind = (file) => {
  const mimeType = String(file?.type || '').toLowerCase();
  if (mimeType.startsWith('audio/')) {
    return MESSAGE_TYPES.VOICE;
  }
  if (mimeType.startsWith('image/')) {
    return MESSAGE_TYPES.IMAGE;
  }
  return 'attachment';
};

export const createComposerAttachmentDraft = (file) => {
  if (!file) {
    return null;
  }

  const previewKind = getComposerAttachmentKind(file);
  return {
    file,
    name: String(file?.name || 'Attachment'),
    size: Number(file?.size || 0),
    mimeType: String(file?.type || ''),
    previewKind,
    previewUrl:
      previewKind === MESSAGE_TYPES.IMAGE || previewKind === MESSAGE_TYPES.VOICE
        ? URL.createObjectURL(file)
        : '',
  };
};

export const revokeObjectUrl = (value) => {
  if (typeof window === 'undefined') {
    return;
  }

  const objectUrl = String(value || '');
  if (objectUrl.startsWith('blob:')) {
    window.URL.revokeObjectURL(objectUrl);
  }
};

export const createOptimisticMediaMessage = ({
  id,
  conversationId,
  senderId,
  senderName,
  senderAvatar,
  content,
  createdAt,
  replyTo,
  messageType,
  mediaUrl,
  mediaMimeType,
  mediaSize,
  attachmentName,
}) => ({
  id: Number(id || 0),
  conversationId: Number(conversationId || 0),
  senderId: Number(senderId || 0),
  senderName: senderName || 'You',
  senderAvatar: senderAvatar || '',
  content,
  createdAt,
  updatedAt: createdAt,
  messageType: messageType || MESSAGE_TYPES.IMAGE,
  mediaUrl: mediaUrl || '',
  mediaMimeType: mediaMimeType || '',
  mediaSize: Number(mediaSize || 0),
  attachmentName: attachmentName || '',
  isDeleted: false,
  deletedAt: null,
  deliveredAt: null,
  readAt: null,
  replyTo: replyTo || null,
  sendStatus: 'sending',
});

export const resizeComposer = (element) => {
  if (!element) return;
  element.style.height = 'auto';
  element.style.height = `${Math.min(element.scrollHeight, 100)}px`;
};

export const markMessageDeleted = (messages = [], messageId) =>
  (Array.isArray(messages) ? messages : []).map((message) =>
    Number(message?.id || 0) === Number(messageId || 0)
      ? {
          ...message,
          content: null,
          isDeleted: true,
          deletedAt: message?.deletedAt || new Date().toISOString(),
        }
      : message,
  );

export const applyReadReceipt = (messages = [], currentUserId, readerUserId, readAt) => {
  if (Number(readerUserId || 0) === Number(currentUserId || 0)) {
    return Array.isArray(messages) ? messages : [];
  }

  const readAtTs = new Date(readAt || 0).getTime();
  return (Array.isArray(messages) ? messages : []).map((message) => {
    const messageTs = new Date(message?.createdAt || 0).getTime();
    if (
      Number(message?.senderId || 0) === Number(currentUserId || 0) &&
      messageTs <= readAtTs
    ) {
      return {
        ...message,
        readAt,
      };
    }

    return message;
  });
};

export const applyDeliveryReceipt = (messages = [], messageId, deliveredAt) =>
  (Array.isArray(messages) ? messages : []).map((message) =>
    Number(message?.id || 0) === Number(messageId || 0)
      ? {
          ...message,
          deliveredAt: deliveredAt || message?.deliveredAt || null,
        }
      : message,
  );

export const buildTypingUserLabel = (names = []) => {
  const uniqueNames = Array.from(
    new Set(
      names
        .map((name) => String(name || '').trim())
        .filter(Boolean),
    ),
  );

  if (uniqueNames.length === 0) {
    return 'Member';
  }

  if (uniqueNames.length === 1) {
    return uniqueNames[0];
  }

  if (uniqueNames.length === 2) {
    return `${uniqueNames[0]} and ${uniqueNames[1]}`;
  }

  return `${uniqueNames[0]} and ${uniqueNames.length - 1} others`;
};

export const getMessageSearchText = (message = {}) =>
  [message?.content, message?.replyTo?.content, message?.senderName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

export const renderHighlightedText = (text, query, isActive = false) => {
  const content = String(text || '');
  const needle = String(query || '').trim();
  if (!content || !needle) {
    return content;
  }

  const normalizedContent = content.toLowerCase();
  const normalizedNeedle = needle.toLowerCase();
  const firstMatchIndex = normalizedContent.indexOf(normalizedNeedle);
  if (firstMatchIndex === -1) {
    return content;
  }

  const fragments = [];
  let cursor = 0;
  let matchIndex = firstMatchIndex;
  let fragmentKey = 0;

  while (matchIndex !== -1) {
    if (matchIndex > cursor) {
      fragments.push(
        React.createElement(
          React.Fragment,
          { key: `text-${fragmentKey}` },
          content.slice(cursor, matchIndex),
        ),
      );
      fragmentKey += 1;
    }

    fragments.push(
      React.createElement(
        'mark',
        {
          className: `chat-search-highlight${isActive ? ' chat-search-highlight--active' : ''}`,
          key: `mark-${fragmentKey}`,
        },
        content.slice(matchIndex, matchIndex + normalizedNeedle.length),
      ),
    );
    fragmentKey += 1;
    cursor = matchIndex + normalizedNeedle.length;
    matchIndex = normalizedContent.indexOf(normalizedNeedle, cursor);
  }

  if (cursor < content.length) {
    fragments.push(
      React.createElement(
        React.Fragment,
        { key: `text-${fragmentKey}` },
        content.slice(cursor),
      ),
    );
  }

  return fragments;
};

export const formatInfoDateTime = (value) => {
  if (!value) {
    return 'Not available yet';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Not available yet';
  }

  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export const getRoomTypeLabel = (roomType) => {
  switch (String(roomType || '').trim().toLowerCase()) {
    case 'general':
      return 'General room';
    case 'announcements':
      return 'Announcements room';
    case 'event':
      return 'Event room';
    case 'custom':
      return 'Custom room';
    default:
      return 'Group room';
  }
};

export const getConversationInfoDescription = (conversation, familyName) => {
  const roomType = String(conversation?.roomType || '').trim().toLowerCase();
  const resolvedFamilyName = familyName || 'this family';

  if (conversation?.conversationType === 'archived') {
    return `Archived room history preserved for ${resolvedFamilyName}. New messages are disabled.`;
  }

  if (roomType === 'announcements') {
    return `Announcements for ${resolvedFamilyName}. Only family admins can post here.`;
  }

  if (roomType === 'general') {
    return `General room for everyone in ${resolvedFamilyName}.`;
  }

  if (roomType === 'event') {
    return `Event discussion room inside ${resolvedFamilyName}.`;
  }

  if (roomType === 'custom') {
    return `Private room created for selected members in ${resolvedFamilyName}.`;
  }

  return `Direct conversation inside ${resolvedFamilyName}.`;
};

export const getRoomDisplayName = (conversation = {}) => {
  const roomName = String(conversation?.roomName || '').trim();
  if (roomName) {
    return roomName;
  }

  switch (String(conversation?.roomType || '').trim().toLowerCase()) {
    case 'general':
      return 'General';
    case 'announcements':
      return 'Announcements';
    case 'event':
      return 'Event';
    case 'custom':
      return 'Custom room';
    default:
      return 'Room';
  }
};

export const EMOJI_PICKER_CATEGORIES = [
  Categories.SMILEYS_PEOPLE,
  Categories.ANIMALS_NATURE,
  Categories.FOOD_DRINK,
  Categories.TRAVEL_PLACES,
  Categories.ACTIVITIES,
  Categories.OBJECTS,
  Categories.SYMBOLS,
  Categories.FLAGS,
];

export const getReceiptState = (message) => {
  if (!message || message?.isDeleted) {
    return null;
  }

  if (message?.sendStatus === 'failed') {
    return 'failed';
  }

  if (message?.sendStatus === 'sending') {
    return 'sending';
  }

  if (message?.readAt) {
    return 'seen';
  }

  if (message?.deliveredAt) {
    return 'delivered';
  }

  return 'sent';
};
