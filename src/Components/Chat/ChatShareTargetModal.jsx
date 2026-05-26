import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { FiCheck, FiImage, FiSearch, FiUsers, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { CHAT_LIMITS } from '../../constants/chat.constants';
import {
  createConversation,
  getConversations,
  getFamilyMembersForChat,
  getInitials,
  getRooms,
  sendTextMessage,
} from '../../services/chat.service';
import {
  cacheConversations,
  cacheRooms,
  getCachedConversations,
  getCachedRooms,
} from '../../utils/chatCache';

const SHARE_TARGET_CACHE_TTL_MS = 60 * 1000;
const TARGET_SECTIONS = ['Recent chats', 'Rooms', 'People'];
const shareTargetDataCache = {
  conversations: [],
  rooms: [],
  contacts: [],
  updatedAt: {
    conversations: 0,
    rooms: 0,
    contacts: 0,
  },
};

const hasFreshShareTargetCache = (key) =>
  Number(shareTargetDataCache?.updatedAt?.[key] || 0) > 0 &&
  Date.now() - Number(shareTargetDataCache.updatedAt[key] || 0) < SHARE_TARGET_CACHE_TTL_MS;

const updateShareTargetCache = (key, items) => {
  shareTargetDataCache[key] = Array.isArray(items) ? items : [];
  shareTargetDataCache.updatedAt[key] = Date.now();
};

const buildDirectConversationName = (conversation, currentUserId) => {
  const participants = Array.isArray(conversation?.participants) ? conversation.participants : [];
  const others = participants.filter(
    (participant) => Number(participant?.userId || 0) !== Number(currentUserId || 0),
  );
  const names = others.map((participant) => String(participant?.name || '').trim()).filter(Boolean);
  return names.join(', ') || 'Direct chat';
};

const mapConversationTargets = (conversations = [], currentUserId) =>
  (Array.isArray(conversations) ? conversations : []).map((conversation) => ({
    key: `conversation:${conversation.id}`,
    targetType: 'conversation',
    id: Number(conversation.id),
    familyCode: conversation.familyCode || '',
    title: buildDirectConversationName(conversation, currentUserId),
    subtitle: 'Existing direct chat',
    avatarUrl:
      conversation?.participants?.find(
        (participant) => Number(participant?.userId || 0) !== Number(currentUserId || 0),
      )?.profileUrl || '',
    section: 'Recent chats',
  }));

const mapRoomTargets = (rooms = []) =>
  (Array.isArray(rooms) ? rooms : []).map((room) => ({
    key: `room:${room.id}`,
    targetType: 'room',
    id: Number(room.id),
    familyCode: room.familyCode || '',
    title: room.roomName || 'Family room',
    subtitle: room.roomType ? `Room · ${room.roomType}` : 'Room',
    avatarUrl: room.roomAvatarUrl || '',
    section: 'Rooms',
  }));

const mapContactTargets = (contacts = [], currentUserId) =>
  (Array.isArray(contacts) ? contacts : [])
    .filter((contact) => Number(contact?.userId || 0) !== Number(currentUserId || 0))
    .map((contact) => ({
      key: `contact:${contact.userId}`,
      targetType: 'contact',
      id: Number(contact.userId),
      familyCode: contact.familyCode || contact.sourceFamilyCode || '',
      title: contact.name || 'Family member',
      subtitle: 'Start a direct chat',
      avatarUrl: contact.profileUrl || '',
      section: 'People',
      blockStatus: contact.blockStatus || {
        isBlockedByMe: false,
        isBlockedByThem: false,
      },
    }));

const buildShareTargets = (sourceData = {}, currentUserId) => {
  const dedupedTargets = new Map();

  [
    ...mapConversationTargets(sourceData?.conversations, currentUserId),
    ...mapRoomTargets(sourceData?.rooms),
    ...mapContactTargets(sourceData?.contacts, currentUserId),
  ].forEach((target) => {
    if (!dedupedTargets.has(target.key)) {
      dedupedTargets.set(target.key, target);
    }
  });

  return Array.from(dedupedTargets.values());
};

const ChatShareTargetModal = ({ currentUserId, isOpen, onClose, shareItem }) => {
  const [submitBusy, setSubmitBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [note, setNote] = useState('');
  const [targets, setTargets] = useState([]);
  const [loadingState, setLoadingState] = useState({
    conversations: false,
    rooms: false,
    contacts: false,
  });
  const sourceDataRef = useRef({
    conversations: [],
    rooms: [],
    contacts: [],
  });

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setSelectedKeys([]);
      setNote('');
      setError('');
      setLoadingState({
        conversations: false,
        rooms: false,
        contacts: false,
      });
      return undefined;
    }

    let cancelled = false;
    const loadErrors = [];
    setError('');
    const setSourceData = (partial) => {
      sourceDataRef.current = {
        ...sourceDataRef.current,
        ...partial,
      };

      if (!cancelled) {
        setTargets(buildShareTargets(sourceDataRef.current, currentUserId));
      }
    };

    const cachedConversations = hasFreshShareTargetCache('conversations')
      ? shareTargetDataCache.conversations
      : getCachedConversations();
    const cachedRooms = hasFreshShareTargetCache('rooms')
      ? shareTargetDataCache.rooms
      : getCachedRooms();
    const cachedContacts = hasFreshShareTargetCache('contacts') ? shareTargetDataCache.contacts : [];

    sourceDataRef.current = {
      conversations: Array.isArray(cachedConversations) ? cachedConversations : [],
      rooms: Array.isArray(cachedRooms) ? cachedRooms : [],
      contacts: Array.isArray(cachedContacts) ? cachedContacts : [],
    };
    setTargets(buildShareTargets(sourceDataRef.current, currentUserId));

    const nextLoadingState = {
      conversations: !hasFreshShareTargetCache('conversations'),
      rooms: !hasFreshShareTargetCache('rooms'),
      contacts: !hasFreshShareTargetCache('contacts'),
    };
    setLoadingState(nextLoadingState);

    const finishLoading = (key) => {
      if (cancelled) {
        return;
      }

      setLoadingState((current) => {
        const next = {
          ...current,
          [key]: false,
        };

        if (
          !next.conversations &&
          !next.rooms &&
          !next.contacts &&
          buildShareTargets(sourceDataRef.current, currentUserId).length === 0 &&
          loadErrors.length > 0
        ) {
          setError(loadErrors[0]?.message || 'Unable to load chat targets right now.');
        }

        return next;
      });
    };

    const loadSection = async (key, loader, extractItems, onSuccess) => {
      if (!nextLoadingState[key]) {
        return;
      }

      try {
        const response = await loader();
        if (cancelled) {
          return;
        }

        const items = Array.isArray(extractItems(response)) ? extractItems(response) : [];
        updateShareTargetCache(key, items);
        onSuccess?.(items);
        setSourceData({ [key]: items });
      } catch (loadError) {
        loadErrors.push(loadError);
      } finally {
        finishLoading(key);
      }
    };

    void loadSection(
      'conversations',
      getConversations,
      (response) => response?.conversations || [],
      (items) => {
        cacheConversations('', items);
      },
    );
    void loadSection(
      'rooms',
      getRooms,
      (response) => response?.rooms || [],
      (items) => {
        cacheRooms('', items);
      },
    );
    void loadSection(
      'contacts',
      getFamilyMembersForChat,
      (response) => response?.members || [],
    );

    return () => {
      cancelled = true;
    };
  }, [currentUserId, isOpen]);

  const filteredTargets = useMemo(() => {
    const query = String(search || '').trim().toLowerCase();
    if (!query) {
      return targets;
    }

    return targets.filter((target) =>
      [target.title, target.subtitle, target.familyCode, target.section]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [search, targets]);

  const groupedTargets = useMemo(() => {
    const sections = new Map();
    filteredTargets.forEach((target) => {
      const key = target.section || 'Targets';
      if (!sections.has(key)) {
        sections.set(key, []);
      }
      sections.get(key).push(target);
    });

    return TARGET_SECTIONS
      .map((section) => [section, sections.get(section) || []])
      .filter(([, sectionTargets]) => sectionTargets.length > 0);
  }, [filteredTargets]);

  const isLoading = loadingState.conversations || loadingState.rooms || loadingState.contacts;
  const isInitialLoading = isLoading && groupedTargets.length === 0;

  const toggleTarget = (targetKey) => {
    setSelectedKeys((current) =>
      current.includes(targetKey)
        ? current.filter((key) => key !== targetKey)
        : [...current, targetKey],
    );
  };

  const handleSubmit = async () => {
    if (!shareItem?.shareType || !shareItem?.entityId || selectedKeys.length === 0) {
      return;
    }

    setSubmitBusy(true);
    setError('');

    try {
      const selectedTargets = targets.filter((target) => selectedKeys.includes(target.key));
      const results = await Promise.allSettled(
        selectedTargets.map(async (target) => {
          let conversationId = Number(target.id);
          let familyCode = String(target.familyCode || '').trim();

          if (target.targetType === 'contact') {
            const conversation = await createConversation(Number(target.id), familyCode);
            conversationId = Number(conversation?.id || 0);
            familyCode = String(conversation?.familyCode || familyCode || '').trim();
          }

          if (!conversationId) {
            throw new Error(`Unable to prepare ${target.title}.`);
          }

          return sendTextMessage(conversationId, familyCode, note, {
            sharePayload: {
              shareType: shareItem.shareType,
              entityId: Number(shareItem.entityId),
            },
          });
        }),
      );

      const failedCount = results.filter((result) => result.status === 'rejected').length;
      const successCount = results.length - failedCount;

      if (successCount > 0) {
        toast.success(successCount === 1 ? 'Shared to chat' : `Shared to ${successCount} chats`);
      }
      if (failedCount > 0) {
        toast.error(
          failedCount === 1
            ? 'One chat could not be shared right now.'
            : `${failedCount} chats could not be shared right now.`,
        );
      }

      if (successCount > 0) {
        onClose?.({ shared: true });
      }
    } catch (submitError) {
      setError(submitError?.message || 'Unable to share to chat right now.');
    } finally {
      setSubmitBusy(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 px-4 pb-4 pt-8 backdrop-blur-sm sm:items-center"
      onClick={() => onClose?.()}
      role="presentation"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Share to chat"
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-5 pb-4 pt-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-900">Share to chat</h3>
            <p className="mt-1 text-sm text-gray-500">
              Send this {shareItem?.shareType === 'gallery' ? 'gallery' : 'post'} into one or more chats.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="grid h-10 w-10 place-items-center rounded-full text-gray-500 hover:bg-gray-100"
            aria-label="Close share to chat"
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="border-b border-gray-100 px-5 py-4">
          <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
            {shareItem?.previewMediaUrl && shareItem?.previewMediaKind !== 'video' ? (
              <img
                src={shareItem.previewMediaUrl}
                alt={shareItem.previewTitle || 'Shared content'}
                className="h-16 w-16 rounded-2xl object-cover"
              />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white text-slate-500">
                {shareItem?.shareType === 'gallery' ? <FiUsers size={18} /> : <FiImage size={18} />}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                {shareItem?.shareType === 'gallery' ? 'Gallery' : 'Post'}
              </div>
              <div className="mt-1 line-clamp-1 text-sm font-semibold text-gray-900">
                {shareItem?.previewTitle || 'Shared content'}
              </div>
              {shareItem?.previewText ? (
                <div className="mt-1 line-clamp-2 text-xs text-gray-500">{shareItem.previewText}</div>
              ) : null}
            </div>
          </div>

          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={CHAT_LIMITS.MAX_TEXT_LENGTH}
            rows={3}
            placeholder="Add a message (optional)"
            className="mt-3 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div className="px-5 pt-4">
          <label className="flex items-center gap-3 rounded-2xl border border-gray-200 px-4 py-3">
            <FiSearch size={16} className="text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search chats, rooms, or people"
              className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
            />
          </label>
        </div>

        {error ? (
          <div className="px-5 pt-3">
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {isInitialLoading ? (
            <div className="py-10 text-center text-sm text-gray-500">Loading chat targets...</div>
          ) : groupedTargets.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">No chats or contacts found.</div>
          ) : (
            <>
              {groupedTargets.map(([sectionTitle, sectionTargets]) => (
                <div key={sectionTitle} className="mb-5 last:mb-0">
                  <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    {sectionTitle}
                  </div>
                  {sectionTargets.map((target) => {
                    const isSelected = selectedKeys.includes(target.key);
                    const isBlocked =
                      target.targetType === 'contact' &&
                      (target?.blockStatus?.isBlockedByMe || target?.blockStatus?.isBlockedByThem);

                    return (
                      <button
                        key={target.key}
                        type="button"
                        disabled={isBlocked}
                        onClick={() => toggleTarget(target.key)}
                        className={`mb-2 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                          isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                        } ${isBlocked ? 'cursor-not-allowed opacity-50' : ''}`}
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200 text-sm font-semibold text-gray-700">
                          {target.avatarUrl ? (
                            <img src={target.avatarUrl} alt={target.title} className="h-full w-full object-cover" />
                          ) : (
                            getInitials(target.title, '') || target.title?.slice(0, 1) || '?'
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-gray-900">{target.title}</div>
                          <div className="mt-1 truncate text-xs text-gray-500">
                            {isBlocked
                              ? target?.blockStatus?.isBlockedByMe
                                ? 'You blocked this member.'
                                : 'This member blocked you.'
                              : [target.subtitle, target.familyCode].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                            isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'
                          }`}
                        >
                          {isSelected ? <FiCheck size={12} /> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
              {isLoading ? (
                <div className="px-2 pt-2 text-center text-xs text-gray-400">
                  Loading more chat targets...
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="flex gap-3 border-t border-gray-200 px-5 py-4">
          <button
            type="button"
            onClick={() => onClose?.()}
            disabled={submitBusy}
            className="flex-1 rounded-2xl bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitBusy || selectedKeys.length === 0}
            className="flex-1 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitBusy ? 'Sharing...' : 'Share to chat'}
          </button>
        </div>
      </div>
    </div>
  );
};

ChatShareTargetModal.propTypes = {
  currentUserId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  shareItem: PropTypes.shape({
    entityId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    previewMediaKind: PropTypes.string,
    previewMediaUrl: PropTypes.string,
    previewText: PropTypes.string,
    previewTitle: PropTypes.string,
    shareType: PropTypes.oneOf(['post', 'gallery']),
  }),
};

ChatShareTargetModal.defaultProps = {
  currentUserId: null,
  isOpen: false,
  onClose: undefined,
  shareItem: null,
};

export default ChatShareTargetModal;
