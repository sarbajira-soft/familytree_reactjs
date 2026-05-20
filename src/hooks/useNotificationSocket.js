import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { getToken } from '../utils/auth';
import { authFetchResponse } from '../utils/authFetch';
import {
  countUnreadNonChatNotifications,
  filterNonChatNotifications,
  isChatOrRoomNotification,
} from '../utils/chatNotificationFilter';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export const useNotificationSocket = (userInfo) => {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef(null);
  const queryClient = useQueryClient();

  const fetchUnreadCount = useCallback(async () => {
    const token = getToken();
    if (!token || !userInfo?.userId) {
      setUnreadCount(0);
      return;
    }

    try {
      const response = await authFetchResponse('/notifications?all=true', {
        method: 'GET',
        skipThrow: true,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      setUnreadCount(countUnreadNonChatNotifications(data));
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  }, [userInfo?.userId]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (!userInfo?.userId) {
      setNotifications([]);
      setIsConnected(false);
      return undefined;
    }

    const token = getToken();
    if (!token) {
      console.warn('No auth token available for notification WebSocket connection');
      return undefined;
    }

    const socket = io(`${SOCKET_URL}/notifications`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('connected', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Notification WebSocket connection error:', error.message);
      setIsConnected(false);
    });

    socket.on('notification', (notification) => {
      if (isChatOrRoomNotification(notification)) {
        void fetchUnreadCount();
        return;
      }

      setNotifications((prev) => filterNonChatNotifications([notification, ...prev]));
      queryClient.invalidateQueries({ queryKey: ['notifications'] });

      void fetchUnreadCount();
    });

    socket.on('unread-count-update', () => {
      void fetchUnreadCount();
    });

    socket.on('post-like', (data) => {
      setNotifications((prev) => [
        {
          type: 'post_like',
          title: 'New Like',
          message: `${data.userName} liked your post`,
          postId: data.postId,
          userId: data.userId,
          time: new Date(),
        },
        ...prev,
      ]);
      void fetchUnreadCount();
    });

    socket.on('notification-updated', () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void fetchUnreadCount();
    });

    socket.on('family_event', (event) => {
      switch (event.type) {
        case 'TREE_PERSON_DELETED':
          queryClient.invalidateQueries({ queryKey: ['familyTree'] });
          break;
        case 'MEMBER_REMOVED':
        case 'DUMMY_USER_REPLACED':
          queryClient.invalidateQueries({ queryKey: ['familyTree'] });
          queryClient.invalidateQueries({ queryKey: ['familyMembers'] });
          break;
        default:
          break;
      }
    });

    socket.on('error', (error) => {
      console.error('Notification WebSocket error:', error);
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchUnreadCount, queryClient, userInfo?.userId]);

  const subscribe = () => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('subscribe-notifications', { userId: userInfo?.userId });
    }
  };

  const unsubscribe = () => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('unsubscribe-notifications');
    }
  };

  return {
    isConnected,
    notifications,
    unreadCount,
    subscribe,
    unsubscribe,
    refetchUnreadCount: fetchUnreadCount,
    socket: socketRef.current,
  };
};
