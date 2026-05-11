import React from 'react';

const TypingIndicator = ({ userName }) => (
  <div className="typing-indicator">
    <div className="typing-indicator__bubble" aria-hidden="true">
      <div className="typing-dots">
        <span /><span /><span />
      </div>
    </div>
    <span className="typing-indicator__label">{userName || 'Someone'} is typing…</span>
  </div>
);

export default React.memo(TypingIndicator);
