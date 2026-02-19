import React, { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { BLOCK_MESSAGES } from '../../constants/block.constants';

const resolveMessage = (action, userName) => {
  if (action === 'block') {
    return BLOCK_MESSAGES.confirmBlock(userName);
  }
  return BLOCK_MESSAGES.confirmUnblock(userName);
};

const getModalTitle = (action) => (action === 'block' ? 'Block User' : 'Unblock User');

const getConfirmLabel = (action) => (action === 'block' ? 'Block' : 'Unblock');

/** BLOCK OVERRIDE: Accessible confirmation modal for block/unblock actions. */
export const BlockConfirmationModal = ({
  isVisible,
  userName = 'this user',
  action,
  onConfirm,
  onCancel,
}) => {
  const handleEscape = useCallback(
    (event) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    },
    [onCancel],
  );

  useEffect(() => {
    if (!isVisible) {
      return undefined;
    }

    // BLOCK OVERRIDE: Prevent page scroll and nested container clipping while modal is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [handleEscape, isVisible]);

  if (!isVisible) {
    return null;
  }

  if (typeof document === 'undefined') {
    return null;
  }

  const title = getModalTitle(action);
  const confirmLabel = getConfirmLabel(action);

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onCancel();
    }
  };

  const handlePortalClick = (event) => {
    event.stopPropagation();
  };

  const handlePanelMouseDown = (event) => {
    event.stopPropagation();
  };

  const handleCancelClick = (event) => {
    event.stopPropagation();
    onCancel();
  };

  const handleConfirmClick = (event) => {
    event.stopPropagation();
    onConfirm();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 py-6"
      onMouseDown={handleBackdropClick}
      onClick={handlePortalClick}
      data-block-modal="true"
      role="dialog"
      aria-modal="true"
      aria-label="Block confirmation modal"
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
        onMouseDown={handlePanelMouseDown}
        onClick={handlePortalClick}
      >
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-3 text-sm text-gray-600">{resolveMessage(action, userName)}</p>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            aria-label="Cancel block action"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700"
            onClick={handleCancelClick}
          >
            Cancel
          </button>
          <button
            type="button"
            aria-label={`${confirmLabel} user`}
            className={`rounded-lg px-4 py-2 text-sm text-white ${
              action === 'block' ? 'bg-red-500' : 'bg-green-600'
            }`}
            onClick={handleConfirmClick}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

BlockConfirmationModal.propTypes = {
  isVisible: PropTypes.bool.isRequired,
  userName: PropTypes.string,
  action: PropTypes.oneOf(['block', 'unblock']).isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
