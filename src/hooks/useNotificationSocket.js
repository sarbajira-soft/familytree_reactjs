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
import {
  getCurrentPushPlatform,
  getOrCreatePushInstallationId,
  getOrCreatePushSessionId,
} from '../utils/pushDeviceState';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
let activeNotificationSocket = null;
let activeNotificationSocketUserId = null;

const isNotificationUnread = (notification = {}) => {
  if (typeof notification?.read === 'boolean') {
    return !notification.read;
  }
  if (typeof notification?.isRead === 'boolean') {
    return !notification.isRead;
  }
  return true;
};

const getNotificationTimestamp = (notification = {}) => {
  const value = notification?.createdAt || notification?.time || notification?.readAt || 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const normalizeNotificationShape = (notification = {}) => {
  const createdAt = notification?.createdAt || notification?.time || new Date().toISOString();
  const hasRead = typeof notification?.read === 'boolean';
  const hasIsRead = typeof notification?.isRead === 'boolean';
  const read = hasRead ? notification.read : hasIsRead ? Boolean(notification.isRead) : false;

  return {
    ...notification,
    createdAt,
    time: notification?.time || createdAt,
    read,
    isRead: hasIsRead ? Boolean(notification.isRead) : read,
  };
};

const mergeNotifications = (currentNotifications = [], incomingNotifications = []) => {
  const mergedById = new Map();

  [...(Array.isArray(currentNotifications) ? currentNotifications : []), ...(Array.isArray(incomingNotifications) ? incomingNotifications : [])]
    .map((notification) => normalizeNotificationShape(notification))
    .forEach((notification) => {
      const id = Number(notification?.id || 0);
      if (!id) {
        return;
      }

      const existing = mergedById.get(id) || {};
      mergedById.set(id, {
        ...existing,
        ...notification,
        data: {
          ...(existing?.data && typeof existing.data === 'object' ? existing.data : {}),
          ...(notification?.data && typeof notification.data === 'object' ? notification.data : {}),
        },
      });
    });

  return filterNonChatNotifications(
    Array.from(mergedById.values()).sort(
      (left, right) => getNotificationTimestamp(right) - getNotificationTimestamp(left),
    ),
  );
};

const areNotificationsEqual = (leftNotifications = [], rightNotifications = []) => {
  const left = Array.isArray(leftNotifications) ? leftNotifications : [];
  const right = Array.isArray(rightNotifications) ? rightNotifications : [];
  if (left === right) {
    return true;
  }

  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftNotification = left[index] || {};
    const rightNotification = right[index] || {};
    if (Number(leftNotification?.id || 0) !== Number(rightNotification?.id || 0)) {
      return false;
    }

    if (Boolean(leftNotification?.read) !== Boolean(rightNotification?.read)) {
      return false;
    }

    if (String(leftNotification?.status || '') !== String(rightNotification?.status || '')) {
      return false;
    }

    if (
      String(leftNotification?.createdAt || leftNotification?.time || '') !==
      String(rightNotification?.createdAt || rightNotification?.time || '')
    ) {
      return false;
    }
  }

  return true;
};

const teardownNotificationSocket = (socket, reason = 'cleanup') => {
  if (!socket) {
    return;
  }

  try {
    socket.removeAllListeners();
    socket.disconnect();
  } catch (error) {
    console.warn(`Notification WebSocket teardown failed (${reason}):`, error);
  }

  if (activeNotificationSocket === socket) {
    activeNotificationSocket = null;
    activeNotificationSocketUserId = null;
  }
};

export const disconnectNotificationSocket = (reason = 'manual-disconnect') => {
  teardownNotificationSocket(activeNotificationSocket, reason);
};

export const useNotificationSocket = (userInfo) => {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef(null);
  const renderCountRef = useRef(0);
  const listenerRegistrationCountRef = useRef(0);
  const refetchTimeoutRef = useRef(null);
  const inFlightNotificationFetchRef = useRef(null);
  const queryClient = useQueryClient();

  renderCountRef.current += 1;
  console.debug(
    `[NotificationSocket] render count=${renderCountRef.current} user=${Number(userInfo?.userId || 0)} notifications=${notifications.length} unread=${unreadCount}`,
  );

  const syncNotificationCollections = useCallback((updater) => {
    setNotifications((prev) => {
      const next = updater(Array.isArray(prev) ? prev : []);
      if (areNotificationsEqual(prev, next)) {
        return prev;
      }

      queryClient.setQueryData(['notifications'], next);
      return next;
    });
  }, [queryClient]);

  const emitAppState = useCallback(() => {
    if (!socketRef.current?.connected || typeof document === 'undefined') {
      return;
    }

    const visibilityState = document.visibilityState || 'visible';
    socketRef.current.emit('app-state', {
      visibilityState,
    });
    socketRef.current.emit('visibility_change', {
      visibility: visibilityState,
    });
  }, []);

  const syncNotificationReadState = useCallback((payload) => {
    syncNotificationCollections((prev) => {
      const nextNotifications = Array.isArray(prev) ? [...prev] : [];

      if (payload?.markAll) {
        return nextNotifications.map((notification) => ({
          ...notification,
          read: true,
          readAt: payload?.readAt || notification.readAt || new Date().toISOString(),
          status: payload?.status || notification.status,
        }));
      }

      return nextNotifications.map((notification) =>
        Number(notification?.id || 0) === Number(payload?.notificationId || 0)
          ? {
              ...notification,
              read: payload?.isRead !== false,
              readAt: payload?.readAt || notification.readAt || new Date().toISOString(),
              status: payload?.status || notification.status,
            }
          : notification,
      );
    });
  }, [syncNotificationCollections]);

  const syncNotificationStatus = useCallback((payload) => {
    if (!payload?.notificationId) {
      return;
    }

    syncNotificationCollections((prev) =>
      (Array.isArray(prev) ? prev : []).map((notification) =>
        Number(notification?.id || 0) === Number(payload.notificationId)
          ? { ...notification, status: payload.status || notification.status }
          : notification,
      ),
    );
  }, [syncNotificationCollections]);

  const refetchNotifications = useCallback(async (reason = 'manual') => {
    const token = getToken();
    if (!token || !userInfo?.userId) {
      console.debug(
        `[NotificationSocket] refetch skipped reason=${reason} user=${Number(userInfo?.userId || 0)} token=${token ? 'present' : 'missing'}`,
      );
      syncNotificationCollections(() => []);
      return [];
    }

    if (inFlightNotificationFetchRef.current) {
      console.debug(
        `[NotificationSocket] refetch joined existing request reason=${reason} user=${Number(userInfo.userId)}`,
      );
      return inFlightNotificationFetchRef.current;
    }

    try {
      console.debug(
        `[NotificationSocket] refetch start reason=${reason} user=${Number(userInfo.userId)}`,
      );
      const request = (async () => {
        const response = await authFetchResponse('/notifications?all=true', {
          method: 'GET',
          skipThrow: true,
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();
        const fetchedNotifications = Array.isArray(data)
          ? data.map((notification) => normalizeNotificationShape(notification))
          : [];
        let mergedNotifications = [];
        syncNotificationCollections((prev) => {
          mergedNotifications = mergeNotifications(prev, fetchedNotifications);
          return mergedNotifications;
        });
        console.debug(
          `[NotificationSocket] refetch success reason=${reason} user=${Number(userInfo.userId)} count=${fetchedNotifications.length}`,
        );
        return mergedNotifications;
      })();
      inFlightNotificationFetchRef.current = request;
      return await request;
    } catch (error) {
      console.error('Failed to refetch notifications:', error);
      return [];
    } finally {
      inFlightNotificationFetchRef.current = null;
    }
  }, [syncNotificationCollections, userInfo?.userId]);

  const scheduleNotificationRefetch = useCallback(
    (reason = 'socket-notification') => {
      if (refetchTimeoutRef.current) {
        clearTimeout(refetchTimeoutRef.current);
      }

      console.debug(
        `[NotificationSocket] refetch scheduled reason=${reason} user=${Number(userInfo?.userId || 0)}`,
      );
      refetchTimeoutRef.current = setTimeout(() => {
        refetchTimeoutRef.current = null;
        void refetchNotifications(reason);
      }, 250);
    },
    [refetchNotifications, userInfo?.userId],
  );

  const fetchUnreadCount = useCallback(async () => {
    const token = getToken();
    if (!token || !userInfo?.userId) {
      setUnreadCount(0);
      return;
    }

    try {
      const response = await authFetchResponse('/notifications/unread/count', {
        method: 'GET',
        skipThrow: true,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      const nextCount = Number(data?.unreadCount);
      if (Number.isFinite(nextCount)) {
        setUnreadCount(nextCount);
        return;
      }

      setUnreadCount(countUnreadNonChatNotifications(data));
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  }, [userInfo?.userId]);

  useEffect(() => {
    console.debug(
      `[NotificationSocket] useEffect fetchUnreadCount triggered user=${Number(userInfo?.userId || 0)}`,
    );
    void fetchUnreadCount();
  }, [fetchUnreadCount, userInfo?.userId]);

  useEffect(() => {
    if (!userInfo?.userId) {
      return undefined;
    }

    console.debug(
      `[NotificationSocket] useEffect initial notification fetch triggered user=${Number(userInfo.userId)}`,
    );
    void refetchNotifications('initial-page-load');
    return undefined;
  }, [refetchNotifications, userInfo?.userId]);

  useEffect(() => {
    console.debug(
      `[NotificationSocket] socket effect triggered user=${Number(userInfo?.userId || 0)}`,
    );
    if (!userInfo?.userId) {
      disconnectNotificationSocket('missing-user');
      socketRef.current = null;
      setNotifications([]);
      setIsConnected(false);
      return undefined;
    }

    const token = getToken();
    if (!token) {
      disconnectNotificationSocket('missing-token');
      socketRef.current = null;
      console.warn('No auth token available for notification WebSocket connection');
      return undefined;
    }

    if (
      activeNotificationSocket &&
      activeNotificationSocketUserId === Number(userInfo.userId)
    ) {
      socketRef.current = activeNotificationSocket;
      return () => {};
    }

    teardownNotificationSocket(activeNotificationSocket, 'reinitialize');

    const socket = io(`${SOCKET_URL}/notifications`, {
      auth: {
        token,
        deviceId: getOrCreatePushInstallationId(),
        sessionId: getOrCreatePushSessionId(),
        platform: getCurrentPushPlatform(),
        visibilityState:
          typeof document !== 'undefined' ? document.visibilityState || 'visible' : 'visible',
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;
    activeNotificationSocket = socket;
    activeNotificationSocketUserId = Number(userInfo.userId);
    listenerRegistrationCountRef.current += 1;
    console.debug(
      `[NotificationSocket] listener registration count=${listenerRegistrationCountRef.current} user=${Number(userInfo.userId)}`,
    );

    socket.on('connect', () => {
      setIsConnected(true);
      emitAppState();
    });

    socket.on('connected', () => {
      setIsConnected(true);
      emitAppState();
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
        return;
      }

      const normalizedNotification = normalizeNotificationShape(notification);
      let addedUnreadNotification = false;
      syncNotificationCollections((prev) => {
        const existingNotifications = Array.isArray(prev) ? prev : [];
        const alreadyExists = existingNotifications.some(
          (entry) => Number(entry?.id || 0) === Number(normalizedNotification?.id || 0),
        );
        addedUnreadNotification =
          !alreadyExists && isNotificationUnread(normalizedNotification);
        return mergeNotifications(existingNotifications, [normalizedNotification]);
      });
      console.debug(
        `[NotificationSocket] socket notification received id=${Number(normalizedNotification?.id || 0)} triggering scheduled refetch`,
      );
      scheduleNotificationRefetch('socket-notification');
      if (addedUnreadNotification) {
        setUnreadCount((prev) => prev + 1);
      }
    });

    socket.on('unread-count-update', (payload) => {
      const nextCount = Number(payload?.count);
      if (Number.isFinite(nextCount)) {
        setUnreadCount(nextCount);
        return;
      }
      void fetchUnreadCount();
    });

    socket.on('notification-unread-count-updated', (payload) => {
      const nextCount = Number(payload?.count);
      if (Number.isFinite(nextCount)) {
        setUnreadCount(nextCount);
      } else {
        void fetchUnreadCount();
      }
    });

    socket.on('notification-updated', (payload) => {
      syncNotificationStatus(payload);
      console.debug(
        `[NotificationSocket] invalidate skipped event=notification-updated notificationId=${Number(payload?.notificationId || 0)}`,
      );
    });

    socket.on('notification-read', (payload) => {
      syncNotificationReadState(payload);
      if (Number.isFinite(Number(payload?.unreadCount))) {
        setUnreadCount(Number(payload.unreadCount));
      } else {
        void fetchUnreadCount();
      }
      console.debug(
        `[NotificationSocket] invalidate skipped event=notification-read notificationId=${Number(payload?.notificationId || 0)}`,
      );
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

    const handleVisibilityChange = () => {
      emitAppState();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      console.debug(
        `[NotificationSocket] cleanup triggered user=${Number(userInfo?.userId || 0)}`,
      );
      if (refetchTimeoutRef.current) {
        clearTimeout(refetchTimeoutRef.current);
        refetchTimeoutRef.current = null;
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      teardownNotificationSocket(socket, 'effect-cleanup');
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [
    emitAppState,
    fetchUnreadCount,
    scheduleNotificationRefetch,
    syncNotificationCollections,
    syncNotificationReadState,
    syncNotificationStatus,
    userInfo?.userId,
  ]);

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
    refetchNotifications,
    refetchUnreadCount: fetchUnreadCount,
    socket: socketRef.current,
  };
};
