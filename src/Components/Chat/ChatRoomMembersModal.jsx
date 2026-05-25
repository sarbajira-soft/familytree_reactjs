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

  const normalizedQuery = String(searchTerm || '')
    .trim()
    .toLowerCase();

  const filteredCurrentMembers = useMemo(() => {
    if (!normalizedQuery) {
      return members;
    }

    return members.filter((member) =>
      [
        member?.name,
        member?.familyRole,
        member?.sourceFamilyCode,
      ]
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
      [
        member?.name,
        member?.familyRole,
        member?.sourceFamilyCode,
      ]
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
    <div
      className="
        flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden
        rounded-full bg-gradient-to-br from-blue-500 to-indigo-600
        text-sm font-semibold text-white
      "
    >
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
  );

  const renderMemberCard = (
    member,
    {
      isSelected = false,
      showRemove = false,
      isSelf = false,
    } = {},
  ) => {
    const badges = getChatMemberBadges(member);

    return (
      <button
        key={member.userId}
        type="button"
        disabled={showRemove ? false : isSubmitting}
        onClick={() => {
          if (!showRemove) {
            onToggleMember?.(member);
          }
        }}
        className={`
          group relative flex w-full items-center gap-4 overflow-hidden
          rounded-2xl border px-4 py-4 text-left transition-all duration-200

          ${
            isSelected
              ? 'border-blue-500 bg-blue-50 shadow-sm dark:border-blue-500 dark:bg-blue-500/10'
              : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500'
          }
        `}
      >
        {renderMemberAvatar(member)}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h5 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
              {member.name}
            </h5>

            {member.isFamilyAdmin ? (
              <span
                className="
                  rounded-full bg-amber-100 px-2 py-0.5
                  text-[10px] font-semibold uppercase tracking-wide
                  text-amber-700
                "
              >
                Admin
              </span>
            ) : null}

            {badges.map((badge) => (
              <span
                key={`${member.userId}-${badge.key}`}
                title={badge.title}
                className={`
                  rounded-full px-2 py-0.5 text-[10px]
                  font-semibold uppercase tracking-wide
                  ${badge.className}
                `}
              >
                {badge.label}
              </span>
            ))}
          </div>

          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {getChatMemberMetaText(member)}
          </p>
        </div>

        {showRemove && !isSelf ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRemoveMember?.(member);
            }}
            disabled={isSubmitting}
            className="
              inline-flex items-center gap-2 rounded-xl
              bg-red-50 px-3 py-2 text-xs font-semibold
              text-red-600 transition hover:bg-red-100
              dark:bg-red-500/10 dark:text-red-400
            "
          >
            <FiTrash2 size={14} />
            Remove
          </button>
        ) : !showRemove ? (
          <div
            className={`
              flex h-6 w-6 shrink-0 items-center justify-center
              rounded-full border-2 transition-all

              ${
                isSelected
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-300 bg-white dark:border-slate-600 dark:bg-slate-800'
              }
            `}
          >
            {isSelected ? <FiCheck size={13} /> : null}
          </div>
        ) : null}
      </button>
    );
  };

  return (
    <div
  className="
    fixed inset-0 z-[9999]
    flex items-end justify-center
    bg-black/50 backdrop-blur-sm
    sm:items-center
    p-0 sm:p-4 mb-8
  "
  role="presentation"
>
  <div
    role="dialog"
    aria-modal="true"
    aria-label={`Members in ${roomName}`}
    className="
      flex w-full flex-col overflow-hidden
      bg-white dark:bg-slate-950
      shadow-2xl

      /* MOBILE */
      h-[92vh]
      rounded-t-[28px]

      /* WEB */
      sm:h-auto
      sm:max-h-[92vh]
      sm:max-w-5xl
      sm:rounded-3xl
      border border-gray-200 dark:border-slate-800
    "
  >
    {/* HEADER */}
    <div
      className="
        sticky top-0 z-10
        border-b border-gray-100 dark:border-slate-800
        bg-white/95 dark:bg-slate-950/95
        backdrop-blur
      "
    >
      {/* MOBILE HANDLE */}
      <div className="flex justify-center pt-3 sm:hidden">
        <div className="h-1.5 w-14 rounded-full bg-gray-300 dark:bg-slate-700" />
      </div>

      <div className="flex items-start justify-between px-4 py-4 sm:px-6 sm:py-5">
        <div className="min-w-0 flex-1">
          <h3
            className="
              truncate
              text-xl font-bold text-gray-900 dark:text-white
              sm:text-2xl
            "
          >
            {roomName || 'Room members'}
          </h3>

          <p
            className="
              mt-1 max-w-xl
              text-xs leading-relaxed text-gray-500 dark:text-gray-400
              sm:text-sm
            "
          >
            {canManage
              ? 'Manage room members and add eligible Familyss app users.'
              : 'Only active Familyss app users currently in this room appear here.'}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="
            ml-3 flex h-10 w-10 shrink-0 items-center justify-center
            rounded-full bg-gray-100 text-gray-600
            transition hover:bg-gray-200
            dark:bg-slate-800 dark:text-gray-300
          "
        >
          <FiX size={18} />
        </button>
      </div>
    </div>

    {/* BODY */}
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {/* SUMMARY */}
      <div
        className="
          grid grid-cols-1 gap-3
          px-4 pt-4
          sm:grid-cols-2 sm:gap-4 sm:px-6 sm:pt-5
        "
      >
        <div
          className="
            rounded-2xl border border-blue-100
            bg-blue-50/70 p-4
            dark:border-blue-500/20 dark:bg-blue-500/10
            sm:p-5
          "
        >
          <span
            className="
              text-[11px] font-semibold uppercase tracking-wide
              text-blue-600
            "
          >
            Room members
          </span>

          <div
            className="
              mt-2 text-3xl font-bold
              text-gray-900 dark:text-white
            "
          >
            {currentMemberCount}
          </div>

          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
            Active Familyss app users
          </p>
        </div>

        {canManage ? (
          <div
            className="
              rounded-2xl border border-emerald-100
              bg-emerald-50/70 p-4
              dark:border-emerald-500/20 dark:bg-emerald-500/10
              sm:p-5
            "
          >
            <span
              className="
                text-[11px] font-semibold uppercase tracking-wide
                text-emerald-600
              "
            >
              Available to add
            </span>

            <div
              className="
                mt-2 text-3xl font-bold
                text-gray-900 dark:text-white
              "
            >
              {availableMemberCount}
            </div>

            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
              Eligible users from this family scope
            </p>
          </div>
        ) : null}
      </div>

      {/* SEARCH */}
      <div className="px-4 pt-4 sm:px-6 sm:pt-5">
        <label
          className="
            flex items-center gap-3
            rounded-2xl border border-gray-200
            bg-gray-50 px-4 py-3
            dark:border-slate-700 dark:bg-slate-900
          "
        >
          <FiSearch
            size={17}
            className="shrink-0 text-gray-400"
          />

          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={searchPlaceholder}
            className="
              w-full bg-transparent
              text-sm text-gray-900
              outline-none placeholder:text-gray-400
              dark:text-white
            "
          />
        </label>
      </div>

      {/* ERROR */}
      {error ? (
        <div className="px-4 pt-4 sm:px-6">
          <div
            className="
              rounded-2xl bg-red-50 px-4 py-3
              text-sm text-red-600
              dark:bg-red-500/10 dark:text-red-400
            "
          >
            {error}
          </div>
        </div>
      ) : null}

      {/* MEMBERS SECTIONS */}
      <div className="px-4 py-4 sm:px-6 sm:py-5">
        <div className="grid gap-4 lg:grid-cols-2">
          {/* ROOM MEMBERS */}
          <section
            className="
              rounded-3xl border border-gray-200
              bg-gray-50/70 p-4
              dark:border-slate-800 dark:bg-slate-900/50
              sm:p-5
            "
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Room members
                </h4>

                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
                  Current active members
                </p>
              </div>

              <div
                className="
                  flex h-9 min-w-[36px] items-center justify-center
                  rounded-full bg-blue-100 px-3
                  text-sm font-semibold text-blue-700
                  dark:bg-blue-500/20 dark:text-blue-300
                "
              >
                {currentMemberCount}
              </div>
            </div>

            <div className="space-y-3">
              {filteredCurrentMembers.map((member) => {
                const isSelf =
                  Number(member?.userId || 0) ===
                  Number(currentUserId || 0);

                return (
                  <div
                    key={member.userId}
                    className="
                      flex items-center gap-3
                      rounded-2xl border border-gray-200
                      bg-white p-3
                      dark:border-slate-700 dark:bg-slate-900
                    "
                  >
                    {renderMemberAvatar(member)}

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {member.name}
                      </div>

                      <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {getChatMemberMetaText(member)}
                      </div>
                    </div>

                    {canManage && !isSelf ? (
                      <button
                        type="button"
                        onClick={() => onRemoveMember?.(member)}
                        disabled={isSubmitting}
                        className="
                          inline-flex items-center gap-1.5
                          rounded-xl bg-red-50
                          px-3 py-2 text-xs font-semibold
                          text-red-600 transition
                          hover:bg-red-100
                          dark:bg-red-500/10 dark:text-red-400
                        "
                      >
                        <FiTrash2 size={13} />
                        <span className="hidden sm:inline">
                          Remove
                        </span>
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          {/* AVAILABLE MEMBERS */}
          {canManage ? (
            <section
              className="
                rounded-3xl border border-gray-200
                bg-gray-50/70 p-4
                dark:border-slate-800 dark:bg-slate-900/50
                sm:p-5
              "
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Add app users
                  </h4>

                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
                    Select users to add
                  </p>
                </div>

                <div
                  className="
                    flex h-9 min-w-[36px] items-center justify-center
                    rounded-full bg-emerald-100 px-3
                    text-sm font-semibold text-emerald-700
                    dark:bg-emerald-500/20 dark:text-emerald-300
                  "
                >
                  {availableMemberCount}
                </div>
              </div>

              <div className="space-y-3">
                {filteredAvailableMembers.map((member) => {
                  const isSelected = selectedIds.includes(
                    Number(member?.userId || 0),
                  );

                  return (
                    <button
                      key={member.userId}
                      type="button"
                      onClick={() => onToggleMember?.(member)}
                      className={`
                        flex w-full items-center gap-3
                        rounded-2xl border p-3
                        text-left transition-all

                        ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-500/10'
                            : 'border-gray-200 bg-white hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900'
                        }
                      `}
                    >
                      {renderMemberAvatar(member)}

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                          {member.name}
                        </div>

                        <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {getChatMemberMetaText(member)}
                        </div>
                      </div>

                      <div
                        className={`
                          flex h-6 w-6 shrink-0 items-center justify-center
                          rounded-full border-2 transition-all

                          ${
                            isSelected
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-gray-300 dark:border-slate-600'
                          }
                        `}
                      >
                        {isSelected ? (
                          <FiCheck size={12} />
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>

    {/* FOOTER */}
    <div
      className="
        sticky bottom-0 z-10
        border-t border-gray-100
        bg-white/95 p-4 backdrop-blur
        dark:border-slate-800 dark:bg-slate-950/95

        flex flex-col gap-3
        sm:flex-row sm:justify-end
      "
    >
      <button
        type="button"
        onClick={onClose}
        disabled={isSubmitting}
        className="
          h-12 rounded-2xl bg-gray-100
          px-5 text-sm font-semibold text-gray-700
          transition hover:bg-gray-200
          dark:bg-slate-800 dark:text-gray-200
        "
      >
        Close
      </button>

      {canManage ? (
        <button
          type="button"
          onClick={onAddMembers}
          disabled={selectedIds.length === 0 || isSubmitting}
          className="
            inline-flex h-12 items-center justify-center gap-2
            rounded-2xl bg-blue-600 px-5
            text-sm font-semibold text-white
            transition hover:bg-blue-700
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
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