import React from 'react';
import { FiMessageCircle, FiPlus, FiSearch, FiUsers } from 'react-icons/fi';
import { CONVERSATION_TYPES } from '../../constants/chat.constants';
import {
  formatMessageTime,
  getInitials,
  getMessagePreviewText,
  getRoomIcon,
} from '../../services/chat.service';
import { getRoomDisplayName, isSameConversation } from './chatPage.utils';

const getRelationshipPillLabel = (member = {}) => {
  const relationshipLabel = String(
    member?.relationshipLabel || member?.membershipType || '',
  )
    .trim()
    .toLowerCase();

  if (relationshipLabel === 'family' || relationshipLabel === 'member') {
    return 'Family';
  }

  if (relationshipLabel === 'associated') {
    return 'Associated';
  }

  if (relationshipLabel === 'linked') {
    return 'Linked';
  }

  return '';
};

const ChatSidebar = ({
  activeTab,
  familyMemberMap,
  filteredConversations,
  filteredRooms,
  listLoading,
  msgCount,
  onCreateRoom,
  onNewConversation,
  onOpenConversation,
  onSearchChange,
  onTabChange,
  presenceByUserId,
  roomCount,
  search,
  searchInputRef,
  selectedId,
}) => (
  <div className="chat-sidebar">
    <div className="chat-sidebar-search">
      <div className="chat-search-box">
        <FiSearch size={14} color="#9ca3af" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search chats"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="chat-search-input"
        />
      </div>
    </div>

    <div className="chat-sidebar-toolbar">
      <div className="chat-sidebar-tabs">
        <button
          className={`chat-pill${activeTab === 'messages' ? ' active' : ''}`}
          onClick={() => onTabChange('messages')}
          type="button"
        >
          Messages {msgCount > 0 && <span className="chat-pill-badge">{msgCount}</span>}
        </button>
        <button
          className={`chat-pill${activeTab === 'rooms' ? ' active' : ''}`}
          onClick={() => onTabChange('rooms')}
          type="button"
        >
          Rooms {roomCount > 0 && <span className="chat-pill-badge">{roomCount}</span>}
        </button>
      </div>

      {activeTab === 'messages' ? (
        <button
          className="chat-sidebar-action chat-sidebar-action--inline"
          onClick={onNewConversation}
          type="button"
        >
          <FiPlus size={14} />
          New conversation
        </button>
      ) : (
        <button
          className="chat-sidebar-action chat-sidebar-action--inline"
          onClick={onCreateRoom}
          type="button"
        >
          <FiPlus size={14} />
          Create room
        </button>
      )}
    </div>

    {activeTab === 'rooms' ? (
      <div className="chat-sidebar-note-row">
        <span className="chat-sidebar-note">
          Rooms are limited to your reachable family, linked, and associated contacts.
        </span>
      </div>
    ) : null}

    <div className="chat-sidebar-list custom-scrollbar">
      {listLoading ? (
        <div className="chat-list-loader" aria-label="Loading chat list">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="chat-list-loader__item" key={`chat-list-loader-${index}`}>
              <div className="chat-list-loader__avatar shimmer-block" />
              <div className="chat-list-loader__body">
                <div className="chat-list-loader__line shimmer-block" />
                <div className="chat-list-loader__line chat-list-loader__line--short shimmer-block" />
              </div>
            </div>
          ))}
        </div>
      ) : activeTab === 'messages' ? (
        filteredConversations.length > 0 ? (
          filteredConversations.map((conversationItem) => {
            const participant = conversationItem?.participants?.[0] || {};
            const participantMember =
              familyMemberMap.get(Number(participant?.userId || 0)) || null;
            const relationshipPillLabel = getRelationshipPillLabel(participantMember || {});
            const fullName =
              `${participant.firstName || ''} ${participant.lastName || ''}`.trim() ||
              participant?.name ||
              'Unknown';
            const initials = getInitials(
              participant.firstName,
              participant.lastName,
            );
            const isActive = isSameConversation(selectedId, conversationItem?.id);
            const participantPresence =
              presenceByUserId?.[Number(participant?.userId || 0)] || {};
            const isParticipantOnline =
              typeof participantPresence?.isOnline === 'boolean'
                ? participantPresence.isOnline
                : Boolean(participant?.isOnline);

            return (
              <div
                key={conversationItem.id}
                className={`chat-li${isActive ? ' active' : ''}`}
                onClick={() =>
                  onOpenConversation(conversationItem.id, CONVERSATION_TYPES.DIRECT)
                }
              >
                <div className="chat-avatar">
                  {participant.profileUrl ? (
                    <img src={participant.profileUrl} alt="" />
                  ) : (
                    initials
                  )}
                  {isParticipantOnline ? <div className="chat-avatar-online" /> : null}
                </div>
                <div className="chat-li-body">
                  <div className="chat-li-top">
                    <div className="chat-li-name-row">
                      <span className="chat-li-name">{fullName}</span>
                      {relationshipPillLabel ? (
                        <span className="chat-member-chip" title={relationshipPillLabel}>
                          {relationshipPillLabel}
                        </span>
                      ) : null}
                    </div>
                    <span
                      className={`chat-li-time${conversationItem.unreadCount ? ' unread' : ''}`}
                    >
                      {formatMessageTime(conversationItem?.lastMessage?.createdAt)}
                    </span>
                  </div>
                  <div className="chat-li-preview">
                    {getMessagePreviewText(conversationItem?.lastMessage)}
                  </div>
                </div>
                {conversationItem.unreadCount > 0 && (
                  <span className="chat-li-badge">{conversationItem.unreadCount}</span>
                )}
              </div>
            );
          })
        ) : (
          <div className="chat-empty">
            <FiMessageCircle size={40} />
            <p>No conversations</p>
          </div>
        )
      ) : filteredRooms.length > 0 ? (
        filteredRooms.map((room) => {
          const isActive = isSameConversation(selectedId, room?.id);
          const roomDisplayLabel = getRoomDisplayName(room);
          return (
            <div
              key={room.id}
              className={`chat-li${isActive ? ' active' : ''}`}
              onClick={() => onOpenConversation(room.id, CONVERSATION_TYPES.GROUP)}
            >
              <div
                className={`chat-avatar${room?.roomAvatarUrl ? '' : ' chat-avatar--room'}`}
              >
                {room?.roomAvatarUrl ? (
                  <img src={room.roomAvatarUrl} alt={room.roomName || 'Room'} />
                ) : (
                  getRoomIcon(room.roomType)
                )}
              </div>
                <div className="chat-li-body">
                  <div className="chat-li-top">
                    <span className="chat-li-name">
                      {roomDisplayLabel}
                      {room?.memberCount > 0 ? ` (${room.memberCount})` : ''}
                    </span>
                    <span className={`chat-li-time${room.unreadCount ? ' unread' : ''}`}>
                      {formatMessageTime(room?.lastMessage?.createdAt)}
                    </span>
                </div>
                <div className="chat-li-preview">
                  {getMessagePreviewText(room?.lastMessage)}
                </div>
              </div>
              {room.unreadCount > 0 && (
                <span className="chat-li-badge">{room.unreadCount}</span>
              )}
            </div>
          );
        })
      ) : (
        <div className="chat-empty">
          <FiUsers size={40} />
          <p>No rooms yet</p>
        </div>
      )}
    </div>
  </div>
);

export default React.memo(ChatSidebar);
