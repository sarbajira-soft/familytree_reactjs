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
import { removeCurrentChatPushRegistration } from '../services/chatPush.service';
import { clearChatCache } from '../utils/chatCache';

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

  useEffect(() => {
    if (!userInfo?.userId) {
      return undefined;
    }

    removeCurrentChatPushRegistration()
      .catch((error) => {
        console.warn('Chat push cleanup failed:', error);
      });
  }, [userInfo?.userId]);

  const joinConversation = useCallback(
    (conversationId) => {
      if (!socket || !conversationId) return;
      socket.emit(CHAT_SOCKET_EVENTS.JOIN_CONVERSATION, {
        conversationId: Number(conversationId),
      });
    },
    [socket],
  );

  const leaveConversation = useCallback(
    (conversationId) => {
      if (!socket || !conversationId) return;
      socket.emit(CHAT_SOCKET_EVENTS.LEAVE_CONVERSATION, {
        conversationId: Number(conversationId),
      });
    },
    [socket],
  );

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
