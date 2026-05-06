import React from 'react';
import { getInitials, formatMessageTime } from '../../services/chat.service';
import { CONVERSATION_TYPES } from '../../constants/chat.constants';

const ChatListItem = ({ conversation, onClick }) => {
  const isGroup = conversation.type === CONVERSATION_TYPES.GROUP;
  const p = conversation.participants?.[0] || {};
  const name = isGroup
    ? conversation.roomName || 'Group Room'
    : `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Unknown';
  const initials = isGroup ? (conversation.roomIcon || '💬') : getInitials(p.firstName, p.lastName);
  const preview = conversation.lastMessage?.content || 'No messages yet';
  const time = formatMessageTime(conversation.lastMessage?.createdAt);
  const unread = conversation.unreadCount || 0;
  const isMuted = conversation.isMuted;
  const isSentByMe = conversation.lastMessage?.senderId !== (p.id);

  let avatarCls = 'chat-avatar';
  if (isGroup) {
    avatarCls += ' chat-avatar--room';
    if (conversation.roomType === 'announcements') avatarCls += ' chat-avatar--announcements';
    else if (conversation.roomType === 'event') avatarCls += ' chat-avatar--event';
    else if (conversation.roomType === 'custom') avatarCls += ' chat-avatar--custom';
  }

  return (
    <div
      className={`chat-list-item${isMuted ? ' chat-item-muted' : ''}`}
      onClick={() => onClick?.(conversation)}
      role="button"
      tabIndex={0}
      id={`chat-item-${conversation.id}`}
    >
      <div className={avatarCls}>
        {p.profileUrl ? <img src={p.profileUrl} alt={name} /> : initials}
      </div>

      <div className="chat-item-body">
        <div className="chat-item-header">
          <span className="chat-item-name">
            {name}
            {isMuted && <span className="chat-item-muted-icon">🔇</span>}
          </span>
          <span className={`chat-item-time${unread > 0 ? ' unread' : ''}`}>{time}</span>
        </div>
        <div className="chat-item-preview">
          {isSentByMe && !isGroup && <span className="ticks">✓✓</span>}
          {isGroup && conversation.lastMessage?.senderName && (
            <span style={{ fontWeight: 500, color: '#111b21' }}>{conversation.lastMessage.senderName}: </span>
          )}
          <span>{preview}</span>
        </div>
      </div>

      {unread > 0 && <div className="chat-item-badge">{unread > 99 ? '99+' : unread}</div>}
    </div>
  );
};

export default React.memo(ChatListItem);
