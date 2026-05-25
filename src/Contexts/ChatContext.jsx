import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import PropTypes from 'prop-types';
import { useUser } from './UserContext';
import { useChatSocket } from '../hooks/useChatSocket';
import { CHAT_SOCKET_EVENTS } from '../constants/chat.constants';
import {
  getUnreadChatCount,
} from '../services/chat.service';
import { clearChatCache } from '../utils/chatCache';
import {
  clearActivePushConversationId,
  setActivePushConversationId,
} from '../utils/pushDeviceState';

const ChatContext = createContext({
  unreadChatCount: 0,
  refreshUnreadCount: async () => {},
  socket: null,
  isChatConnected: false,
  joinConversation: () => {},
  leaveConversation: () => {},
  emitTyping: () => {},
  markConversationReadSocket: () => {},
});

export const ChatProvider = ({ children }) => {
  const { userInfo } = useUser();
  const [totalUnreadChatCount, setTotalUnreadChatCount] = useState(0);
  const previousUserIdRef = useRef(null);
  const activeConversationStateRef = useRef({
    conversationId: null,
    familyCode: '',
    targetUserId: null,
  });

  const handleUnreadCount = useCallback((payload) => {
    setTotalUnreadChatCount(Number(payload?.totalCount ?? payload?.count ?? 0));
  }, []);

  const { socket, isConnected } = useChatSocket(userInfo, {
    onUnreadCount: handleUnreadCount,
  });

  useEffect(() => {
    const nextUserId = userInfo?.userId || null;
    const previousUserId = previousUserIdRef.current;

    if (previousUserId && previousUserId !== nextUserId) {
      clearChatCache();
    }

    if (!nextUserId) {
      clearChatCache();
      setTotalUnreadChatCount(0);
    }

    previousUserIdRef.current = nextUserId;
  }, [userInfo?.userId]);

  const refreshUnreadCount = useCallback(async () => {
    if (!userInfo?.userId) return;
    try {
      const data = await getUnreadChatCount();
      setTotalUnreadChatCount(Number(data?.totalCount ?? data?.count ?? 0));
    } catch (error) {
      console.warn('Chat unread count refresh failed:', error);
    }
  }, [userInfo?.userId]);

  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  const unreadChatCount = useMemo(
    () => Number(totalUnreadChatCount || 0),
    [totalUnreadChatCount],
  );

  const joinConversation = useCallback(
    (conversationId, familyCode = activeFamilyCode, targetUserId = null) => {
      if (!socket || !socket.connected || !conversationId || !familyCode) return false;
      const normalizedConversationId = Number(conversationId);
      const normalizedFamilyCode = normalizeFamilyCode(familyCode);
      const normalizedTargetUserId = Number(targetUserId || 0) || null;
      const currentState = activeConversationStateRef.current;

      if (
        Number(currentState.conversationId || 0) === normalizedConversationId &&
        normalizeFamilyCode(currentState.familyCode) === normalizedFamilyCode &&
        Number(currentState.targetUserId || 0) === Number(normalizedTargetUserId || 0)
      ) {
        return false;
      }

      socket.emit(CHAT_SOCKET_EVENTS.JOIN_CONVERSATION, {
        conversationId: normalizedConversationId,
        familyCode: normalizedFamilyCode,
      });
      socket.emit('chat_opened', {
        conversationId: normalizedConversationId,
        targetUserId: normalizedTargetUserId,
      });
      activeConversationStateRef.current = {
        conversationId: normalizedConversationId,
        familyCode: normalizedFamilyCode,
        targetUserId: normalizedTargetUserId,
      };
      setActivePushConversationId(normalizedConversationId);
      return true;
    },
    [socket],
  );

  const leaveConversation = useCallback(
    (conversationId) => {
      const normalizedConversationId = Number(conversationId || 0) || null;
      const currentState = activeConversationStateRef.current;
      const shouldEmitClose =
        !!socket &&
        !!socket.connected &&
        !!normalizedConversationId &&
        Number(currentState.conversationId || 0) === normalizedConversationId;

      if (shouldEmitClose) {
        socket.emit(CHAT_SOCKET_EVENTS.LEAVE_CONVERSATION, {
          conversationId: normalizedConversationId,
        });
        socket.emit('chat_closed', {
          conversationId: normalizedConversationId,
        });
      }

      if (
        !normalizedConversationId ||
        Number(currentState.conversationId || 0) === normalizedConversationId
      ) {
        activeConversationStateRef.current = {
          conversationId: null,
          familyCode: '',
          targetUserId: null,
        };
      }

      if (!normalizedConversationId) {
        clearActivePushConversationId();
        return false;
      }

      clearActivePushConversationId(normalizedConversationId);
      return shouldEmitClose;
    },
    [socket],
  );

  useEffect(
    () => () => {
      activeConversationStateRef.current = {
        conversationId: null,
        familyCode: '',
        targetUserId: null,
      };
      clearActivePushConversationId();
    },
    [],
  );

  const joinFamilyRoom = useCallback(
    (familyCode = activeFamilyCode) => {
      if (!socket || !familyCode) return;
      socket.emit(CHAT_SOCKET_EVENTS.JOIN_FAMILY_ROOM, {
        familyCode,
      });
    },
    [activeFamilyCode, socket],
  );

  const leaveFamilyRoom = useCallback(
    (familyCode = activeFamilyCode) => {
      if (!socket || !familyCode) return;
      socket.emit(CHAT_SOCKET_EVENTS.LEAVE_FAMILY_ROOM, {
        familyCode,
      });
    },
    [activeFamilyCode, socket],
  );

  useEffect(() => {
    if (!socket || !isConnected) {
      joinedFamilyCodeRef.current = '';
      activeConversationStateRef.current = {
        conversationId: null,
        familyCode: '',
        targetUserId: null,
      };
      return undefined;
    }

    const normalizedFamilyCode = normalizeFamilyCode(activeFamilyCode);
    if (!normalizedFamilyCode) {
      return undefined;
    }

    joinFamilyRoom(normalizedFamilyCode);
    joinedFamilyCodeRef.current = normalizedFamilyCode;

    return () => {
      leaveFamilyRoom(normalizedFamilyCode);
      if (joinedFamilyCodeRef.current === normalizedFamilyCode) {
        joinedFamilyCodeRef.current = '';
      }
    };
  }, [activeFamilyCode, isConnected, joinFamilyRoom, leaveFamilyRoom, socket]);

  const emitTyping = useCallback(
    (conversationId, familyCode, isTyping = true) => {
      if (!socket || !conversationId || !familyCode) return;
      socket.emit(
        isTyping ? CHAT_SOCKET_EVENTS.TYPING_START : CHAT_SOCKET_EVENTS.TYPING_STOP,
        {
          conversationId: Number(conversationId),
          familyCode,
        },
      );
    },
    [socket],
  );

  const markConversationReadSocket = useCallback(
    (conversationId, familyCode, readAt = null) => {
      if (!socket || !conversationId || !familyCode) return;
      socket.emit(CHAT_SOCKET_EVENTS.MARK_READ, {
        conversationId: Number(conversationId),
        familyCode,
        ...(readAt ? { readAt } : {}),
      });
    },
    [socket],
  );

  const value = useMemo(
    () => ({
      unreadChatCount,
      refreshUnreadCount,
      socket,
      isChatConnected: isConnected,
      joinConversation,
      leaveConversation,
      emitTyping,
      markConversationReadSocket,
    }),
    [
      unreadChatCount,
      refreshUnreadCount,
      socket,
      isConnected,
      joinConversation,
      leaveConversation,
      emitTyping,
      markConversationReadSocket,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

ChatProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useChat = () => useContext(ChatContext);
