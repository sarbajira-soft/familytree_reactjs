import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { getToken } from '../utils/auth';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export const useChatSocket = (userInfo, handlers = {}) => {
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!userInfo?.userId) {
      return undefined;
    }

    const token = getToken();
    if (!token) {
      return undefined;
    }

    const nextSocket = io(`${SOCKET_URL}/chat`, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = nextSocket;
    setSocket(nextSocket);

    nextSocket.on('connect', () => {
      setIsConnected(true);
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

    return () => {
      nextSocket.disconnect();
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
