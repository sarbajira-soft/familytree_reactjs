// BLOCK OVERRIDE: Centralized constants for the new user-level block implementation.
export const BLOCK_MESSAGES = {
  confirmBlock: (name) =>
    `Are you sure you want to block ${name}? They will no longer be able to see your content.`,
  confirmUnblock: (name) =>
    `Unblock ${name}? They will be able to see your content again.`,
  blockedSuccess: 'User blocked successfully',
  unblockedSuccess: 'User unblocked successfully',
  actionFailed: 'Failed to update block status',
  invalidUserId: 'Invalid user id',
  blockedProfileTitle: 'You Have Been Blocked',
  blockedProfileDescription:
    "You can no longer view this profile or interact with this user's content.",
  blockerViewDescription: 'You have blocked this user.',
};

export const BLOCK_STATUS = {
  blockedByMe: 'isBlockedByMe',
  blockedByThem: 'isBlockedByThem',
};

export const BLOCK_BADGE_STYLES = {
  backgroundColor: '#EF4444',
  color: '#FFFFFF',
  borderRadius: '9999px',
  fontSize: '10px',
  fontWeight: 700,
  padding: '2px 8px',
};

export const BLOCK_ERROR_CODES = {
  SELF_BLOCK: 'SELF_BLOCK',
  ALREADY_BLOCKED: 'ALREADY_BLOCKED',
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_UNBLOCKED: 'ALREADY_UNBLOCKED',
  NETWORK: 'NETWORK_ERROR',
};

export const BLOCK_API_ENDPOINTS = {
  blockUser: (userId) => `/block/${userId}`,
  unblockUser: (userId) => `/block/${userId}`,
  blockedUsers: '/block',
  blockStatus: (userId) => `/block/status/${userId}`,
};
