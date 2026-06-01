import React from 'react';
import { formatFullTime, formatSeenAgo } from '../../services/chat.service';
import { MESSAGE_TYPES, CHAT_LIMITS } from '../../constants/chat.constants';

const MessageBubble = ({ message, isSent, currentUserId, onReply, onDelete, onReport, showSenderName }) => {
  if (!message) return null;

  const isSystem = message.messageType === MESSAGE_TYPES.SYSTEM;
  const isDeleted = message.isDeleted || message.messageType === MESSAGE_TYPES.TOMBSTONE;
  const isRead = !!message.readAt;
  const receiptText = isRead
    ? `Seen ${formatSeenAgo(message.readAt) || 'just now'}`
    : message.sendStatus === 'sending'
      ? 'Sending'
      : 'Sent';
  const canDel = isSent && !isDeleted && (Date.now() - new Date(message.createdAt).getTime()) <= CHAT_LIMITS.DELETE_WINDOW_MS;

  if (isSystem) {
    return (
      <div className="msg-row" style={{ justifyContent: 'center' }}>
        <div className="msg-bubble msg-bubble--system"><span>{message.content}</span></div>
      </div>
    );
  }

  return (
    <div className={`msg-row ${isSent ? 'msg-row--sent' : 'msg-row--received'}`}>
      <div className={`msg-bubble ${isSent ? 'msg-bubble--sent' : 'msg-bubble--received'} ${isDeleted ? 'msg-bubble--deleted' : ''}`}>
        {/* Hover actions */}
        {!isDeleted && (
          <div className="msg-actions">
            <button className="msg-action-btn" title="Reply" onClick={() => onReply?.(message)}>↩</button>
            {canDel && <button className="msg-action-btn" title="Delete" onClick={() => onDelete?.(message)}>🗑</button>}
            {!isSent && <button className="msg-action-btn" title="Report" onClick={() => onReport?.(message)}>⚠</button>}
          </div>
        )}

        {!isSent && showSenderName && !isDeleted && (
          <div className="msg-sender">{message.senderName}</div>
        )}

        {message.replyTo && !isDeleted && (
          <div className="msg-reply-bar">
            <div className="msg-reply-bar-name">{message.replyTo.senderName || 'Reply'}</div>
            <div className="msg-reply-bar-text">{message.replyTo.content?.slice(0, 80)}</div>
          </div>
        )}

        {isDeleted ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            🚫 <em>{message.messageType === MESSAGE_TYPES.TOMBSTONE ? 'This message is unavailable' : 'This message was deleted'}</em>
          </span>
        ) : message.messageType === MESSAGE_TYPES.IMAGE ? (
          <div>
            {message.mediaUrl && (
              <img src={message.mediaUrl} alt="" style={{ maxWidth: 260, borderRadius: 6, marginBottom: 4, display: 'block' }} />
            )}
            {message.content && <div style={{ marginTop: 4 }}>{message.content}</div>}
          </div>
        ) : message.messageType === MESSAGE_TYPES.VOICE ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 180 }}>
            <span style={{ fontSize: 20 }}>🎤</span>
            <div style={{ flex: 1, height: 4, background: isSent ? 'rgba(0,0,0,.15)' : '#e5e7eb', borderRadius: 2 }}>
              <div style={{ width: '60%', height: '100%', background: isSent ? '#fff' : 'var(--color-secondary)', borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 12, opacity: .7 }}>0:12</span>
          </div>
        ) : (
          <span>{message.content}</span>
        )}

        {!isDeleted && (
          <span className="msg-meta">
            <span className="msg-time">{formatFullTime(message.createdAt)}</span>
            {isSent && (
              <span className={`msg-read ${isRead ? 'msg-read--read' : ''}`}>
                {receiptText}
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
};

export default React.memo(MessageBubble);
