import React, { useEffect, useMemo, useState } from 'react';
import {
  FiCheck,
  FiSearch,
  FiUser,
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
        member?.sourceFamilyCode,
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
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4" role="presentation">
    <div className="w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col rounded-2xl bg-white dark:bg-slate-900 shadow-2xl" role="dialog" aria-modal="true" aria-label={title}>

      {/* Header */}
      <div className="flex items-start justify-between border-b border-gray-200 dark:border-slate-700 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">{title}</h3>

          {subtitle ? (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
          ) : null}
        </div>

        <button
          type="button"
          className="ml-3 rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800"
          onClick={onClose}
          aria-label="Close"
        >
          <FiX size={18} />
        </button>
      </div>

      {/* Top Content */}
      {topContent ? (
        <div className="border-b border-gray-100 dark:border-slate-800 px-4 py-3 sm:px-5">
          {topContent}
        </div>
      ) : null}

      {/* Search */}
      <div className="px-4 pt-4 sm:px-5">
        <label className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
          <FiSearch size={16} className="text-gray-400" />

          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-sm outline-none text-gray-900 dark:text-white placeholder:text-gray-400"
          />
        </label>
      </div>

      {/* Error */}
      {error ? (
        <div className="px-4 pt-3 sm:px-5">
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </div>
        </div>
      ) : null}

      {/* Members List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-4 custom-scrollbar">
        {filteredMembers.length > 0 ? (
          filteredMembers.map((member) => {
            const isSelected = selectedIds.includes(Number(member?.userId || 0));

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
                className={`mb-2 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-500/10'
                    : 'hover:bg-gray-100 dark:hover:bg-slate-800'
                } ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                {/* Avatar */}
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200 text-sm font-semibold text-gray-700">
                  {member.profileUrl ? (
                    <img
                      src={member.profileUrl}
                      alt={member.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getInitials(member.firstName, member.lastName) || (
                      <FiUser size={16} />
                    )
                  )}
                </div>

                {/* Meta */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                      {member.name}
                    </span>

                    {member.isFamilyAdmin ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-slate-700 dark:text-gray-300">
                        Admin
                      </span>
                    ) : null}

                    {badges.map((badge) => (
                      <span
                        key={`${member.userId}-${badge.key}`}
                        title={badge.title}
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    ))}
                  </div>

                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {getChatMemberMetaText(member)}
                  </div>

                  {note ? (
                    <div className="mt-1 text-xs text-gray-400">
                      {note}
                    </div>
                  ) : null}
                </div>

                {/* Selection */}
                <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                  isSelected
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-300'
                }`}>
                  {selectionMode === 'single' ? (
                    <span className="h-2 w-2 rounded-full bg-white" />
                  ) : (
                    isSelected && <FiCheck size={12} />
                  )}
                </div>
              </button>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <p className="text-base font-semibold text-gray-700 dark:text-gray-200">
              {emptyStateTitle}
            </p>

            <span className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {emptyStateSubtitle}
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex gap-3 border-t border-gray-200 dark:border-slate-700 px-4 py-4 sm:px-5">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="flex-1 rounded-xl bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-200"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={onSubmit}
          disabled={submitDisabled || isSubmitting}
          className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? 'Please wait...' : submitLabel}
        </button>
      </div>
    </div>
  </div>
);
};

export default React.memo(ChatPickerModal);
