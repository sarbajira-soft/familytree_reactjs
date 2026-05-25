import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { getToken } from '../utils/auth';
import { useQueryClient } from '@tanstack/react-query';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

/**
 * Custom hook for real-time event updates via WebSocket
 * @param {number} eventId - Optional event ID to subscribe to specific event updates
 * @param {string} familyCode - Optional family code to subscribe to family events
 */
export const useEventSocket = (eventId = null, familyCode = null) => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      console.warn('⚠️ No auth token available for Event WebSocket connection');
      return;
    }

    console.log('🔌 Connecting to event WebSocket...');

    // Create socket connection
    const socket = io(`${SOCKET_URL}/events`, {
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
      console.log('✅ Event WebSocket connected:', socket.id);
      setIsConnected(true);

      // Auto-join rooms if provided
      if (eventId) {
        socket.emit('join-event', { eventId });
      }
      if (familyCode) {
        socket.emit('join-family-events', { familyCode });
      }
    });

    socket.on('connected', (data) => {
      console.log('✅ Event service connected:', data);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Event WebSocket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Event WebSocket connection error:', error.message);
      setIsConnected(false);
    });

    // Event event handlers
    socket.on('new-event', (data) => {
      console.log('📅 New event created:', data);
      
      // Invalidate events list to show new event
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['events', data.familyCode] });
      
      // Show browser notification if permitted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New Event', {
          body: `${data.event.eventTitle} on ${new Date(data.event.eventDate).toLocaleDateString()}`,
          icon: '/logo.png',
          tag: `event-${data.event.id}`,
        });
      }
    });

    socket.on('event-updated', (data) => {
      console.log('✏️ Event updated:', data);
      
      // Update specific event cache
      queryClient.setQueryData(['event', data.eventId], data.event);
      
      // Invalidate events list
      queryClient.invalidateQueries({ queryKey: ['events'] });
      if (data.familyCode) {
        queryClient.invalidateQueries({ queryKey: ['events', data.familyCode] });
      }
    });

    socket.on('event-deleted', (data) => {
      console.log('🗑️ Event deleted:', data);
      
      // Remove from cache
      queryClient.removeQueries({ queryKey: ['event', data.eventId] });
      
      // Invalidate events list
      queryClient.invalidateQueries({ queryKey: ['events'] });
      if (data.familyCode) {
        queryClient.invalidateQueries({ queryKey: ['events', data.familyCode] });
      }
    });

    socket.on('rsvp-updated', (data) => {
      console.log('✅ RSVP updated:', data);
      
      // Update event cache
      queryClient.invalidateQueries({ queryKey: ['event', data.eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    });

    socket.on('event-reminder', (data) => {
      console.log('⏰ Event reminder:', data);
      
      // Show browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Event Reminder', {
          body: `${data.event.eventTitle} is coming up soon!`,
          icon: '/logo.png',
          tag: `reminder-${data.eventId}`,
        });
      }
    });

    socket.on('error', (error) => {
      console.error('❌ Event WebSocket error:', error);
    });

    // Request browser notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        console.log('Browser notification permission:', permission);
      });
    }

    // Cleanup on unmount
    return () => {
      console.log('🔌 Disconnecting Event WebSocket...');
      if (eventId) {
        socket.emit('leave-event', { eventId });
      }
      if (familyCode) {
        socket.emit('leave-family-events', { familyCode });
      }
      socket.disconnect();
    };
  }, [eventId, familyCode, queryClient]);

  // Join specific event room
  const joinEvent = (newEventId) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('join-event', { eventId: newEventId });
      console.log(`📍 Joined event room: ${newEventId}`);
    }
  };

  // Leave specific event room
  const leaveEvent = (oldEventId) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('leave-event', { eventId: oldEventId });
      console.log(`📍 Left event room: ${oldEventId}`);
    }
  };

  // Join family events room
  const joinFamilyEvents = (newFamilyCode) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('join-family-events', { familyCode: newFamilyCode });
      console.log(`📍 Joined family events: ${newFamilyCode}`);
    }
  };

  // Leave family events room
  const leaveFamilyEvents = (oldFamilyCode) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('leave-family-events', { familyCode: oldFamilyCode });
      console.log(`📍 Left family events: ${oldFamilyCode}`);
    }
  };

  return {
    isConnected,
    joinEvent,
    leaveEvent,
    joinFamilyEvents,
    leaveFamilyEvents,
    socket: socketRef.current,
  };
};
