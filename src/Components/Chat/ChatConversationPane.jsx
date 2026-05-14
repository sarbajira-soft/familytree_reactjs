import React from 'react';
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
import {
  CHAT_LIMITS,
  MESSAGE_TYPES,
} from '../../constants/chat.constants';
import {
  formatFullTime,
  getInitials,
  getRoomIcon,
} from '../../services/chat.service';
import {
  EMOJI_PICKER_CATEGORIES,
  getReceiptState,
  renderHighlightedText,
} from './chatPage.utils';

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
}) => {
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
      <div className="chat-thread-loader" aria-label="Loading conversation">
        <div className="chat-thread-loader__header">
          <div className="chat-thread-loader__avatar shimmer-block" />
          <div className="chat-thread-loader__meta">
            <div className="chat-thread-loader__line shimmer-block" />
            <div className="chat-thread-loader__line chat-thread-loader__line--short shimmer-block" />
          </div>
        </div>
        <div className="chat-thread-loader__messages">
          <div className="chat-thread-loader__bubble shimmer-block" />
          <div className="chat-thread-loader__bubble chat-thread-loader__bubble--sent shimmer-block" />
          <div className="chat-thread-loader__bubble chat-thread-loader__bubble--wide shimmer-block" />
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
          <div className="chat-messages-wrap">
            <div className="chat-messages-bg" />
            <div className="chat-messages custom-scrollbar">
              {messagesPane.groupedMessages.map((item) => {
                if (item.type === 'date') {
                  return (
                    <div className="chat-date-sep" key={item.key}>
                      <span>{item.label}</span>
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
                const receiptGlyph =
                  receiptState === 'failed'
                    ? '!'
                    : receiptState === 'sending' || receiptState === 'sent'
                      ? '\u2713'
                      : '\u2713\u2713';
                const receiptLabel =
                  receiptState === 'failed'
                    ? 'Failed to send'
                    : receiptState === 'sending'
                      ? 'Sending'
                      : receiptState === 'seen'
                        ? 'Seen'
                        : receiptState === 'delivered'
                          ? 'Delivered'
                          : 'Sent';
                const canDelete =
                  isSent &&
                  !isUnavailableMessage &&
                  Date.now() - new Date(message?.createdAt).getTime() <=
                    CHAT_LIMITS.DELETE_WINDOW_MS;
                const senderInitials = getInitials(
                  String(message?.senderName || '').split(' ')[0],
                  String(message?.senderName || '').split(' ')[1],
                );

                if (message?.messageType === MESSAGE_TYPES.SYSTEM) {
                  return (
                    <div
                      className="msg-row"
                      key={item.key}
                      style={{ justifyContent: 'center' }}
                    >
                      <div className="msg-bubble msg-bubble--system">
                        <span>{message.content}</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={item.key}
                    ref={(node) => {
                      if (node && messageId) {
                        messagesPane.nodeRefs.current.set(messageId, node);
                        return;
                      }

                      if (messageId) {
                        messagesPane.nodeRefs.current.delete(messageId);
                      }
                    }}
                    tabIndex={isSearchMatch ? -1 : undefined}
                  >
                    <div
                      className={`msg-row ${isSent ? 'msg-row--sent' : 'msg-row--received'}${isActiveSearchMatch ? ' msg-row--search-active' : ''}`}
                    >
                      {!isSent && (
                        <div className="msg-avatar-sm">
                          {message?.senderAvatar ? (
                            <img
                              src={message.senderAvatar}
                              alt={message.senderName || 'Member'}
                            />
                          ) : (
                            senderInitials
                          )}
                        </div>
                      )}
                      <div
                        className={`msg-bubble ${isSent ? 'msg-bubble--sent' : 'msg-bubble--received'}${isUnavailableMessage ? ' msg-bubble--deleted' : ''}${isSearchMatch ? ' msg-bubble--search-match' : ''}${isActiveSearchMatch ? ' msg-bubble--search-active' : ''}`}
                      >
                        {!isUnavailableMessage && (
                          <div
                            className={`msg-actions ${isSent ? 'msg-actions--sent' : 'msg-actions--received'}`}
                          >
                            <button
                              className="msg-action-btn"
                              onClick={() => messagesPane.onReply(message)}
                              type="button"
                              aria-label="Reply to message"
                              title="Reply"
                            >
                              <FiCornerUpLeft />
                            </button>
                            {canDelete && (
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
                            {!isSent && (
                              <button
                                className="msg-action-btn"
                                onClick={() => messagesPane.onReportMessage(message)}
                                type="button"
                                aria-label="Report message"
                                title="Report"
                              >
                                <FiAlertTriangle />
                              </button>
                            )}
                          </div>
                        )}

                        {!isSent && isGroup && !isUnavailableMessage && (
                          <div className="msg-sender">{message.senderName}</div>
                        )}
                        {message.replyTo && !isUnavailableMessage && (
                          <div className="msg-reply-bar">
                            <div className="msg-reply-bar-name">
                              {message.replyTo.senderName || 'Reply'}
                            </div>
                            <div className="msg-reply-bar-text">
                              {renderHighlightedText(
                                message.replyTo.content?.slice(0, 60),
                                messageSearch.query,
                                isActiveSearchMatch,
                              )}
                            </div>
                          </div>
                        )}

                        {isUnavailableMessage ? (
                          <span>
                            <em>{isTombstone ? 'Message unavailable' : 'Message deleted'}</em>
                          </span>
                        ) : message.mediaUrl ? (
                          message.messageType === MESSAGE_TYPES.VOICE ? (
                            <audio controls src={message.mediaUrl} preload="metadata" />
                          ) : message.messageType === MESSAGE_TYPES.IMAGE ? (
                            <div className="msg-media-block">
                              <a
                                href={message.mediaUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="msg-media-link"
                              >
                                <img
                                  src={message.mediaUrl}
                                  alt={message.content || 'Shared image'}
                                  className="msg-media-image"
                                />
                              </a>
                              {message.content ? (
                                <div className="msg-media-caption">
                                  {renderHighlightedText(
                                    message.content,
                                    messageSearch.query,
                                    isActiveSearchMatch,
                                  )}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <a
                              href={message.mediaUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'inherit', textDecoration: 'underline' }}
                            >
                              {renderHighlightedText(
                                message.content || 'Open attachment',
                                messageSearch.query,
                                isActiveSearchMatch,
                              )}
                            </a>
                          )
                        ) : (
                          <span>
                            {renderHighlightedText(
                              message.content,
                              messageSearch.query,
                              isActiveSearchMatch,
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      className={`msg-time-row ${isSent ? 'msg-row--sent' : ''}`}
                      style={isSent ? undefined : { paddingLeft: 38 }}
                    >
                      {formatFullTime(message.createdAt)}
                      {isSent && receiptState && (
                        <span
                          className={`msg-receipt msg-receipt--${receiptState}`}
                          title={receiptLabel}
                          aria-label={receiptLabel}
                        >
                          {receiptGlyph}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {messagesPane.typingUserIds.length > 0 && (
                <TypingIndicator userName={messagesPane.typingLabel} />
              )}

              <div ref={messagesPane.endRef} />
            </div>
          </div>

          <ChatStateBanner
            availabilityReason={conversation?.availabilityReason}
            conversationState={conversation?.conversationState}
          />

          <div className="chat-composer" ref={composer.ref}>
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
          <div onClick={(event) => event.stopPropagation()} role="presentation">
            {infoPanel.mobileNode}
          </div>
        </div>
      ) : null}
    </>
  );
};

export default React.memo(ChatConversationPane);
