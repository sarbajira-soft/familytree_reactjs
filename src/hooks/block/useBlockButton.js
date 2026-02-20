import { useCallback, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { BLOCK_MESSAGES } from '../../constants/block.constants';
import { blockUser, unblockUser } from '../../services/block.service';
import { logger } from '../../utils/logger';
import { useBlockModal } from './useBlockModal';

const DEFAULT_STATUS = {
  isBlockedByMe: false,
  isBlockedByThem: false,
};

const getActionErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || BLOCK_MESSAGES.actionFailed;

/** BLOCK OVERRIDE: Centralized block/unblock action orchestration with optimistic state callback support. */
export const useBlockButton = ({
  userId,
  isBlockedByMe,
  onStatusChange,
}) => {
  const { isVisible, openModal, closeModal } = useBlockModal();
  const [loading, setLoading] = useState(false);

  const action = useMemo(
    () => (isBlockedByMe ? 'unblock' : 'block'),
    [isBlockedByMe],
  );

  const handleOpen = useCallback(() => {
    if (!userId || loading) {
      return;
    }
    openModal();
  }, [loading, openModal, userId]);

  const handleConfirm = useCallback(async () => {
    if (!userId || loading) {
      return;
    }

    setLoading(true);
    try {
      if (action === 'block') {
        await blockUser(userId);
        toast.success(BLOCK_MESSAGES.blockedSuccess);
      } else {
        await unblockUser(userId);
        toast.success(BLOCK_MESSAGES.unblockedSuccess);
      }

      if (onStatusChange) {
        const nextStatus = { ...DEFAULT_STATUS, isBlockedByMe: action === 'block' };
        onStatusChange(nextStatus);
      }

      closeModal();
    } catch (error) {
      logger.error('BLOCK OVERRIDE: block button action failed', error);
      toast.error(getActionErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [action, closeModal, isBlockedByMe, loading, onStatusChange, userId]);

  return {
    action,
    loading,
    isVisible,
    openModal: handleOpen,
    closeModal,
    confirmAction: handleConfirm,
  };
};
