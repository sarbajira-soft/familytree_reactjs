import React from 'react';
import PropTypes from 'prop-types';
import { BlockConfirmationModal } from './BlockConfirmationModal';
import { useBlockButton } from '../../hooks/block/useBlockButton';

const BUTTON_CLASS_BY_LOCATION = {
  profile: 'rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600',
  memberCard: 'w-full px-2 py-1.5 text-left text-xs text-red-600',
  membersList: 'rounded-md border border-red-300 px-2 py-1 text-xs text-red-600',
  post: 'rounded-md border border-red-300 px-2 py-1 text-xs text-red-600',
  comment: 'rounded-md border border-red-300 px-2 py-1 text-xs text-red-600',
};

/** BLOCK OVERRIDE: Unified block/unblock action button with confirmation modal and optimistic callback. */
export const BlockButton = ({
  userId,
  isBlockedByMe = false,
  location = 'profile',
  userName = 'this user',
  onStatusChange = null,
  disabled = false,
}) => {
  const {
    action,
    loading,
    isVisible,
    openModal,
    closeModal,
    confirmAction,
  } = useBlockButton({
    userId,
    isBlockedByMe,
    onStatusChange,
  });

  if (!userId) {
    return null;
  }

  const handleButtonClick = (event) => {
    // BLOCK OVERRIDE: Prevent parent card click handlers (view action) from firing on block clicks.
    event.stopPropagation();
    openModal();
  };

  const handleButtonMouseDown = (event) => {
    // BLOCK OVERRIDE: Stop mousedown propagation to avoid triggering parent press handlers.
    event.stopPropagation();
  };

  const label = action === 'block' ? 'Block' : 'Unblock';
  const buttonClassName = BUTTON_CLASS_BY_LOCATION[location] || BUTTON_CLASS_BY_LOCATION.profile;

  return (
    <>
      <button
        type="button"
        aria-label={`${label} ${userName}`}
        className={`${buttonClassName} ${loading || disabled ? 'opacity-60' : ''}`}
        disabled={loading || disabled}
        onMouseDown={handleButtonMouseDown}
        onClick={handleButtonClick}
      >
        {loading ? 'Please wait...' : label}
      </button>

      <BlockConfirmationModal
        isVisible={isVisible}
        userName={userName}
        action={action}
        onConfirm={confirmAction}
        onCancel={closeModal}
      />
    </>
  );
};

BlockButton.propTypes = {
  userId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  isBlockedByMe: PropTypes.bool,
  location: PropTypes.oneOf(['profile', 'memberCard', 'membersList', 'post', 'comment']),
  userName: PropTypes.string,
  onStatusChange: PropTypes.func,
  disabled: PropTypes.bool,
};
