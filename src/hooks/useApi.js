import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getToken } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Generic fetch function with auth
const fetchWithAuth = async (endpoint, options = {}) => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

// Hook for dashboard summary data
export const useDashboardSummary = (familyCode, userId, enabled = true) => {
  return useQuery({
    queryKey: ['dashboardSummary', familyCode, userId],
    queryFn: () => fetchWithAuth(`/dashboard/summary?familyCode=${familyCode}&userId=${userId}`),
    enabled: enabled && !!familyCode && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook for family stats
export const useFamilyStats = (familyCode, enabled = true) => {
  return useQuery({
    queryKey: ['familyStats', familyCode],
    queryFn: () => fetchWithAuth(`/family/member/${familyCode}/stats`),
    enabled: enabled && !!familyCode,
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for user posts
export const useUserPosts = (userId, enabled = true) => {
  return useQuery({
    queryKey: ['userPosts', userId],
    queryFn: () => fetchWithAuth(`/post/by-options?createdBy=${userId}`),
    enabled: enabled && !!userId,
    staleTime: 3 * 60 * 1000, // 3 minutes
  });
};

// Hook for user galleries
export const useUserGalleries = (userId, enabled = true) => {
  return useQuery({
    queryKey: ['userGalleries', userId],
    queryFn: () => fetchWithAuth(`/gallery/by-options?createdBy=${userId}`),
    enabled: enabled && !!userId,
    staleTime: 3 * 60 * 1000,
  });
};

// Hook for events by tab
export const useEvents = (activeTab, familyCode, approveStatus, enabled = true) => {
  const getEndpoint = () => {
    if (activeTab === 'upcoming') return '/event/upcoming/all';
    if (activeTab === 'my-events') return '/event/my-events';
    if (activeTab === 'all') return '/event/all';
    return '/event/upcoming/all';
  };

  return useQuery({
    queryKey: ['events', activeTab, familyCode],
    queryFn: () => fetchWithAuth(getEndpoint()),
    enabled: enabled && !!familyCode && approveStatus === 'approved',
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Hook for notifications (initial fetch only - WebSocket handles real-time updates)
export const useNotifications = (enabled = true) => {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetchWithAuth('/notifications?all=true'),
    enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes - WebSocket updates cache
    refetchInterval: false, // Disabled - WebSocket handles real-time updates
    refetchOnWindowFocus: false, // Disabled - rely on WebSocket
  });
};

// Hook for unread notification count (initial fetch only - WebSocket handles real-time updates)
export const useUnreadCount = (enabled = true) => {
  return useQuery({
    queryKey: ['unreadCount'],
    queryFn: () => fetchWithAuth('/notifications/unread/count'),
    enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes - WebSocket updates cache
    refetchInterval: false, // Disabled - WebSocket handles real-time updates
    refetchOnWindowFocus: false, // Disabled - rely on WebSocket
  });
};

// Hook for family tree complete data
export const useFamilyTreeComplete = (familyCode, userId, enabled = true) => {
  return useQuery({
    queryKey: ['familyTreeComplete', familyCode, userId],
    queryFn: () => fetchWithAuth(`/family/tree/${familyCode}/complete?userId=${userId}`),
    enabled: enabled && !!familyCode && !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Hook for custom labels (highly cacheable)
export const useCustomLabels = (language = 'en', enabled = true) => {
  return useQuery({
    queryKey: ['customLabels', language],
    queryFn: () => fetchWithAuth(`/custom-labels/all?language=${language}`),
    enabled,
    staleTime: 30 * 60 * 1000, // 30 minutes - labels don't change often
    cacheTime: 60 * 60 * 1000, // 1 hour
  });
};

// Mutation hook for accepting association
export const useAcceptAssociation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (requestId) => 
      fetchWithAuth('/family/accept-association', {
        method: 'POST',
        body: JSON.stringify({ requestId }),
      }),
    onSuccess: () => {
      // Invalidate notifications to refetch
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    },
  });
};

// Mutation hook for rejecting association
export const useRejectAssociation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (requestId) => 
      fetchWithAuth('/family/reject-association', {
        method: 'POST',
        body: JSON.stringify({ requestId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    },
  });
};

// Mutation hook for liking/unliking posts
export const useTogglePostLike = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ postId, isLiked }) => 
      fetchWithAuth(`/post/${postId}/${isLiked ? 'unlike' : 'like'}`, {
        method: 'POST',
      }),
    onSuccess: (data, variables) => {
      // Optimistically update the cache
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
    },
  });
};

// =======================
// Family Merge hooks
// =======================

// List merge requests for the logged-in admin (optionally filtered by status)
export const useMergeRequests = (status, enabled = true) => {
  return useQuery({
    queryKey: ['mergeRequests', status],
    queryFn: () =>
      fetchWithAuth(
        status ? `/family-merge/requests?status=${encodeURIComponent(status)}` : '/family-merge/requests',
      ),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
};

// Fetch merge analysis (matches, conflicts, new persons, generation mapping)
export const useMergeAnalysis = (requestId, enabled = true) => {
  return useQuery({
    queryKey: ['mergeAnalysis', requestId],
    queryFn: () => fetchWithAuth(`/family-merge/${requestId}/analysis`),
    enabled: enabled && !!requestId,
    staleTime: 5 * 60 * 1000,
  });
};

// Fetch cached merge state (selection/cache)
export const useMergeState = (requestId, enabled = true) => {
  return useQuery({
    queryKey: ['mergeState', requestId],
    queryFn: () => fetchWithAuth(`/family-merge/${requestId}/state`),
    enabled: enabled && !!requestId,
    staleTime: 5 * 60 * 1000,
  });
};

// Mutation hook for deleting posts
export const useDeletePost = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (postId) => 
      fetchWithAuth(`/post/delete/${postId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
    },
  });
};
