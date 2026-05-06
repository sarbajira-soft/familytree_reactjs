import React, { useEffect, useMemo, useState } from 'react';
import {
  FiCheck,
  FiSearch,
  FiTrash2,
  FiUser,
  FiUserPlus,
  FiX,
} from 'react-icons/fi';
import { getInitials } from '../../services/chat.service';

const ChatRoomMembersModal = ({
  isOpen,
  roomName,
  members,
  availableMembers,
  selectedIds,
  onToggleMember,
  onAddMembers,
  onRemoveMember,
  onClose,
  canManage,
  isSubmitting = false,
  error = '',
  currentUserId = null,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  const normalizedQuery = String(searchTerm || '').trim().toLowerCase();

  const filteredCurrentMembers = useMemo(() => {
    if (!normalizedQuery) {
      return members;
    }

    return members.filter((member) =>
      [member?.name, member?.familyRole]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [members, normalizedQuery]);

  const filteredAvailableMembers = useMemo(() => {
    if (!normalizedQuery) {
      return availableMembers;
    }

    return availableMembers.filter((member) =>
      [member?.name, member?.familyRole]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [availableMembers, normalizedQuery]);

  if (!isOpen) {
    return null;
  }

  const renderMemberAvatar = (member) => (
    <div className="chat-member-avatar">
      {member.profileUrl ? (
        <img src={member.profileUrl} alt={member.name} />
      ) : (
        getInitials(member.firstName, member.lastName) || <FiUser size={16} />
      )}
    </div>
  );

  return (
    <div className="chat-modal-overlay" role="presentation">
      <div
        className="chat-modal chat-modal--wide"
        role="dialog"
        aria-modal="true"
        aria-label={`Members in ${roomName}`}
      >
        <div className="chat-modal-header">
          <div>
            <h3>{roomName || 'Room members'}</h3>
            <p>
              {canManage
                ? 'View members, add more family members, or remove someone from this room.'
                : 'View everyone currently in this room.'}
            </p>
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

        <label className="chat-member-search">
          <FiSearch size={16} />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search room members"
          />
        </label>

        {error ? <div className="chat-modal-error">{error}</div> : null}

        <div className="chat-room-members-layout custom-scrollbar">
          <section className="chat-room-members-section">
            <div className="chat-room-members-heading">
              <h4>Current members</h4>
              <span>{members.length}</span>
            </div>

            {filteredCurrentMembers.length > 0 ? (
              <div className="chat-room-members-list">
                {filteredCurrentMembers.map((member) => {
                  const isSelf = Number(member?.userId || 0) === Number(currentUserId || 0);
                  return (
                    <div className="chat-room-member-row" key={`current-${member.userId}`}>
                      {renderMemberAvatar(member)}

                      <div className="chat-member-meta">
                        <div className="chat-member-name-row">
                          <span className="chat-member-name">{member.name}</span>
                          {member.isFamilyAdmin ? (
                            <span className="chat-member-chip">Admin</span>
                          ) : null}
                        </div>
                        <div className="chat-member-role">{member.familyRole || 'Family member'}</div>
                      </div>

                      {canManage && !isSelf ? (
                        <button
                          type="button"
                          className="chat-inline-action chat-inline-action--danger"
                          onClick={() => onRemoveMember?.(member)}
                          disabled={isSubmitting}
                        >
                          <FiTrash2 size={14} />
                          Remove
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="chat-member-empty chat-member-empty--compact">
                <p>No matching room members</p>
                <span>Try a different search term.</span>
              </div>
            )}
          </section>

          {canManage ? (
            <section className="chat-room-members-section">
              <div className="chat-room-members-heading">
                <h4>Add members</h4>
                <span>{availableMembers.length}</span>
              </div>

              {filteredAvailableMembers.length > 0 ? (
                <div className="chat-room-members-list">
                  {filteredAvailableMembers.map((member) => {
                    const isSelected = selectedIds.includes(Number(member?.userId || 0));
                    return (
                      <button
                        type="button"
                        className={`chat-member-row${isSelected ? ' selected' : ''}`}
                        key={`available-${member.userId}`}
                        onClick={() => onToggleMember?.(member)}
                      >
                        {renderMemberAvatar(member)}

                        <div className="chat-member-meta">
                          <div className="chat-member-name-row">
                            <span className="chat-member-name">{member.name}</span>
                            {member.isFamilyAdmin ? (
                              <span className="chat-member-chip">Admin</span>
                            ) : null}
                          </div>
                          <div className="chat-member-role">{member.familyRole || 'Family member'}</div>
                        </div>

                        <div className={`chat-member-select${isSelected ? ' selected' : ''}`}>
                          <FiCheck size={14} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="chat-member-empty chat-member-empty--compact">
                  <p>No more members to add</p>
                  <span>Everyone eligible for this family room is already included.</span>
                </div>
              )}
            </section>
          ) : null}
        </div>

        <div className="chat-modal-actions">
          <button
            type="button"
            className="chat-modal-btn chat-modal-btn--secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Close
          </button>
          {canManage ? (
            <button
              type="button"
              className="chat-modal-btn chat-modal-btn--primary"
              onClick={onAddMembers}
              disabled={selectedIds.length === 0 || isSubmitting}
            >
              {isSubmitting ? (
                'Updating...'
              ) : (
                <>
                  <FiUserPlus size={15} />
                  Add selected
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default React.memo(ChatRoomMembersModal);
