import { useCallback, useEffect, useRef, useState } from 'react';
import { getBlockStatus } from '../../services/block.service';
import { logger } from '../../utils/logger';

const DEFAULT_STATUS = {
  isBlockedByMe: false,
  isBlockedByThem: false,
};

/** BLOCK OVERRIDE: Fetches and caches directional block status per user id. */
export const useBlockStatus = (userId, initialStatus = DEFAULT_STATUS) => {
  const cacheRef = useRef({});
  const [blockStatus, setBlockStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const updateStatus = useCallback((nextStatus) => {
    setBlockStatus(nextStatus || DEFAULT_STATUS);
    if (userId) {
      cacheRef.current[userId] = nextStatus || DEFAULT_STATUS;
    }
  }, [userId]);

  const fetchStatus = useCallback(async () => {
    if (!userId) {
      setBlockStatus(DEFAULT_STATUS);
      return DEFAULT_STATUS;
    }

    const cached = cacheRef.current[userId];
    if (cached) {
      setBlockStatus(cached);
      return cached;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getBlockStatus(userId);
      const nextStatus = response?.data || DEFAULT_STATUS;
      cacheRef.current[userId] = nextStatus;
      setBlockStatus(nextStatus);
      return nextStatus;
    } catch (requestError) {
      logger.error('BLOCK OVERRIDE: Failed to fetch block status hook', requestError);
      setError(requestError);
      setBlockStatus(DEFAULT_STATUS);
      return DEFAULT_STATUS;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    blockStatus,
    loading,
    error,
    refreshStatus: fetchStatus,
    updateStatus,
  };
};
