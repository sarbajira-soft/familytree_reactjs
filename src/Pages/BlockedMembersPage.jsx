import React, { useEffect, useState } from 'react';
import { getBlockedUsers } from '../services/block.service';
import { BlockButton } from '../Components/block/BlockButton';
import { logger } from '../utils/logger';
import { Shield, UserX, Users, AlertCircle, Loader2 } from 'lucide-react';

/** Enterprise-grade Blocked Members Page */
const BlockedMembersPage = () => {
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const fetchBlockedUsers = async () => {
      setLoading(true);
      try {
        const response = await getBlockedUsers();
        console.log('[DEBUG] Full API response:', JSON.stringify(response, null, 2));
        
        // Try different possible response structures
        let users = [];
        if (Array.isArray(response)) {
          users = response;
          console.log('[DEBUG] Response is array, count:', users.length);
        } else if (response?.data && Array.isArray(response.data)) {
          users = response.data;
          console.log('[DEBUG] Found response.data array, count:', users.length);
        } else if (response?.data?.data && Array.isArray(response.data.data)) {
          users = response.data.data;
          console.log('[DEBUG] Found response.data.data array, count:', users.length);
        } else {
          console.log('[DEBUG] No valid array found in response');
        }
        
        console.log('[DEBUG] Final users array:', users);
        setBlockedUsers(users);
        logger.info('Blocked users loaded:', users.length);
      } catch (error) {
        logger.error('Failed to load blocked members:', error);
        setBlockedUsers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBlockedUsers();
  }, [refreshTrigger]);

  // Refresh when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setRefreshTrigger((prev) => prev + 1);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Refresh when window gets focus
  useEffect(() => {
    const handleFocus = () => {
      setRefreshTrigger((prev) => prev + 1);
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const handleStatusChange = (userId, status) => {
    if (!status?.isBlockedByMe) {
      setBlockedUsers((prev) =>
        prev.filter((row) => Number(row?.blockedUserId) !== Number(userId)),
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm font-medium">Loading blocked members...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-red-100 rounded-xl flex items-center justify-center">
              <Shield className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Privacy Settings</h1>
              <p className="text-sm text-gray-500">Manage your blocked users and privacy preferences</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Stats Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 bg-red-50 rounded-2xl flex items-center justify-center">
                <UserX className="h-8 w-8 text-red-500" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{blockedUsers.length}</p>
                <p className="text-sm text-gray-500">Blocked Members</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 max-w-xs">
                Blocked users cannot see your posts, send you messages, or interact with your content.
              </p>
            </div>
          </div>
        </div>

        {/* Blocked Users List */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900">Blocked Profiles</h2>
            </div>
          </div>

          <div className="grid gap-4 p-6">
            {blockedUsers.map((row) => {
              const user = row?.user || {};
              const fullName = user?.name || 'Unknown User';
              const profilePhoto = user?.profilePhoto?.trim() || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(fullName) + '&background=random&color=fff&size=128';
              const blockedUserId = Number(row?.blockedUserId);
              const blockedDate = row?.createdAt 
                ? new Date(row.createdAt).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  })
                : 'Unknown date';

              const handleImageError = (e) => {
                e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(fullName) + '&background=random&color=fff&size=128';
              };

              return (
                <div
                  key={row?.id || blockedUserId}
                  className="group relative bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg hover:border-red-200 transition-all duration-200"
                >
                  <div className="flex items-center gap-5">
                    {/* Avatar Section */}
                    <div className="relative flex-shrink-0">
                      <div className="h-16 w-16 rounded-full overflow-hidden ring-2 ring-gray-100 group-hover:ring-red-100 transition-all">
                        <img
                          src={profilePhoto}
                          alt={fullName}
                          className="h-full w-full object-cover"
                          onError={handleImageError}
                        />
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 h-6 w-6 bg-red-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                        <UserX className="h-3 w-3 text-white" />
                      </div>
                    </div>

                    {/* Info Section */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1.5">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">{fullName}</h3>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                          Blocked
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Blocked on {blockedDate}</span>
                        </div>
                        
                        {user?.familyCode && (
                          <>
                            <span className="text-gray-300">|</span>
                            <div className="flex items-center gap-1.5">
                              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                              <span className="font-medium text-gray-600">{user.familyCode}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Action Section */}
                    <div className="flex-shrink-0">
                      <BlockButton
                        userId={blockedUserId}
                        isBlockedByMe
                        location="membersList"
                        userName={fullName}
                        onStatusChange={(status) => handleStatusChange(blockedUserId, status)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {!blockedUsers.length && (
              <div className="px-6 py-12 text-center">
                <div className="h-20 w-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Blocked Members</h3>
                <p className="text-sm text-gray-500 max-w-sm mx-auto">
                  You haven't blocked anyone yet. When you block someone, they will appear here and won't be able to interact with you.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Info Card */}
        <div className="mt-6 bg-blue-50 rounded-xl border border-blue-100 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-blue-900">About Blocking</h4>
              <p className="text-sm text-blue-700 mt-1">
                When you block a user, they cannot view your profile, see your posts, send you messages, 
                or interact with your content. They will not be notified that you blocked them.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlockedMembersPage;
