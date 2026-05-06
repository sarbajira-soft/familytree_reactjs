import React, { useState, useRef, useCallback } from 'react';
import { FiPaperclip, FiSend, FiMic, FiSmile, FiX } from 'react-icons/fi';

const MessageInput = ({ onSend, onTyping, replyTo, onClearReply, disabled }) => {
  const [text, setText] = useState('');
  const ref = useRef(null);

  const handleSend = useCallback(() => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend?.(t, replyTo);
    setText('');
    onClearReply?.();
    if (ref.current) { ref.current.style.height = 'auto'; ref.current.focus(); }
  }, [text, disabled, onSend, replyTo, onClearReply]);

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  const handleChange = (e) => {
    setText(e.target.value);
    onTyping?.();
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 100) + 'px';
  };

  return (
    <>
      {/* Reply bar */}
      {replyTo && (
        <div className="chat-reply-bar">
          <div className="chat-reply-bar-body">
            <div className="chat-reply-bar-name">{replyTo.senderName || 'Reply'}</div>
            <div className="chat-reply-bar-text">{replyTo.content?.slice(0, 60)}</div>
          </div>
          <button onClick={onClearReply} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#667781' }}>
            <FiX size={16} />
          </button>
        </div>
      )}

      <div className="chat-input-bar">
        <button className="chat-input-attach" title="Emoji" type="button"><FiSmile size={22} /></button>
        <button className="chat-input-attach" title="Attach" type="button"><FiPaperclip size={20} /></button>

        <textarea
          ref={ref}
          className="chat-input-field"
          placeholder="Type a message"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKey}
          rows={1}
          disabled={disabled}
          id="chat-message-input"
        />

        {text.trim() ? (
          <button className="chat-send-btn" onClick={handleSend} disabled={disabled} title="Send" type="button" id="chat-send-button">
            <FiSend size={18} />
          </button>
        ) : (
          <button className="chat-send-btn" title="Voice note" type="button" style={{ background: '#008069' }}>
            <FiMic size={20} />
          </button>
        )}
      </div>
    </>
  );
};

export default React.memo(MessageInput);
