import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { getToken } from '../utils/auth';
import { useQueryClient } from "@tanstack/react-query";


const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

/**
 * Custom hook for real-time post updates via WebSocket
 * @param {number} postId - Optional post ID to subscribe to specific post updates
 * @param {string} familyCode - Optional family code to subscribe to family feed
 */
export const usePostSocket = (postId = null, familyCode = null) => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      console.warn('⚠️ No auth token available for Post WebSocket connection');
      return;
    }

    console.log('🔌 Connecting to post WebSocket...');

    // Create socket connection
    const socket = io(`${SOCKET_URL}/posts`, {
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
      console.log('✅ Post WebSocket connected:', socket.id);
      setIsConnected(true);

      // Auto-join rooms if provided
      if (postId) {
        socket.emit('join-post', { postId });
      }
      if (familyCode) {
        socket.emit('join-family-feed', { familyCode });
      }
    });

    socket.on('connected', (data) => {
      console.log('✅ Post service connected:', data);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Post WebSocket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Post WebSocket connection error:', error.message);
      setIsConnected(false);
    });

    // Post event handlers
    socket.on('post-liked', (data) => {
      console.log('👍 Post liked:', data);
      
      // Update React Query cache for the specific post
      queryClient.setQueryData(['post', data.postId], (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          likeCount: data.likeCount,
          isLiked: data.isLiked,
        };
      });

      // Invalidate posts list to refetch
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    });

    socket.on('new-comment', (data) => {
      console.log('💬 New comment:', data);
      
      // Update React Query cache
      queryClient.invalidateQueries({ queryKey: ['comments', data.postId] });
      queryClient.invalidateQueries({ queryKey: ['post', data.postId] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    });

    socket.on('comment-deleted', (data) => {
      console.log('🗑️ Comment deleted:', data);
      
      // Update React Query cache
      queryClient.invalidateQueries({ queryKey: ['comments', data.postId] });
      queryClient.invalidateQueries({ queryKey: ['post', data.postId] });
    });

    socket.on('new-post', (data) => {
      console.log('📝 New post in feed:', data);
      
      // Invalidate posts list to show new post
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['posts', data.familyCode] });
    });

    socket.on('post-updated', (data) => {
      console.log('✏️ Post updated:', data);
      
      // Update specific post cache
      queryClient.setQueryData(['post', data.postId], data.post);
      
      // Invalidate posts list
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    });

    socket.on('post-deleted', (data) => {
      console.log('🗑️ Post deleted:', data);
      
      // Remove from cache
      queryClient.removeQueries({ queryKey: ['post', data.postId] });
      
      // Invalidate posts list
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      if (data.familyCode) {
        queryClient.invalidateQueries({ queryKey: ['posts', data.familyCode] });
      }
    });

    socket.on('error', (error) => {
      console.error('❌ Post WebSocket error:', error);
    });

    // Cleanup on unmount
    return () => {
      console.log('🔌 Disconnecting Post WebSocket...');
      if (postId) {
        socket.emit('leave-post', { postId });
      }
      if (familyCode) {
        socket.emit('leave-family-feed', { familyCode });
      }
      socket.disconnect();
    };
  }, [postId, familyCode, queryClient]);

  // Join specific post room
  const joinPost = (newPostId) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('join-post', { postId: newPostId });
      console.log(`📍 Joined post room: ${newPostId}`);
    }
  };

  // Leave specific post room
  const leavePost = (oldPostId) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('leave-post', { postId: oldPostId });
      console.log(`📍 Left post room: ${oldPostId}`);
    }
  };

  // Join family feed room
  const joinFamilyFeed = (newFamilyCode) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('join-family-feed', { familyCode: newFamilyCode });
      console.log(`📍 Joined family feed: ${newFamilyCode}`);
    }
  };

  // Leave family feed room
  const leaveFamilyFeed = (oldFamilyCode) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('leave-family-feed', { familyCode: oldFamilyCode });
      console.log(`📍 Left family feed: ${oldFamilyCode}`);
    }
  };

  return {
    isConnected,
    joinPost,
    leavePost,
    joinFamilyFeed,
    leaveFamilyFeed,
    socket: socketRef.current,
  };
};
