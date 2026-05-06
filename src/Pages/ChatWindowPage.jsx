/**
 * ChatWindowPage — Redirects to ChatPage which handles the split layout.
 * On mobile, ChatPage detects the conversationId param and shows the chat view.
 */
import React from 'react';
import ChatPage from './ChatPage';

const ChatWindowPage = () => <ChatPage />;

export default ChatWindowPage;
