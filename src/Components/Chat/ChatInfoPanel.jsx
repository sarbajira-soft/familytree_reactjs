import React from 'react';
import {
  FiCamera,
  FiEdit2,
  FiLogOut,
  FiMessageCircle,
  FiSearch,
  FiTrash2,
  FiUsers,
  FiVolume2,
  FiVolumeX,
  FiX,
} from 'react-icons/fi';
import {
  getChatMemberBadges,
  getChatMemberMetaText,
  getInitials,
  getRoomIcon,
} from '../../services/chat.service';

const ChatInfoPanel = ({
  canLeaveRoom,
  canManageRoom,
  canManageRoomMembers,
  conversation,
  currentRoomMembers,
  handleCloseInfoPanel,
  handleDeleteConversation,
  handleDeleteRoom,
  handleInfoPanelSearch,
  handleLeaveRoom,
  handleMute,
  handleOpenRoomMembers,
  handleOpenRoomPhotoPicker,
  handleRenameRoom,
  headerInitials,
  headerName,
  infoCreatedAtLabel,
  infoFamilyLabel,
  infoPanelDescription,
  infoPanelTitle,
  infoPrimaryMeta,
  isGroup,
  mobile = false,
  roomAvatarUrl,
  roomDisplayName,
  roomMemberCount,
  roomTypeLabel,
  sharedMediaCount,
  activeParticipant,
}) => (
  <aside
    className={`chat-info-panel${mobile ? ' chat-info-panel--mobile' : ''}`}
    role="dialog"
    aria-label={infoPanelTitle}
  >
    <div className="chat-info-panel-header">
      <button
        className="chat-info-panel-close"
        onClick={handleCloseInfoPanel}
        type="button"
        aria-label="Close info panel"
      >
        <FiX size={18} />
      </button>
      <h3>{infoPanelTitle}</h3>
    </div>

    <div className="chat-info-panel-scroll custom-scrollbar">
      <section className="chat-info-hero">
        <div className="chat-info-avatar-wrap">
          <div
            className={`chat-info-avatar${isGroup && !roomAvatarUrl ? ' chat-info-avatar--room' : ''}`}
          >
            {isGroup ? (
              roomAvatarUrl ? (
                <img src={roomAvatarUrl} alt={headerName} />
              ) : (
                getRoomIcon(conversation?.roomType)
              )
            ) : activeParticipant.profileUrl ? (
              <img src={activeParticipant.profileUrl} alt={headerName} />
            ) : (
              headerInitials
            )}
          </div>
          {canManageRoom ? (
            <button
              className="chat-info-avatar-edit"
              onClick={handleOpenRoomPhotoPicker}
              type="button"
              aria-label="Change room photo"
            >
              <FiCamera size={15} />
            </button>
          ) : null}
        </div>

        <h3 className="chat-info-title">{headerName}</h3>
        <p className="chat-info-subtitle">
          {isGroup
            ? `${roomTypeLabel} · ${roomMemberCount} member${roomMemberCount === 1 ? '' : 's'}`
            : infoPrimaryMeta}
        </p>

        <div
          className={`chat-info-hero-actions${!isGroup ? ' chat-info-hero-actions--compact' : ''}`}
        >
          {isGroup ? (
            <button
              className="chat-info-hero-btn"
              onClick={handleOpenRoomMembers}
              type="button"
            >
              <FiUsers size={18} />
              <span>{canManageRoomMembers ? 'Add members' : 'View members'}</span>
            </button>
          ) : (
            <button
              className="chat-info-hero-btn"
              onClick={handleInfoPanelSearch}
              type="button"
            >
              <FiSearch size={18} />
              <span>Search</span>
            </button>
          )}

          <button
            className="chat-info-hero-btn"
            onClick={isGroup ? handleInfoPanelSearch : handleMute}
            type="button"
          >
            {isGroup ? (
              <FiSearch size={18} />
            ) : conversation?.isMuted ? (
              <FiVolume2 size={18} />
            ) : (
              <FiVolumeX size={18} />
            )}
            <span>
              {isGroup ? 'Search' : conversation?.isMuted ? 'Unmute' : 'Mute'}
            </span>
          </button>
        </div>
      </section>

      <section className="chat-info-section">
        <div className="chat-info-section-heading">Overview</div>

        {isGroup ? (
          <div className="chat-info-row">
            <div className="chat-info-row-icon">
              <FiEdit2 size={16} />
            </div>
            <div className="chat-info-row-body">
              <div className="chat-info-row-title">Room name</div>
              <div className="chat-info-row-text">{roomDisplayName}</div>
            </div>
            {canManageRoom ? (
              <button
                className="chat-info-row-btn"
                onClick={handleRenameRoom}
                type="button"
              >
                Edit
              </button>
            ) : null}
          </div>
        ) : (
          <div className="chat-info-row">
            <div className="chat-info-row-icon">
              <FiUsers size={16} />
            </div>
            <div className="chat-info-row-body">
              <div className="chat-info-row-title">Family</div>
              <div className="chat-info-row-text">{infoFamilyLabel}</div>
            </div>
          </div>
        )}

        <div className="chat-info-row">
          <div className="chat-info-row-icon">
            <FiMessageCircle size={16} />
          </div>
          <div className="chat-info-row-body">
            <div className="chat-info-row-title">
              {isGroup ? 'About this room' : 'About this chat'}
            </div>
            <div className="chat-info-row-text">{infoPanelDescription}</div>
          </div>
        </div>

        <div className="chat-info-row">
          <div className="chat-info-row-icon">
            <FiCamera size={16} />
          </div>
          <div className="chat-info-row-body">
            <div className="chat-info-row-title">Shared media</div>
            <div className="chat-info-row-text">
              {sharedMediaCount} item{sharedMediaCount === 1 ? '' : 's'} in the loaded chat
            </div>
          </div>
        </div>

        <div className="chat-info-row">
          <div className="chat-info-row-icon">
            {conversation?.isMuted ? <FiVolumeX size={16} /> : <FiVolume2 size={16} />}
          </div>
          <div className="chat-info-row-body">
            <div className="chat-info-row-title">Notifications</div>
            <div className="chat-info-row-text">
              {conversation?.isMuted ? 'Muted for this chat' : 'Notifications are active'}
            </div>
          </div>
          <button className="chat-info-row-btn" onClick={handleMute} type="button">
            {conversation?.isMuted ? 'Unmute' : 'Mute'}
          </button>
        </div>

        <div className="chat-info-row">
          <div className="chat-info-row-icon">
            <FiUsers size={16} />
          </div>
          <div className="chat-info-row-body">
            <div className="chat-info-row-title">
              {isGroup ? 'Created' : 'Conversation started'}
            </div>
            <div className="chat-info-row-text">{infoCreatedAtLabel}</div>
          </div>
        </div>
      </section>

      {isGroup ? (
        <section className="chat-info-section">
          <div className="chat-info-section-heading">Members</div>
          <div className="chat-info-members-preview">
            {currentRoomMembers.slice(0, 5).map((member) => (
              <div className="chat-info-member-chip" key={`info-member-${member.userId}`}>
                <div className="chat-info-member-chip-avatar">
                  {member.profileUrl ? (
                    <img src={member.profileUrl} alt={member.name} />
                  ) : (
                    getInitials(member.firstName, member.lastName)
                  )}
                </div>
                <div className="chat-info-member-chip-text">
                  <span className="chat-info-member-chip-name">{member.name}</span>
                  <small>{getChatMemberMetaText(member)}</small>
                  <div className="chat-member-chip-row chat-member-chip-row--compact">
                    {member.isFamilyAdmin ? (
                      <span className="chat-member-chip">Admin</span>
                    ) : null}
                    {getChatMemberBadges(member).map((badge) => (
                      <span
                         className={`chat-member-chip ${badge.className}`}
                        key={`info-member-${member.userId}-${badge.key}`}
                        title={badge.title}
                      >
                        {badge.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            className="chat-info-wide-action"
            onClick={handleOpenRoomMembers}
            type="button"
          >
            <FiUsers size={16} />
            {canManageRoomMembers ? 'Manage members' : 'View members'}
          </button>
        </section>
      ) : null}

      <section className="chat-info-section">
        <div className="chat-info-section-heading">Actions</div>

        <button
          className="chat-info-action-row"
          onClick={handleInfoPanelSearch}
          type="button"
        >
          <FiSearch size={17} />
          <span>Search in chat</span>
        </button>

        {canManageRoom ? (
          <button
            className="chat-info-action-row"
            onClick={handleOpenRoomPhotoPicker}
            type="button"
          >
            <FiCamera size={17} />
            <span>Change room photo</span>
          </button>
        ) : null}

        {canLeaveRoom ? (
          <button
            className="chat-info-action-row chat-info-action-row--danger"
            onClick={handleLeaveRoom}
            type="button"
          >
            <FiLogOut size={17} />
            <span>Leave room</span>
          </button>
        ) : null}

        {canManageRoomMembers ? (
          <button
            className="chat-info-action-row chat-info-action-row--danger"
            onClick={handleDeleteRoom}
            type="button"
          >
            <FiTrash2 size={17} />
            <span>Delete room</span>
          </button>
        ) : null}

        {!isGroup ? (
          <button
            className="chat-info-action-row chat-info-action-row--danger"
            onClick={handleDeleteConversation}
            type="button"
          >
            <FiTrash2 size={17} />
            <span>Delete chat</span>
          </button>
        ) : null}
      </section>
    </div>
  </aside>
);

export default React.memo(ChatInfoPanel);
