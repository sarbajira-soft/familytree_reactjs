import React, { useEffect, useState } from 'react';
import { getBlockedUsers } from '../services/block.service';
import { BlockButton } from '../Components/block/BlockButton';
import { logger } from '../utils/logger';

/** BLOCK OVERRIDE: Dedicated blocked members page for active user-level blocks. */
const BlockedMembersPage = () => {
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBlockedUsers = async () => {
      try {
        const response = await getBlockedUsers();
        setBlockedUsers(response?.data || []);
      } catch (error) {
        logger.error('BLOCK OVERRIDE: Failed to load blocked members page', error);
        setBlockedUsers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBlockedUsers();
  }, []);

  const handleStatusChange = (userId, status) => {
    if (!status?.isBlockedByMe) {
      setBlockedUsers((prev) =>
        prev.filter((row) => Number(row?.blockedUserId) !== Number(userId)),
      );
    }
  };

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">Loading blocked members...</div>;
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="mb-4 text-xl font-semibold text-gray-900">Blocked Members</h1>

      <div className="space-y-3">
        {blockedUsers.map((row) => {
          const user = row?.user || {};
          const fullName = user?.name || 'Unknown user';
          const profilePhoto = user?.profilePhoto || '/assets/user.png';
          const blockedUserId = Number(row?.blockedUserId);

          return (
            <div
              key={row?.id || blockedUserId}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
            >
              <div className="flex items-center gap-3">
                <img
                  src={profilePhoto}
                  alt={fullName}
                  className="h-10 w-10 rounded-full object-cover"
                />
                <span className="text-sm font-medium text-gray-900">{fullName}</span>
              </div>

              <BlockButton
                userId={blockedUserId}
                isBlockedByMe
                location="membersList"
                userName={fullName}
                onStatusChange={(status) => handleStatusChange(blockedUserId, status)}
              />
            </div>
          );
        })}

        {!blockedUsers.length && (
          <p className="text-sm text-gray-500">No blocked members.</p>
        )}
      </div>
    </div>
  );
};

export default BlockedMembersPage;
