import React from 'react';

const TypingIndicator = ({ userName }) => (
  <div className="typing-indicator">
    <div className="typing-dots">
      <span /><span /><span />
    </div>
    <span>{userName || 'Someone'} is typing...</span>
  </div>
);

export default React.memo(TypingIndicator);
