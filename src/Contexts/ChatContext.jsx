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
import {
  getChatFamilies,
  getUnreadChatCount,
} from '../services/chat.service';
import { initializeChatPush } from '../services/chatPush.service';
import { clearChatCache } from '../utils/chatCache';

const normalizeFamilyCode = (value) =>
  String(value || '').trim().toUpperCase();

const ChatContext = createContext({
  unreadChatCount: 0,
  families: [],
  activeFamilyCode: '',
  setActiveFamilyCode: () => {},
  refreshUnreadCount: async () => {},
  refreshFamilies: async () => {},
  socket: null,
  isChatConnected: false,
  joinConversation: () => {},
  leaveConversation: () => {},
  emitTyping: () => {},
  markConversationReadSocket: () => {},
});

export const ChatProvider = ({ children }) => {
  const { userInfo } = useUser();
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [families, setFamilies] = useState([]);
  const [activeFamilyCode, setActiveFamilyCode] = useState('');
  const previousUserIdRef = useRef(null);

  const handleUnreadCount = useCallback((payload) => {
    setUnreadChatCount(Number(payload?.count || 0));
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
      setUnreadChatCount(0);
      setFamilies([]);
      setActiveFamilyCode('');
    }

    previousUserIdRef.current = nextUserId;
  }, [userInfo?.userId]);

  const refreshUnreadCount = useCallback(async () => {
    if (!userInfo?.userId) return;
    try {
      const data = await getUnreadChatCount();
      setUnreadChatCount(Number(data?.count || 0));
    } catch (error) {
      console.warn('Chat unread count refresh failed:', error);
    }
  }, [userInfo?.userId]);

  const refreshFamilies = useCallback(async () => {
    if (!userInfo?.userId) {
      setFamilies([]);
      return;
    }

    try {
      const data = await getChatFamilies();
      const nextFamilies = Array.isArray(data?.families) ? data.families : [];
      setFamilies(nextFamilies);

      const preferredFamilyCode = normalizeFamilyCode(userInfo?.familyCode);
      const availableCodes = nextFamilies
        .map((family) => normalizeFamilyCode(family?.familyCode))
        .filter(Boolean);

      setActiveFamilyCode((current) => {
        const currentCode = normalizeFamilyCode(current);

        if (currentCode && availableCodes.includes(currentCode)) {
          return currentCode;
        }

        if (preferredFamilyCode && availableCodes.includes(preferredFamilyCode)) {
          return preferredFamilyCode;
        }

        return availableCodes[0] || '';
      });
    } catch (error) {
      console.warn('Chat families refresh failed:', error);
      setFamilies([]);
      setActiveFamilyCode('');
    }
  }, [userInfo?.familyCode, userInfo?.userId]);

  useEffect(() => {
    refreshUnreadCount();
    refreshFamilies();
  }, [refreshFamilies, refreshUnreadCount]);

  useEffect(() => {
    if (!userInfo?.userId) {
      return undefined;
    }

    let cleanup = async () => {};
    initializeChatPush()
      .then((fn) => {
        cleanup = typeof fn === 'function' ? fn : async () => {};
      })
      .catch((error) => {
        console.warn('Chat push initialization failed:', error);
      });

    return () => {
      cleanup?.();
    };
  }, [userInfo?.userId]);

  const joinConversation = useCallback(
    (conversationId, familyCode = activeFamilyCode) => {
      if (!socket || !conversationId || !familyCode) return;
      socket.emit('join-conversation', {
        conversationId: Number(conversationId),
        familyCode,
      });
    },
    [activeFamilyCode, socket],
  );

  const leaveConversation = useCallback(
    (conversationId) => {
      if (!socket || !conversationId) return;
      socket.emit('leave-conversation', {
        conversationId: Number(conversationId),
      });
    },
    [socket],
  );

  const emitTyping = useCallback(
    (conversationId, familyCode = activeFamilyCode, isTyping = true) => {
      if (!socket || !conversationId || !familyCode) return;
      socket.emit(isTyping ? 'typing-start' : 'typing-stop', {
        conversationId: Number(conversationId),
        familyCode,
      });
    },
    [activeFamilyCode, socket],
  );

  const markConversationReadSocket = useCallback(
    (conversationId, familyCode = activeFamilyCode, readAt = null) => {
      if (!socket || !conversationId || !familyCode) return;
      socket.emit('mark-read', {
        conversationId: Number(conversationId),
        familyCode,
        ...(readAt ? { readAt } : {}),
      });
    },
    [activeFamilyCode, socket],
  );

  const value = useMemo(
    () => ({
      unreadChatCount,
      families,
      activeFamilyCode,
      setActiveFamilyCode,
      refreshUnreadCount,
      refreshFamilies,
      socket,
      isChatConnected: isConnected,
      joinConversation,
      leaveConversation,
      emitTyping,
      markConversationReadSocket,
    }),
    [
      unreadChatCount,
      families,
      activeFamilyCode,
      refreshUnreadCount,
      refreshFamilies,
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
