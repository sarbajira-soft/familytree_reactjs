import React from 'react';

const PinnedMessageBanner = ({ pinnedMessage, onClose }) => {
  if (!pinnedMessage) return null;
  return (
    <div className="pinned-banner">
      <span className="pinned-banner-icon">📌</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="pinned-banner-label">Pinned Message</div>
        <div className="pinned-banner-content">
          {pinnedMessage.senderName && <strong>{pinnedMessage.senderName}: </strong>}
          {pinnedMessage.content}
        </div>
      </div>
    </div>
  );
};

export default React.memo(PinnedMessageBanner);
