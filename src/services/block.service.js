import { BLOCK_API_ENDPOINTS, BLOCK_MESSAGES } from '../constants/block.constants';
import { authFetchResponse } from '../utils/authFetch';
import { logger } from '../utils/logger';

const sanitizeUserId = (userId) => {
  const parsedUserId = Number.parseInt(String(userId), 10);
  if (Number.isNaN(parsedUserId) || parsedUserId <= 0) {
    throw new Error(BLOCK_MESSAGES.invalidUserId);
  }
  return parsedUserId;
};

const parseResponse = async (response) => {
  const json = await response.json().catch(() => ({}));
  return json || {};
};

const requestBlockApi = async (endpoint, options) => {
  const response = await authFetchResponse(endpoint, {
    ...(options || {}),
    skipThrow: true,
  });

  const payload = await parseResponse(response);
  if (response.ok) {
    return payload;
  }

  const message =
    payload?.message || payload?.error || BLOCK_MESSAGES.actionFailed;
  throw new Error(message);
};

/** BLOCK OVERRIDE: New user-level block API service using centralized auth fetch flow. */
export const blockUser = async (userId) => {
  const safeUserId = sanitizeUserId(userId);
  return requestBlockApi(BLOCK_API_ENDPOINTS.blockUser(safeUserId), {
    method: 'POST',
  });
};

/** BLOCK OVERRIDE: New user-level unblock API service using centralized auth fetch flow. */
export const unblockUser = async (userId) => {
  const safeUserId = sanitizeUserId(userId);
  return requestBlockApi(BLOCK_API_ENDPOINTS.unblockUser(safeUserId), {
    method: 'DELETE',
  });
};

/** BLOCK OVERRIDE: Fetch active blocked users list. */
export const getBlockedUsers = async () =>
  requestBlockApi(BLOCK_API_ENDPOINTS.blockedUsers, { method: 'GET' });

/** BLOCK OVERRIDE: Fetch directional block status between current user and target user. */
export const getBlockStatus = async (userId) => {
  const safeUserId = sanitizeUserId(userId);
  try {
    return await requestBlockApi(BLOCK_API_ENDPOINTS.blockStatus(safeUserId), {
      method: 'GET',
    });
  } catch (error) {
    logger.error('BLOCK OVERRIDE: Failed to fetch block status', error);
    throw error;
  }
};
