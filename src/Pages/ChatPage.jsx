import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useUser } from '../Contexts/UserContext';
import { useChat } from '../Contexts/ChatContext';
import ChatConversationPane from '../Components/Chat/ChatConversationPane';
import ChatDeleteConversationModal from '../Components/Chat/ChatDeleteConversationModal';
import ChatInfoPanel from '../Components/Chat/ChatInfoPanel';
import ChatSidebar from '../Components/Chat/ChatSidebar';
import ReportMessageModal from '../Components/Chat/ReportMessageModal';
import ChatRoomMembersModal from '../Components/Chat/ChatRoomMembersModal';
import ChatPickerModal from '../Components/Chat/ChatPickerModal';
import {
  CHAT_LIMITS,
  CHAT_SOCKET_EVENTS,
  CONVERSATION_STATES,
  CONVERSATION_TYPES,
  MESSAGE_TYPES,
} from '../constants/chat.constants';
import {
  addMembersToRoom,
  addMembersToRoomSocket,
  createConversation,
  createRoomConversation,
  deleteMessage as deleteMsg,
  deleteMessageSocket,
  deleteRoomConversation,
  deleteRoomConversationSocket,
  formatDateSeparator,
  getChatMemberBadges,
  getChatMemberMetaText,
  getConversation,
  getConversations,
  getFamilyMembersForChat,
  getInitials,
  hideConversation as hideConversationRequest,
  hideConversationSocket,
  getMessages,
  getRooms,
  leaveRoomConversation,
  leaveRoomConversationSocket,
  markConversationRead,
  markConversationReadSocket as markConversationReadSocketRequest,
  removeMemberFromRoom,
  removeMemberFromRoomSocket,
  sendMediaMessage,
  sendTextMessageSocket,
  toggleMute,
  toggleMuteSocket,
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
import {
  applyDeliveryReceipt,
  applyReadReceipt,
  buildTypingUserLabel,
  createComposerAttachmentDraft,
  createOptimisticMediaMessage,
  createOptimisticTextMessage,
  formatInfoDateTime,
  getComposerAttachmentKind,
  getConversationInfoDescription,
  getMessageReplyId,
  getMessageReplyPreview,
  getMessageSearchText,
  markMessageDeleted,
  getReceiptState,
  getRoomDisplayName,
  getRoomTypeLabel,
  isSameConversation,
  isUnavailableConversationError,
  normalizeFamilyCode,
  resizeComposer,
  revokeObjectUrl,
  toConversationType,
} from '../Components/Chat/chatPage.utils';
import '../Components/Chat/chat.css';

const TEXT_SEND_MAX_RETRIES = 3;
const TEXT_SEND_RETRY_BASE_DELAY_MS = 350;
const DELETE_CHAT_ERROR_MESSAGE = "Couldn't delete the chat right now. Please try again.";
const isSocketTimeoutError = (error) =>
  Number(error?.status || 0) === 504 ||
  String(error?.message || '')
    .trim()
    .toLowerCase()
    .includes('chat socket timed out');

const ChatPage = () => {
  const navigate = useNavigate();
  const { conversationId: routeConversationId } = useParams();
  const [searchParams] = useSearchParams();
  const { userInfo } = useUser();
  const {
    activeFamilyCode,
    families,
    isChatConnected,
    joinFamilyRoom,
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
  const [messagePagination, setMessagePagination] = useState({
    nextCursor: null,
    hasMore: false,
    loadingOlder: false,
    initialized: false,
  });
  const [chatLoading, setChatLoading] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [attachmentDraft, setAttachmentDraft] = useState(null);
  const [reportMsg, setReportMsg] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [text, setText] = useState('');
  const [showComposerPicker, setShowComposerPicker] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false,
  );
  const [sendingMedia, setSendingMedia] = useState(false);
  const [typingUserIds, setTypingUserIds] = useState([]);
  const [presenceByUserId, setPresenceByUserId] = useState({});
  const [familyMembers, setFamilyMembers] = useState([]);
  const [roomMembersOpen, setRoomMembersOpen] = useState(false);
  const [selectedRoomMemberIds, setSelectedRoomMemberIds] = useState([]);
  const [roomMembersSubmitting, setRoomMembersSubmitting] = useState(false);
  const [roomMembersError, setRoomMembersError] = useState('');
  const [roomPhotoUploading, setRoomPhotoUploading] = useState(false);
  const [leavingRoom, setLeavingRoom] = useState(false);
  const [deleteConversationOpen, setDeleteConversationOpen] = useState(false);
  const [deleteConversationSubmitting, setDeleteConversationSubmitting] = useState(false);
  const [deleteConversationError, setDeleteConversationError] = useState('');
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
  const messagesContainerRef = useRef(null);
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
  const composerDraftVersionRef = useRef(0);
  const lastSubmittedDraftKeyRef = useRef('');
  const pendingTextMessagesRef = useRef(new Map());
  const pendingMediaMessagesRef = useRef(new Map());
  const chatSocketRef = useRef(socket);
  const chatSocketReadyRef = useRef(Boolean(socket?.connected) && Boolean(isChatConnected));
  const textSendQueueRef = useRef([]);
  const textSendProcessingRef = useRef(false);
  const messagesRef = useRef([]);
  const previousSelectedIdRef = useRef(null);
  const pendingOlderMessagesRestoreRef = useRef(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    selectedConversationRef.current = Number(selectedId || 0) || null;
  }, [selectedId]);

  useEffect(() => {
    activeFamilyCodeRef.current = normalizeFamilyCode(activeFamilyCode);
  }, [activeFamilyCode]);

  useEffect(() => {
    chatSocketRef.current = socket;
    chatSocketReadyRef.current = Boolean(socket?.connected) && Boolean(isChatConnected);
  }, [isChatConnected, socket]);

  useEffect(() => {
    setPresenceByUserId({});
  }, [activeFamilyCode]);

  useEffect(() => {
    setFamilyMembers([]);
    setRoomMembersOpen(false);
    setSelectedRoomMemberIds([]);
    setRoomMembersError('');
    setAttachmentDraft(null);
    setDeleteConversationOpen(false);
    setDeleteConversationSubmitting(false);
    setDeleteConversationError('');
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
      setIsMobile(window.innerWidth < 1024);
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
      pendingOlderMessagesRestoreRef.current = null;
      setSelectedId(null);
      setResolvedConversationId(null);
      setSelectedType(CONVERSATION_TYPES.DIRECT);
      setConversation(null);
      setMessages([]);
      setMessagePagination({
        nextCursor: null,
        hasMore: false,
        loadingOlder: false,
        initialized: false,
      });
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
      setMessagePagination({
        nextCursor: null,
        hasMore: false,
        loadingOlder: false,
        initialized: false,
      });
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
        const result =
          socket && isChatConnected
            ? await markConversationReadSocketRequest(
                socket,
                targetConversationId,
                familyCode,
              )
            : await markConversationRead(targetConversationId, familyCode);
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
    [isChatConnected, socket, syncListsFromCache],
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

  const applyConversationDeliveryUpdate = useCallback((conversationId, messageId, deliveredAt) => {
    const targetConversationId = Number(conversationId || 0);
    const targetMessageId = Number(messageId || 0);
    if (!targetConversationId || !targetMessageId || !deliveredAt) {
      return [];
    }

    const currentMessages = getCachedMessages(targetConversationId);
    if (currentMessages.length === 0) {
      return [];
    }

    const nextMessages = cacheMessages(
      targetConversationId,
      applyDeliveryReceipt(currentMessages, targetMessageId, deliveredAt),
    );

    if (isSameConversation(targetConversationId, selectedConversationRef.current)) {
      setMessages(nextMessages);
    }

    return nextMessages;
  }, []);

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
    const targetClientRequestId = String(message?.clientRequestId || '').trim();
    const matchingIndex = currentEntries.findIndex(
      (entry) => {
        const entryClientRequestId = String(entry?.clientRequestId || '').trim();
        if (targetClientRequestId && entryClientRequestId) {
          return entryClientRequestId === targetClientRequestId;
        }

        return (
          String(entry?.content || '').trim() === targetContent &&
          Number(entry?.replyToId || 0) === Number(targetReplyId || 0)
        );
      },
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

  const findOptimisticMessageIdByClientRequestId = useCallback(
    (conversationId, clientRequestId) => {
      const targetConversationId = Number(conversationId || 0);
      const normalizedClientRequestId = String(clientRequestId || '').trim();
      if (!targetConversationId || !normalizedClientRequestId) {
        return null;
      }

      const matchingMessage = getCachedMessages(targetConversationId).find((message) => {
        const messageId = Number(message?.id || 0);
        if (messageId >= 0) {
          return false;
        }

        return (
          String(message?.clientRequestId || '').trim() === normalizedClientRequestId
        );
      });

      return matchingMessage ? Number(matchingMessage.id || 0) : null;
    },
    [],
  );

  const waitForTextSendRetry = useCallback(
    (attemptCount) =>
      new Promise((resolve) => {
        window.setTimeout(
          resolve,
          Math.max(1, Number(attemptCount || 1)) * TEXT_SEND_RETRY_BASE_DELAY_MS,
        );
      }),
    [],
  );

  const processTextSendQueue = useCallback(async () => {
    if (textSendProcessingRef.current) {
      return;
    }

    textSendProcessingRef.current = true;
    try {
      while (textSendQueueRef.current.length > 0) {
        const currentEntry = textSendQueueRef.current[0];
        const activeSocket = chatSocketRef.current;
        if (!activeSocket || !chatSocketReadyRef.current || !activeSocket.connected) {
          break;
        }

        try {
          const nextMessage = await sendTextMessageSocket(
            activeSocket,
            currentEntry.conversationId,
            currentEntry.familyCode,
            currentEntry.content,
            {
              clientRequestId: currentEntry.clientRequestId,
              replyToId: currentEntry.replyToId,
            },
          );
          if (!nextMessage || !Number(nextMessage?.id || 0)) {
            throw new Error('Message send did not return a valid message payload');
          }

          const enrichedMessage = currentEntry.replyPreview
            ? {
                ...nextMessage,
                replyTo: nextMessage?.replyTo || currentEntry.replyPreview,
              }
            : nextMessage;
          const pendingMessage = removePendingTextMessage(
            currentEntry.conversationId,
            currentEntry.tempId,
          );
          const fallbackOptimisticMessageId = findOptimisticMessageIdByClientRequestId(
            currentEntry.conversationId,
            currentEntry.clientRequestId,
          );

          if (pendingMessage?.tempId) {
            replaceConversationMessageUpdate(
              currentEntry.conversationId,
              currentEntry.tempId,
              enrichedMessage,
              {
                familyCode: currentEntry.familyCode,
                clearUnread: true,
              },
            );
          } else if (fallbackOptimisticMessageId) {
            replaceConversationMessageUpdate(
              currentEntry.conversationId,
              fallbackOptimisticMessageId,
              enrichedMessage,
              {
                familyCode: currentEntry.familyCode,
                clearUnread: true,
              },
            );
          } else {
            applyConversationMessageUpdate(currentEntry.conversationId, enrichedMessage, {
              familyCode: currentEntry.familyCode,
              clearUnread: true,
            });
          }

          textSendQueueRef.current.shift();
        } catch (error) {
          currentEntry.attemptCount = Number(currentEntry.attemptCount || 0) + 1;
          const status = Number(error?.status || 0);
          const shouldRetry =
            currentEntry.attemptCount < TEXT_SEND_MAX_RETRIES &&
            ![400, 403, 404].includes(status);

          if (shouldRetry) {
            await waitForTextSendRetry(currentEntry.attemptCount);
            continue;
          }

          textSendQueueRef.current.shift();
          const failedPendingMessage = removePendingTextMessage(
            currentEntry.conversationId,
            currentEntry.tempId,
          );
          const failedMessageId =
            failedPendingMessage?.tempId ||
            findOptimisticMessageIdByClientRequestId(
              currentEntry.conversationId,
              currentEntry.clientRequestId,
            );

          if (failedMessageId) {
            applyConversationMessageFailure(currentEntry.conversationId, failedMessageId, {
              familyCode: currentEntry.familyCode,
              clearUnread: true,
            });
          }

          console.error('Failed to send message:', error);
        }
      }
    } finally {
      textSendProcessingRef.current = false;
    }
  }, [
    applyConversationMessageFailure,
    applyConversationMessageUpdate,
    findOptimisticMessageIdByClientRequestId,
    removePendingTextMessage,
    replaceConversationMessageUpdate,
    waitForTextSendRetry,
  ]);

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
      pendingOlderMessagesRestoreRef.current = null;

      setSelectedId(targetConversationId);
      setResolvedConversationId(null);
      setSelectedType(conversationType);
      setMessagePagination({
        nextCursor: null,
        hasMore: false,
        loadingOlder: false,
        initialized: false,
      });
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
        setMessagePagination({
          nextCursor: messageResponse?.nextCursor || null,
          hasMore: Boolean(messageResponse?.hasMore),
          loadingOlder: false,
          initialized: true,
        });
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

  const loadOlderMessages = useCallback(async () => {
    const targetConversationId = Number(selectedConversationRef.current || 0);
    const familyCode = activeFamilyCodeRef.current;
    const nextCursor = messagePagination?.nextCursor || null;
    if (
      !targetConversationId ||
      !familyCode ||
      !nextCursor ||
      !messagePagination?.hasMore ||
      messagePagination?.loadingOlder ||
      chatLoading
    ) {
      return;
    }

    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

      setMessagePagination((current) => ({
        ...current,
        loadingOlder: true,
      }));

    try {
      const messageResponse = await getMessages(
        targetConversationId,
        nextCursor,
        currentUserId,
        familyCode,
      );

      if (!isSameConversation(targetConversationId, selectedConversationRef.current)) {
        return;
      }

      pendingOlderMessagesRestoreRef.current = {
        conversationId: targetConversationId,
        previousScrollHeight: container.scrollHeight,
        previousScrollTop: container.scrollTop,
      };

      const nextMessages = cacheMessages(targetConversationId, [
        ...(messageResponse?.messages || []),
        ...messagesRef.current,
      ]);

      setMessages(nextMessages);
      setMessagePagination({
        nextCursor: messageResponse?.nextCursor || null,
        hasMore: Boolean(messageResponse?.hasMore),
        loadingOlder: false,
        initialized: true,
      });
    } catch (error) {
      console.error('Failed to load older chat messages:', error);
      setMessagePagination((current) => ({
        ...current,
        loadingOlder: false,
      }));
    }
  }, [
    chatLoading,
    currentUserId,
    messagePagination?.hasMore,
    messagePagination?.loadingOlder,
    messagePagination?.nextCursor,
  ]);

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
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    const pendingRestore = pendingOlderMessagesRestoreRef.current;
    if (
      pendingRestore &&
      isSameConversation(pendingRestore.conversationId, selectedId)
    ) {
      const scrollDelta = container.scrollHeight - pendingRestore.previousScrollHeight;
      container.scrollTop = Math.max(
        0,
        pendingRestore.previousScrollTop + scrollDelta,
      );
      pendingOlderMessagesRestoreRef.current = null;
      previousSelectedIdRef.current = selectedId;
      return;
    }

    const previousSelectedId = previousSelectedIdRef.current;
    previousSelectedIdRef.current = selectedId;
    if (!selectedId) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({
      behavior:
        previousSelectedId && isSameConversation(previousSelectedId, selectedId)
          ? 'smooth'
          : 'auto',
    });
  }, [messages, selectedId, typingUserIds]);

  const handleMessagesScroll = useCallback(
    (event) => {
      if (
        event.currentTarget.scrollTop <= 80 &&
        messagePagination.hasMore &&
        !messagePagination.loadingOlder
      ) {
        loadOlderMessages();
      }
    },
    [
      loadOlderMessages,
      messagePagination.hasMore,
      messagePagination.loadingOlder,
    ],
  );

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
      const hasCachedConversation = Boolean(cachedConversation);
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
      const matchingOptimisticMessageId =
        sentByCurrentUser && !matchingPendingMessage
          ? findOptimisticMessageIdByClientRequestId(
              conversationId,
              payload?.clientRequestId,
            )
          : null;
      const matchingPendingMediaMessage =
        sentByCurrentUser && !matchingPendingMessage && !matchingOptimisticMessageId
          ? shiftMatchingPendingMediaMessage(conversationId, payload)
          : null;

      if (matchingPendingMessage?.tempId) {
        replaceConversationMessageUpdate(
          conversationId,
          matchingPendingMessage.tempId,
          payload,
          {
            familyCode: payload?.familyCode || cachedConversation?.familyCode,
            clearUnread: shouldClearUnread,
            unreadCount: nextUnreadCount,
          },
        );
      } else if (matchingOptimisticMessageId) {
        replaceConversationMessageUpdate(
          conversationId,
          matchingOptimisticMessageId,
          payload,
          {
            familyCode: payload?.familyCode || cachedConversation?.familyCode,
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
            familyCode: payload?.familyCode || cachedConversation?.familyCode,
            clearUnread: shouldClearUnread,
            unreadCount: nextUnreadCount,
          },
        );
      } else {
        applyConversationMessageUpdate(conversationId, payload, {
          familyCode: payload?.familyCode || cachedConversation?.familyCode,
          clearUnread: shouldClearUnread,
          unreadCount: nextUnreadCount,
        });
      }

      if (!hasCachedConversation) {
        void refreshConversationFromServer(payload);
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

    const handleMessageDelivered = (payload = {}) => {
      const conversationId = Number(payload?.conversationId || 0);
      const messageId = Number(payload?.messageId || 0);
      if (!conversationId || !messageId || !payload?.deliveredAt) {
        return;
      }

      applyConversationDeliveryUpdate(
        conversationId,
        messageId,
        payload.deliveredAt,
      );
    };

    const handlePresenceSnapshot = (payload = {}) => {
      const payloadFamilyCode = normalizeFamilyCode(payload?.familyCode);
      if (
        payloadFamilyCode &&
        payloadFamilyCode !== activeFamilyCodeRef.current
      ) {
        return;
      }

      const nextPresenceByUserId = {};
      (Array.isArray(payload?.presences) ? payload.presences : []).forEach((entry) => {
        const userId = Number(entry?.userId || 0);
        if (!userId) {
          return;
        }

        nextPresenceByUserId[userId] = {
          isOnline: Boolean(entry?.isOnline),
          lastSeenAt: entry?.lastSeenAt || null,
        };
      });

      setPresenceByUserId(nextPresenceByUserId);
    };

    const handlePresenceUpdated = (payload = {}) => {
      const payloadFamilyCode = normalizeFamilyCode(payload?.familyCode);
      const userId = Number(payload?.userId || 0);
      if (
        !userId ||
        (payloadFamilyCode &&
          payloadFamilyCode !== activeFamilyCodeRef.current)
      ) {
        return;
      }

      setPresenceByUserId((current) => ({
        ...current,
        [userId]: {
          isOnline: Boolean(payload?.isOnline),
          lastSeenAt: payload?.lastSeenAt || null,
        },
      }));
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

    const handleConversationHidden = (payload = {}) => {
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
    socket.on(CHAT_SOCKET_EVENTS.MESSAGE_DELIVERED, handleMessageDelivered);
    socket.on(CHAT_SOCKET_EVENTS.MEMBER_JOINED, handleRoomMembershipChange);
    socket.on(CHAT_SOCKET_EVENTS.MEMBER_REMOVED, handleRoomMembershipChange);
    socket.on(CHAT_SOCKET_EVENTS.ROOM_UPDATED, handleRoomUpdated);
    socket.on(CHAT_SOCKET_EVENTS.CONVERSATION_REMOVED, handleConversationRemoved);
    socket.on(CHAT_SOCKET_EVENTS.CONVERSATION_HIDDEN, handleConversationHidden);
    socket.on(CHAT_SOCKET_EVENTS.PRESENCE_SNAPSHOT, handlePresenceSnapshot);
    socket.on(CHAT_SOCKET_EVENTS.PRESENCE_UPDATED, handlePresenceUpdated);

    return () => {
      socket.off(CHAT_SOCKET_EVENTS.NEW_MESSAGE, handleNewMessage);
      socket.off(CHAT_SOCKET_EVENTS.MESSAGE_DELETED, handleMessageDeleted);
      socket.off(CHAT_SOCKET_EVENTS.TYPING, handleTyping);
      socket.off(CHAT_SOCKET_EVENTS.READ_RECEIPT, handleReadReceipt);
      socket.off(CHAT_SOCKET_EVENTS.MESSAGE_DELIVERED, handleMessageDelivered);
      socket.off(CHAT_SOCKET_EVENTS.MEMBER_JOINED, handleRoomMembershipChange);
      socket.off(CHAT_SOCKET_EVENTS.MEMBER_REMOVED, handleRoomMembershipChange);
      socket.off(CHAT_SOCKET_EVENTS.ROOM_UPDATED, handleRoomUpdated);
      socket.off(CHAT_SOCKET_EVENTS.CONVERSATION_REMOVED, handleConversationRemoved);
      socket.off(CHAT_SOCKET_EVENTS.CONVERSATION_HIDDEN, handleConversationHidden);
      socket.off(CHAT_SOCKET_EVENTS.PRESENCE_SNAPSHOT, handlePresenceSnapshot);
      socket.off(CHAT_SOCKET_EVENTS.PRESENCE_UPDATED, handlePresenceUpdated);
    };
  }, [
    applyConversationDeliveryUpdate,
    applyConversationMessageUpdate,
    clearOpenConversation,
    currentUserId,
    findOptimisticMessageIdByClientRequestId,
    markConversationReadNow,
    replaceConversationMessageUpdate,
    refreshConversationFromServer,
    routeConversationIdNumber,
    socket,
    shiftMatchingPendingMediaMessage,
    shiftMatchingPendingTextMessage,
    syncListsFromCache,
  ]);

  useEffect(() => {
    const familyCode = normalizeFamilyCode(activeFamilyCode);
    if (!socket || !isChatConnected || !familyCode) {
      return;
    }

    joinFamilyRoom(familyCode);
  }, [activeFamilyCode, isChatConnected, joinFamilyRoom, socket]);

  useEffect(() => {
    if (!socket || !isChatConnected) {
      return;
    }

    void processTextSendQueue();
  }, [isChatConnected, processTextSendQueue, socket]);

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
      composerDraftVersionRef.current += 1;
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

      composerDraftVersionRef.current += 1;
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
      const clientRequestId = `send-message:${targetConversationId}:${Date.now()}:${Math.random()
        .toString(36)
        .slice(2, 10)}`;
      if (
        !trimmedText ||
        !targetConversationId ||
        !familyCodeAtSend ||
        conversation?.canSend === false
      ) {
        return;
      }

      const currentDraftKey = [
        targetConversationId,
        composerDraftVersionRef.current,
        Number(replyPreview?.id || 0),
      ].join(':');
      if (lastSubmittedDraftKeyRef.current === currentDraftKey) {
        return;
      }
      lastSubmittedDraftKeyRef.current = currentDraftKey;

      optimisticMessageIdRef.current -= 1;
      stopLocalTyping();
      queuePendingTextMessage(targetConversationId, {
        tempId: optimisticMessageId,
        clientRequestId,
        content: trimmedText,
        replyToId: replyPreview?.id || null,
      });

      applyConversationMessageUpdate(
        targetConversationId,
        createOptimisticTextMessage({
          id: optimisticMessageId,
          conversationId: targetConversationId,
          clientRequestId,
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

      textSendQueueRef.current.push({
        attemptCount: 0,
        clientRequestId,
        content: trimmedText,
        conversationId: targetConversationId,
        familyCode: familyCodeAtSend,
        replyPreview,
        replyToId: replyPreview?.id || null,
        tempId: optimisticMessageId,
      });
      void processTextSendQueue();
    }
  }, [
    activeFamilyCode,
    applyConversationMessageUpdate,
    conversation?.canSend,
    currentUserAvatarUrl,
    currentUserDisplayName,
    currentUserId,
    processTextSendQueue,
    queuePendingTextMessage,
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
        if (socket && isChatConnected) {
          await deleteMessageSocket(socket, message.id, activeFamilyCode);
        } else {
          await deleteMsg(message.id, activeFamilyCode);
        }

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
    [activeFamilyCode, isChatConnected, selectedId, socket, syncListsFromCache],
  );

  const handleMute = useCallback(async () => {
    if (!conversation || !activeFamilyCode) return;

    try {
      const result =
        socket && isChatConnected
          ? await toggleMuteSocket(
              socket,
              conversation.id,
              activeFamilyCode,
              conversation.isMuted,
            )
          : await toggleMute(
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
  }, [activeFamilyCode, conversation, isChatConnected, socket, syncListsFromCache]);

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
      const nextConversation =
        socket && isChatConnected
          ? await addMembersToRoomSocket(
              socket,
              conversation.roomId,
              activeFamilyCode,
              selectedRoomMemberIds,
            )
          : await addMembersToRoom(
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
    isChatConnected,
    selectedRoomMemberIds,
    socket,
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
        const nextConversation =
          socket && isChatConnected
            ? await removeMemberFromRoomSocket(
                socket,
                conversation.roomId,
                activeFamilyCode,
                member.userId,
              )
            : await removeMemberFromRoom(
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
    [activeFamilyCode, applyConversationRefresh, conversation?.roomId, isChatConnected, socket],
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

  const handleCloseDeleteConversationModal = useCallback(() => {
    if (deleteConversationSubmitting) {
      return;
    }

    setDeleteConversationOpen(false);
    setDeleteConversationError('');
  }, [deleteConversationSubmitting]);

  const handleOpenDeleteConversationModal = useCallback(() => {
    if (!selectedId || !activeFamilyCode) {
      return;
    }

    setDeleteConversationError('');
    setDeleteConversationOpen(true);
    setMenuOpen(false);
  }, [activeFamilyCode, selectedId]);

  const handleConfirmHideConversation = useCallback(async () => {
    if (!selectedId || !activeFamilyCode) {
      return;
    }

    const isGroupConversation =
      Boolean(conversation?.roomId) || selectedType === CONVERSATION_TYPES.GROUP;

    setDeleteConversationSubmitting(true);
    setDeleteConversationError('');
    setRoomMembersError('');

    try {
      if (socket && isChatConnected) {
        try {
          await hideConversationSocket(socket, selectedId, activeFamilyCode);
        } catch (error) {
          if (!isSocketTimeoutError(error)) {
            throw error;
          }
          await hideConversationRequest(selectedId, activeFamilyCode);
        }
      } else {
        await hideConversationRequest(selectedId, activeFamilyCode);
      }

      removeCachedConversation(selectedId, activeFamilyCode);
      if (isGroupConversation) {
        const roomResponse = await getRooms(activeFamilyCode);
        setRooms(cacheRooms(activeFamilyCode, roomResponse?.rooms || []));
      } else {
        const conversationResponse = await getConversations(activeFamilyCode);
        setConversations(
          cacheConversations(activeFamilyCode, conversationResponse?.conversations || []),
        );
      }
      clearOpenConversation();
      setDeleteConversationOpen(false);
      toast.success('Chat deleted successfully.');
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      const message = DELETE_CHAT_ERROR_MESSAGE;
      setDeleteConversationError(message);
      toast.error(message);
    } finally {
      setDeleteConversationSubmitting(false);
    }
  }, [
    activeFamilyCode,
    clearOpenConversation,
    conversation?.roomId,
    isChatConnected,
    selectedId,
    selectedType,
    socket,
  ]);

  const handleLeaveRoom = useCallback(() => {
    if (!conversation?.roomId || !activeFamilyCode || !selectedId) {
      return;
    }

    setRoomMembersOpen(false);
    setRoomMembersError('');
    setSelectedRoomMemberIds([]);
    handleOpenDeleteConversationModal();
  }, [
    activeFamilyCode,
    conversation?.roomId,
    handleOpenDeleteConversationModal,
    selectedId,
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

  const handleDeleteConversation = useCallback(() => {
    if (!selectedId || !activeFamilyCode) {
      return;
    }

    handleOpenDeleteConversationModal();
  }, [activeFamilyCode, handleOpenDeleteConversationModal, selectedId]);

  const handleConfirmDeleteAndLeaveGroup = useCallback(async () => {
    if (!conversation?.roomId || !activeFamilyCode || !selectedId) {
      return;
    }

    setLeavingRoom(true);
    setDeleteConversationSubmitting(true);
    setDeleteConversationError('');
    setRoomMembersError('');

    try {
      if (socket && isChatConnected) {
        await leaveRoomConversationSocket(socket, conversation.roomId, activeFamilyCode);
      } else {
        await leaveRoomConversation(conversation.roomId, activeFamilyCode);
      }
      removeCachedConversation(selectedId, activeFamilyCode);

      const roomResponse = await getRooms(activeFamilyCode);
      setRooms(cacheRooms(activeFamilyCode, roomResponse?.rooms || []));
      clearOpenConversation();
      setDeleteConversationOpen(false);
      toast.success('You left the group successfully.');
    } catch (error) {
      console.error('Failed to leave room:', error);
      const message = error?.message || 'Failed to leave this room';
      setDeleteConversationError(message);
      setRoomMembersError(message);
      toast.error(message);
    } finally {
      setDeleteConversationSubmitting(false);
      setLeavingRoom(false);
    }
  }, [
    activeFamilyCode,
    clearOpenConversation,
    conversation?.roomId,
    isChatConnected,
    selectedId,
    socket,
  ]);

  const handleDeleteRoom = useCallback(async () => {
    if (!conversation?.roomId || !activeFamilyCode || !selectedId) {
      return;
    }

    const roomName = conversation?.roomName || 'this room';
    if (!window.confirm(`Delete ${roomName} for everyone in this room?`)) {
      return;
    }

    try {
      if (socket && isChatConnected) {
        await deleteRoomConversationSocket(socket, conversation.roomId, activeFamilyCode);
      } else {
        await deleteRoomConversation(conversation.roomId, activeFamilyCode);
      }
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
    isChatConnected,
    selectedId,
    socket,
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
  const activeParticipantPresence =
    presenceByUserId[Number(activeParticipant?.userId || 0)] || {
      isOnline: Boolean(activeParticipant?.isOnline),
      lastSeenAt: activeParticipant?.lastSeenAt || null,
    };
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
          : activeParticipantPresence?.isOnline
            ? 'Online now'
            : activeParticipantPresence?.lastSeenAt
              ? `Last seen ${formatInfoDateTime(activeParticipantPresence.lastSeenAt)}`
              : 'Offline';
  const showHeaderOnline =
    !isGroup &&
    activeParticipantPresence?.isOnline &&
    conversation?.conversationState === CONVERSATION_STATES.ACTIVE;
  const headerBadgeLabel = isGroup
    ? isChatConnected
      ? 'Live'
      : 'Offline'
    : activeParticipantPresence?.isOnline
      ? 'Online'
      : 'Offline';
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
    !selectedId ||
    !socket ||
    !isChatConnected ||
    chatLoading ||
    sendingMedia ||
    conversation?.canSend === false;
  const composerPlaceholder =
    !socket || !isChatConnected
      ? 'Connecting to chat...'
      : conversation?.canSend === false
        ? 'Messaging unavailable in this chat'
        : 'Type a message...';
  const infoPanelProps = {
    canLeaveRoom,
    canManageRoom,
    canManageRoomMembers,
    conversation,
    currentRoomMembers,
    handleCloseInfoPanel,
    handleDeleteConversation,
    handleDeleteRoom,
    handleInfoPanelSearch,
    handleLeaveRoom,
    handleMute,
    handleOpenRoomMembers,
    handleOpenRoomPhotoPicker,
    handleRenameRoom,
    headerInitials,
    headerName,
    infoCreatedAtLabel,
    infoFamilyLabel,
    infoPanelDescription,
    infoPanelTitle,
    infoPrimaryMeta,
    isGroup,
    roomAvatarUrl,
    roomDisplayName,
    roomMemberCount,
    roomTypeLabel,
    sharedMediaCount,
    activeParticipant,
  };
  const desktopInfoPanel = <ChatInfoPanel {...infoPanelProps} />;
  const mobileInfoPanel = <ChatInfoPanel {...infoPanelProps} mobile />;

  return (
    <div className="chat-split" id="chat-page">
      {showSidebar ? (
        <ChatSidebar
          activeTab={activeTab}
          familyMemberMap={familyMemberMap}
          filteredConversations={filteredConversations}
          filteredRooms={filteredRooms}
          hasFamilyScope={hasFamilyScope}
          listLoading={listLoading}
          msgCount={msgCount}
          onCreateRoom={handleOpenCreateRoom}
          onNewConversation={handleOpenNewConversation}
          onOpenConversation={openChat}
          onSearchChange={setSearch}
          onTabChange={setActiveTab}
          presenceByUserId={presenceByUserId}
          roomCount={roomCount}
          search={search}
          searchInputRef={searchInputRef}
          selectedId={selectedId}
        />
      ) : null}

      {showChat ? (
        <div className="chat-main">
          <ChatConversationPane
            chatLoading={chatLoading}
            composer={{
              attachmentDraft,
              fileInputRef,
              hasAttachmentDraft,
              hasText: hasComposerText,
              inputRef,
              isDisabled: isComposerDisabled,
              onClearAttachment: () => setAttachmentDraft(null),
              onClearReply: () => setReplyTo(null),
              onEmojiSelect: handleEmojiSelect,
              onFileChange: handleFileChange,
              onKeyDown: handleComposerKeyDown,
              onOpenAttachmentPicker: handleOpenAttachmentPicker,
              onRoomPhotoChange: handleRoomPhotoChange,
              onSend: handleSend,
              onStageAttachment: handleStageAttachment,
              onTextBlur: stopLocalTyping,
              onTextChange: handleTextChange,
              onTogglePicker: handleToggleComposerPicker,
              placeholder: composerPlaceholder,
              ref: composerRef,
              replyTo,
              roomPhotoInputRef,
              showPicker: showComposerPicker,
              text,
            }}
            conversation={conversation}
            directChatBadges={directChatBadges}
            header={{
              activeParticipant,
              hasFamilyScope,
              initials: headerInitials,
              name: headerName,
              onBack: handleBack,
              badgeLabel: headerBadgeLabel,
              onHeaderSearch: handleHeaderSearch,
              onOpenInfoPanel: handleOpenInfoPanel,
              roomAvatarUrl,
              showOnline: showHeaderOnline,
              statusLabel: headerStatusLabel,
            }}
            infoPanel={{
              desktopNode: desktopInfoPanel,
              mobileNode: mobileInfoPanel,
              onOverlayClose: handleCloseInfoPanel,
              showDesktop: showDesktopInfoPanel,
              showMobile: showMobileInfoPanel,
            }}
            isChatConnected={isChatConnected}
            isGroup={isGroup}
            isMobile={isMobile}
            menu={{
              canLeaveRoom,
              canManageRoom,
              canManageRoomMembers,
              leavingRoom,
              onDeleteConversation: handleDeleteConversation,
              onDeleteRoom: handleDeleteRoom,
              onLeaveRoom: handleLeaveRoom,
              onMute: handleMute,
              onOpenRoomMembers: handleOpenRoomMembers,
              onOpenRoomPhotoPicker: handleOpenRoomPhotoPicker,
              onRemoveRoomPhoto: handleRemoveRoomPhoto,
              onRenameRoom: handleRenameRoom,
              onToggle: () => setMenuOpen((current) => !current),
              open: menuOpen,
              ref: menuRef,
              roomPhotoUploading,
            }}
            messageSearch={{
              activeIndex: activeMessageSearchIndex,
              inputRef: messageSearchInputRef,
              onClose: () => {
                setMessageSearchOpen(false);
                setMessageSearchQuery('');
                setActiveMessageSearchIndex(-1);
              },
              onCycle: handleCycleMessageSearch,
              onKeyDown: handleMessageSearchKeyDown,
              onQueryChange: setMessageSearchQuery,
              open: messageSearchOpen,
              query: messageSearchQuery,
              total: messageSearchMatches.length,
            }}
            messagesPane={{
              containerRef: messagesContainerRef,
              activeSearchId: activeMessageSearchId,
              currentUserId,
              endRef: messagesEndRef,
              groupedMessages,
              hasOlderMessages: messagePagination.hasMore,
              hasResolvedHistory: messagePagination.initialized,
              isLoadingOlderMessages: messagePagination.loadingOlder,
              matchIds: messageSearchMatchIds,
              nodeRefs: messageNodeRefs,
              onDeleteMessage: handleDelete,
              onScroll: handleMessagesScroll,
              onReply: setReplyTo,
              onReportMessage: setReportMsg,
              typingLabel,
              typingUserIds,
            }}
            selectedId={selectedId}
          />
        </div>
      ) : null}

      {reportMsg && (
        <ReportMessageModal
          message={reportMsg}
          familyCode={activeFamilyCode}
          onClose={() => setReportMsg(null)}
        />
      )}

      <ChatDeleteConversationModal
        isOpen={deleteConversationOpen}
        conversationName={isGroup ? roomDisplayName : headerName}
        isGroup={isGroup}
        canLeaveRoom={canLeaveRoom}
        isSubmitting={deleteConversationSubmitting || leavingRoom}
        error={deleteConversationError}
        onClose={handleCloseDeleteConversationModal}
        onDelete={handleConfirmHideConversation}
        onDeleteAndLeave={handleConfirmDeleteAndLeaveGroup}
      />

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
