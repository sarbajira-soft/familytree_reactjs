import React, { useState, useMemo, useCallback } from 'react';
import { Virtuoso } from 'react-virtuoso';
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react';
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiCamera,
  FiChevronDown,
  FiChevronUp,
  FiCornerUpLeft,
  FiEdit2,
  FiLogOut,
  FiMoreVertical,
  FiPaperclip,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiSmile,
  FiTrash2,
  FiUsers,
  FiVolume2,
  FiVolumeX,
  FiX,
} from 'react-icons/fi';
import TypingIndicator from './TypingIndicator';
import VoiceRecorder from './VoiceRecorder';
import ChatStateBanner from './ChatStateBanner';
import ChatSharedContentCard from './ChatSharedContentCard';
import {
  CHAT_LIMITS,
  MESSAGE_TYPES,
} from '../../constants/chat.constants';
import {
  formatFullTime,
  formatSeenAgo,
  getInitials,
  getRoomIcon,
} from '../../services/chat.service';
import {
  EMOJI_PICKER_CATEGORIES,
  getReceiptState,
  renderHighlightedText,
} from './chatPage.utils';

const VirtuosoItem = React.forwardRef(({ children, className, ...props }, ref) => (
  <div
    {...props}
    ref={ref}
    className={['chat-virtuoso-item', className].filter(Boolean).join(' ')}
  >
    {children}
  </div>
));
VirtuosoItem.displayName = 'ChatVirtuosoItem';

const getSeenByEntries = (message = {}, currentUserId) =>
  (Array.isArray(message?.seenBy) ? message.seenBy : []).filter((entry) => {
    const entryUserId = Number(entry?.userId || 0);
    return (
      entryUserId > 0 &&
      entryUserId !== Number(currentUserId || 0) &&
      entryUserId !== Number(message?.senderId || 0)
    );
  });

const getSeenByName = (entry = {}) =>
  String(entry?.name || '').trim() ||
  `${String(entry?.firstName || '').trim()} ${String(entry?.lastName || '').trim()}`.trim() ||
  'Family Member';

const getSeenBySummary = (entries = []) => {
  const names = entries.map(getSeenByName).filter(Boolean);
  if (names.length <= 3) {
    return names.join(', ');
  }

  return `${names.slice(0, 3).join(', ')} +${names.length - 3}`;
};

const getReceiptText = (receiptState, message = {}) => {
  if (receiptState === 'failed') {
    return 'Failed to send';
  }

  if (receiptState === 'sending') {
    return 'Sending';
  }

  if (receiptState === 'seen') {
    const seenAgo = formatSeenAgo(message?.readAt);
    return seenAgo ? `Seen ${seenAgo}` : 'Seen';
  }

  if (receiptState === 'delivered') {
    return 'Delivered';
  }

  return receiptState ? 'Sent' : '';
};

const ChatConversationPane = ({
  chatLoading,
  composer,
  conversation,
  directChatBadges,
  header,
  infoPanel,
  isChatConnected,
  isGroup,
  isMobile,
  menu,
  messageSearch,
  messagesPane,
  selectedId,
  typingLabel,
  typingUserIds,
}) => {
  const [previewImage, setPreviewImage] = useState(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevMessagesLength = React.useRef(messagesPane.groupedMessages.length);
  const [isDragging, setIsDragging] = useState(false);

  React.useEffect(() => {
    if (messagesPane.groupedMessages.length > prevMessagesLength.current) {
      if (!isAtBottom) {
        setUnreadCount(prev => prev + (messagesPane.groupedMessages.length - prevMessagesLength.current));
      }
    }
    prevMessagesLength.current = messagesPane.groupedMessages.length;
  }, [messagesPane.groupedMessages.length, isAtBottom]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  }, [isDragging]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      composer.onFileChange?.({ target: { files: e.dataTransfer.files } });
    }
  }, [composer]);

  const virtuosoComponents = useMemo(() => ({
    Item: VirtuosoItem,
    Header: () => (
      <div className="chat-history-header">
        {messagesPane.isLoadingOlderMessages && (
          <div className="flex justify-center py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500"></div>
          </div>
        )}
        {messagesPane.hasResolvedHistory &&
        !messagesPane.hasOlderMessages &&
        messagesPane.groupedMessages.length > 0 ? (
          <div className="chat-history-loader chat-history-loader--complete">
            Beginning of conversation
          </div>
        ) : null}
      </div>
    )
  }), [messagesPane.hasResolvedHistory, messagesPane.hasOlderMessages, messagesPane.groupedMessages.length, messagesPane.isLoadingOlderMessages]);

  const latestSentMessageId = useMemo(() => {
    for (let i = messagesPane.groupedMessages.length - 1; i >= 0; i--) {
      const item = messagesPane.groupedMessages[i];
      if (item.type === 'message') {
        const msg = item.data;
        if (Number(msg?.senderId || 0) === Number(messagesPane.currentUserId || 0)) {
          return Number(msg?.id || 0);
        }
      }
    }
    return 0;
  }, [messagesPane.groupedMessages, messagesPane.currentUserId]);

  const virtuosoItemContent = useCallback((index, item) => {
    if (item.type === 'date') {
      return (
        <div className="chat-message-item chat-message-item--center" key={item.key}>
          <div className="chat-date-sep">
            <span>{item.label}</span>
          </div>
        </div>
      );
    }

    const message = item.data;
    const messageId = Number(message?.id || 0);
    const isSent =
      Number(message?.senderId || 0) === Number(messagesPane.currentUserId || 0);
    const isDeleted = Boolean(message?.isDeleted);
    const isTombstone = message?.messageType === MESSAGE_TYPES.TOMBSTONE;
    const isUnavailableMessage = isDeleted || isTombstone;
    const isSearchMatch = messagesPane.matchIds.has(messageId);
    const isActiveSearchMatch =
      isSearchMatch && Number(messagesPane.activeSearchId || 0) === messageId;
    const receiptState = isSent ? getReceiptState(message) : null;
    const shouldShowReceipt = isSent && messageId === latestSentMessageId;
    const receiptText = getReceiptText(receiptState, message);
    const seenByEntries = shouldShowReceipt
      ? getSeenByEntries(message, messagesPane.currentUserId)
      : [];
    const showRoomSeenBy =
      shouldShowReceipt &&
      isGroup &&
      receiptState === 'seen' &&
      seenByEntries.length > 0;
    const seenBySummary = showRoomSeenBy ? getSeenBySummary(seenByEntries) : '';
    const showTextReceipt =
      shouldShowReceipt &&
      receiptState &&
      (!isGroup || receiptState !== 'seen' || seenByEntries.length === 0);
    const showSystemMessage = message?.messageType === MESSAGE_TYPES.SYSTEM;
    const previousMessage =
      index > 0 ? messagesPane.groupedMessages[index - 1]?.data : null;
    const isConsecutive =
      previousMessage &&
      !showSystemMessage &&
      Number(previousMessage?.senderId || 0) === Number(message?.senderId || 0) &&
      previousMessage?.messageType !== MESSAGE_TYPES.SYSTEM &&
      message.createdAt &&
      previousMessage.createdAt &&
      new Date(message.createdAt).getTime() - new Date(previousMessage.createdAt).getTime() <
        5 * 60 * 1000;
    const showSenderName = isGroup && !isConsecutive && !isSent && !isUnavailableMessage;

    return (
      <div
        className={`chat-message-item${isSent ? ' chat-message-item--sent' : ' chat-message-item--received'}`}
        key={item.key}
      >
        <div
          className={`msg-row${isSent ? ' msg-row--sent' : ' msg-row--received'}${
            isActiveSearchMatch ? ' msg-row--search-active' : ''
          }`}
          ref={(node) => {
            if (isSearchMatch && node) {
              messagesPane.nodeRefs.current.set(messageId, node);
            } else if (isSearchMatch) {
              messagesPane.nodeRefs.current.delete(messageId);
            }
          }}
        >
          {!isSent && !showSystemMessage && (
            <div className="msg-avatar-sm" aria-hidden="true">
              {isConsecutive || isUnavailableMessage ? null : message?.senderAvatar ? (
                <img src={message.senderAvatar} alt="" />
              ) : (
                (message?.senderName || '?').charAt(0).toUpperCase()
              )}
            </div>
          )}

          <div
            className={`msg-bubble${isSent ? ' msg-bubble--sent' : ' msg-bubble--received'}${
              showSystemMessage ? ' msg-bubble--system' : ''
            }${isUnavailableMessage ? ' msg-bubble--deleted' : ''}${
              isSearchMatch ? ' msg-bubble--search-match' : ''
            }${isActiveSearchMatch ? ' msg-bubble--search-active' : ''}`}
          >
          {showSenderName && (
            <div className="msg-sender">{message.senderName}</div>
          )}

          {message?.replyTo && !isUnavailableMessage && !showSystemMessage && (
            <div className="msg-reply-bar">
              <div className="msg-reply-bar-name">
                {message.replyTo.senderName || 'Unknown'}
              </div>
              <div className="msg-reply-bar-text">
                {message.replyTo.content || 'Attachment'}
              </div>
            </div>
          )}

          {isDeleted ? (
            <span>This message was deleted</span>
          ) : isTombstone ? (
            <span>Message unavailable</span>
          ) : showSystemMessage ? (
            <span>{message.content}</span>
          ) : message?.messageType === MESSAGE_TYPES.IMAGE && message?.mediaUrl ? (
            <div className="msg-media-block">
              <a
                href={message.mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="msg-media-link"
                onClick={(e) => {
                  e.preventDefault();
                  setPreviewImage(message.mediaUrl);
                }}
              >
                <img
                  src={message.mediaUrl}
                  alt={message.attachmentName || 'Image'}
                  className="msg-media-image"
                  loading="lazy"
                />
              </a>
              {message.content && (
                <div className="msg-media-caption">
                  {renderHighlightedText(message.content, messageSearch.query)}
                </div>
              )}
            </div>
          ) : message?.messageType === MESSAGE_TYPES.VOICE && message?.mediaUrl ? (
            <div className="msg-media-block">
              <audio controls src={message.mediaUrl} className="max-w-full">
                <track kind="captions" />
                Your browser does not support the audio element.
              </audio>
            </div>
          ) : message?.messageType === MESSAGE_TYPES.POST_SHARE ||
            message?.messageType === MESSAGE_TYPES.GALLERY_SHARE ? (
            <div className="msg-share-block">
              <button
                type="button"
                className="chat-share-card"
                onClick={() => messagesPane.onOpenSharedMessage(message)}
              >
                <div className="chat-share-card__media">
                  {message?.sharePayload?.previewMediaUrl ? (
                    <img
                      src={message.sharePayload.previewMediaUrl}
                      alt="Preview"
                      className="chat-share-card__image"
                    />
                  ) : (
                    <div className="chat-share-card__placeholder">
                      {message?.messageType === MESSAGE_TYPES.POST_SHARE ? (
                        <FiImage size={24} />
                      ) : (
                        <FiFolder size={24} />
                      )}
                    </div>
                  )}
                  {message?.messageType === MESSAGE_TYPES.POST_SHARE && (
                    <div className="chat-share-card__badge">Post</div>
                  )}
                  {message?.messageType === MESSAGE_TYPES.GALLERY_SHARE && (
                    <div className="chat-share-card__badge">Gallery</div>
                  )}
                </div>
                <div className="chat-share-card__body">
                  <span className="chat-share-card__eyebrow">
                    {message?.sharePayload?.creatorName || 'Familyss User'}
                  </span>
                  <strong className="chat-share-card__title">
                    {message?.sharePayload?.previewTitle || 'Shared Content'}
                  </strong>
                  {message?.sharePayload?.previewText && (
                    <p className="chat-share-card__description">
                      {message.sharePayload.previewText}
                    </p>
                  )}
                  <span className="chat-share-card__action">View full post →</span>
                </div>
              </button>
              {message.content && (
                <div className="msg-share-caption">
                  {renderHighlightedText(message.content, messageSearch.query)}
                </div>
              )}
            </div>
          ) : (
            renderHighlightedText(message.content, messageSearch.query)
          )}

          {!showSystemMessage && (
            <div className={`msg-time-row${showRoomSeenBy ? ' msg-time-row--seen-by' : ''}`}>
              {message.createdAt ? formatSeenAgo(message.createdAt) : 'Sending...'}

              {showRoomSeenBy && (
                <div className="msg-seen-by">
                  <span className="msg-seen-by__avatars">
                    {seenByEntries.map((entry) => (
                      <span
                        key={`seen-${messageId}-${entry.userId}`}
                        className="msg-seen-by__avatar"
                        title={`${entry.name} - ${formatFullTime(entry.readAt)}`}
                      >
                        {entry.profileUrl ? (
                          <img src={entry.profileUrl} alt={entry.name} />
                        ) : (
                          entry.initials
                        )}
                      </span>
                    ))}
                  </span>
                </div>
              )}

              {showTextReceipt && (
                <span className={`msg-receipt msg-receipt--${receiptState}`}>
                  {receiptText}
                  {receiptState === 'failed' && (
                    <button
                      className="ml-1 inline-flex items-center text-red-500 hover:text-red-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        messagesPane.onRetryMessage?.(message);
                      }}
                      title="Retry sending"
                      type="button"
                    >
                      <FiRefreshCw size={12} />
                    </button>
                  )}
                </span>
              )}
            </div>
          )}

          {!isUnavailableMessage && !showSystemMessage && (
            <div
              className={`msg-actions${isSent ? ' msg-actions--sent' : ' msg-actions--received'}`}
            >
              {conversation?.canSend !== false && (
                <button
                  className="msg-action-btn"
                  onClick={() => messagesPane.onReply(message)}
                  type="button"
                  aria-label="Reply to message"
                  title="Reply"
                >
                  <FiCornerUpLeft />
                </button>
              )}
              {isSent && !isDeleted && (
                <button
                  className="msg-action-btn"
                  onClick={() => messagesPane.onDeleteMessage(message)}
                  type="button"
                  aria-label="Delete message"
                  title="Delete"
                >
                  <FiTrash2 />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      </div>
    );
  }, [messagesPane, messageSearch.query, isGroup, latestSentMessageId]);
  if (!selectedId) {
    return (
      <div className="chat-placeholder">
        <div className="chat-placeholder-icon">Chat</div>
        <h2>
          {header.hasFamilyScope ? 'Start with your family circle' : 'Family chat is unavailable'}
        </h2>
        <p>
          {header.hasFamilyScope
            ? 'Choose a conversation to share updates, memories, and support together.'
            : 'Switch to an available family to open your chat space.'}
        </p>
      </div>
    );
  }

  if (chatLoading) {
  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900">

      {/* Header Skeleton */}
      <div className="flex items-center gap-3 border-b border-gray-200 dark:border-slate-800 px-4 py-3">
        <div className="h-11 w-11 animate-pulse rounded-full bg-gray-200 dark:bg-slate-700" />

        <div className="flex-1">
          <div className="h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-slate-700" />

          <div className="mt-2 h-3 w-20 animate-pulse rounded bg-gray-100 dark:bg-slate-800" />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">

        {/* Left Message */}
        <div className="flex items-end gap-2">
          <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200 dark:bg-slate-700" />

          <div className="max-w-[70%]">
            <div className="h-16 w-56 animate-pulse rounded-2xl rounded-bl-sm bg-gray-200 dark:bg-slate-700" />

            <div className="mt-2 h-3 w-12 animate-pulse rounded bg-gray-100 dark:bg-slate-800" />
          </div>
        </div>

        {/* Right Message */}
        <div className="flex justify-end">
          <div className="max-w-[70%]">
            <div className="h-14 w-48 animate-pulse rounded-2xl rounded-br-sm bg-blue-100 dark:bg-slate-700" />

            <div className="ml-auto mt-2 h-3 w-10 animate-pulse rounded bg-gray-100 dark:bg-slate-800" />
          </div>
        </div>

        {/* Left Message */}
        <div className="flex items-end gap-2">
          <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200 dark:bg-slate-700" />

          <div className="max-w-[70%]">
            <div className="h-20 w-64 animate-pulse rounded-2xl rounded-bl-sm bg-gray-200 dark:bg-slate-700" />

            <div className="mt-2 h-3 w-16 animate-pulse rounded bg-gray-100 dark:bg-slate-800" />
          </div>
        </div>

        {/* Right Message */}
        <div className="flex justify-end">
          <div className="max-w-[70%]">
            <div className="h-12 w-40 animate-pulse rounded-2xl rounded-br-sm bg-blue-100 dark:bg-slate-700" />

            <div className="ml-auto mt-2 h-3 w-10 animate-pulse rounded bg-gray-100 dark:bg-slate-800" />
          </div>
        </div>
      </div>

      {/* Composer Skeleton */}
      <div className="border-t border-gray-200 dark:border-slate-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200 dark:bg-slate-700" />

          <div className="h-11 flex-1 animate-pulse rounded-full bg-gray-200 dark:bg-slate-700" />

          <div className="h-10 w-10 animate-pulse rounded-full bg-blue-100 dark:bg-slate-700" />
        </div>
      </div>
    </div>
  );
}

  return (
    <>
      <div className="chat-header">
        {isMobile && (
          <button className="chat-header-back" onClick={header.onBack} type="button">
            <FiArrowLeft size={20} />
          </button>
        )}

        <button
          className="chat-header-identity"
          onClick={header.onOpenInfoPanel}
          type="button"
        >
          <div
            className={`chat-avatar${isGroup && !header.roomAvatarUrl ? ' chat-avatar--room' : ''}`}
            style={{ width: 36, height: 36, fontSize: 12 }}
          >
            {isGroup ? (
              header.roomAvatarUrl ? (
                <img src={header.roomAvatarUrl} alt={header.name} />
              ) : (
                getRoomIcon(conversation?.roomType)
              )
            ) : header.activeParticipant.profileUrl ? (
              <img src={header.activeParticipant.profileUrl} alt={header.name} />
            ) : (
              header.initials
            )}
            {header.showOnline ? <div className="chat-avatar-online" /> : null}
          </div>

          <div className="chat-header-info">
            <div className="chat-header-name">
              <span className="chat-header-name-text">{header.name}</span>
              {directChatBadges.map((badge) => (
                <span
                  className={`chat-member-chip ${badge.className}`}
                  key={`header-${badge.key}`}
                  title={badge.title}
                >
                  {badge.label}
                </span>
              ))}
              <span className="chat-header-badge">
                {header.badgeLabel || (isChatConnected ? 'Active' : 'Offline')}
              </span>
            </div>
            <div className={`chat-header-status ${header.showOnline ? 'online' : ''}`}>
              {header.statusLabel}
            </div>
          </div>
        </button>

        <div className="chat-header-actions" ref={menu.ref}>
          <button className="chat-header-btn" onClick={header.onHeaderSearch} type="button">
            <FiSearch size={16} />
          </button>
          <button className="chat-header-btn" onClick={menu.onToggle} type="button">
            <FiMoreVertical size={16} />
          </button>
          {menu.open && (
            <div className="chat-dropdown">
              {isGroup ? (
                <button
                  onClick={menu.onOpenRoomMembers}
                  className="chat-dropdown-item"
                  type="button"
                >
                  <FiUsers size={14} /> {menu.canManageRoomMembers ? 'Manage members' : 'View members'}
                </button>
              ) : null}
              {menu.canManageRoom ? (
                <button
                  onClick={menu.onRenameRoom}
                  className="chat-dropdown-item"
                  type="button"
                >
                  <FiEdit2 size={14} /> Edit room name
                </button>
              ) : null}
              {menu.canManageRoom ? (
                <button
                  onClick={menu.onOpenRoomPhotoPicker}
                  className="chat-dropdown-item"
                  type="button"
                  disabled={menu.roomPhotoUploading}
                >
                  <FiCamera size={14} />{' '}
                  {menu.roomPhotoUploading ? 'Uploading photo...' : 'Change room photo'}
                </button>
              ) : null}
              {menu.canManageRoom && header.roomAvatarUrl ? (
                <button
                  onClick={menu.onRemoveRoomPhoto}
                  className="chat-dropdown-item"
                  type="button"
                >
                  <FiCamera size={14} /> Remove room photo
                </button>
              ) : null}
              <button onClick={menu.onMute} className="chat-dropdown-item" type="button">
                {conversation?.isMuted ? (
                  <>
                    <FiVolume2 size={14} /> Unmute
                  </>
                ) : (
                  <>
                    <FiVolumeX size={14} /> Mute
                  </>
                )}
              </button>
              {menu.canLeaveRoom ? (
                <button
                  onClick={menu.onLeaveRoom}
                  className="chat-dropdown-item"
                  type="button"
                  disabled={menu.leavingRoom}
                >
                  <FiLogOut size={14} /> {menu.leavingRoom ? 'Leaving room...' : 'Leave room'}
                </button>
              ) : null}
              {menu.canManageRoomMembers ? (
                <button
                  onClick={menu.onDeleteRoom}
                  className="chat-dropdown-item"
                  type="button"
                >
                  <FiTrash2 size={14} /> Delete room
                </button>
              ) : null}
              {!isGroup ? (
                <button
                  onClick={menu.onDeleteConversation}
                  className="chat-dropdown-item"
                  type="button"
                >
                  <FiTrash2 size={14} /> Delete chat
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {messageSearch.open ? (
        <div className="chat-header-searchbar">
          <label className="chat-header-searchfield">
            <FiSearch size={16} />
            <input
              ref={messageSearch.inputRef}
              type="text"
              value={messageSearch.query}
              onChange={(event) => messageSearch.onQueryChange(event.target.value)}
              onKeyDown={messageSearch.onKeyDown}
              placeholder="Search in this chat"
            />
          </label>
          <div className="chat-header-searchmeta">
            <span className="chat-header-searchcount">
              {messageSearch.total > 0 && messageSearch.activeIndex >= 0
                ? `${messageSearch.activeIndex + 1}/${messageSearch.total}`
                : `0/${messageSearch.total}`}
            </span>
            <button
              className="chat-header-searchnav"
              onClick={() => messageSearch.onCycle(-1)}
              type="button"
              disabled={messageSearch.total === 0}
              aria-label="Previous result"
            >
              <FiChevronUp size={15} />
            </button>
            <button
              className="chat-header-searchnav"
              onClick={() => messageSearch.onCycle(1)}
              type="button"
              disabled={messageSearch.total === 0}
              aria-label="Next result"
            >
              <FiChevronDown size={15} />
            </button>
            <button
              className="chat-header-searchclose"
              onClick={messageSearch.onClose}
              type="button"
              aria-label="Close message search"
            >
              <FiX size={15} />
            </button>
          </div>
        </div>
      ) : null}

      <div
        className={`chat-body-shell${infoPanel.showDesktop ? ' chat-body-shell--with-info' : ''}`}
      >
        <div className="chat-thread-pane">
          <div
            className={`chat-messages-wrap ${isDragging ? 'ring-2 ring-inset ring-blue-500 bg-blue-50/10' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isDragging && (
              <div className="absolute inset-0 z-40 flex items-center justify-center bg-blue-500/10 backdrop-blur-[1px]">
                <div className="flex flex-col items-center rounded-xl bg-white/90 p-6 shadow-xl dark:bg-slate-800/90 pointer-events-none">
                  <FiPaperclip className="mb-2 text-4xl text-blue-500" />
                  <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">Drop files here</p>
                </div>
              </div>
            )}
            <div className="chat-messages-bg" />
            <Virtuoso
              ref={messagesPane.virtuosoRef}
              atBottomStateChange={(atBottom) => {
                setIsAtBottom(atBottom);
                if (atBottom) setUnreadCount(0);
              }}
              className="chat-messages custom-scrollbar"
              style={{ width: '100%', height: '100%' }}
              data={messagesPane.groupedMessages}
              firstItemIndex={1000000 - messagesPane.groupedMessages.length}
              initialTopMostItemIndex={messagesPane.groupedMessages.length > 0 ? messagesPane.groupedMessages.length - 1 : 0}
              followOutput={(isAtBottom) => isAtBottom ? 'smooth' : false}
              atTopThreshold={80}
              startReached={() => {
                if (messagesPane.hasOlderMessages && !messagesPane.isLoadingOlderMessages) {
                  messagesPane.onScroll({ currentTarget: { scrollTop: 0 } });
                }
              }}
              scrollerRef={(ref) => {
                if (messagesPane.containerRef) {
                  messagesPane.containerRef.current = ref;
                }
              }}
              components={virtuosoComponents}
              itemContent={virtuosoItemContent}

            />
          </div>

          {typingUserIds?.length > 0 && (
            <div className="px-10 py-2">
              <TypingIndicator userName={typingLabel} />
            </div>
          )}

          <ChatStateBanner
            availabilityReason={conversation?.availabilityReason}
            conversationState={conversation?.conversationState}
          />

          <div className="chat-composer" ref={composer.ref}>
            {!isAtBottom && (
              <button
                className="chat-fab-scroll-bottom absolute right-4 -top-12 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 shadow-md border border-slate-100 hover:bg-slate-50 hover:text-slate-800 transition-colors dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                onClick={() => {
                  messagesPane.virtuosoRef?.current?.scrollToIndex({
                    index: messagesPane.groupedMessages.length - 1,
                    behavior: 'smooth',
                  });
                }}
                type="button"
                aria-label="Scroll to bottom"
              >
                <FiChevronDown size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white shadow-sm">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            )}
            {composer.attachmentDraft && (
              <div className="chat-attachment-preview">
                <div className="chat-attachment-preview__media">
                  {composer.attachmentDraft.previewKind === MESSAGE_TYPES.IMAGE ? (
                    <img
                      src={composer.attachmentDraft.previewUrl}
                      alt={composer.attachmentDraft.name || 'Selected image'}
                      className="chat-attachment-preview__image"
                    />
                  ) : composer.attachmentDraft.previewKind === MESSAGE_TYPES.VOICE ? (
                    <audio
                      controls
                      src={composer.attachmentDraft.previewUrl}
                      preload="metadata"
                      className="chat-attachment-preview__audio"
                       controlsList="nodownload noplaybackrate"
                    />
                  ) : (
                    <div className="chat-attachment-preview__fileicon">
                      <FiPaperclip size={18} />
                    </div>
                  )}
                </div>
                <div className="chat-attachment-preview__meta">
                  <div className="chat-attachment-preview__title">
                    {composer.attachmentDraft.previewKind === MESSAGE_TYPES.VOICE
                      ? 'Voice message preview'
                      : composer.attachmentDraft.previewKind === MESSAGE_TYPES.IMAGE
                        ? 'Image preview'
                        : 'Attachment preview'}
                  </div>
                  <div className="chat-attachment-preview__name">
                    {composer.attachmentDraft.name}
                  </div>
                </div>
                <button
                  className="chat-attachment-preview__close"
                  onClick={composer.onClearAttachment}
                  type="button"
                  aria-label="Remove attachment"
                >
                  <FiX size={14} />
                </button>
              </div>
            )}

            {composer.replyTo && (
              <div className="chat-reply-bar">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="chat-reply-bar-name">
                    {composer.replyTo.senderName || 'Reply'}
                  </div>
                  <div className="chat-reply-bar-text">
                    {composer.replyTo.content?.slice(0, 50)}
                  </div>
                </div>
                <button
                  onClick={composer.onClearReply}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 4,
                    color: '#9ca3af',
                  }}
                  type="button"
                >
                  <FiX size={14} />
                </button>
              </div>
            )}

            {composer.showPicker && (
              <div
                className="chat-composer-picker"
                role="dialog"
                aria-label="Emoji picker"
              >
                <div className="chat-composer-emoji-panel">
                  <EmojiPicker
                    className="chat-emoji-picker"
                    onEmojiClick={composer.onEmojiSelect}
                    width="100%"
                    height={365}
                    autoFocusSearch={false}
                    previewConfig={{ showPreview: false }}
                    searchPlaceholder="Search emoji"
                    skinTonesDisabled
                    lazyLoadEmojis
                    emojiStyle={EmojiStyle.NATIVE}
                    theme={Theme.LIGHT}
                    categories={EMOJI_PICKER_CATEGORIES}
                  />
                </div>
              </div>
            )}

            <div className="chat-input-bar">
              <button
                className={`chat-input-attach${composer.showPicker ? ' chat-input-attach--active' : ''}`}
                onClick={composer.onTogglePicker}
                title="Emoji"
                type="button"
                disabled={composer.isDisabled}
                aria-expanded={composer.showPicker}
              >
                <FiSmile size={20} />
              </button>
              <button
                className="chat-input-attach"
                onClick={composer.onOpenAttachmentPicker}
                title="Attach"
                type="button"
                disabled={composer.isDisabled}
              >
                <FiPaperclip size={18} />
              </button>

              <textarea
                ref={composer.inputRef}
                className="chat-input-field"
                placeholder={composer.placeholder}
                value={composer.text}
                onBlur={composer.onTextBlur}
                onChange={composer.onTextChange}
                onKeyDown={composer.onKeyDown}
                rows={1}
                disabled={composer.isDisabled}
              />

              {composer.hasText || composer.hasAttachmentDraft ? (
                <button
                  className="chat-send-btn"
                  onClick={composer.onSend}
                  disabled={composer.isDisabled}
                  type="button"
                  title={composer.hasAttachmentDraft ? 'Send attachment' : 'Send message'}
                >
                  <FiSend size={16} />
                </button>
              ) : (
                <VoiceRecorder
                  disabled={composer.isDisabled}
                  onRecorded={composer.onStageAttachment}
                  className="chat-send-btn"
                  iconSize={18}
                />
              )}

              <input
                ref={composer.fileInputRef}
                type="file"
                accept="image/*,audio/*"
                onChange={composer.onFileChange}
                style={{ display: 'none' }}
              />
              <input
                ref={composer.roomPhotoInputRef}
                type="file"
                accept="image/*"
                onChange={composer.onRoomPhotoChange}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </div>

        {infoPanel.showDesktop ? infoPanel.desktopNode : null}
      </div>

      {infoPanel.showMobile ? (
        <div className="chat-info-overlay" onClick={infoPanel.onOverlayClose} role="presentation">
          <div
            className="chat-info-overlay__panel"
            onClick={(event) => event.stopPropagation()}
            role="presentation"
          >
            {infoPanel.mobileNode}
          </div>
        </div>
      ) : null}
      {previewImage && (
  <div
    className="
      absolute
      inset-0
      z-50
      flex
      items-center
      justify-center
      bg-black/60
      backdrop-blur-sm
      p-4
    "
    onClick={() => setPreviewImage(null)}
  >
    <div
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setPreviewImage(null)}
        className="
          absolute
          right-3
          top-3
          z-10
          rounded-full
          bg-black/60
          p-2
          text-white
          hover:bg-black/80
        "
      >
        <FiX size={20} />
      </button>

      <img
        src={previewImage}
        alt="Preview"
        className="
          max-h-[80vh]
          w-auto
          max-w-full
          rounded-xl
          object-contain
        "
      />
    </div>
  </div>
)}
    </>
  );
};

export default React.memo(ChatConversationPane);
