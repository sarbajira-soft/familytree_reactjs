import React, { useEffect, useMemo, useState } from 'react';
import {
  FiCheck,
  FiSearch,
  FiUser,
  FiX,
} from 'react-icons/fi';
import { getInitials } from '../../services/chat.service';

const ChatPickerModal = ({
  isOpen,
  title,
  subtitle,
  members,
  selectedIds,
  onToggleMember,
  onClose,
  onSubmit,
  submitLabel,
  isSubmitting = false,
  selectionMode = 'multiple',
  topContent = null,
  error = '',
  emptyStateTitle = 'No members available',
  emptyStateSubtitle = 'Try again in a moment.',
  submitDisabled = false,
  disableMember = null,
  getMemberNote = null,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  const filteredMembers = useMemo(() => {
    const query = String(searchTerm || '').trim().toLowerCase();
    if (!query) {
      return members;
    }

    return members.filter((member) => {
      const haystack = [
        member?.name,
        member?.familyRole,
        member?.firstName,
        member?.lastName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [members, searchTerm]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="chat-modal-overlay" role="presentation">
      <div
        className="chat-modal chat-modal--wide"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="chat-modal-header">
          <div>
            <h3>{title}</h3>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="chat-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <FiX size={18} />
          </button>
        </div>

        {topContent ? (
          <div className="chat-modal-top-content">
            {topContent}
          </div>
        ) : null}

        <label className="chat-member-search">
          <FiSearch size={16} />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search members"
          />
        </label>

        {error ? <div className="chat-modal-error">{error}</div> : null}

        <div className="chat-member-list custom-scrollbar">
          {filteredMembers.length > 0 ? (
            filteredMembers.map((member) => {
              const isSelected = selectedIds.includes(Number(member?.userId || 0));
              const isDisabled = typeof disableMember === 'function'
                ? Boolean(disableMember(member))
                : false;
              const note = typeof getMemberNote === 'function'
                ? getMemberNote(member)
                : '';

              return (
                <button
                  key={member.userId}
                  type="button"
                  className={`chat-member-row${isSelected ? ' selected' : ''}${isDisabled ? ' disabled' : ''}`}
                  onClick={() => {
                    if (!isDisabled) {
                      onToggleMember?.(member);
                    }
                  }}
                  disabled={isDisabled}
                >
                  <div className="chat-member-avatar">
                    {member.profileUrl ? (
                      <img src={member.profileUrl} alt={member.name} />
                    ) : (
                      getInitials(member.firstName, member.lastName) || <FiUser size={16} />
                    )}
                  </div>

                  <div className="chat-member-meta">
                    <div className="chat-member-name-row">
                      <span className="chat-member-name">{member.name}</span>
                      {member.isFamilyAdmin ? (
                        <span className="chat-member-chip">Admin</span>
                      ) : null}
                    </div>
                    <div className="chat-member-role">{member.familyRole || 'Family member'}</div>
                    {note ? <div className="chat-member-note">{note}</div> : null}
                  </div>

                  <div className={`chat-member-select${isSelected ? ' selected' : ''}`}>
                    {selectionMode === 'single' ? (
                      <span className="chat-member-select-dot" />
                    ) : (
                      <FiCheck size={14} />
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="chat-member-empty">
              <p>{emptyStateTitle}</p>
              <span>{emptyStateSubtitle}</span>
            </div>
          )}
        </div>

        <div className="chat-modal-actions">
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
            onClick={onSubmit}
            disabled={submitDisabled || isSubmitting}
          >
            {isSubmitting ? 'Please wait...' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ChatPickerModal);
