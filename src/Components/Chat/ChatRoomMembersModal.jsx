import React, { useEffect, useMemo, useState } from 'react';
import {
  FiCheck,
  FiSearch,
  FiTrash2,
  FiUser,
  FiUserPlus,
  FiX,
} from 'react-icons/fi';
import {
  getChatMemberBadges,
  getChatMemberMetaText,
  getInitials,
} from '../../services/chat.service';

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
      [member?.name, member?.familyRole, member?.sourceFamilyCode]
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
      [member?.name, member?.familyRole, member?.sourceFamilyCode]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [availableMembers, normalizedQuery]);

  const currentMemberCount = members.length;
  const availableMemberCount = availableMembers.length;
  const searchPlaceholder = canManage
    ? 'Search active app users in this room or add list'
    : 'Search active app users in this room';

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
        className={`chat-modal chat-modal--members${
          canManage ? ' chat-modal--members-manage' : ''
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={`Members in ${roomName}`}
      >
        <div className="chat-modal-header chat-modal-header--members">
          <div>
            <h3>{roomName || 'Room members'}</h3>
            <p>
              {canManage
                ? 'See the active app users in this room, add more eligible users, or remove someone.'
                : 'Only active Familyss app users currently in this room appear here.'}
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

        <div className="chat-room-members-summary">
          <div className="chat-room-members-stat">
            <span className="chat-room-members-stat-label">Room members</span>
            <strong>{currentMemberCount}</strong>
            <small>Active Familyss app users</small>
          </div>
          {canManage ? (
            <div className="chat-room-members-stat chat-room-members-stat--soft">
              <span className="chat-room-members-stat-label">Available to add</span>
              <strong>{availableMemberCount}</strong>
              <small>Eligible app users from this family scope</small>
            </div>
          ) : null}
        </div>

        <label className="chat-member-search chat-member-search--members">
          <FiSearch size={16} />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={searchPlaceholder}
          />
        </label>

        {error ? <div className="chat-modal-error">{error}</div> : null}

        <div className="chat-room-members-layout chat-room-members-layout--stack custom-scrollbar">
          <section className="chat-room-members-section">
            <div className="chat-room-members-heading">
              <div>
                <h4>Room members</h4>
                <p>Only active Familyss app users are shown here.</p>
              </div>
              <span>{currentMemberCount}</span>
            </div>

            {filteredCurrentMembers.length > 0 ? (
              <div className="chat-room-members-list">
                {filteredCurrentMembers.map((member) => {
                  const isSelf = Number(member?.userId || 0) === Number(currentUserId || 0);
                  const badges = getChatMemberBadges(member);
                  return (
                    <div className="chat-room-member-row" key={`current-${member.userId}`}>
                      {renderMemberAvatar(member)}

                      <div className="chat-member-meta">
                        <div className="chat-member-name-row">
                          <span className="chat-member-name">{member.name}</span>
                          {member.isFamilyAdmin ? (
                            <span className="chat-member-chip">Admin</span>
                          ) : null}
                          {badges.map((badge) => (
                            <span
                              className={`chat-member-chip ${badge.className}`}
                              key={`current-${member.userId}-${badge.key}`}
                              title={badge.title}
                            >
                              {badge.label}
                            </span>
                          ))}
                        </div>
                        <div className="chat-member-role">{getChatMemberMetaText(member)}</div>
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
                <p>No matching app users found</p>
                <span>Try another search term for this room.</span>
              </div>
            )}
          </section>

          {canManage ? (
            <section className="chat-room-members-section">
              <div className="chat-room-members-heading">
                <div>
                  <h4>Add app users</h4>
                  <p>Choose from eligible Familyss app users in this family scope.</p>
                </div>
                <span>{availableMemberCount}</span>
              </div>

              {filteredAvailableMembers.length > 0 ? (
                <div className="chat-room-members-list">
                {filteredAvailableMembers.map((member) => {
                  const isSelected = selectedIds.includes(Number(member?.userId || 0));
                  const badges = getChatMemberBadges(member);
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
                            {badges.map((badge) => (
                              <span
                                className={`chat-member-chip ${badge.className}`}
                                key={`available-${member.userId}-${badge.key}`}
                                title={badge.title}
                              >
                                {badge.label}
                              </span>
                            ))}
                          </div>
                          <div className="chat-member-role">{getChatMemberMetaText(member)}</div>
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
                  <p>No more app users to add</p>
                  <span>Every eligible Familyss app user is already in this room.</span>
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
