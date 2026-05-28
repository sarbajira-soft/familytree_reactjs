import React, { useEffect, useMemo, useState } from 'react';
import {
  FiAlertCircle,
  FiCheck,
  FiSearch,
  FiUser,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import {
  getChatMemberBadges,
  getChatMemberMetaText,
  getInitials,
} from '../../services/chat.service';

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
  searchPlaceholder = 'Search family app users',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const memberList = useMemo(
    () => (Array.isArray(members) ? members : []),
    [members],
  );

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  const filteredMembers = useMemo(() => {
    const query = String(searchTerm || '').trim().toLowerCase();
    if (!query) {
      return memberList;
    }

    return memberList.filter((member) => {
      const haystack = [
        member?.name,
        member?.familyRole,
        member?.firstName,
        member?.lastName,
        member?.sourceFamilyCode,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [memberList, searchTerm]);

  const normalizedSelectedIds = useMemo(
    () =>
      (Array.isArray(selectedIds) ? selectedIds : [])
        .map((selectedId) => Number(selectedId || 0))
        .filter((selectedId) => selectedId > 0),
    [selectedIds],
  );
  const selectedIdSet = useMemo(
    () => new Set(normalizedSelectedIds),
    [normalizedSelectedIds],
  );
  const selectedMembers = useMemo(
    () =>
      memberList.filter((member) =>
        selectedIdSet.has(Number(member?.userId || 0)),
      ),
    [memberList, selectedIdSet],
  );
  const selectedCount = normalizedSelectedIds.length;
  const totalCount = memberList.length;
  const isSingleSelect = selectionMode === 'single';
  const hasSearch = String(searchTerm || '').trim().length > 0;

  if (!isOpen) {
    return null;
  }

  return (
  <div
    className="chat-picker-overlay"
    onClick={(event) => {
      if (event.target === event.currentTarget && !isSubmitting) {
        onClose?.();
      }
    }}
    role="presentation"
  >
    <div
      className="chat-picker-modal"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="chat-picker-hero">
        <div className="chat-picker-hero__icon" aria-hidden="true">
          {isSingleSelect ? <FiUser size={20} /> : <FiUsers size={20} />}
        </div>

        <div className="chat-picker-hero__copy">
          <h3>{title}</h3>
        </div>

        <button
          type="button"
          className="chat-picker-close"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close"
        >
          <FiX size={18} />
        </button>
      </div>

      {topContent ? (
        <div className="chat-picker-top-content">
          {topContent}
        </div>
      ) : null}

      <div className="chat-picker-toolbar">
        <label className="chat-picker-search">
          <FiSearch size={18} />

          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />

          {hasSearch ? (
            <button
              type="button"
              className="chat-picker-search__clear"
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
            >
              <FiX size={15} />
            </button>
          ) : null}
        </label>

        <div className="chat-picker-summary" aria-live="polite">
          <span>{filteredMembers.length}/{totalCount}</span>
          <span>{selectedCount} selected</span>
        </div>

        {selectedMembers.length > 0 ? (
          <div className="chat-picker-selected-strip">
            {selectedMembers.slice(0, 4).map((member) => (
              <span className="chat-picker-selected-chip" key={`selected-${member.userId}`}>
                {member.profileUrl ? (
                  <img src={member.profileUrl} alt="" />
                ) : (
                  <span>{getInitials(member.firstName, member.lastName) || <FiUser size={12} />}</span>
                )}
                {member.name}
              </span>
            ))}
            {selectedMembers.length > 4 ? (
              <span className="chat-picker-selected-more">
                +{selectedMembers.length - 4} more
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="chat-picker-error">
          <FiAlertCircle size={17} />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="chat-picker-list custom-scrollbar">
        {filteredMembers.length > 0 ? (
          filteredMembers.map((member) => {
            const isSelected = selectedIdSet.has(Number(member?.userId || 0));

            const isDisabled =
              typeof disableMember === 'function'
                ? Boolean(disableMember(member))
                : false;

            const note =
              typeof getMemberNote === 'function'
                ? getMemberNote(member)
                : '';

            const badges = getChatMemberBadges(member);

            return (
              <button
                key={member.userId}
                type="button"
                disabled={isDisabled}
                onClick={() => {
                  if (!isDisabled) {
                    onToggleMember?.(member);
                  }
                }}
                className={`chat-picker-member${isSelected ? ' is-selected' : ''}${isDisabled ? ' is-disabled' : ''}`}
              >
                <div className="chat-picker-member__avatar">
                  {member.profileUrl ? (
                    <img
                      src={member.profileUrl}
                      alt={member.name}
                    />
                  ) : (
                    getInitials(member.firstName, member.lastName) || (
                      <FiUser size={16} />
                    )
                  )}
                </div>

                <div className="chat-picker-member__meta">
                  <div className="chat-picker-member__title-row">
                    <span className="chat-picker-member__name">
                      {member.name}
                    </span>

                    {member.isFamilyAdmin ? (
                      <span className="chat-picker-member__badge chat-picker-member__badge--admin">
                        Admin
                      </span>
                    ) : null}

                    {badges.map((badge) => (
                      <span
                        key={`${member.userId}-${badge.key}`}
                        title={badge.title}
                        className={`chat-picker-member__badge ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    ))}
                  </div>

                  <div className="chat-picker-member__role">
                    {getChatMemberMetaText(member)}
                  </div>

                  {note ? (
                    <div className="chat-picker-member__note">
                      {note}
                    </div>
                  ) : null}
                </div>

                <div className={`chat-picker-member__select${isSelected ? ' is-selected' : ''}`}>
                  {isSingleSelect ? (
                    isSelected ? <span /> : null
                  ) : (
                    isSelected && <FiCheck size={12} />
                  )}
                </div>
              </button>
            );
          })
        ) : (
          <div className="chat-picker-empty">
            <div className="chat-picker-empty__icon">
              <FiSearch size={22} />
            </div>
            <p>{hasSearch ? 'No matching members' : emptyStateTitle}</p>
            <span>
              {hasSearch
                ? 'Try a different name or family code.'
                : emptyStateSubtitle}
            </span>
          </div>
        )}
      </div>

      <div className="chat-picker-footer">
        <div className="chat-picker-footer__hint" aria-live="polite">
          {selectedCount > 0
            ? `${selectedCount} ${selectedCount === 1 ? 'person' : 'people'} selected`
            : isSingleSelect
              ? 'Select one person to continue'
              : 'Select people to continue'}
        </div>

        <div className="chat-picker-footer__actions">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="chat-picker-btn chat-picker-btn--secondary"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled || isSubmitting}
            className="chat-picker-btn chat-picker-btn--primary"
          >
            {isSubmitting ? 'Please wait...' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  </div>
);
};

export default React.memo(ChatPickerModal);
