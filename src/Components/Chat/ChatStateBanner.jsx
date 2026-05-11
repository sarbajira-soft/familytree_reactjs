import React from 'react';
import {
  CONVERSATION_AVAILABILITY_REASONS,
  CONVERSATION_STATES,
} from '../../constants/chat.constants';

const getBannerCopy = (conversationState, availabilityReason) => {
  switch (availabilityReason) {
    case CONVERSATION_AVAILABILITY_REASONS.ACCOUNT_PENDING_DELETION:
      return {
        tone: 'warning',
        title: 'Read-only chat',
        description: 'This chat is read-only while your account is pending deletion.',
      };
    case CONVERSATION_AVAILABILITY_REASONS.ACCOUNT_SUSPENDED:
      return {
        tone: 'warning',
        title: 'Read-only chat',
        description: 'This chat is read-only because your account is suspended.',
      };
    case CONVERSATION_AVAILABILITY_REASONS.ACCOUNT_UNAVAILABLE:
      return {
        tone: 'danger',
        title: 'Chat unavailable',
        description: 'This chat is unavailable because your account is no longer an active app user.',
      };
    case CONVERSATION_AVAILABILITY_REASONS.ANNOUNCEMENT_ADMIN_ONLY:
      return {
        tone: 'info',
        title: 'Read-only chat',
        description: 'Only the family admin can post in announcements.',
      };
    case CONVERSATION_AVAILABILITY_REASONS.FAMILY_CONNECTION_LOST:
      return {
        tone: 'warning',
        title: 'Read-only chat',
        description: 'This chat is read-only because you are no longer in the same family scope.',
      };
    case CONVERSATION_AVAILABILITY_REASONS.PARTICIPANT_PENDING_DELETION:
      return {
        tone: 'warning',
        title: 'Read-only chat',
        description: 'This chat is temporarily read-only while the other account is pending deletion.',
      };
    case CONVERSATION_AVAILABILITY_REASONS.PARTICIPANT_SUSPENDED:
      return {
        tone: 'warning',
        title: 'Read-only chat',
        description: 'This chat is read-only because the other account is suspended.',
      };
    case CONVERSATION_AVAILABILITY_REASONS.PARTICIPANT_BLOCKED:
      return {
        tone: 'danger',
        title: 'Chat unavailable',
        description: 'This chat is unavailable because one of the participants is blocked.',
      };
    case CONVERSATION_AVAILABILITY_REASONS.PARTICIPANT_UNAVAILABLE:
      return {
        tone: 'danger',
        title: 'Chat unavailable',
        description: 'This chat is unavailable because the other participant is no longer an active app user.',
      };
    case CONVERSATION_AVAILABILITY_REASONS.ROOM_ARCHIVED:
      return {
        tone: 'muted',
        title: 'Archived chat',
        description: 'This chat has been archived and can no longer accept new messages.',
      };
    default:
      break;
  }

  switch (conversationState) {
    case CONVERSATION_STATES.READ_ONLY:
      return {
        tone: 'warning',
        title: 'Read-only chat',
        description: 'New messages are disabled for this conversation right now.',
      };
    case CONVERSATION_STATES.REVOKED:
      return {
        tone: 'danger',
        title: 'Chat unavailable',
        description: 'This conversation is no longer available for new messages.',
      };
    case CONVERSATION_STATES.ARCHIVED:
      return {
        tone: 'muted',
        title: 'Archived chat',
        description: 'This conversation has been archived.',
      };
    default:
      return null;
  }
};

const ChatStateBanner = ({ conversationState, availabilityReason }) => {
  const banner = getBannerCopy(conversationState, availabilityReason);
  if (!banner) {
    return null;
  }

  return (
    <div className={`chat-state-banner chat-state-banner--${banner.tone}`} role="status">
      <strong>{banner.title}</strong>
      <span>{banner.description}</span>
    </div>
  );
};

export default ChatStateBanner;
