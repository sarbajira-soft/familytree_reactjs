import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '../utils/authFetch';

// Hook for dashboard summary data
export const useDashboardSummary = (familyCode, userId, enabled = true) => {
  return useQuery({
    queryKey: ['dashboardSummary', familyCode, userId],
    queryFn: () => authFetch(`/dashboard/summary?familyCode=${familyCode}&userId=${userId}`),
    enabled: enabled && !!familyCode && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook for family stats
export const useFamilyStats = (familyCode, enabled = true) => {
  return useQuery({
    queryKey: ['familyStats', familyCode],
    queryFn: () => authFetch(`/family/member/${familyCode}/stats`),
    enabled: enabled && !!familyCode,
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for user posts
export const useUserPosts = (userId, enabled = true) => {
  return useQuery({
    queryKey: ['userPosts', userId],
    queryFn: () => authFetch(`/post/by-options?createdBy=${userId}`),
    enabled: enabled && !!userId,
    staleTime: 3 * 60 * 1000, // 3 minutes
  });
};

// Hook for user galleries
export const useUserGalleries = (userId, enabled = true) => {
  return useQuery({
    queryKey: ['userGalleries', userId],
    queryFn: () => authFetch(`/gallery/by-options?createdBy=${userId}`),
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
    queryFn: () => authFetch(getEndpoint()),
    enabled: enabled && !!familyCode && approveStatus === 'approved',
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Hook for notifications (initial fetch only - WebSocket handles real-time updates)
export const useNotifications = (enabled = true) => {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => authFetch('/notifications?all=true'),
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
    queryFn: () => authFetch('/notifications/unread/count'),
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
    queryFn: () => authFetch(`/family/tree/${familyCode}/complete?userId=${userId}`),
    enabled: enabled && !!familyCode && !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Hook for custom labels (highly cacheable)
export const useCustomLabels = (language = 'en', enabled = true) => {
  return useQuery({
    queryKey: ['customLabels', language],
    queryFn: () => authFetch(`/custom-labels/all?language=${language}`),
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
      authFetch('/family/accept-association', {
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
      authFetch('/family/reject-association', {
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
      authFetch(`/post/${postId}/${isLiked ? 'unlike' : 'like'}` , {
        method: 'POST',
      }),
    onSuccess: (data, variables) => {
      // Optimistically update the cache
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
    },
  });
};

// Mutation hook for deleting posts
export const useDeletePost = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (postId) => 
      authFetch(`/post/delete/${postId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
    },
  });
};
