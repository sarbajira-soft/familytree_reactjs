import React from 'react';
import { FiAlertTriangle, FiLogOut, FiTrash2, FiX } from 'react-icons/fi';

const ChatDeleteConversationModal = ({
  isOpen,
  conversationName,
  isGroup,
  canLeaveRoom,
  isSubmitting = false,
  error = '',
  onClose,
  onDelete,
  onDeleteAndLeave,
}) => {
  if (!isOpen) {
    return null;
  }

  const normalizedConversationName = String(
    conversationName || (isGroup ? 'this group' : 'this chat'),
  ).trim();

  return (
    <div className="chat-modal-overlay" role="presentation">
      <div
        className="chat-modal chat-modal--delete"
        role="dialog"
        aria-modal="true"
        aria-label={isGroup ? 'Delete group chat' : 'Delete chat'}
      >
        <div className="chat-modal-header">
          <div>
            <h3>{isGroup ? 'Delete group chat' : 'Delete chat'}</h3>
            <p>{normalizedConversationName}</p>
          </div>
          <button
            type="button"
            className="chat-modal-close"
            onClick={onClose}
            aria-label="Close"
            disabled={isSubmitting}
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="chat-modal-top-content chat-delete-modal-content">
          <div className="chat-delete-modal-warning">
            <FiAlertTriangle size={18} />
            <div>
              <strong>{normalizedConversationName}</strong>
              <p>
                {isGroup
                  ? 'Choose whether to only remove this chat from your list or leave the group completely.'
                  : 'Deleting this chat removes it only from your own chat list and history. The other participant keeps their copy.'}
              </p>
            </div>
          </div>

          {isGroup ? (
            <div className="chat-delete-modal-options">
              <div className="chat-delete-modal-option">
                <h4>Delete Chat Only</h4>
                <p>
                  Removes this chat from your list. You stay in the group, and a new message will
                  bring it back with only the newer history.
                </p>
              </div>
              {canLeaveRoom ? (
                <div className="chat-delete-modal-option chat-delete-modal-option--danger">
                  <h4>Delete Chat and Leave Group</h4>
                  <p>
                    Removes this chat from your list and removes you from the group so you stop
                    receiving future messages.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {error ? <div className="chat-modal-error">{error}</div> : null}

        <div
          className={`chat-modal-actions chat-delete-modal-actions${
            isGroup && canLeaveRoom ? ' chat-delete-modal-actions--group' : ''
          }`}
        >
          <button
            type="button"
            className="chat-modal-btn chat-modal-btn--secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="chat-modal-btn chat-modal-btn--primary"
            onClick={onDelete}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Updating...' : (
              <>
                <FiTrash2 size={15} />
                Delete Chat
              </>
            )}
          </button>
          {isGroup && canLeaveRoom ? (
            <button
              type="button"
              className="chat-modal-btn chat-modal-btn--danger"
              onClick={onDeleteAndLeave}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Updating...' : (
                <>
                  <FiLogOut size={15} />
                  Delete and Leave Group
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default React.memo(ChatDeleteConversationModal);
