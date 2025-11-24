import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { getToken } from '../utils/auth';
import { useQueryClient } from '@tanstack/react-query';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export const useNotificationSocket = (userInfo) => {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef(null);
  const queryClient = useQueryClient();

  // Function to fetch unread count via REST API
  const fetchUnreadCount = async () => {
    const token = getToken();
    if (!token || !userInfo?.userId) return;

    try {
      const response = await fetch(`${SOCKET_URL}/notifications/unread/count`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      setUnreadCount(data.unreadCount || 0);
      console.log('🔄 Unread count fetched:', data.unreadCount);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  // Fetch initial unread count via REST API
  useEffect(() => {
    fetchUnreadCount();
  }, [userInfo?.userId]);
  useEffect(() => {
    console.log("🔁 useEffect triggered - connecting socket", userInfo?.userId);
  }, [userInfo?.userId, queryClient]);


  useEffect(() => {
    // Only connect if we have a user
    if (!userInfo?.userId) {
      console.log('⏸️ WebSocket: Waiting for user info...');
      return;
    }

    const token = getToken();
    if (!token) {
      console.warn('⚠️ No auth token available for WebSocket connection');
      return;
    }

    console.log('🔌 Connecting to notification WebSocket for user:', userInfo.userId);
    console.log(token);
    // Create socket connection
    const socket = io(`${SOCKET_URL}/notifications`, {
      auth: {
        token: token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('✅ WebSocket connected:', socket.id);
      setIsConnected(true);
    });

    socket.on('connected', (data) => {
      console.log('✅ Notification service connected:', data);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error.message);
      setIsConnected(false);
    });

    // Notification event handlers
    socket.on('notification', (notification) => {
      console.log('🔔 New notification received:', notification);
      
      // Add to local state
      setNotifications((prev) => [notification, ...prev]);
      
      // Invalidate React Query cache to refetch notifications
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      
      // Show browser notification if permitted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/logo.png',
          tag: `notification-${notification.id}`,
        });
      }
    });

    socket.on('unread-count-update', (data) => {
      console.log('📊 Unread count updated:', data.count);
      setUnreadCount(data.count);
      
      // Update React Query cache
      queryClient.setQueryData(['unreadCount'], data.count);
    });

    socket.on("post-like", (data) => {
      console.log("👍 Post like event received:", data);

      // Example: Add it to notifications list
      setNotifications((prev) => [
        {
          type: "post_like",
          title: "New Like",
          message: `${data.userName} liked your post`,
          postId: data.postId,
          userId: data.userId,
          time: new Date(),
        },
        ...prev,
      ]);
    });


    socket.on('notification-updated', (data) => {
      console.log('🔄 Notification updated:', data);
      
      // Invalidate cache to refetch
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    socket.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });

    // Request browser notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        console.log('Browser notification permission:', permission);
      });
    }

    // Cleanup on unmount
    return () => {
      console.log('🔌 Disconnecting WebSocket...');
      socket.disconnect();
    };
  }, [userInfo?.userId, queryClient]);

  // Subscribe to notifications
  const subscribe = () => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('subscribe-notifications', { userId: userInfo?.userId });
    }
  };

  // Unsubscribe from notifications
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
    refetchUnreadCount: fetchUnreadCount, // Expose refetch function
    socket: socketRef.current,
  };
};