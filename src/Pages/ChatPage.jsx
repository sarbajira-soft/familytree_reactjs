import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import EmojiPicker, {
  Categories,
  EmojiStyle,
  Theme,
} from 'emoji-picker-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiCamera,
  FiChevronDown,
  FiChevronUp,
  FiCornerUpLeft,
  FiEdit2,
  FiLogOut,
  FiMessageCircle,
  FiMoreVertical,
  FiPaperclip,
  FiPlus,
  FiSearch,
  FiSend,
  FiSmile,
  FiTrash2,
  FiUsers,
  FiVolume2,
  FiVolumeX,
  FiX,
} from 'react-icons/fi';
import { useUser } from '../Contexts/UserContext';
import { useChat } from '../Contexts/ChatContext';
import TypingIndicator from '../Components/Chat/TypingIndicator';
import VoiceRecorder from '../Components/Chat/VoiceRecorder';
import ReportMessageModal from '../Components/Chat/ReportMessageModal';
import ChatRoomMembersModal from '../Components/Chat/ChatRoomMembersModal';
import ChatPickerModal from '../Components/Chat/ChatPickerModal';
import ChatStateBanner from '../Components/Chat/ChatStateBanner';
import {
  CHAT_LIMITS,
  CHAT_SOCKET_EVENTS,
  CONVERSATION_STATES,
  CONVERSATION_TYPES,
  MESSAGE_TYPES,
} from '../constants/chat.constants';
import {
  addMembersToRoom,
  createConversation,
  createRoomConversation,
  deleteConversation as deleteConversationRequest,
  deleteMessage as deleteMsg,
  deleteRoomConversation,
  formatDateSeparator,
  getChatMemberBadges,
  getChatMemberMetaText,
  formatFullTime,
  formatMessageTime,
  getConversation,
  getConversations,
  getFamilyMembersForChat,
  getInitials,
  getMessagePreviewText,
  getMessages,
  getRoomIcon,
  getRooms,
  leaveRoomConversation,
  markConversationRead,
  removeMemberFromRoom,
  sendMediaMessage,
  sendTextMessage,
  toggleMute,
  updateRoomConversation,
} from '../services/chat.service';
import {
  cacheConversation,
  cacheConversationMessage,
  cacheConversations,
  cacheMessages,
  cacheRooms,
  getCachedConversation,
  getCachedConversations,
  getCachedMessages,
  getCachedRooms,
  markCachedConversationRead,
  markCachedMessageFailed,
  removeCachedConversation,
  replaceCachedMessage,
  upsertCachedMessage,
} from '../utils/chatCache';
import '../Components/Chat/chat.css';

const normalizeFamilyCode = (value) =>
  String(value || '').trim().toUpperCase();

const toConversationType = (conversation) =>
  conversation?.type === CONVERSATION_TYPES.GROUP ||
    conversation?.roomId ||
    conversation?.roomType
    ? CONVERSATION_TYPES.GROUP
    : CONVERSATION_TYPES.DIRECT;

const isSameConversation = (left, right) =>
  Number(left || 0) === Number(right || 0);

const isUnavailableConversationError = (error) => {
  const status = Number(error?.status || 0);
  return status === 403 || status === 404;
};

const getMessageReplyPreview = (message) => {
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

const getMessageReplyId = (message) => Number(message?.replyTo?.id || message?.replyToId || 0) || null;

const createOptimisticTextMessage = ({
  id,
  conversationId,
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
  readAt: null,
  replyTo: replyTo || null,
  sendStatus: 'sending',
});

const getComposerAttachmentKind = (file) => {
  const mimeType = String(file?.type || '').toLowerCase();
  if (mimeType.startsWith('audio/')) {
    return MESSAGE_TYPES.VOICE;
  }
  if (mimeType.startsWith('image/')) {
    return MESSAGE_TYPES.IMAGE;
  }
  return 'attachment';
};

const createComposerAttachmentDraft = (file) => {
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

const revokeObjectUrl = (value) => {
  if (typeof window === 'undefined') {
    return;
  }

  const objectUrl = String(value || '');
  if (objectUrl.startsWith('blob:')) {
    window.URL.revokeObjectURL(objectUrl);
  }
};

const createOptimisticMediaMessage = ({
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
  readAt: null,
  replyTo: replyTo || null,
  sendStatus: 'sending',
});

const resizeComposer = (element) => {
  if (!element) return;
  element.style.height = 'auto';
  element.style.height = `${Math.min(element.scrollHeight, 100)}px`;
};

const markMessageDeleted = (messages = [], messageId) =>
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

const applyReadReceipt = (messages = [], currentUserId, readerUserId, readAt) => {
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

const buildTypingUserLabel = (names = []) => {
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

const getMessageSearchText = (message = {}) =>
  [message?.content, message?.replyTo?.content, message?.senderName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const renderHighlightedText = (text, query, isActive = false) => {
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
        <React.Fragment key={`text-${fragmentKey}`}>
          {content.slice(cursor, matchIndex)}
        </React.Fragment>,
      );
      fragmentKey += 1;
    }

    fragments.push(
      <mark
        className={`chat-search-highlight${isActive ? ' chat-search-highlight--active' : ''
          }`}
        key={`mark-${fragmentKey}`}
      >
        {content.slice(matchIndex, matchIndex + normalizedNeedle.length)}
      </mark>,
    );
    fragmentKey += 1;
    cursor = matchIndex + normalizedNeedle.length;
    matchIndex = normalizedContent.indexOf(normalizedNeedle, cursor);
  }

  if (cursor < content.length) {
    fragments.push(
      <React.Fragment key={`text-${fragmentKey}`}>
        {content.slice(cursor)}
      </React.Fragment>,
    );
  }

  return fragments;
};

const formatInfoDateTime = (value) => {
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

const getRoomTypeLabel = (roomType) => {
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

const getConversationInfoDescription = (conversation, familyName) => {
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

const getRoomDisplayName = (conversation = {}) => {
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

const EMOJI_PICKER_CATEGORIES = [
  Categories.SMILEYS_PEOPLE,
  Categories.ANIMALS_NATURE,
  Categories.FOOD_DRINK,
  Categories.TRAVEL_PLACES,
  Categories.ACTIVITIES,
  Categories.OBJECTS,
  Categories.SYMBOLS,
  Categories.FLAGS,
];

const getReceiptState = (message) => {
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

  return 'delivered';
};

const ChatPage = () => {
  const navigate = useNavigate();
  const { conversationId: routeConversationId } = useParams();
  const [searchParams] = useSearchParams();
  const { userInfo } = useUser();
  const {
    activeFamilyCode,
    families,
    isChatConnected,
    joinConversation,
    leaveConversation,
    emitTyping,
    setActiveFamilyCode,
    socket,
  } = useChat();

  const currentUserId = userInfo?.userId || 0;
  const currentUserDisplayName = useMemo(
    () =>
      [userInfo?.firstName, userInfo?.lastName].filter(Boolean).join(' ').trim() ||
      String(userInfo?.name || '').trim() ||
      'You',
    [userInfo],
  );
  const currentUserAvatarUrl = useMemo(
    () => String(userInfo?.profileUrl || userInfo?.profile || '').trim(),
    [userInfo],
  );
  const hasFamilyScope = Boolean(activeFamilyCode);
  const routeFamilyCode = normalizeFamilyCode(searchParams.get('familyCode'));
  const routeConversationIdNumber = Number(routeConversationId || 0) || null;

  const [activeTab, setActiveTab] = useState('messages');
  const [conversations, setConversations] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [messagesListLoading, setMessagesListLoading] = useState(true);
  const [roomsListLoading, setRoomsListLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [resolvedConversationId, setResolvedConversationId] = useState(null);
  const [selectedType, setSelectedType] = useState(CONVERSATION_TYPES.DIRECT);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [attachmentDraft, setAttachmentDraft] = useState(null);
  const [reportMsg, setReportMsg] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [text, setText] = useState('');
  const [showComposerPicker, setShowComposerPicker] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );
  const [sendingMedia, setSendingMedia] = useState(false);
  const [typingUserIds, setTypingUserIds] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [roomMembersOpen, setRoomMembersOpen] = useState(false);
  const [selectedRoomMemberIds, setSelectedRoomMemberIds] = useState([]);
  const [roomMembersSubmitting, setRoomMembersSubmitting] = useState(false);
  const [roomMembersError, setRoomMembersError] = useState('');
  const [roomPhotoUploading, setRoomPhotoUploading] = useState(false);
  const [leavingRoom, setLeavingRoom] = useState(false);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [activeMessageSearchIndex, setActiveMessageSearchIndex] = useState(-1);
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [newConversationError, setNewConversationError] = useState('');
  const [newConversationSubmitting, setNewConversationSubmitting] = useState(false);
  const [newConversationMemberId, setNewConversationMemberId] = useState(null);
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [createRoomError, setCreateRoomError] = useState('');
  const [createRoomSubmitting, setCreateRoomSubmitting] = useState(false);
  const [createRoomName, setCreateRoomName] = useState('');
  const [createRoomMemberIds, setCreateRoomMemberIds] = useState([]);
  const [roomNameEditorOpen, setRoomNameEditorOpen] = useState(false);
  const [roomNameDraft, setRoomNameDraft] = useState('');
  const [roomNameError, setRoomNameError] = useState('');
  const [roomNameSubmitting, setRoomNameSubmitting] = useState(false);
  const listLoading = activeTab === 'messages' ? messagesListLoading : roomsListLoading;
  const hasAttachmentDraft = Boolean(attachmentDraft?.file);
  const hasComposerText = Boolean(String(text || '').trim());

  const messagesEndRef = useRef(null);
  const menuRef = useRef(null);
  const composerRef = useRef(null);
  const inputRef = useRef(null);
  const searchInputRef = useRef(null);
  const messageSearchInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const roomPhotoInputRef = useRef(null);
  const openRequestIdRef = useRef(0);
  const selectedConversationRef = useRef(null);
  const activeFamilyCodeRef = useRef(normalizeFamilyCode(activeFamilyCode));
  const conversationRef = useRef(null);
  const familyMembersFamilyCodeRef = useRef('');
  const localTypingRef = useRef(false);
  const localTypingTimeoutRef = useRef(null);
  const remoteTypingTimeoutsRef = useRef(new Map());
  const sendingMediaRef = useRef(false);
  const messageNodeRefs = useRef(new Map());
  const optimisticMessageIdRef = useRef(-1);
  const pendingTextMessagesRef = useRef(new Map());
  const pendingMediaMessagesRef = useRef(new Map());

  useEffect(() => {
    selectedConversationRef.current = Number(selectedId || 0) || null;
  }, [selectedId]);

  useEffect(() => {
    activeFamilyCodeRef.current = normalizeFamilyCode(activeFamilyCode);
  }, [activeFamilyCode]);

  useEffect(() => {
    setFamilyMembers([]);
    setRoomMembersOpen(false);
    setSelectedRoomMemberIds([]);
    setRoomMembersError('');
    setAttachmentDraft(null);
    setNewConversationOpen(false);
    setNewConversationError('');
    setNewConversationSubmitting(false);
    setNewConversationMemberId(null);
    setCreateRoomOpen(false);
    setCreateRoomError('');
    setCreateRoomSubmitting(false);
    setCreateRoomName('');
    setCreateRoomMemberIds([]);
    setRoomNameEditorOpen(false);
    setRoomNameDraft('');
    setRoomNameError('');
    setRoomNameSubmitting(false);
    familyMembersFamilyCodeRef.current = '';
  }, [activeFamilyCode]);

  useEffect(
    () => () => {
      revokeObjectUrl(attachmentDraft?.previewUrl);
    },
    [attachmentDraft?.previewUrl],
  );

  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!messageSearchOpen) {
      return;
    }

    window.requestAnimationFrame(() => {
      messageSearchInputRef.current?.focus();
      messageSearchInputRef.current?.select?.();
    });
  }, [messageSearchOpen]);

  const syncListsFromCache = useCallback((familyCode = activeFamilyCodeRef.current) => {
    const normalizedFamilyCode = normalizeFamilyCode(familyCode);
    if (!normalizedFamilyCode) return;

    setConversations(getCachedConversations(normalizedFamilyCode));
    setRooms(getCachedRooms(normalizedFamilyCode));
  }, []);

  const applyConversationRefresh = useCallback(
    (nextConversation) => {
      if (!nextConversation?.id) {
        return null;
      }

      const normalizedFamilyCode = normalizeFamilyCode(
        nextConversation?.familyCode || activeFamilyCodeRef.current,
      );
      const cachedConversation = cacheConversation(nextConversation);

      if (normalizedFamilyCode) {
        syncListsFromCache(normalizedFamilyCode);
      }

      if (isSameConversation(cachedConversation?.id, selectedConversationRef.current)) {
        setConversation(cachedConversation);
        setSelectedType(toConversationType(cachedConversation));
      }

      return cachedConversation;
    },
    [syncListsFromCache],
  );

  const loadFamilyMembers = useCallback(
    async (forceReload = false) => {
      const familyCode = activeFamilyCodeRef.current;
      if (!familyCode) {
        return [];
      }

      if (
        !forceReload &&
        familyMembersFamilyCodeRef.current === familyCode &&
        familyMembers.length > 0
      ) {
        return familyMembers;
      }

      const response = await getFamilyMembersForChat(familyCode);
      const nextMembers = response?.members || [];
      setFamilyMembers(nextMembers);
      familyMembersFamilyCodeRef.current = familyCode;
      return nextMembers;
    },
    [familyMembers],
  );

  useEffect(() => {
    if (!hasFamilyScope) {
      return;
    }

    let timeoutId = null;
    let idleCallbackId = null;
    const warmFamilyMembers = () => {
      loadFamilyMembers().catch((error) => {
        console.error('Failed to preload family members for chat:', error);
      });
    };

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      idleCallbackId = window.requestIdleCallback(warmFamilyMembers, { timeout: 1500 });
    } else {
      timeoutId = window.setTimeout(warmFamilyMembers, 900);
    }

    return () => {
      if (idleCallbackId !== null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleCallbackId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [activeFamilyCode, hasFamilyScope, loadFamilyMembers]);

  const resolveConversationFamilyCode = useCallback(
    (conversationId, fallbackFamilyCode = '') => {
      const cachedConversation = getCachedConversation(conversationId);
      const cachedFamilyCode = normalizeFamilyCode(cachedConversation?.familyCode);
      if (cachedFamilyCode) {
        return cachedFamilyCode;
      }

      if (isSameConversation(conversationId, selectedConversationRef.current)) {
        const selectedFamilyCode = normalizeFamilyCode(
          conversationRef.current?.familyCode || activeFamilyCodeRef.current,
        );
        if (selectedFamilyCode) {
          return selectedFamilyCode;
        }
      }

      return normalizeFamilyCode(fallbackFamilyCode);
    },
    [],
  );

  const clearRemoteTyping = useCallback(() => {
    remoteTypingTimeoutsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    remoteTypingTimeoutsRef.current.clear();
    setTypingUserIds([]);
  }, []);

  const stopLocalTyping = useCallback(() => {
    if (localTypingTimeoutRef.current) {
      window.clearTimeout(localTypingTimeoutRef.current);
      localTypingTimeoutRef.current = null;
    }

    const conversationId = selectedConversationRef.current;
    const familyCode = activeFamilyCodeRef.current;
    if (localTypingRef.current && conversationId && familyCode) {
      emitTyping(conversationId, familyCode, false);
    }

    localTypingRef.current = false;
  }, [emitTyping]);

  useEffect(() => () => {
    stopLocalTyping();
    clearRemoteTyping();
  }, [clearRemoteTyping, stopLocalTyping]);

  useEffect(() => {
    if (!routeFamilyCode || families.length === 0) {
      return;
    }

    if (routeFamilyCode === normalizeFamilyCode(activeFamilyCode)) {
      return;
    }

    const hasRouteFamily = families.some(
      (family) => normalizeFamilyCode(family?.familyCode) === routeFamilyCode,
    );

    if (hasRouteFamily) {
      setActiveFamilyCode(routeFamilyCode);
    }
  }, [activeFamilyCode, families, routeFamilyCode, setActiveFamilyCode]);

  useEffect(() => {
    stopLocalTyping();
    clearRemoteTyping();
    setSelectedId(null);
    setResolvedConversationId(null);
    setSelectedType(CONVERSATION_TYPES.DIRECT);
    setConversation(null);
    setMessages([]);
    setReplyTo(null);
    setAttachmentDraft(null);
    setMenuOpen(false);
    setReportMsg(null);
    setInfoPanelOpen(false);
    setShowComposerPicker(false);
    setText('');
    setRoomNameEditorOpen(false);
    setRoomNameDraft('');
    setRoomNameError('');
    setRoomNameSubmitting(false);
  }, [activeFamilyCode, clearRemoteTyping, stopLocalTyping]);

  const clearOpenConversation = useCallback(
    (options = {}) => {
      stopLocalTyping();
      clearRemoteTyping();
      setSelectedId(null);
      setResolvedConversationId(null);
      setSelectedType(CONVERSATION_TYPES.DIRECT);
      setConversation(null);
      setMessages([]);
      setReplyTo(null);
      setAttachmentDraft(null);
      setMenuOpen(false);
      setReportMsg(null);
      setInfoPanelOpen(false);
      setShowComposerPicker(false);
      setText('');
      setRoomMembersOpen(false);
      setSelectedRoomMemberIds([]);
      setRoomMembersError('');
      setRoomNameEditorOpen(false);
      setRoomNameDraft('');
      setRoomNameError('');
      setRoomNameSubmitting(false);
      setMessageSearchOpen(false);
      setMessageSearchQuery('');
      setActiveMessageSearchIndex(-1);

      if (options?.navigateToList !== false && routeConversationIdNumber) {
        const nextUrl = activeFamilyCodeRef.current
          ? `/chat?familyCode=${encodeURIComponent(activeFamilyCodeRef.current)}`
          : '/chat';
        navigate(nextUrl, { replace: true });
      }
    },
    [clearRemoteTyping, navigate, routeConversationIdNumber, stopLocalTyping],
  );

  useEffect(() => {
    let isCancelled = false;

    if (!hasFamilyScope) {
      setConversations([]);
      setRooms([]);
      setMessagesListLoading(false);
      setRoomsListLoading(false);
      return () => {
        isCancelled = true;
      };
    }

    const cachedConversations = getCachedConversations(activeFamilyCode);
    const cachedRooms = getCachedRooms(activeFamilyCode);
    if (cachedConversations.length > 0) {
      setConversations(cachedConversations);
    }
    if (cachedRooms.length > 0) {
      setRooms(cachedRooms);
    }
    setMessagesListLoading(cachedConversations.length === 0);
    setRoomsListLoading(cachedRooms.length === 0);

    (async () => {
      try {
        const conversationResponse = await getConversations(activeFamilyCode);

        if (isCancelled) return;

        setConversations(
          cacheConversations(
            activeFamilyCode,
            conversationResponse?.conversations || [],
          ),
        );
      } catch (error) {
        if (!isCancelled) {
          console.error('Chat conversations load failed:', error);
          if (cachedConversations.length === 0) {
            setConversations([]);
          }
        }
      } finally {
        if (!isCancelled) {
          setMessagesListLoading(false);
        }
      }
    })();

    (async () => {
      try {
        const roomResponse = await getRooms(activeFamilyCode);

        if (isCancelled) return;

        setRooms(cacheRooms(activeFamilyCode, roomResponse?.rooms || []));
      } catch (error) {
        if (!isCancelled) {
          console.error('Chat rooms load failed:', error);
          if (cachedRooms.length === 0) {
            setRooms([]);
          }
        }
      } finally {
        if (!isCancelled) {
          setRoomsListLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [activeFamilyCode, hasFamilyScope]);

  const markConversationReadNow = useCallback(
    async (conversationId, options = {}) => {
      const targetConversationId = Number(conversationId || selectedConversationRef.current || 0);
      const familyCode = activeFamilyCodeRef.current;
      if (!targetConversationId || !familyCode) {
        return null;
      }

      try {
        const result = await markConversationRead(targetConversationId, familyCode);
        if (result?.familyCode) {
          markCachedConversationRead(result.familyCode, targetConversationId);
          if (
            normalizeFamilyCode(result.familyCode) === activeFamilyCodeRef.current
          ) {
            syncListsFromCache(result.familyCode);
          }
        }

        if (isSameConversation(targetConversationId, selectedConversationRef.current)) {
          const cachedConversation = getCachedConversation(targetConversationId);
          if (cachedConversation) {
            setConversation(cachedConversation);
          }
        }

        return result;
      } catch (error) {
        if (!options?.suppressErrors) {
          console.error('Failed to mark chat as read:', error);
        }
        return null;
      }
    },
    [syncListsFromCache],
  );

  const applyConversationMessageUpdate = useCallback(
    (conversationId, message, options = {}) => {
      const targetConversationId = Number(conversationId || 0);
      if (!targetConversationId || !message) {
        return [];
      }

      const nextMessages = upsertCachedMessage(targetConversationId, message);
      const resolvedFamilyCode = resolveConversationFamilyCode(
        targetConversationId,
        options?.familyCode,
      );
      const cachedConversation = getCachedConversation(targetConversationId);

      if (resolvedFamilyCode) {
        const nextUnreadCount = options?.clearUnread
          ? 0
          : typeof options?.unreadCount === 'number'
            ? Number(options.unreadCount)
            : Number(cachedConversation?.unreadCount || 0);

        cacheConversationMessage(
          resolvedFamilyCode,
          targetConversationId,
          message,
          options?.clearUnread
            ? { clearUnread: true }
            : { unreadCount: nextUnreadCount },
        );

        if (normalizeFamilyCode(resolvedFamilyCode) === activeFamilyCodeRef.current) {
          syncListsFromCache(resolvedFamilyCode);
        }
      }

      if (isSameConversation(targetConversationId, selectedConversationRef.current)) {
        setMessages(nextMessages);
        const latestConversation = getCachedConversation(targetConversationId);
        if (latestConversation) {
          setConversation(latestConversation);
        }
      }

      return nextMessages;
    },
    [resolveConversationFamilyCode, syncListsFromCache],
  );

  const replaceConversationMessageUpdate = useCallback(
    (conversationId, targetMessageId, message, options = {}) => {
      const targetConversationId = Number(conversationId || 0);
      const optimisticMessageId = Number(targetMessageId || 0);
      if (!targetConversationId || !optimisticMessageId || !message) {
        return [];
      }

      const nextMessages = replaceCachedMessage(
        targetConversationId,
        optimisticMessageId,
        message,
      );
      const resolvedFamilyCode = resolveConversationFamilyCode(
        targetConversationId,
        options?.familyCode,
      );
      const cachedConversation = getCachedConversation(targetConversationId);

      if (resolvedFamilyCode) {
        const nextUnreadCount = options?.clearUnread
          ? 0
          : typeof options?.unreadCount === 'number'
            ? Number(options.unreadCount)
            : Number(cachedConversation?.unreadCount || 0);

        cacheConversationMessage(
          resolvedFamilyCode,
          targetConversationId,
          message,
          options?.clearUnread
            ? { clearUnread: true }
            : { unreadCount: nextUnreadCount },
        );

        if (normalizeFamilyCode(resolvedFamilyCode) === activeFamilyCodeRef.current) {
          syncListsFromCache(resolvedFamilyCode);
        }
      }

      if (isSameConversation(targetConversationId, selectedConversationRef.current)) {
        setMessages(nextMessages);
        const latestConversation = getCachedConversation(targetConversationId);
        if (latestConversation) {
          setConversation(latestConversation);
        }
      }

      return nextMessages;
    },
    [resolveConversationFamilyCode, syncListsFromCache],
  );

  const applyConversationMessageFailure = useCallback(
    (conversationId, messageId, options = {}) => {
      const targetConversationId = Number(conversationId || 0);
      const failedMessageId = Number(messageId || 0);
      if (!targetConversationId || !failedMessageId) {
        return [];
      }

      const nextMessages = markCachedMessageFailed(targetConversationId, failedMessageId);
      const failedMessage = nextMessages.find(
        (message) => Number(message?.id || 0) === failedMessageId,
      );
      const resolvedFamilyCode = resolveConversationFamilyCode(
        targetConversationId,
        options?.familyCode,
      );
      const cachedConversation = getCachedConversation(targetConversationId);

      if (resolvedFamilyCode && failedMessage) {
        const nextUnreadCount = options?.clearUnread
          ? 0
          : typeof options?.unreadCount === 'number'
            ? Number(options.unreadCount)
            : Number(cachedConversation?.unreadCount || 0);

        cacheConversationMessage(
          resolvedFamilyCode,
          targetConversationId,
          failedMessage,
          options?.clearUnread
            ? { clearUnread: true }
            : { unreadCount: nextUnreadCount },
        );

        if (normalizeFamilyCode(resolvedFamilyCode) === activeFamilyCodeRef.current) {
          syncListsFromCache(resolvedFamilyCode);
        }
      }

      if (isSameConversation(targetConversationId, selectedConversationRef.current)) {
        setMessages(nextMessages);
        const latestConversation = getCachedConversation(targetConversationId);
        if (latestConversation) {
          setConversation(latestConversation);
        }
      }

      return nextMessages;
    },
    [resolveConversationFamilyCode, syncListsFromCache],
  );

  const queuePendingTextMessage = useCallback((conversationId, entry = {}) => {
    const targetConversationId = Number(conversationId || 0);
    const tempId = Number(entry?.tempId || 0);
    if (!targetConversationId || !tempId) {
      return;
    }

    const currentEntries = pendingTextMessagesRef.current.get(targetConversationId) || [];
    pendingTextMessagesRef.current.set(targetConversationId, [...currentEntries, entry]);
  }, []);

  const removePendingTextMessage = useCallback((conversationId, tempId) => {
    const targetConversationId = Number(conversationId || 0);
    const optimisticMessageId = Number(tempId || 0);
    if (!targetConversationId || !optimisticMessageId) {
      return null;
    }

    const currentEntries = pendingTextMessagesRef.current.get(targetConversationId) || [];
    const matchingIndex = currentEntries.findIndex(
      (entry) => Number(entry?.tempId || 0) === optimisticMessageId,
    );
    if (matchingIndex < 0) {
      return null;
    }

    const nextEntries = [...currentEntries];
    const [matchingEntry] = nextEntries.splice(matchingIndex, 1);

    if (nextEntries.length > 0) {
      pendingTextMessagesRef.current.set(targetConversationId, nextEntries);
    } else {
      pendingTextMessagesRef.current.delete(targetConversationId);
    }

    return matchingEntry || null;
  }, []);

  const shiftMatchingPendingTextMessage = useCallback((conversationId, message = {}) => {
    const targetConversationId = Number(conversationId || 0);
    if (!targetConversationId) {
      return null;
    }

    const currentEntries = pendingTextMessagesRef.current.get(targetConversationId) || [];
    if (currentEntries.length === 0) {
      return null;
    }

    const targetContent = String(message?.content || '').trim();
    const targetReplyId = getMessageReplyId(message);
    const matchingIndex = currentEntries.findIndex(
      (entry) =>
        String(entry?.content || '').trim() === targetContent &&
        Number(entry?.replyToId || 0) === Number(targetReplyId || 0),
    );
    if (matchingIndex < 0) {
      return null;
    }

    const nextEntries = [...currentEntries];
    const [matchingEntry] = nextEntries.splice(matchingIndex, 1);

    if (nextEntries.length > 0) {
      pendingTextMessagesRef.current.set(targetConversationId, nextEntries);
    } else {
      pendingTextMessagesRef.current.delete(targetConversationId);
    }

    return matchingEntry || null;
  }, []);

  const queuePendingMediaMessage = useCallback((conversationId, entry = {}) => {
    const targetConversationId = Number(conversationId || 0);
    const tempId = Number(entry?.tempId || 0);
    if (!targetConversationId || !tempId) {
      return;
    }

    const currentEntries = pendingMediaMessagesRef.current.get(targetConversationId) || [];
    pendingMediaMessagesRef.current.set(targetConversationId, [...currentEntries, entry]);
  }, []);

  const removePendingMediaMessage = useCallback((conversationId, tempId) => {
    const targetConversationId = Number(conversationId || 0);
    const optimisticMessageId = Number(tempId || 0);
    if (!targetConversationId || !optimisticMessageId) {
      return null;
    }

    const currentEntries = pendingMediaMessagesRef.current.get(targetConversationId) || [];
    const matchingIndex = currentEntries.findIndex(
      (entry) => Number(entry?.tempId || 0) === optimisticMessageId,
    );
    if (matchingIndex < 0) {
      return null;
    }

    const nextEntries = [...currentEntries];
    const [matchingEntry] = nextEntries.splice(matchingIndex, 1);

    if (nextEntries.length > 0) {
      pendingMediaMessagesRef.current.set(targetConversationId, nextEntries);
    } else {
      pendingMediaMessagesRef.current.delete(targetConversationId);
    }

    return matchingEntry || null;
  }, []);

  const shiftMatchingPendingMediaMessage = useCallback((conversationId, message = {}) => {
    const targetConversationId = Number(conversationId || 0);
    if (!targetConversationId) {
      return null;
    }

    const currentEntries = pendingMediaMessagesRef.current.get(targetConversationId) || [];
    if (currentEntries.length === 0) {
      return null;
    }

    const targetContent = String(message?.content || '').trim();
    const targetReplyId = getMessageReplyId(message);
    const targetMessageType = String(message?.messageType || '').trim().toLowerCase();
    const matchingIndex = currentEntries.findIndex(
      (entry) =>
        String(entry?.content || '').trim() === targetContent &&
        Number(entry?.replyToId || 0) === Number(targetReplyId || 0) &&
        String(entry?.messageType || '').trim().toLowerCase() === targetMessageType,
    );
    if (matchingIndex < 0) {
      return null;
    }

    const nextEntries = [...currentEntries];
    const [matchingEntry] = nextEntries.splice(matchingIndex, 1);

    if (nextEntries.length > 0) {
      pendingMediaMessagesRef.current.set(targetConversationId, nextEntries);
    } else {
      pendingMediaMessagesRef.current.delete(targetConversationId);
    }

    return matchingEntry || null;
  }, []);

  const refreshConversationFromServer = useCallback(
    async (payload = {}) => {
      const conversationId = Number(payload?.conversationId || payload?.id || 0);
      const familyCode = normalizeFamilyCode(
        payload?.familyCode || resolveConversationFamilyCode(conversationId),
      );
      if (!conversationId || !familyCode) {
        return null;
      }

      try {
        const nextConversation = await getConversation(conversationId, familyCode);
        return applyConversationRefresh(nextConversation);
      } catch (error) {
        console.error('Failed to refresh room conversation:', error);
        return null;
      }
    },
    [applyConversationRefresh, resolveConversationFamilyCode],
  );

  const openChat = useCallback(
    async (conversationId, conversationType = CONVERSATION_TYPES.DIRECT) => {
      const targetConversationId = Number(conversationId || 0);
      const familyCode = activeFamilyCodeRef.current;
      if (!targetConversationId || !familyCode) {
        return;
      }

      const requestId = openRequestIdRef.current + 1;
      openRequestIdRef.current = requestId;

      setSelectedId(targetConversationId);
      setResolvedConversationId(null);
      setSelectedType(conversationType);
      setChatLoading(true);
      setReplyTo(null);
      setAttachmentDraft(null);
      setText('');
      setMenuOpen(false);
      setReportMsg(null);
      setInfoPanelOpen(false);
      setMessageSearchOpen(false);
      setMessageSearchQuery('');
      setActiveMessageSearchIndex(-1);
      setRoomMembersOpen(false);
      setSelectedRoomMemberIds([]);
      setRoomMembersError('');
      setRoomNameEditorOpen(false);
      setRoomNameDraft('');
      setRoomNameError('');
      setRoomNameSubmitting(false);
      stopLocalTyping();
      clearRemoteTyping();

      const cachedConversation = getCachedConversation(targetConversationId);
      const cachedMessages = getCachedMessages(targetConversationId);

      if (cachedConversation) {
        setConversation(cachedConversation);
        setSelectedType(toConversationType(cachedConversation));
      }

      if (cachedMessages.length > 0) {
        setMessages(cachedMessages);
      } else {
        setMessages([]);
      }

      if (cachedConversation || cachedMessages.length > 0) {
        setChatLoading(false);
      }

      try {
        const conversationPromise = getConversation(targetConversationId, familyCode);
        const messagePromise = getMessages(
          targetConversationId,
          null,
          currentUserId,
          familyCode,
        );
        const conversationResponse = await conversationPromise;

        if (openRequestIdRef.current !== requestId) {
          return;
        }

        const nextConversation = cacheConversation(conversationResponse);
        setConversation(nextConversation);
        setSelectedType(toConversationType(nextConversation));
        setResolvedConversationId(targetConversationId);

        const messageResponse = await messagePromise;

        if (openRequestIdRef.current !== requestId) {
          return;
        }

        const nextMessages = cacheMessages(
          targetConversationId,
          messageResponse?.messages || [],
        );

        setMessages(nextMessages);
        syncListsFromCache(familyCode);
        await markConversationReadNow(targetConversationId, { suppressErrors: true });
      } catch (error) {
        if (openRequestIdRef.current === requestId) {
          console.error('Failed to open conversation:', error);
          setResolvedConversationId(null);
          if (isUnavailableConversationError(error)) {
            removeCachedConversation(targetConversationId, familyCode);
            syncListsFromCache(familyCode);
            clearOpenConversation();
          }
        }
      } finally {
        if (openRequestIdRef.current === requestId) {
          setChatLoading(false);
        }
      }
    },
    [
      clearOpenConversation,
      clearRemoteTyping,
      currentUserId,
      markConversationReadNow,
      stopLocalTyping,
      syncListsFromCache,
    ],
  );

  const sendMediaRef = useRef(null);

  const safeSendMedia = useCallback(
    (file, options = {}) => {
      if (typeof sendMediaRef.current === 'function') {
        return sendMediaRef.current(file, options);
      }
    },
    [],
  );

  useEffect(() => {
    if (!hasFamilyScope || !routeConversationIdNumber) {
      return;
    }

    if (
      routeFamilyCode &&
      routeFamilyCode !== normalizeFamilyCode(activeFamilyCode)
    ) {
      return;
    }

    if (
      isSameConversation(routeConversationIdNumber, selectedId) &&
      conversation
    ) {
      return;
    }

    const knownConversation =
      getCachedConversation(routeConversationIdNumber) ||
      conversations.find((item) => isSameConversation(item?.id, routeConversationIdNumber)) ||
      rooms.find((item) => isSameConversation(item?.id, routeConversationIdNumber));

    openChat(
      routeConversationIdNumber,
      knownConversation ? toConversationType(knownConversation) : CONVERSATION_TYPES.DIRECT,
    );
  }, [
    conversation,
    conversations,
    hasFamilyScope,
    openChat,
    rooms,
    routeConversationIdNumber,
    selectedId,
  ]);

  useEffect(() => {
    const normalizedActiveFamilyCode = normalizeFamilyCode(activeFamilyCode);
    if (!selectedId || !resolvedConversationId || !normalizedActiveFamilyCode) {
      return undefined;
    }

    if (!isSameConversation(selectedId, resolvedConversationId)) {
      return undefined;
    }

    const selectedConversationFamilyCode = normalizeFamilyCode(
      conversation?.familyCode || getCachedConversation(selectedId)?.familyCode || '',
    );

    if (
      selectedConversationFamilyCode &&
      selectedConversationFamilyCode !== normalizedActiveFamilyCode
    ) {
      return undefined;
    }

    joinConversation(selectedId, normalizedActiveFamilyCode);

    return () => {
      leaveConversation(selectedId);
      stopLocalTyping();
      clearRemoteTyping();
    };
  }, [
    activeFamilyCode,
    clearRemoteTyping,
    conversation?.familyCode,
    joinConversation,
    leaveConversation,
    resolvedConversationId,
    selectedId,
    stopLocalTyping,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedId, typingUserIds]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }

      if (composerRef.current && !composerRef.current.contains(event.target)) {
        setShowComposerPicker(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handleNewMessage = (payload = {}) => {
      const conversationId = Number(payload?.conversationId || 0);
      if (!conversationId) return;

      const cachedConversation = getCachedConversation(conversationId);
      const isActiveConversation = isSameConversation(
        conversationId,
        selectedConversationRef.current,
      );
      const sentByCurrentUser =
        Number(payload?.senderId || 0) === Number(currentUserId || 0);
      const shouldClearUnread = isActiveConversation || sentByCurrentUser;
      const nextUnreadCount = shouldClearUnread
        ? 0
        : Number(cachedConversation?.unreadCount || 0) + 1;
      const matchingPendingMessage = sentByCurrentUser
        ? shiftMatchingPendingTextMessage(conversationId, payload)
        : null;
      const matchingPendingMediaMessage =
        sentByCurrentUser && !matchingPendingMessage
          ? shiftMatchingPendingMediaMessage(conversationId, payload)
          : null;

      if (matchingPendingMessage?.tempId) {
        replaceConversationMessageUpdate(
          conversationId,
          matchingPendingMessage.tempId,
          payload,
          {
            familyCode: cachedConversation?.familyCode,
            clearUnread: shouldClearUnread,
            unreadCount: nextUnreadCount,
          },
        );
      } else if (matchingPendingMediaMessage?.tempId) {
        revokeObjectUrl(matchingPendingMediaMessage.previewUrl);
        replaceConversationMessageUpdate(
          conversationId,
          matchingPendingMediaMessage.tempId,
          payload,
          {
            familyCode: cachedConversation?.familyCode,
            clearUnread: shouldClearUnread,
            unreadCount: nextUnreadCount,
          },
        );
      } else {
        applyConversationMessageUpdate(conversationId, payload, {
          familyCode: cachedConversation?.familyCode,
          clearUnread: shouldClearUnread,
          unreadCount: nextUnreadCount,
        });
      }

      if (isActiveConversation && !sentByCurrentUser) {
        window.setTimeout(() => {
          markConversationReadNow(conversationId, { suppressErrors: true });
        }, 150);
      }
    };

    const handleMessageDeleted = (payload = {}) => {
      const conversationId = Number(payload?.conversationId || 0);
      const messageId = Number(payload?.messageId || 0);
      if (!conversationId || !messageId) return;

      const nextMessages = cacheMessages(
        conversationId,
        markMessageDeleted(getCachedMessages(conversationId), messageId),
      );

      if (isSameConversation(conversationId, selectedConversationRef.current)) {
        setMessages(nextMessages);
      }

      const cachedConversation = getCachedConversation(conversationId);
      if (
        cachedConversation?.lastMessage &&
        Number(cachedConversation.lastMessage.id || 0) === messageId
      ) {
        const nextConversation = cacheConversation({
          ...cachedConversation,
          lastMessage: {
            ...cachedConversation.lastMessage,
            content: 'Message deleted',
          },
        });

        const familyCode = normalizeFamilyCode(nextConversation?.familyCode);
        if (familyCode === activeFamilyCodeRef.current) {
          syncListsFromCache(familyCode);
        }

        if (isSameConversation(conversationId, selectedConversationRef.current)) {
          setConversation(nextConversation);
        }
      }
    };

    const handleTyping = (payload = {}) => {
      const conversationId = Number(payload?.conversationId || 0);
      const userId = Number(payload?.userId || 0);
      if (
        !conversationId ||
        !userId ||
        userId === Number(currentUserId || 0) ||
        !isSameConversation(conversationId, selectedConversationRef.current)
      ) {
        return;
      }

      const existingTimeout = remoteTypingTimeoutsRef.current.get(userId);
      if (existingTimeout) {
        window.clearTimeout(existingTimeout);
      }

      if (!payload?.isTyping) {
        remoteTypingTimeoutsRef.current.delete(userId);
        setTypingUserIds((current) =>
          current.filter((entry) => Number(entry || 0) !== userId),
        );
        return;
      }

      setTypingUserIds((current) =>
        current.includes(userId) ? current : [...current, userId],
      );

      const timeoutId = window.setTimeout(() => {
        remoteTypingTimeoutsRef.current.delete(userId);
        setTypingUserIds((current) =>
          current.filter((entry) => Number(entry || 0) !== userId),
        );
      }, CHAT_LIMITS.TYPING_TIMEOUT_MS + 500);

      remoteTypingTimeoutsRef.current.set(userId, timeoutId);
    };

    const handleReadReceipt = (payload = {}) => {
      const conversationId = Number(payload?.conversationId || 0);
      const readerUserId = Number(payload?.userId || 0);
      const readAt = payload?.readAt;
      if (!conversationId || !readAt) return;

      if (readerUserId === Number(currentUserId || 0)) {
        if (payload?.familyCode) {
          markCachedConversationRead(payload.familyCode, conversationId);
          if (
            normalizeFamilyCode(payload.familyCode) === activeFamilyCodeRef.current
          ) {
            syncListsFromCache(payload.familyCode);
          }
        }
        return;
      }

      const currentMessages = getCachedMessages(conversationId);
      if (currentMessages.length === 0) {
        return;
      }

      const nextMessages = cacheMessages(
        conversationId,
        applyReadReceipt(currentMessages, currentUserId, readerUserId, readAt),
      );

      if (isSameConversation(conversationId, selectedConversationRef.current)) {
        setMessages(nextMessages);
      }
    };

    const handleRoomMembershipChange = (payload = {}) => {
      refreshConversationFromServer(payload);
    };

    const handleRoomUpdated = (payload = {}) => {
      refreshConversationFromServer(payload);
    };

    const handleConversationRemoved = (payload = {}) => {
      const conversationId = Number(payload?.conversationId || 0);
      if (!conversationId) {
        return;
      }

      removeCachedConversation(conversationId, payload?.familyCode);
      if (
        payload?.familyCode &&
        normalizeFamilyCode(payload.familyCode) === activeFamilyCodeRef.current
      ) {
        syncListsFromCache(payload.familyCode);
      }

      if (isSameConversation(conversationId, selectedConversationRef.current)) {
        clearOpenConversation({
          navigateToList:
            routeConversationIdNumber &&
            isSameConversation(routeConversationIdNumber, conversationId),
        });
      }
    };

    socket.on(CHAT_SOCKET_EVENTS.NEW_MESSAGE, handleNewMessage);
    socket.on(CHAT_SOCKET_EVENTS.MESSAGE_DELETED, handleMessageDeleted);
    socket.on(CHAT_SOCKET_EVENTS.TYPING, handleTyping);
    socket.on(CHAT_SOCKET_EVENTS.READ_RECEIPT, handleReadReceipt);
    socket.on(CHAT_SOCKET_EVENTS.MEMBER_JOINED, handleRoomMembershipChange);
    socket.on(CHAT_SOCKET_EVENTS.MEMBER_REMOVED, handleRoomMembershipChange);
    socket.on(CHAT_SOCKET_EVENTS.ROOM_UPDATED, handleRoomUpdated);
    socket.on(CHAT_SOCKET_EVENTS.CONVERSATION_REMOVED, handleConversationRemoved);

    return () => {
      socket.off(CHAT_SOCKET_EVENTS.NEW_MESSAGE, handleNewMessage);
      socket.off(CHAT_SOCKET_EVENTS.MESSAGE_DELETED, handleMessageDeleted);
      socket.off(CHAT_SOCKET_EVENTS.TYPING, handleTyping);
      socket.off(CHAT_SOCKET_EVENTS.READ_RECEIPT, handleReadReceipt);
      socket.off(CHAT_SOCKET_EVENTS.MEMBER_JOINED, handleRoomMembershipChange);
      socket.off(CHAT_SOCKET_EVENTS.MEMBER_REMOVED, handleRoomMembershipChange);
      socket.off(CHAT_SOCKET_EVENTS.ROOM_UPDATED, handleRoomUpdated);
      socket.off(CHAT_SOCKET_EVENTS.CONVERSATION_REMOVED, handleConversationRemoved);
    };
  }, [
    applyConversationMessageUpdate,
    clearOpenConversation,
    currentUserId,
    markConversationReadNow,
    replaceConversationMessageUpdate,
    refreshConversationFromServer,
    routeConversationIdNumber,
    socket,
    shiftMatchingPendingMediaMessage,
    shiftMatchingPendingTextMessage,
    syncListsFromCache,
  ]);

  const handleTypingActivity = useCallback(() => {
    const conversationId = selectedConversationRef.current;
    const familyCode = activeFamilyCodeRef.current;
    if (!conversationId || !familyCode) {
      return;
    }

    if (!localTypingRef.current) {
      localTypingRef.current = true;
      emitTyping(conversationId, familyCode, true);
    }

    if (localTypingTimeoutRef.current) {
      window.clearTimeout(localTypingTimeoutRef.current);
    }

    localTypingTimeoutRef.current = window.setTimeout(() => {
      if (localTypingRef.current && conversationId && familyCode) {
        emitTyping(conversationId, familyCode, false);
      }
      localTypingRef.current = false;
      localTypingTimeoutRef.current = null;
    }, CHAT_LIMITS.TYPING_TIMEOUT_MS);
  }, [emitTyping]);

  const handleTextChange = useCallback(
    (event) => {
      const nextText = event.target.value;
      setText(nextText);
      resizeComposer(event.target);

      if (nextText.trim()) {
        handleTypingActivity();
      } else {
        stopLocalTyping();
      }
    },
    [handleTypingActivity, stopLocalTyping],
  );

  const insertComposerText = useCallback(
    (value) => {
      const nextValue = String(value || '');
      if (!nextValue) {
        return;
      }

      const input = inputRef.current;
      const selectionStart = input?.selectionStart ?? text.length;
      const selectionEnd = input?.selectionEnd ?? text.length;
      const nextText = `${text.slice(0, selectionStart)}${nextValue}${text.slice(
        selectionEnd,
      )}`;

      setText(nextText);

      window.requestAnimationFrame(() => {
        if (!inputRef.current) {
          return;
        }

        resizeComposer(inputRef.current);
        inputRef.current.focus();
        const nextCaretPosition = selectionStart + nextValue.length;
        inputRef.current.setSelectionRange(nextCaretPosition, nextCaretPosition);
      });

      if (nextText.trim()) {
        handleTypingActivity();
      } else {
        stopLocalTyping();
      }
    },
    [handleTypingActivity, stopLocalTyping, text],
  );

  const handleEmojiSelect = useCallback(
    (emojiData) => {
      insertComposerText(emojiData?.emoji || '');
    },
    [insertComposerText],
  );

  const handleSend = useCallback(() => {
    const trimmedText = String(text || '').trim();
    const targetConversationId = Number(selectedId || 0);
    const familyCodeAtSend = activeFamilyCode;
    if (hasAttachmentDraft && attachmentDraft?.file) {
      void safeSendMedia(attachmentDraft.file, {
        content: trimmedText,
        draft: attachmentDraft,
      });
    } else {
      const replyPreview = getMessageReplyPreview(replyTo);
      const optimisticMessageId = optimisticMessageIdRef.current;
      if (
        !trimmedText ||
        !targetConversationId ||
        !familyCodeAtSend ||
        conversation?.canSend === false
      ) {
        return;
      }

      optimisticMessageIdRef.current -= 1;
      stopLocalTyping();
      queuePendingTextMessage(targetConversationId, {
        tempId: optimisticMessageId,
        content: trimmedText,
        replyToId: replyPreview?.id || null,
      });

      applyConversationMessageUpdate(
        targetConversationId,
        createOptimisticTextMessage({
          id: optimisticMessageId,
          conversationId: targetConversationId,
          senderId: currentUserId,
          senderName: currentUserDisplayName,
          senderAvatar: currentUserAvatarUrl,
          content: trimmedText,
          createdAt: new Date().toISOString(),
          replyTo: replyPreview,
        }),
        {
          familyCode: familyCodeAtSend,
          clearUnread: true,
        },
      );

      setText('');
      setReplyTo(null);
      if (inputRef.current) {
        resizeComposer(inputRef.current);
        inputRef.current.focus();
      }

      void (async () => {
        try {
          const nextMessage = await sendTextMessage(
            targetConversationId,
            familyCodeAtSend,
            trimmedText,
            {
              replyTo,
            },
          );
          if (!nextMessage || !Number(nextMessage?.id || 0)) {
            throw new Error('Message send did not return a valid message payload');
          }

          const enrichedMessage = replyPreview
            ? {
                ...nextMessage,
                replyTo: nextMessage?.replyTo || replyPreview,
              }
            : nextMessage;
          const pendingMessage = removePendingTextMessage(
            targetConversationId,
            optimisticMessageId,
          );

          if (pendingMessage) {
            replaceConversationMessageUpdate(
              targetConversationId,
              optimisticMessageId,
              enrichedMessage,
              {
                familyCode: familyCodeAtSend,
                clearUnread: true,
              },
            );
          } else {
            applyConversationMessageUpdate(targetConversationId, enrichedMessage, {
              familyCode: familyCodeAtSend,
              clearUnread: true,
            });
          }
        } catch (error) {
          removePendingTextMessage(targetConversationId, optimisticMessageId);
          applyConversationMessageFailure(targetConversationId, optimisticMessageId, {
            familyCode: familyCodeAtSend,
            clearUnread: true,
          });
          console.error('Failed to send message:', error);
        }
      })();
    }
  }, [
    activeFamilyCode,
    applyConversationMessageFailure,
    applyConversationMessageUpdate,
    conversation?.canSend,
    currentUserAvatarUrl,
    currentUserDisplayName,
    currentUserId,
    queuePendingTextMessage,
    removePendingTextMessage,
    replaceConversationMessageUpdate,
    replyTo,
    selectedId,
    safeSendMedia,
    stopLocalTyping,
    text,
    attachmentDraft,
    hasAttachmentDraft,
  ]);

  const sendMedia = useCallback(
    async (file, options = {}) => {
      const targetConversationId = Number(selectedId || 0);
      const familyCodeAtSend = activeFamilyCode;
      let optimisticMessageId = 0;
      if (
        !file ||
        !targetConversationId ||
        !familyCodeAtSend ||
        conversation?.canSend === false ||
        sendingMediaRef.current
      ) {
        return;
      }

      stopLocalTyping();
      sendingMediaRef.current = true;
      setSendingMedia(true);

      try {
        const messageContent =
          typeof options?.content === 'string'
            ? String(options.content).trim()
            : String(text || '').trim();
        const replyPreview = getMessageReplyPreview(replyTo);
        optimisticMessageId = optimisticMessageIdRef.current;
        const messageType = getComposerAttachmentKind(file);
        const localMediaUrl =
          messageType === MESSAGE_TYPES.IMAGE || messageType === MESSAGE_TYPES.VOICE
            ? URL.createObjectURL(file)
            : '';

        optimisticMessageIdRef.current -= 1;
        queuePendingMediaMessage(targetConversationId, {
          tempId: optimisticMessageId,
          previewUrl: localMediaUrl,
          content: messageContent,
          replyToId: replyPreview?.id || null,
          messageType,
        });
        applyConversationMessageUpdate(
          targetConversationId,
          createOptimisticMediaMessage({
            id: optimisticMessageId,
            conversationId: targetConversationId,
            senderId: currentUserId,
            senderName: currentUserDisplayName,
            senderAvatar: currentUserAvatarUrl,
            content: messageContent || null,
            createdAt: new Date().toISOString(),
            replyTo: replyPreview,
            messageType,
            mediaUrl: localMediaUrl,
            mediaMimeType: file?.type || '',
            mediaSize: Number(file?.size || 0),
            attachmentName: file?.name || '',
          }),
          {
            familyCode: familyCodeAtSend,
            clearUnread: true,
          },
        );
        setText('');
        setReplyTo(null);
        setAttachmentDraft(null);
        if (inputRef.current) {
          resizeComposer(inputRef.current);
          inputRef.current.focus();
        }

        const mediaMessage = await sendMediaMessage(
          targetConversationId,
          familyCodeAtSend,
          file,
          {
            content: messageContent || undefined,
            replyTo,
          },
        );

        const enrichedMessage = replyTo
          ? {
            ...mediaMessage,
            replyTo: mediaMessage?.replyTo || {
              id: replyTo.id,
              content: replyTo.content,
              senderName: replyTo.senderName,
            },
          }
          : mediaMessage;

        const pendingMessage = removePendingMediaMessage(
          targetConversationId,
          optimisticMessageId,
        );
        if (pendingMessage?.previewUrl) {
          revokeObjectUrl(pendingMessage.previewUrl);
        }

        if (pendingMessage) {
          replaceConversationMessageUpdate(
            targetConversationId,
            optimisticMessageId,
            enrichedMessage,
            {
              familyCode: familyCodeAtSend,
              clearUnread: true,
            },
          );
        } else {
          applyConversationMessageUpdate(targetConversationId, enrichedMessage, {
            familyCode: familyCodeAtSend,
            clearUnread: true,
          });
        }
      } catch (error) {
        const failedPendingMessage = removePendingMediaMessage(
          targetConversationId,
          optimisticMessageId,
        );
        if (failedPendingMessage?.tempId) {
          applyConversationMessageFailure(targetConversationId, failedPendingMessage.tempId, {
            familyCode: familyCodeAtSend,
            clearUnread: true,
          });
        }
        console.error('Failed to send media:', error);
      } finally {
        sendingMediaRef.current = false;
        setSendingMedia(false);
      }
    },
    [
      activeFamilyCode,
      applyConversationMessageFailure,
      applyConversationMessageUpdate,
      conversation?.canSend,
      currentUserAvatarUrl,
      currentUserDisplayName,
      currentUserId,
      queuePendingMediaMessage,
      removePendingMediaMessage,
      replaceConversationMessageUpdate,
      replyTo,
      selectedId,
      stopLocalTyping,
      text,
    ],
  );

  useEffect(() => {
    sendMediaRef.current = sendMedia;
  }, [sendMedia]);

  const handleStageAttachment = useCallback((file) => {
    if (!file) {
      return;
    }

    setShowComposerPicker(false);
    setAttachmentDraft(createComposerAttachmentDraft(file));
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleFileChange = useCallback(
    async (event) => {
      const [file] = Array.from(event.target.files || []);
      event.target.value = '';
      handleStageAttachment(file);
    },
    [handleStageAttachment],
  );

  const handleDelete = useCallback(
    async (message) => {
      if (!activeFamilyCode || !message) return;
      if (!window.confirm('Delete this message?')) return;

      try {
        await deleteMsg(message.id, activeFamilyCode);

        const nextMessages = cacheMessages(
          Number(selectedId || 0),
          markMessageDeleted(getCachedMessages(selectedId), message.id),
        );
        setMessages(nextMessages);

        const cachedConversation = getCachedConversation(selectedId);
        if (
          cachedConversation?.lastMessage &&
          Number(cachedConversation.lastMessage.id || 0) === Number(message.id || 0)
        ) {
          cacheConversation({
            ...cachedConversation,
            lastMessage: {
              ...cachedConversation.lastMessage,
              content: 'Message deleted',
            },
          });
          syncListsFromCache(activeFamilyCode);
          setConversation(getCachedConversation(selectedId));
        }
      } catch (error) {
        console.error('Failed to delete message:', error);
      }
    },
    [activeFamilyCode, selectedId, syncListsFromCache],
  );

  const handleMute = useCallback(async () => {
    if (!conversation || !activeFamilyCode) return;

    try {
      const result = await toggleMute(
        conversation.id,
        activeFamilyCode,
        conversation.isMuted,
      );

      const nextConversation = cacheConversation({
        ...conversation,
        isMuted: Boolean(result?.isMuted),
      });
      setConversation(nextConversation);
      syncListsFromCache(activeFamilyCode);
    } catch (error) {
      console.error('Failed to update mute state:', error);
    } finally {
      setMenuOpen(false);
    }
  }, [activeFamilyCode, conversation, syncListsFromCache]);

  const handleOpenRoomMembers = useCallback(async () => {
    if (!conversation?.roomId || !activeFamilyCodeRef.current) {
      return;
    }

    setMenuOpen(false);
    setInfoPanelOpen(false);
    setRoomMembersError('');
    setSelectedRoomMemberIds([]);

    try {
      await loadFamilyMembers();
    } catch (error) {
      console.error('Failed to load room members:', error);
      setRoomMembersError(error?.message || 'Failed to load family members');
    }

    setRoomMembersOpen(true);
  }, [conversation?.roomId, loadFamilyMembers]);

  const handleToggleRoomMemberSelection = useCallback((member) => {
    const memberId = Number(member?.userId || 0);
    if (!memberId) {
      return;
    }

    setSelectedRoomMemberIds((currentIds) =>
      currentIds.includes(memberId)
        ? currentIds.filter((entry) => entry !== memberId)
        : [...currentIds, memberId],
    );
  }, []);

  const handleAddRoomMembers = useCallback(async () => {
    if (!conversation?.roomId || !activeFamilyCode || selectedRoomMemberIds.length === 0) {
      return;
    }

    setRoomMembersSubmitting(true);
    setRoomMembersError('');

    try {
      const nextConversation = await addMembersToRoom(
        conversation.roomId,
        activeFamilyCode,
        selectedRoomMemberIds,
      );
      applyConversationRefresh(nextConversation);
      setSelectedRoomMemberIds([]);
    } catch (error) {
      console.error('Failed to add room members:', error);
      setRoomMembersError(error?.message || 'Failed to add room members');
    } finally {
      setRoomMembersSubmitting(false);
    }
  }, [
    activeFamilyCode,
    applyConversationRefresh,
    conversation?.roomId,
    selectedRoomMemberIds,
  ]);

  const handleRemoveRoomMember = useCallback(
    async (member) => {
      if (!conversation?.roomId || !activeFamilyCode || !member?.userId) {
        return;
      }

      const memberName = member?.name || 'this member';
      if (!window.confirm(`Remove ${memberName} from this room?`)) {
        return;
      }

      setRoomMembersSubmitting(true);
      setRoomMembersError('');

      try {
        const nextConversation = await removeMemberFromRoom(
          conversation.roomId,
          activeFamilyCode,
          member.userId,
        );
        applyConversationRefresh(nextConversation);
      } catch (error) {
        console.error('Failed to remove room member:', error);
        setRoomMembersError(error?.message || 'Failed to remove room member');
      } finally {
        setRoomMembersSubmitting(false);
      }
    },
    [activeFamilyCode, applyConversationRefresh, conversation?.roomId],
  );

  const handleOpenRoomPhotoPicker = useCallback(() => {
    setMenuOpen(false);
    setInfoPanelOpen(false);
    roomPhotoInputRef.current?.click();
  }, []);

  const handleRoomPhotoChange = useCallback(
    async (event) => {
      const input = event.target;
      const file = input?.files?.[0] || null;
      if (input) {
        input.value = '';
      }

      if (!file || !conversation?.roomId || !activeFamilyCode) {
        return;
      }

      setRoomPhotoUploading(true);
      setRoomMembersError('');

      try {
        const nextConversation = await updateRoomConversation(
          conversation.roomId,
          activeFamilyCode,
          { file },
        );
        applyConversationRefresh(nextConversation);
      } catch (error) {
        console.error('Failed to update room photo:', error);
        const message = error?.message || 'Failed to update room photo';
        setRoomMembersError(message);
        window.alert(message);
      } finally {
        setRoomPhotoUploading(false);
      }
    },
    [activeFamilyCode, applyConversationRefresh, conversation?.roomId],
  );

  const handleLeaveRoom = useCallback(async () => {
    if (!conversation?.roomId || !activeFamilyCode || !selectedId) {
      return;
    }

    const roomName = conversation?.roomName || 'this room';
    if (!window.confirm(`Leave ${roomName}?`)) {
      return;
    }

    setLeavingRoom(true);
    setMenuOpen(false);
    setRoomMembersOpen(false);
    setRoomMembersError('');
    setSelectedRoomMemberIds([]);

    try {
      await leaveRoomConversation(conversation.roomId, activeFamilyCode);
      removeCachedConversation(selectedId, activeFamilyCode);

      const roomResponse = await getRooms(activeFamilyCode);
      setRooms(cacheRooms(activeFamilyCode, roomResponse?.rooms || []));
      clearOpenConversation();
    } catch (error) {
      console.error('Failed to leave room:', error);
      const message = error?.message || 'Failed to leave this room';
      setRoomMembersError(message);
      window.alert(message);
    } finally {
      setLeavingRoom(false);
    }
  }, [
    activeFamilyCode,
    conversation?.roomId,
    conversation?.roomName,
    selectedId,
    clearOpenConversation,
  ]);

  const handleRenameRoom = useCallback(() => {
    if (!conversation?.roomId || !activeFamilyCode) {
      return;
    }

    setMenuOpen(false);
    setInfoPanelOpen(false);
    setRoomNameDraft(String(conversation?.roomName || '').trim());
    setRoomNameError('');
    setRoomNameEditorOpen(true);
  }, [
    activeFamilyCode,
    conversation?.roomId,
    conversation?.roomName,
  ]);

  const handleCloseRoomNameEditor = useCallback(() => {
    if (roomNameSubmitting) {
      return;
    }

    setRoomNameEditorOpen(false);
    setRoomNameDraft('');
    setRoomNameError('');
  }, [roomNameSubmitting]);

  const handleSubmitRoomName = useCallback(async () => {
    if (!conversation?.roomId || !activeFamilyCode) {
      return;
    }

    const normalizedRoomName = String(roomNameDraft || '').trim();
    if (!normalizedRoomName) {
      setRoomNameError('Room name is required.');
      return;
    }

    if (normalizedRoomName === String(conversation?.roomName || '').trim()) {
      handleCloseRoomNameEditor();
      return;
    }

    setRoomNameSubmitting(true);
    setRoomNameError('');
    try {
      const nextConversation = await updateRoomConversation(
        conversation.roomId,
        activeFamilyCode,
        { roomName: normalizedRoomName },
      );
      applyConversationRefresh(nextConversation);
      setRoomNameEditorOpen(false);
      setRoomNameDraft('');
    } catch (error) {
      console.error('Failed to rename room:', error);
      setRoomNameError(error?.message || 'Failed to rename this room');
    } finally {
      setRoomNameSubmitting(false);
    }
  }, [
    activeFamilyCode,
    applyConversationRefresh,
    conversation?.roomId,
    conversation?.roomName,
    handleCloseRoomNameEditor,
    roomNameDraft,
  ]);

  const handleRemoveRoomPhoto = useCallback(async () => {
    if (!conversation?.roomId || !activeFamilyCode || !conversation?.roomAvatarUrl) {
      return;
    }

    try {
      const nextConversation = await updateRoomConversation(
        conversation.roomId,
        activeFamilyCode,
        { removeAvatar: true },
      );
      applyConversationRefresh(nextConversation);
    } catch (error) {
      console.error('Failed to remove room photo:', error);
      window.alert(error?.message || 'Failed to remove this room photo');
    } finally {
      setMenuOpen(false);
    }
  }, [
    activeFamilyCode,
    applyConversationRefresh,
    conversation?.roomAvatarUrl,
    conversation?.roomId,
  ]);

  const handleDeleteConversation = useCallback(async () => {
    if (!selectedId || !activeFamilyCode) {
      return;
    }

    if (!window.confirm('Delete this complete chat?')) {
      return;
    }

    try {
      await deleteConversationRequest(selectedId, activeFamilyCode);
      removeCachedConversation(selectedId, activeFamilyCode);
      const conversationResponse = await getConversations(activeFamilyCode);
      setConversations(
        cacheConversations(activeFamilyCode, conversationResponse?.conversations || []),
      );
      clearOpenConversation();
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      window.alert(error?.message || 'Failed to delete this chat');
    } finally {
      setMenuOpen(false);
    }
  }, [activeFamilyCode, clearOpenConversation, selectedId]);

  const handleDeleteRoom = useCallback(async () => {
    if (!conversation?.roomId || !activeFamilyCode || !selectedId) {
      return;
    }

    const roomName = conversation?.roomName || 'this room';
    if (!window.confirm(`Delete ${roomName} for everyone in this room?`)) {
      return;
    }

    try {
      await deleteRoomConversation(conversation.roomId, activeFamilyCode);
      removeCachedConversation(selectedId, activeFamilyCode);
      const roomResponse = await getRooms(activeFamilyCode);
      setRooms(cacheRooms(activeFamilyCode, roomResponse?.rooms || []));
      clearOpenConversation();
    } catch (error) {
      console.error('Failed to delete room:', error);
      window.alert(error?.message || 'Failed to delete this room');
    } finally {
      setMenuOpen(false);
    }
  }, [
    activeFamilyCode,
    clearOpenConversation,
    conversation?.roomId,
    conversation?.roomName,
    selectedId,
  ]);

  const handleCycleMessageSearch = useCallback(
    (direction) => {
      if (messageSearchMatches.length === 0) {
        return;
      }

      setActiveMessageSearchIndex((currentIndex) => {
        const baseIndex = currentIndex < 0 ? 0 : currentIndex;
        return direction < 0
          ? (baseIndex - 1 + messageSearchMatches.length) % messageSearchMatches.length
          : (baseIndex + 1) % messageSearchMatches.length;
      });
    },
    [messages, messageSearchQuery],
  );

  const handleMessageSearchKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleCycleMessageSearch(event.shiftKey ? -1 : 1);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        handleCycleMessageSearch(-1);
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        handleCycleMessageSearch(1);
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setMessageSearchOpen(false);
        setMessageSearchQuery('');
        setActiveMessageSearchIndex(-1);
      }
    },
    [handleCycleMessageSearch],
  );

  const handleOpenNewConversation = useCallback(async () => {
    if (!activeFamilyCodeRef.current) {
      return;
    }

    setNewConversationError('');
    setNewConversationMemberId(null);

    try {
      await loadFamilyMembers();
      setNewConversationOpen(true);
    } catch (error) {
      console.error('Failed to load family members for direct chat:', error);
      setNewConversationError(error?.message || 'Failed to load family members');
      setNewConversationOpen(true);
    }
  }, [loadFamilyMembers]);

  const handleCreateDirectConversation = useCallback(async () => {
    const targetUserId = Number(newConversationMemberId || 0);
    if (!activeFamilyCode || !targetUserId) {
      return;
    }

    setNewConversationSubmitting(true);
    setNewConversationError('');

    try {
      const nextConversation = await createConversation(activeFamilyCode, targetUserId);
      cacheConversation(nextConversation);
      syncListsFromCache(activeFamilyCode);
      setNewConversationOpen(false);
      setNewConversationMemberId(null);
      openChat(nextConversation.id, CONVERSATION_TYPES.DIRECT);
    } catch (error) {
      console.error('Failed to create direct conversation:', error);
      setNewConversationError(error?.message || 'Failed to start this conversation');
    } finally {
      setNewConversationSubmitting(false);
    }
  }, [
    activeFamilyCode,
    newConversationMemberId,
    openChat,
    syncListsFromCache,
  ]);

  const handleOpenCreateRoom = useCallback(async () => {
    if (!activeFamilyCodeRef.current) {
      return;
    }

    setCreateRoomError('');
    setCreateRoomName('');
    setCreateRoomMemberIds([]);

    try {
      await loadFamilyMembers();
      setCreateRoomOpen(true);
    } catch (error) {
      console.error('Failed to load family members for room creation:', error);
      setCreateRoomError(error?.message || 'Failed to load family members');
      setCreateRoomOpen(true);
    }
  }, [loadFamilyMembers]);

  const handleToggleCreateRoomMember = useCallback((member) => {
    const memberId = Number(member?.userId || 0);
    if (!memberId) {
      return;
    }

    setCreateRoomMemberIds((currentIds) =>
      currentIds.includes(memberId)
        ? currentIds.filter((entry) => entry !== memberId)
        : [...currentIds, memberId],
    );
  }, []);

  const handleCreateRoom = useCallback(async () => {
    const normalizedRoomName = String(createRoomName || '').trim();
    if (!activeFamilyCode || !normalizedRoomName || createRoomMemberIds.length === 0) {
      return;
    }

    setCreateRoomSubmitting(true);
    setCreateRoomError('');

    try {
      const nextConversation = await createRoomConversation(
        activeFamilyCode,
        normalizedRoomName,
        createRoomMemberIds,
      );
      cacheConversation(nextConversation);
      syncListsFromCache(activeFamilyCode);
      setCreateRoomOpen(false);
      setCreateRoomName('');
      setCreateRoomMemberIds([]);
      setActiveTab('rooms');
      openChat(nextConversation.id, CONVERSATION_TYPES.GROUP);
    } catch (error) {
      console.error('Failed to create room:', error);
      setCreateRoomError(error?.message || 'Failed to create this room');
    } finally {
      setCreateRoomSubmitting(false);
    }
  }, [
    activeFamilyCode,
    createRoomMemberIds,
    createRoomName,
    openChat,
    syncListsFromCache,
  ]);

  const handleComposerKeyDown = useCallback(
    (event) => {
      if (event.nativeEvent?.isComposing) {
        return;
      }

      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleOpenAttachmentPicker = useCallback(() => {
    setShowComposerPicker(false);
    fileInputRef.current?.click();
  }, []);

  const handleToggleComposerPicker = useCallback(() => {
    if (!selectedId || chatLoading || sendingMediaRef.current) {
      return;
    }

    setShowComposerPicker((currentValue) => !currentValue);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [chatLoading, selectedId]);

  const handleBack = useCallback(() => {
    clearOpenConversation();
  }, [clearOpenConversation]);

  const handleHeaderSearch = useCallback(() => {
    setMenuOpen(false);
    setMessageSearchOpen(true);
    window.requestAnimationFrame(() => messageSearchInputRef.current?.focus());
  }, []);

  const handleOpenInfoPanel = useCallback(async () => {
    setMenuOpen(false);

    try {
      await loadFamilyMembers();
    } catch (error) {
      console.error('Failed to load chat info details:', error);
    }

    setInfoPanelOpen(true);
  }, [loadFamilyMembers]);

  const handleCloseInfoPanel = useCallback(() => {
    setInfoPanelOpen(false);
  }, []);

  const handleInfoPanelSearch = useCallback(() => {
    setInfoPanelOpen(false);
    handleHeaderSearch();
  }, [handleHeaderSearch]);

  const msgCount = useMemo(
    () => conversations.reduce((total, item) => total + Number(item?.unreadCount || 0), 0),
    [conversations],
  );

  const roomCount = useMemo(
    () => rooms.reduce((total, item) => total + Number(item?.unreadCount || 0), 0),
    [rooms],
  );

  const filteredConversations = useMemo(() => {
    const query = search.toLowerCase();
    return conversations.filter((conversationItem) => {
      const shouldSurfaceConversation =
        conversationItem?.conversationState !== CONVERSATION_STATES.REVOKED ||
        Number(conversationItem?.unreadCount || 0) > 0;
      if (!shouldSurfaceConversation) {
        return false;
      }
      if (!query) return true;
      const participant = conversationItem?.participants?.[0] || {};
      const fullName = (
        `${participant.firstName || ''} ${participant.lastName || ''}`.trim() ||
        participant?.name ||
        ''
      ).toLowerCase();
      return fullName.includes(query);
    });
  }, [conversations, search]);

  const filteredRooms = useMemo(() => {
    const query = search.toLowerCase();
    return rooms.filter((room) => {
      const shouldSurfaceConversation =
        ![CONVERSATION_STATES.REVOKED, CONVERSATION_STATES.ARCHIVED].includes(
          room?.conversationState,
        ) ||
        Number(room?.unreadCount || 0) > 0;
      if (!shouldSurfaceConversation) {
        return false;
      }

      return !query || getRoomDisplayName(room).toLowerCase().includes(query);
    });
  }, [rooms, search]);

  const messageSearchMatches = useMemo(() => {
    const query = String(messageSearchQuery || '').trim().toLowerCase();
    if (!query) {
      return [];
    }

    return messages
      .filter((message) => {
        if (
          !message ||
          message?.isDeleted ||
          message?.messageType === MESSAGE_TYPES.SYSTEM ||
          message?.messageType === MESSAGE_TYPES.TOMBSTONE
        ) {
          return false;
        }

        return getMessageSearchText(message).includes(query);
      })
      .map((message) => ({
        messageId: Number(message?.id || 0),
      }))
      .filter((match) => match.messageId > 0);
  }, [messageSearchQuery, messages]);

  const messageSearchMatchIds = useMemo(
    () =>
      new Set(
        messageSearchMatches
          .map((match) => Number(match?.messageId || 0))
          .filter((messageId) => messageId > 0),
      ),
    [messageSearchMatches],
  );

  useEffect(() => {
    if (!messageSearchOpen) {
      return;
    }

    if (messageSearchMatches.length === 0) {
      setActiveMessageSearchIndex(-1);
      return;
    }

    setActiveMessageSearchIndex((currentIndex) =>
      currentIndex >= 0 && currentIndex < messageSearchMatches.length ? currentIndex : 0,
    );
  }, [messageSearchMatches, messageSearchOpen]);

  const activeMessageSearchMatch =
    activeMessageSearchIndex >= 0 ? messageSearchMatches[activeMessageSearchIndex] : null;
  const activeMessageSearchId = Number(activeMessageSearchMatch?.messageId || 0) || null;

  useEffect(() => {
    if (!activeMessageSearchId) {
      return;
    }

    const node = messageNodeRefs.current.get(activeMessageSearchId);
    if (!node) {
      return;
    }

    node.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    node.focus?.({ preventScroll: true });
  }, [activeMessageSearchId]);

  const groupedMessages = useMemo(() => {
    const nextGroupedMessages = [];
    let lastDateLabel = '';

    for (const message of messages) {
      const dateLabel = formatDateSeparator(message.createdAt);
      if (dateLabel !== lastDateLabel) {
        nextGroupedMessages.push({
          key: `date-${message.createdAt}`,
          type: 'date',
          label: dateLabel,
        });
        lastDateLabel = dateLabel;
      }

      nextGroupedMessages.push({
        key: `message-${message.id}`,
        type: 'message',
        data: message,
      });
    }

    return nextGroupedMessages;
  }, [messages]);

  const typingLabel = useMemo(() => {
    if (typingUserIds.length === 0) {
      return '';
    }

    const participants = Array.isArray(conversation?.participants)
      ? conversation.participants
      : [];

    const names = typingUserIds.map((userId) => {
      const matchingParticipant = participants.find(
        (participant) => Number(participant?.userId || 0) === Number(userId || 0),
      );

      if (!matchingParticipant) {
        return 'Member';
      }

      return (
        `${matchingParticipant.firstName || ''} ${matchingParticipant.lastName || ''}`.trim() ||
        matchingParticipant.name ||
        'Member'
      );
    });

    return buildTypingUserLabel(names);
  }, [conversation, typingUserIds]);

  const isGroup = selectedType === CONVERSATION_TYPES.GROUP;
  const familyMemberMap = useMemo(
    () =>
      new Map(
        familyMembers
          .map((member) => [Number(member?.userId || 0), member])
          .filter(([memberId]) => memberId > 0),
      ),
    [familyMembers],
  );
  const currentRoomMembers = useMemo(() => {
    const roomMembers = Array.isArray(conversation?.roomMembers)
      ? conversation.roomMembers
      : [];
    if (roomMembers.length === 0) {
      return [];
    }

    return roomMembers
      .map((member) => {
        const memberId = Number(member?.userId || 0);
        const familyMember = familyMemberMap.get(memberId);
        return {
          ...member,
          ...(familyMember || {}),
          userId: memberId,
          familyCode:
            familyMember?.familyCode ||
            normalizeFamilyCode(conversation?.familyCode || activeFamilyCode),
          sourceFamilyCode:
            familyMember?.sourceFamilyCode ||
            normalizeFamilyCode(conversation?.familyCode || activeFamilyCode),
          membershipType: familyMember?.membershipType || 'member',
          isNotInTree: Boolean(familyMember?.isNotInTree),
          profileUrl: familyMember?.profileUrl || member?.profileUrl || '',
          name:
            familyMember?.name ||
            member?.name ||
            `${member?.firstName || ''} ${member?.lastName || ''}`.trim() ||
            'Family Member',
        };
      })
      .filter(Boolean);
  }, [activeFamilyCode, conversation?.familyCode, conversation?.roomMembers, familyMemberMap]);
  const currentRoomMemberIds = useMemo(
    () =>
      new Set(
        currentRoomMembers
          .map((member) => Number(member?.userId || 0))
          .filter((memberId) => memberId > 0),
      ),
    [currentRoomMembers],
  );
  const availableRoomMembers = useMemo(
    () =>
      familyMembers.filter(
        (member) => !currentRoomMemberIds.has(Number(member?.userId || 0)),
      ),
    [currentRoomMemberIds, familyMembers],
  );
  const availableDirectMembers = useMemo(
    () =>
      familyMembers.filter(
        (member) => Number(member?.userId || 0) > 0 && Number(member?.userId || 0) !== Number(currentUserId || 0),
      ),
    [currentUserId, familyMembers],
  );
  const activeFamily = useMemo(
    () =>
      families.find(
        (family) =>
          normalizeFamilyCode(family?.familyCode) === normalizeFamilyCode(activeFamilyCode),
      ) || null,
    [activeFamilyCode, families],
  );
  const activeParticipant = conversation?.participants?.[0] || {};
  const selectedContactMember = useMemo(
    () => familyMemberMap.get(Number(activeParticipant?.userId || 0)) || null,
    [activeParticipant?.userId, familyMemberMap],
  );
  const familyMembersLoadedForScope =
    familyMembersFamilyCodeRef.current === normalizeFamilyCode(activeFamilyCode);
  const roomMemberCount = familyMembersLoadedForScope
    ? currentRoomMembers.length
    : Number(conversation?.memberCount || currentRoomMembers.length || 0);
  const canManageRoom = Boolean(isGroup && conversation?.canManageRoom);
  const canManageRoomMembers =
    canManageRoom &&
    !['general', 'announcements'].includes(String(conversation?.roomType || '').toLowerCase());
  const canLeaveRoom = Boolean(isGroup && conversation?.canLeaveRoom);
  const roomDisplayName = getRoomDisplayName(conversation);
  const roomTypeLabel = getRoomTypeLabel(conversation?.roomType);
  const headerName = isGroup
    ? roomDisplayName
    : `${activeParticipant.firstName || ''} ${activeParticipant.lastName || ''}`.trim() ||
    activeParticipant?.name ||
    'Chat';
  const directChatBadges = isGroup ? [] : getChatMemberBadges(selectedContactMember || {});
  const headerInitials = getInitials(
    activeParticipant.firstName,
    activeParticipant.lastName,
  );
  const roomAvatarUrl = conversation?.roomAvatarUrl || '';
  const headerStatusLabel = isGroup
    ? conversation?.conversationState === CONVERSATION_STATES.ACTIVE
      ? `${roomMemberCount} member${roomMemberCount === 1 ? '' : 's'}`
      : conversation?.conversationState === CONVERSATION_STATES.READ_ONLY
        ? 'Read-only chat'
        : conversation?.conversationState === CONVERSATION_STATES.REVOKED
          ? 'Chat unavailable'
          : conversation?.conversationState === CONVERSATION_STATES.ARCHIVED
            ? 'Archived chat'
            : roomTypeLabel
    : conversation?.conversationState === CONVERSATION_STATES.READ_ONLY
      ? 'Read-only chat'
      : conversation?.conversationState === CONVERSATION_STATES.REVOKED
        ? 'Chat unavailable'
        : conversation?.conversationState === CONVERSATION_STATES.ARCHIVED
          ? 'Archived chat'
          : isChatConnected
            ? 'Online now'
            : 'Connecting...';
  const showHeaderOnline =
    !isGroup &&
    isChatConnected &&
    conversation?.conversationState === CONVERSATION_STATES.ACTIVE;
  const sharedMediaCount = useMemo(
    () =>
      messages.filter(
        (message) => Boolean(message?.mediaUrl) && !Boolean(message?.isDeleted),
      ).length,
    [messages],
  );
  const infoPanelTitle = isGroup ? 'Group info' : 'Contact info';
  const infoPanelDescription = getConversationInfoDescription(
    conversation,
    activeFamily?.familyName || activeFamilyCode,
  );
  const infoCreatedAtLabel = formatInfoDateTime(conversation?.createdAt);
  const infoFamilyLabel = activeFamily?.familyName || activeFamilyCode || 'Family chat';
  const infoPrimaryMeta = isGroup
    ? `${roomTypeLabel} in ${infoFamilyLabel}`
    : `${getChatMemberMetaText(selectedContactMember || {})} in ${infoFamilyLabel}`;
  const showDesktopInfoPanel = Boolean(infoPanelOpen && !isMobile && selectedId);
  const showMobileInfoPanel = Boolean(infoPanelOpen && isMobile && selectedId);

  const showSidebar = !isMobile || !selectedId;
  const showChat = !isMobile || Boolean(selectedId);
  const isComposerDisabled =
    !selectedId || chatLoading || sendingMedia || conversation?.canSend === false;
  const composerPlaceholder =
    conversation?.canSend === false ? 'Messaging unavailable in this chat' : 'Type a message...';

  const renderInfoPanel = (mobile = false) => (
    <aside
      className={`chat-info-panel${mobile ? ' chat-info-panel--mobile' : ''}`}
      role="dialog"
      aria-label={infoPanelTitle}
    >
      <div className="chat-info-panel-header">
        <button
          className="chat-info-panel-close"
          onClick={handleCloseInfoPanel}
          type="button"
          aria-label="Close info panel"
        >
          <FiX size={18} />
        </button>
        <h3>{infoPanelTitle}</h3>
      </div>

      <div className="chat-info-panel-scroll custom-scrollbar">
        <section className="chat-info-hero">
          <div className="chat-info-avatar-wrap">
            <div
              className={`chat-info-avatar${isGroup && !roomAvatarUrl ? ' chat-info-avatar--room' : ''
                }`}
            >
              {isGroup ? (
                roomAvatarUrl ? (
                  <img src={roomAvatarUrl} alt={headerName} />
                ) : (
                  getRoomIcon(conversation?.roomType)
                )
              ) : activeParticipant.profileUrl ? (
                <img src={activeParticipant.profileUrl} alt={headerName} />
              ) : (
                headerInitials
              )}
            </div>
            {canManageRoom ? (
              <button
                className="chat-info-avatar-edit"
                onClick={handleOpenRoomPhotoPicker}
                type="button"
                aria-label="Change room photo"
              >
                <FiCamera size={15} />
              </button>
            ) : null}
          </div>

          <h3 className="chat-info-title">{headerName}</h3>
          <p className="chat-info-subtitle">
            {isGroup
              ? `${roomTypeLabel} · ${roomMemberCount} member${roomMemberCount === 1 ? '' : 's'}`
              : infoPrimaryMeta}
          </p>

          <div
            className={`chat-info-hero-actions${!isGroup ? ' chat-info-hero-actions--compact' : ''
              }`}
          >
            {isGroup ? (
              <button
                className="chat-info-hero-btn"
                onClick={handleOpenRoomMembers}
                type="button"
              >
                <FiUsers size={18} />
                <span>{canManageRoomMembers ? 'Add members' : 'View members'}</span>
              </button>
            ) : (
              <button
                className="chat-info-hero-btn"
                onClick={handleInfoPanelSearch}
                type="button"
              >
                <FiSearch size={18} />
                <span>Search</span>
              </button>
            )}

            <button
              className="chat-info-hero-btn"
              onClick={isGroup ? handleInfoPanelSearch : handleMute}
              type="button"
            >
              {isGroup ? <FiSearch size={18} /> : conversation?.isMuted ? <FiVolume2 size={18} /> : <FiVolumeX size={18} />}
              <span>
                {isGroup
                  ? 'Search'
                  : conversation?.isMuted
                    ? 'Unmute'
                    : 'Mute'}
              </span>
            </button>
          </div>
        </section>

        <section className="chat-info-section">
          <div className="chat-info-section-heading">Overview</div>

          {isGroup ? (
            <div className="chat-info-row">
              <div className="chat-info-row-icon">
                <FiEdit2 size={16} />
              </div>
              <div className="chat-info-row-body">
                <div className="chat-info-row-title">Room name</div>
                <div className="chat-info-row-text">{roomDisplayName}</div>
              </div>
              {canManageRoom ? (
                <button
                  className="chat-info-row-btn"
                  onClick={handleRenameRoom}
                  type="button"
                >
                  Edit
                </button>
              ) : null}
            </div>
          ) : (
            <div className="chat-info-row">
              <div className="chat-info-row-icon">
                <FiUsers size={16} />
              </div>
              <div className="chat-info-row-body">
                <div className="chat-info-row-title">Family</div>
                <div className="chat-info-row-text">{infoFamilyLabel}</div>
              </div>
            </div>
          )}

          <div className="chat-info-row">
            <div className="chat-info-row-icon">
              <FiMessageCircle size={16} />
            </div>
            <div className="chat-info-row-body">
              <div className="chat-info-row-title">
                {isGroup ? 'About this room' : 'About this chat'}
              </div>
              <div className="chat-info-row-text">{infoPanelDescription}</div>
            </div>
          </div>

          <div className="chat-info-row">
            <div className="chat-info-row-icon">
              <FiCamera size={16} />
            </div>
            <div className="chat-info-row-body">
              <div className="chat-info-row-title">Shared media</div>
              <div className="chat-info-row-text">
                {sharedMediaCount} item{sharedMediaCount === 1 ? '' : 's'} in the loaded chat
              </div>
            </div>
          </div>

          <div className="chat-info-row">
            <div className="chat-info-row-icon">
              {conversation?.isMuted ? <FiVolumeX size={16} /> : <FiVolume2 size={16} />}
            </div>
            <div className="chat-info-row-body">
              <div className="chat-info-row-title">Notifications</div>
              <div className="chat-info-row-text">
                {conversation?.isMuted ? 'Muted for this chat' : 'Notifications are active'}
              </div>
            </div>
            <button className="chat-info-row-btn" onClick={handleMute} type="button">
              {conversation?.isMuted ? 'Unmute' : 'Mute'}
            </button>
          </div>

          <div className="chat-info-row">
            <div className="chat-info-row-icon">
              <FiUsers size={16} />
            </div>
            <div className="chat-info-row-body">
              <div className="chat-info-row-title">
                {isGroup ? 'Created' : 'Conversation started'}
              </div>
              <div className="chat-info-row-text">{infoCreatedAtLabel}</div>
            </div>
          </div>
        </section>

        {isGroup ? (
          <section className="chat-info-section">
            <div className="chat-info-section-heading">Members</div>
            <div className="chat-info-members-preview">
              {currentRoomMembers.slice(0, 5).map((member) => (
                <div className="chat-info-member-chip" key={`info-member-${member.userId}`}>
                  <div className="chat-info-member-chip-avatar">
                    {member.profileUrl ? (
                      <img src={member.profileUrl} alt={member.name} />
                    ) : (
                      getInitials(member.firstName, member.lastName)
                    )}
                  </div>
                  <div className="chat-info-member-chip-text">
                    <span>{member.name}</span>
                    <small>{getChatMemberMetaText(member)}</small>
                    <div className="chat-member-chip-row chat-member-chip-row--compact">
                      {member.isFamilyAdmin ? (
                        <span className="chat-member-chip">Admin</span>
                      ) : null}
                      {getChatMemberBadges(member).map((badge) => (
                        <span
                          className={`chat-member-chip ${badge.className}`}
                          key={`info-member-${member.userId}-${badge.key}`}
                          title={badge.title}
                        >
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              className="chat-info-wide-action"
              onClick={handleOpenRoomMembers}
              type="button"
            >
              <FiUsers size={16} />
              {canManageRoomMembers ? 'Manage members' : 'View members'}
            </button>
          </section>
        ) : null}

        <section className="chat-info-section">
          <div className="chat-info-section-heading">Actions</div>

          <button
            className="chat-info-action-row"
            onClick={handleInfoPanelSearch}
            type="button"
          >
            <FiSearch size={17} />
            <span>Search in chat</span>
          </button>

          {canManageRoom ? (
            <button
              className="chat-info-action-row"
              onClick={handleOpenRoomPhotoPicker}
              type="button"
            >
              <FiCamera size={17} />
              <span>Change room photo</span>
            </button>
          ) : null}

          {canLeaveRoom ? (
            <button
              className="chat-info-action-row chat-info-action-row--danger"
              onClick={handleLeaveRoom}
              type="button"
            >
              <FiLogOut size={17} />
              <span>Leave room</span>
            </button>
          ) : null}

          {canManageRoomMembers ? (
            <button
              className="chat-info-action-row chat-info-action-row--danger"
              onClick={handleDeleteRoom}
              type="button"
            >
              <FiTrash2 size={17} />
              <span>Delete room</span>
            </button>
          ) : null}

          {!isGroup ? (
            <button
              className="chat-info-action-row chat-info-action-row--danger"
              onClick={handleDeleteConversation}
              type="button"
            >
              <FiTrash2 size={17} />
              <span>Delete chat</span>
            </button>
          ) : null}
        </section>
      </div>
    </aside>
  );

  return (
    <div className="chat-split" id="chat-page">
      {showSidebar && (
        <div className="chat-sidebar">
          <div className="chat-sidebar-search">
            <div className="chat-search-box">
              <FiSearch size={14} color="#9ca3af" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search chats"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="chat-search-input"
              />
            </div>
          </div>

          <div className="chat-sidebar-toolbar">
            <div className="chat-sidebar-tabs">
              <button
                className={`chat-pill${activeTab === 'messages' ? ' active' : ''}`}
                onClick={() => setActiveTab('messages')}
                type="button"
              >
                Messages {msgCount > 0 && <span className="chat-pill-badge">{msgCount}</span>}
              </button>
              <button
                className={`chat-pill${activeTab === 'rooms' ? ' active' : ''}`}
                onClick={() => setActiveTab('rooms')}
                type="button"
              >
                Rooms {roomCount > 0 && <span className="chat-pill-badge">{roomCount}</span>}
              </button>
            </div>

            {hasFamilyScope && (
              activeTab === 'messages' ? (
                <button
                  className="chat-sidebar-action chat-sidebar-action--inline"
                  onClick={handleOpenNewConversation}
                  type="button"
                >
                  <FiPlus size={14} />
                  New conversation
                </button>
              ) : (
                <button
                  className="chat-sidebar-action chat-sidebar-action--inline"
                  onClick={handleOpenCreateRoom}
                  type="button"
                >
                  <FiPlus size={14} />
                  Create room
                </button>
              )
            )}
          </div>

          {hasFamilyScope && activeTab === 'rooms' ? (
            <div className="chat-sidebar-note-row">
              <span className="chat-sidebar-note">
                Custom rooms can include linked, associated, and not-in-tree app users.
              </span>
            </div>
          ) : null}

          <div className="chat-sidebar-list custom-scrollbar">
            {listLoading ? (
              <div className="chat-list-loader" aria-label="Loading chat list">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div className="chat-list-loader__item" key={`chat-list-loader-${index}`}>
                    <div className="chat-list-loader__avatar shimmer-block" />
                    <div className="chat-list-loader__body">
                      <div className="chat-list-loader__line shimmer-block" />
                      <div className="chat-list-loader__line chat-list-loader__line--short shimmer-block" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !hasFamilyScope ? (
              <div className="chat-empty">
                <FiUsers size={40} />
                <p>No rooms available</p>
              </div>
            ) : activeTab === 'messages' ? (
              filteredConversations.length > 0 ? (
                filteredConversations.map((conversationItem) => {
                  const participant = conversationItem?.participants?.[0] || {};
                  const participantMember =
                    familyMemberMap.get(Number(participant?.userId || 0)) || null;
                  const participantBadges = getChatMemberBadges(participantMember || {});
                  const fullName =
                    `${participant.firstName || ''} ${participant.lastName || ''}`.trim() ||
                    participant?.name ||
                    'Unknown';
                  const initials = getInitials(
                    participant.firstName,
                    participant.lastName,
                  );
                  const isActive = isSameConversation(selectedId, conversationItem?.id);

                  return (
                    <div
                      key={conversationItem.id}
                      className={`chat-li${isActive ? ' active' : ''}`}
                      onClick={() =>
                        openChat(conversationItem.id, CONVERSATION_TYPES.DIRECT)
                      }
                    >
                      <div className="chat-avatar">
                        {participant.profileUrl ? (
                          <img src={participant.profileUrl} alt="" />
                        ) : (
                          initials
                        )}
                        <div className="chat-avatar-online" />
                      </div>
                      <div className="chat-li-body">
                        <div className="chat-li-top">
                          <div className="chat-li-name-row">
                            <span className="chat-li-name">{fullName}</span>
                            {participantBadges.map((badge) => (
                              <span
                                className={`chat-member-chip ${badge.className}`}
                                key={`${conversationItem.id}-${badge.key}`}
                                title={badge.title}
                              >
                                {badge.label}
                              </span>
                            ))}
                          </div>
                          <span
                            className={`chat-li-time${conversationItem.unreadCount ? ' unread' : ''
                              }`}
                          >
                            {formatMessageTime(conversationItem?.lastMessage?.createdAt)}
                          </span>
                        </div>
                        <div className="chat-li-preview">
                          {getMessagePreviewText(conversationItem?.lastMessage)}
                        </div>
                      </div>
                      {conversationItem.unreadCount > 0 && (
                        <span className="chat-li-badge">
                          {conversationItem.unreadCount}
                        </span>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="chat-empty">
                  <FiMessageCircle size={40} />
                  <p>No conversations</p>
                </div>
              )
            ) : filteredRooms.length > 0 ? (
              filteredRooms.map((room) => {
                const isActive = isSameConversation(selectedId, room?.id);
                const roomDisplayLabel = getRoomDisplayName(room);
                return (
                  <div
                    key={room.id}
                    className={`chat-li${isActive ? ' active' : ''}`}
                    onClick={() => openChat(room.id, CONVERSATION_TYPES.GROUP)}
                  >
                    <div
                      className={`chat-avatar${room?.roomAvatarUrl ? '' : ' chat-avatar--room'
                        }`}
                    >
                      {room?.roomAvatarUrl ? (
                        <img src={room.roomAvatarUrl} alt={room.roomName || 'Room'} />
                      ) : (
                        getRoomIcon(room.roomType)
                      )}
                    </div>
                    <div className="chat-li-body">
                      <div className="chat-li-top">
                        <span className="chat-li-name">{roomDisplayLabel}</span>
                        <span
                          className={`chat-li-time${room.unreadCount ? ' unread' : ''}`}
                        >
                          {formatMessageTime(room?.lastMessage?.createdAt)}
                        </span>
                      </div>
                      <div className="chat-li-preview">
                        {getMessagePreviewText(room?.lastMessage)}
                      </div>
                    </div>
                    {room.unreadCount > 0 && (
                      <span className="chat-li-badge">{room.unreadCount}</span>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="chat-empty">
                <FiUsers size={40} />
                <p>No rooms yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showChat && (
        <div className="chat-main">
          {!selectedId ? (
            <div className="chat-placeholder">
              <div className="chat-placeholder-icon">💬</div>
              <h2>
                {hasFamilyScope ? 'Start with your family circle' : 'Family chat is unavailable'}
              </h2>
              <p>
                {hasFamilyScope
                  ? 'Choose a conversation to share updates, memories, and support together.'
                  : 'Switch to an available family to open your chat space.'}
              </p>
            </div>
          ) : chatLoading ? (
            <div className="chat-thread-loader" aria-label="Loading conversation">
              <div className="chat-thread-loader__header">
                <div className="chat-thread-loader__avatar shimmer-block" />
                <div className="chat-thread-loader__meta">
                  <div className="chat-thread-loader__line shimmer-block" />
                  <div className="chat-thread-loader__line chat-thread-loader__line--short shimmer-block" />
                </div>
              </div>
              <div className="chat-thread-loader__messages">
                <div className="chat-thread-loader__bubble shimmer-block" />
                <div className="chat-thread-loader__bubble chat-thread-loader__bubble--sent shimmer-block" />
                <div className="chat-thread-loader__bubble chat-thread-loader__bubble--wide shimmer-block" />
              </div>
            </div>
          ) : (
            <>
              <div className="chat-header">
                {isMobile && (
                  <button
                    className="chat-header-back"
                    onClick={handleBack}
                    type="button"
                  >
                    <FiArrowLeft size={20} />
                  </button>
                )}

                <button
                  className="chat-header-identity"
                  onClick={handleOpenInfoPanel}
                  type="button"
                >
                  <div
                    className={`chat-avatar${isGroup && !roomAvatarUrl ? ' chat-avatar--room' : ''
                      }`}
                    style={{ width: 36, height: 36, fontSize: 12 }}
                  >
                    {isGroup ? (
                      roomAvatarUrl ? (
                        <img src={roomAvatarUrl} alt={headerName} />
                      ) : (
                        getRoomIcon(conversation?.roomType)
                      )
                    ) : (
                      <>
                        {activeParticipant.profileUrl ? (
                          <img src={activeParticipant.profileUrl} alt={headerName} />
                        ) : (
                          headerInitials
                        )}
                      </>
                    )}
                    {showHeaderOnline ? <div className="chat-avatar-online" /> : null}
                  </div>

                  <div className="chat-header-info">
                    <div className="chat-header-name">
                      <span className="chat-header-name-text">{headerName}</span>
                      {directChatBadges.map((badge) => (
                        <span
                          className={`chat-member-chip ${badge.className}`}
                          key={`header-${badge.key}`}
                          title={badge.title}
                        >
                          {badge.label}
                        </span>
                      ))}
                      <span className="chat-header-badge">
                        {isChatConnected ? 'Active' : 'Offline'}
                      </span>
                    </div>
                    <div className={`chat-header-status ${showHeaderOnline ? 'online' : ''}`}>
                      {headerStatusLabel}
                    </div>
                  </div>
                </button>

                <div className="chat-header-actions" ref={menuRef}>
                  <button
                    className="chat-header-btn"
                    onClick={handleHeaderSearch}
                    type="button"
                  >
                    <FiSearch size={16} />
                  </button>
                  <button
                    className="chat-header-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      setMenuOpen((current) => !current);
                    }}
                    type="button"
                  >
                    <FiMoreVertical size={16} />
                  </button>
                  {menuOpen && (
                    <div className="chat-dropdown">
                      {isGroup ? (
                        <button
                          onClick={handleOpenRoomMembers}
                          className="chat-dropdown-item"
                          type="button"
                        >
                          <FiUsers size={14} />{' '}
                          {canManageRoomMembers ? 'Manage members' : 'View members'}
                        </button>
                      ) : null}
                      {canManageRoom ? (
                        <button
                          onClick={handleRenameRoom}
                          className="chat-dropdown-item"
                          type="button"
                        >
                          <FiEdit2 size={14} /> Edit room name
                        </button>
                      ) : null}
                      {canManageRoom ? (
                        <button
                          onClick={handleOpenRoomPhotoPicker}
                          className="chat-dropdown-item"
                          type="button"
                          disabled={roomPhotoUploading}
                        >
                          <FiCamera size={14} />{' '}
                          {roomPhotoUploading ? 'Uploading photo...' : 'Change room photo'}
                        </button>
                      ) : null}
                      {canManageRoom && roomAvatarUrl ? (
                        <button
                          onClick={handleRemoveRoomPhoto}
                          className="chat-dropdown-item"
                          type="button"
                        >
                          <FiCamera size={14} /> Remove room photo
                        </button>
                      ) : null}
                      <button
                        onClick={handleMute}
                        className="chat-dropdown-item"
                        type="button"
                      >
                        {conversation?.isMuted ? (
                          <>
                            <FiVolume2 size={14} /> Unmute
                          </>
                        ) : (
                          <>
                            <FiVolumeX size={14} /> Mute
                          </>
                        )}
                      </button>
                      {canLeaveRoom ? (
                        <button
                          onClick={handleLeaveRoom}
                          className="chat-dropdown-item"
                          type="button"
                          disabled={leavingRoom}
                        >
                          <FiLogOut size={14} /> {leavingRoom ? 'Leaving room...' : 'Leave room'}
                        </button>
                      ) : null}
                      {canManageRoomMembers ? (
                        <button
                          onClick={handleDeleteRoom}
                          className="chat-dropdown-item"
                          type="button"
                        >
                          <FiTrash2 size={14} /> Delete room
                        </button>
                      ) : null}
                      {!isGroup ? (
                        <button
                          onClick={handleDeleteConversation}
                          className="chat-dropdown-item"
                          type="button"
                        >
                          <FiTrash2 size={14} /> Delete chat
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>

              {messageSearchOpen ? (
                <div className="chat-header-searchbar">
                  <label className="chat-header-searchfield">
                    <FiSearch size={16} />
                    <input
                      ref={messageSearchInputRef}
                      type="text"
                      value={messageSearchQuery}
                      onChange={(event) => setMessageSearchQuery(event.target.value)}
                      onKeyDown={handleMessageSearchKeyDown}
                      placeholder="Search in this chat"
                    />
                  </label>
                  <div className="chat-header-searchmeta">
                    <span className="chat-header-searchcount">
                      {messageSearchMatches.length > 0 && activeMessageSearchIndex >= 0
                        ? `${activeMessageSearchIndex + 1}/${messageSearchMatches.length}`
                        : `0/${messageSearchMatches.length}`}
                    </span>
                    <button
                      className="chat-header-searchnav"
                      onClick={() => handleCycleMessageSearch(-1)}
                      type="button"
                      disabled={messageSearchMatches.length === 0}
                      aria-label="Previous result"
                    >
                      <FiChevronUp size={15} />
                    </button>
                    <button
                      className="chat-header-searchnav"
                      onClick={() => handleCycleMessageSearch(1)}
                      type="button"
                      disabled={messageSearchMatches.length === 0}
                      aria-label="Next result"
                    >
                      <FiChevronDown size={15} />
                    </button>
                    <button
                      className="chat-header-searchclose"
                      onClick={() => {
                        setMessageSearchOpen(false);
                        setMessageSearchQuery('');
                        setActiveMessageSearchIndex(-1);
                      }}
                      type="button"
                      aria-label="Close message search"
                    >
                      <FiX size={15} />
                    </button>
                  </div>
                </div>
              ) : null}

              <div
                className={`chat-body-shell${showDesktopInfoPanel ? ' chat-body-shell--with-info' : ''
                  }`}
              >
                <div className="chat-thread-pane">
                  <div className="chat-messages-wrap">
                    <div className="chat-messages-bg" />
                    <div className="chat-messages custom-scrollbar">
                      {groupedMessages.map((item) => {
                        if (item.type === 'date') {
                          return (
                            <div className="chat-date-sep" key={item.key}>
                              <span>{item.label}</span>
                            </div>
                          );
                        }

                        const message = item.data;
                        const messageId = Number(message?.id || 0);
                        const isSent =
                          Number(message?.senderId || 0) === Number(currentUserId || 0);
                        const isDeleted = Boolean(message?.isDeleted);
                        const isTombstone =
                          message?.messageType === MESSAGE_TYPES.TOMBSTONE;
                        const isUnavailableMessage = isDeleted || isTombstone;
                        const isSearchMatch = messageSearchMatchIds.has(messageId);
                        const isActiveSearchMatch =
                          isSearchMatch && Number(activeMessageSearchId || 0) === messageId;
                        const receiptState = isSent ? getReceiptState(message) : null;
                        const receiptGlyph =
                          receiptState === 'failed'
                            ? '!'
                            : receiptState === 'sending' || receiptState === 'sent'
                              ? '✓'
                              : '✓✓';
                        const receiptLabel =
                          receiptState === 'failed'
                            ? 'Failed to send'
                            : receiptState === 'sending'
                              ? 'Sending'
                              : receiptState === 'seen'
                                ? 'Seen'
                                : receiptState === 'delivered'
                                  ? 'Delivered'
                                  : 'Sent';
                        const canDelete =
                          isSent &&
                          !isUnavailableMessage &&
                          Date.now() - new Date(message?.createdAt).getTime() <=
                          CHAT_LIMITS.DELETE_WINDOW_MS;
                        const senderInitials = getInitials(
                          String(message?.senderName || '').split(' ')[0],
                          String(message?.senderName || '').split(' ')[1],
                        );

                        if (message?.messageType === MESSAGE_TYPES.SYSTEM) {
                          return (
                            <div
                              className="msg-row"
                              key={item.key}
                              style={{ justifyContent: 'center' }}
                            >
                              <div className="msg-bubble msg-bubble--system">
                                <span>{message.content}</span>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={item.key}
                            ref={(node) => {
                              if (node && messageId) {
                                messageNodeRefs.current.set(messageId, node);
                                return;
                              }

                              if (messageId) {
                                messageNodeRefs.current.delete(messageId);
                              }
                            }}
                            tabIndex={isSearchMatch ? -1 : undefined}
                          >
                            <div
                              className={`msg-row ${isSent ? 'msg-row--sent' : 'msg-row--received'
                                }${isActiveSearchMatch ? ' msg-row--search-active' : ''}`}
                            >
                              {!isSent && (
                                <div className="msg-avatar-sm">
                                  {message?.senderAvatar ? (
                                    <img
                                      src={message.senderAvatar}
                                      alt={message.senderName || 'Member'}
                                    />
                                  ) : (
                                    senderInitials
                                  )}
                                </div>
                              )}
                              <div
                                className={`msg-bubble ${isSent
                                    ? 'msg-bubble--sent'
                                    : 'msg-bubble--received'
                                  }${isUnavailableMessage ? ' msg-bubble--deleted' : ''}${isSearchMatch ? ' msg-bubble--search-match' : ''
                                  }${isActiveSearchMatch ? ' msg-bubble--search-active' : ''}`}
                              >
                                {!isUnavailableMessage && (
                                  <div
                                    className={`msg-actions ${isSent
                                        ? 'msg-actions--sent'
                                        : 'msg-actions--received'
                                      }`}
                                  >
                                    <button
                                      className="msg-action-btn"
                                      onClick={() => setReplyTo(message)}
                                      type="button"
                                      aria-label="Reply to message"
                                      title="Reply"
                                    >
                                      <FiCornerUpLeft />
                                    </button>
                                    {canDelete && (
                                      <button
                                        className="msg-action-btn"
                                        onClick={() => handleDelete(message)}
                                        type="button"
                                        aria-label="Delete message"
                                        title="Delete"
                                      >
                                        <FiTrash2 />
                                      </button>
                                    )}
                                    {!isSent && (
                                      <button
                                        className="msg-action-btn"
                                        onClick={() => setReportMsg(message)}
                                        type="button"
                                        aria-label="Report message"
                                        title="Report"
                                      >
                                        <FiAlertTriangle />
                                      </button>
                                    )}
                                  </div>
                                )}

                                {!isSent && isGroup && !isUnavailableMessage && (
                                  <div className="msg-sender">{message.senderName}</div>
                                )}
                                {message.replyTo && !isUnavailableMessage && (
                                  <div className="msg-reply-bar">
                                    <div className="msg-reply-bar-name">
                                      {message.replyTo.senderName || 'Reply'}
                                    </div>
                                    <div className="msg-reply-bar-text">
                                      {renderHighlightedText(
                                        message.replyTo.content?.slice(0, 60),
                                        messageSearchQuery,
                                        isActiveSearchMatch,
                                      )}
                                    </div>
                                  </div>
                                )}

                                {isUnavailableMessage ? (
                                  <span>
                                    🚫 <em>{isTombstone ? 'Message unavailable' : 'Message deleted'}</em>
                                  </span>
                                ) : message.mediaUrl ? (
                                  message.messageType === MESSAGE_TYPES.VOICE ? (
                                    <audio
                                      controls
                                      src={message.mediaUrl}
                                      preload="metadata"
                                    />
                                  ) : message.messageType === MESSAGE_TYPES.IMAGE ? (
                                    <div className="msg-media-block">
                                      <a
                                        href={message.mediaUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="msg-media-link"
                                      >
                                        <img
                                          src={message.mediaUrl}
                                          alt={message.content || 'Shared image'}
                                          className="msg-media-image"
                                        />
                                      </a>
                                      {message.content ? (
                                        <div className="msg-media-caption">
                                          {renderHighlightedText(
                                            message.content,
                                            messageSearchQuery,
                                            isActiveSearchMatch,
                                          )}
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <a
                                      href={message.mediaUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{ color: 'inherit', textDecoration: 'underline' }}
                                    >
                                      {renderHighlightedText(
                                        message.content || 'Open attachment',
                                        messageSearchQuery,
                                        isActiveSearchMatch,
                                      )}
                                    </a>
                                  )
                                ) : (
                                  <span>
                                    {renderHighlightedText(
                                      message.content,
                                      messageSearchQuery,
                                      isActiveSearchMatch,
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div
                              className={`msg-time-row ${isSent ? 'msg-row--sent' : ''}`}
                              style={isSent ? undefined : { paddingLeft: 38 }}
                            >
                              {formatFullTime(message.createdAt)}
                              {isSent && receiptState && (
                                <span
                                  className={`msg-receipt msg-receipt--${receiptState}`}
                                  title={receiptLabel}
                                  aria-label={receiptLabel}
                                >
                                  {receiptGlyph}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {typingUserIds.length > 0 && (
                        <TypingIndicator userName={typingLabel} />
                      )}

                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  <ChatStateBanner
                    availabilityReason={conversation?.availabilityReason}
                    conversationState={conversation?.conversationState}
                  />

                  <div className="chat-composer" ref={composerRef}>
                    {attachmentDraft && (
                      <div className="chat-attachment-preview">
                        <div className="chat-attachment-preview__media">
                          {attachmentDraft.previewKind === MESSAGE_TYPES.IMAGE ? (
                            <img
                              src={attachmentDraft.previewUrl}
                              alt={attachmentDraft.name || 'Selected image'}
                              className="chat-attachment-preview__image"
                            />
                          ) : attachmentDraft.previewKind === MESSAGE_TYPES.VOICE ? (
                            <audio
                              controls
                              src={attachmentDraft.previewUrl}
                              preload="metadata"
                              className="chat-attachment-preview__audio"
                            />
                          ) : (
                            <div className="chat-attachment-preview__fileicon">
                              <FiPaperclip size={18} />
                            </div>
                          )}
                        </div>
                        <div className="chat-attachment-preview__meta">
                          <div className="chat-attachment-preview__title">
                            {attachmentDraft.previewKind === MESSAGE_TYPES.VOICE
                              ? 'Voice message preview'
                              : attachmentDraft.previewKind === MESSAGE_TYPES.IMAGE
                                ? 'Image preview'
                                : 'Attachment preview'}
                          </div>
                          <div className="chat-attachment-preview__name">
                            {attachmentDraft.name}
                          </div>
                        </div>
                        <button
                          className="chat-attachment-preview__close"
                          onClick={() => setAttachmentDraft(null)}
                          type="button"
                          aria-label="Remove attachment"
                        >
                          <FiX size={14} />
                        </button>
                      </div>
                    )}

                    {replyTo && (
                      <div className="chat-reply-bar">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="chat-reply-bar-name">
                            {replyTo.senderName || 'Reply'}
                          </div>
                          <div className="chat-reply-bar-text">
                            {replyTo.content?.slice(0, 50)}
                          </div>
                        </div>
                        <button
                          onClick={() => setReplyTo(null)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 4,
                            color: '#9ca3af',
                          }}
                          type="button"
                        >
                          <FiX size={14} />
                        </button>
                      </div>
                    )}

                    {showComposerPicker && (
                      <div
                        className="chat-composer-picker"
                        role="dialog"
                        aria-label="Emoji picker"
                      >
                        <div className="chat-composer-emoji-panel">
                          <EmojiPicker
                            className="chat-emoji-picker"
                            onEmojiClick={handleEmojiSelect}
                            width="100%"
                            height={365}
                            autoFocusSearch={false}
                            previewConfig={{ showPreview: false }}
                            searchPlaceholder="Search emoji"
                            skinTonesDisabled
                            lazyLoadEmojis
                            emojiStyle={EmojiStyle.NATIVE}
                            theme={Theme.LIGHT}
                            categories={EMOJI_PICKER_CATEGORIES}
                          />
                        </div>
                      </div>
                    )}

                    <div className="chat-input-bar">
                      <button
                        className={`chat-input-attach${showComposerPicker ? ' chat-input-attach--active' : ''
                          }`}
                        onClick={handleToggleComposerPicker}
                        title="Emoji"
                        type="button"
                        disabled={isComposerDisabled}
                        aria-expanded={showComposerPicker}
                      >
                        <FiSmile size={20} />
                      </button>
                      <button
                        className="chat-input-attach"
                        onClick={handleOpenAttachmentPicker}
                        title="Attach"
                        type="button"
                        disabled={isComposerDisabled}
                      >
                        <FiPaperclip size={18} />
                      </button>

                      <textarea
                        ref={inputRef}
                        className="chat-input-field"
                        placeholder={composerPlaceholder}
                        value={text}
                        onBlur={stopLocalTyping}
                        onChange={handleTextChange}
                        onKeyDown={handleComposerKeyDown}
                        rows={1}
                        disabled={isComposerDisabled}
                      />

                      {hasComposerText || hasAttachmentDraft ? (
                        <button
                          className="chat-send-btn"
                          onClick={handleSend}
                          disabled={isComposerDisabled}
                          type="button"
                          title={hasAttachmentDraft ? 'Send attachment' : 'Send message'}
                        >
                          <FiSend size={16} />
                        </button>
                      ) : (
                        <VoiceRecorder
                          disabled={isComposerDisabled}
                          onRecorded={handleStageAttachment}
                          className="chat-send-btn"
                          iconSize={18}
                        />
                      )}

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,audio/*"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                      />
                      <input
                        ref={roomPhotoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleRoomPhotoChange}
                        style={{ display: 'none' }}
                      />
                    </div>
                  </div>
                </div>

                {showDesktopInfoPanel ? renderInfoPanel() : null}
              </div>

              {showMobileInfoPanel ? (
                <div
                  className="chat-info-overlay"
                  onClick={handleCloseInfoPanel}
                  role="presentation"
                >
                  <div onClick={(event) => event.stopPropagation()} role="presentation">
                    {renderInfoPanel(true)}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}

      {reportMsg && (
        <ReportMessageModal
          message={reportMsg}
          familyCode={activeFamilyCode}
          onClose={() => setReportMsg(null)}
        />
      )}

      <ChatPickerModal
        isOpen={newConversationOpen}
        title="New conversation"
        subtitle="Choose a Familyss app user from your family circle to start a direct chat."
        members={availableDirectMembers}
        selectedIds={newConversationMemberId ? [Number(newConversationMemberId)] : []}
        onToggleMember={(member) => {
          const memberId = Number(member?.userId || 0);
          setNewConversationMemberId((currentId) =>
            Number(currentId || 0) === memberId ? null : memberId,
          );
        }}
        onClose={() => {
          setNewConversationOpen(false);
          setNewConversationError('');
          setNewConversationMemberId(null);
        }}
        onSubmit={handleCreateDirectConversation}
        submitLabel="Start chat"
        isSubmitting={newConversationSubmitting}
        selectionMode="single"
        error={newConversationError}
        emptyStateTitle="No family app users available"
        emptyStateSubtitle="Associated and linked Familyss users will appear here when available."
        searchPlaceholder="Search family app users"
        submitDisabled={!newConversationMemberId}
        disableMember={(member) =>
          Boolean(
            member?.blockStatus?.isBlockedByMe || member?.blockStatus?.isBlockedByThem,
          )
        }
        getMemberNote={(member) => {
          if (member?.blockStatus?.isBlockedByMe) {
            return 'You blocked this member.';
          }

          if (member?.blockStatus?.isBlockedByThem) {
            return 'This member blocked you.';
          }

          return '';
        }}
      />

      <ChatPickerModal
        isOpen={createRoomOpen}
        title="Create room"
        subtitle="Pick a room name and choose the Familyss app users you want to include."
        members={availableDirectMembers}
        selectedIds={createRoomMemberIds}
        onToggleMember={handleToggleCreateRoomMember}
        onClose={() => {
          setCreateRoomOpen(false);
          setCreateRoomError('');
          setCreateRoomName('');
          setCreateRoomMemberIds([]);
        }}
        onSubmit={handleCreateRoom}
        submitLabel="Create room"
        isSubmitting={createRoomSubmitting}
        error={createRoomError}
        emptyStateTitle="No family app users available"
        emptyStateSubtitle="Associated and linked Familyss users will appear here when available."
        searchPlaceholder="Search family app users"
        submitDisabled={!String(createRoomName || '').trim() || createRoomMemberIds.length === 0}
        topContent={(
          <>
            <div className="chat-form-group">
              <label className="chat-form-label" htmlFor="chat-create-room-name">
                Room name
              </label>
              <input
                id="chat-create-room-name"
                className="chat-form-input"
                type="text"
                value={createRoomName}
                onChange={(event) => {
                  setCreateRoomName(event.target.value);
                  if (createRoomError) {
                    setCreateRoomError('');
                  }
                }}
                placeholder="Enter room name"
                maxLength={100}
                autoFocus
              />
            </div>
            <p className="chat-helper-text">
              You will be added automatically even if you do not select yourself.
            </p>
            {!String(createRoomName || '').trim() ? (
              <p className="chat-helper-text chat-helper-text--warning">
                Enter a room name to enable Create room.
              </p>
            ) : null}
            {createRoomMemberIds.length === 0 ? (
              <p className="chat-helper-text chat-helper-text--warning">
                Select at least one member to create a room.
              </p>
            ) : null}
          </>
        )}
      />

      {roomNameEditorOpen ? (
        <div className="chat-modal-overlay" role="presentation">
          <div
            className="chat-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Edit room name"
          >
            <div className="chat-modal-header">
              <div>
                <h3>Edit room name</h3>
                <p>Choose a clear family room name that everyone will recognize.</p>
              </div>
              <button
                type="button"
                className="chat-modal-close"
                onClick={handleCloseRoomNameEditor}
                aria-label="Close"
                disabled={roomNameSubmitting}
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="chat-modal-top-content">
              <div className="chat-form-group">
                <label className="chat-form-label" htmlFor="chat-room-name-editor">
                  Room name
                </label>
                <input
                  id="chat-room-name-editor"
                  className="chat-form-input"
                  type="text"
                  value={roomNameDraft}
                  onChange={(event) => {
                    setRoomNameDraft(event.target.value);
                    if (roomNameError) {
                      setRoomNameError('');
                    }
                  }}
                  placeholder="Enter room name"
                  maxLength={100}
                  autoFocus
                />
              </div>
            </div>

            {roomNameError ? <div className="chat-modal-error">{roomNameError}</div> : null}

            <div className="chat-modal-actions">
              <button
                type="button"
                className="chat-modal-btn chat-modal-btn--secondary"
                onClick={handleCloseRoomNameEditor}
                disabled={roomNameSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="chat-modal-btn chat-modal-btn--primary"
                onClick={handleSubmitRoomName}
                disabled={roomNameSubmitting}
              >
                {roomNameSubmitting ? 'Saving...' : 'Save room name'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <ChatRoomMembersModal
        isOpen={roomMembersOpen}
        roomName={conversation?.roomName || 'Room members'}
        members={currentRoomMembers}
        availableMembers={availableRoomMembers}
        selectedIds={selectedRoomMemberIds}
        onToggleMember={handleToggleRoomMemberSelection}
        onAddMembers={handleAddRoomMembers}
        onRemoveMember={handleRemoveRoomMember}
        onClose={() => {
          setRoomMembersOpen(false);
          setSelectedRoomMemberIds([]);
          setRoomMembersError('');
        }}
        canManage={canManageRoomMembers}
        isSubmitting={roomMembersSubmitting}
        error={roomMembersError}
        currentUserId={currentUserId}
      />
    </div>
  );
};

export default ChatPage;
