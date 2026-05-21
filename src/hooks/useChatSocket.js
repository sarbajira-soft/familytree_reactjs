import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { getToken } from '../utils/auth';
import {
  getCurrentPushPlatform,
  getOrCreatePushInstallationId,
  getOrCreatePushSessionId,
} from '../utils/pushDeviceState';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
let activeChatSocket = null;
let activeChatSocketUserId = null;

const teardownChatSocket = (socket, reason = 'cleanup') => {
  if (!socket) {
    return;
  }

  try {
    socket.removeAllListeners();
    socket.disconnect();
  } catch (error) {
    console.warn(`Chat socket teardown failed (${reason}):`, error);
  }

  if (activeChatSocket === socket) {
    activeChatSocket = null;
    activeChatSocketUserId = null;
  }
};

export const disconnectChatSocket = (reason = 'manual-disconnect') => {
  teardownChatSocket(activeChatSocket, reason);
};

export const useChatSocket = (userInfo, handlers = {}) => {
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!userInfo?.userId) {
      disconnectChatSocket('missing-user');
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      return undefined;
    }

    const token = getToken();
    if (!token) {
      disconnectChatSocket('missing-token');
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      return undefined;
    }

    if (activeChatSocket && activeChatSocketUserId === Number(userInfo.userId)) {
      socketRef.current = activeChatSocket;
      setSocket(activeChatSocket);
      return () => {};
    }

    teardownChatSocket(activeChatSocket, 'reinitialize');

    const nextSocket = io(`${SOCKET_URL}/chat`, {
      auth: {
        token,
        deviceId: getOrCreatePushInstallationId(),
        sessionId: getOrCreatePushSessionId(),
        platform: getCurrentPushPlatform(),
        visibilityState:
          typeof document !== 'undefined' ? document.visibilityState || 'visible' : 'visible',
      },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = nextSocket;
    activeChatSocket = nextSocket;
    activeChatSocketUserId = Number(userInfo.userId);
    setSocket(nextSocket);

    const emitVisibilityState = () => {
      if (!nextSocket.connected || typeof document === 'undefined') {
        return;
      }

      nextSocket.emit('visibility_change', {
        visibility: document.visibilityState || 'visible',
      });
    };

    nextSocket.on('connect', () => {
      setIsConnected(false);
      emitVisibilityState();
    });

    // The namespace transport can connect before the backend finishes auth.
    // We only mark chat as ready after the gateway confirms the session.
    nextSocket.on('connected', () => {
      setIsConnected(true);
      emitVisibilityState();
    });

    nextSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    nextSocket.on('connect_error', (error) => {
      console.warn('Chat socket connection error:', error?.message || error);
      setIsConnected(false);
    });

    if (typeof handlers?.onUnreadCount === 'function') {
      nextSocket.on('unread-chat-count', handlers.onUnreadCount);
    }

    const handleVisibilityChange = () => {
      emitVisibilityState();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      teardownChatSocket(nextSocket, 'effect-cleanup');
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    };
  }, [handlers?.onUnreadCount, userInfo?.userId]);

  return {
    socket,
    isConnected,
  };
};
