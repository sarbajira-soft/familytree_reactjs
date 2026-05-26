import React from 'react';
import PropTypes from 'prop-types';
import { FiArrowUpRight, FiFilm, FiGrid, FiImage } from 'react-icons/fi';
import { MESSAGE_TYPES } from '../../constants/chat.constants';

const ChatSharedContentCard = ({ message, onOpen }) => {
  const sharePayload = message?.sharePayload || null;
  const isPost = message?.messageType === MESSAGE_TYPES.POST_SHARE;
  const mediaUrl = String(sharePayload?.previewMediaUrl || '').trim();
  const mediaKind = String(sharePayload?.previewMediaKind || '').trim().toLowerCase();
  const title = String(sharePayload?.previewTitle || (isPost ? 'Post' : 'Gallery')).trim();
  const subtitle = String(sharePayload?.creatorName || '').trim();
  const description = String(sharePayload?.previewText || '').trim();
  const mediaCount = Number(sharePayload?.mediaCount || 0);
  const canRenderImage = Boolean(mediaUrl) && mediaKind !== 'video';

  return (
    <button
      type="button"
      className="chat-share-card"
      onClick={() => onOpen?.(message)}
      title={isPost ? 'Open shared post' : 'Open shared gallery'}
    >
      <div className="chat-share-card__media">
        {canRenderImage ? (
          <img src={mediaUrl} alt={title} className="chat-share-card__image" />
        ) : (
          <div className="chat-share-card__placeholder">
            {isPost ? <FiImage size={20} /> : <FiGrid size={20} />}
          </div>
        )}
        {mediaKind === 'video' ? (
          <span className="chat-share-card__badge">
            <FiFilm size={12} /> Video
          </span>
        ) : null}
      </div>
      <div className="chat-share-card__body">
        <div className="chat-share-card__eyebrow">
          {isPost ? 'Shared post' : 'Shared gallery'}
          {!isPost && mediaCount > 0 ? ` · ${mediaCount} photos` : ''}
        </div>
        <div className="chat-share-card__title">{title}</div>
        {subtitle ? <div className="chat-share-card__subtitle">{subtitle}</div> : null}
        {description ? <div className="chat-share-card__description">{description}</div> : null}
      </div>
      <div className="chat-share-card__action">
        <FiArrowUpRight size={16} />
      </div>
    </button>
  );
};

ChatSharedContentCard.propTypes = {
  message: PropTypes.shape({
    messageType: PropTypes.string,
    sharePayload: PropTypes.shape({
      previewMediaKind: PropTypes.string,
      previewMediaUrl: PropTypes.string,
      previewText: PropTypes.string,
      previewTitle: PropTypes.string,
      creatorName: PropTypes.string,
      mediaCount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    }),
  }),
  onOpen: PropTypes.func,
};

ChatSharedContentCard.defaultProps = {
  message: null,
  onOpen: undefined,
};

export default React.memo(ChatSharedContentCard);
