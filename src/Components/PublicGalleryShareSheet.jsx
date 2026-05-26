import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { FiCopy, FiMessageCircle, FiShare2, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import {
  buildPublicGalleryShareUrl,
  copyTextToClipboard,
} from '../utils/publicPostShare';
import ChatShareTargetModal from './Chat/ChatShareTargetModal';

const SHARE_COPY = {
  title: 'Familyss Gallery',
  text: 'Take a look at this public gallery on Familyss.',
};

const PublicGalleryShareSheet = ({ currentUserId, isOpen, gallery, onClose }) => {
  const [busyAction, setBusyAction] = useState('');
  const [shareToChatOpen, setShareToChatOpen] = useState(false);
  const isPublicShareable =
    String(gallery?.privacy || '').toLowerCase() === 'public' &&
    (Number(gallery?.id) > 0 || String(gallery?.publicShareId || '').trim());
  const isShareable = Number(gallery?.id) > 0;

  const shareLabel = useMemo(() => {
    if (busyAction === 'share') return 'Opening share options...';
    if (busyAction === 'copy') return 'Copying link...';
    return null;
  }, [busyAction]);

  if (!isOpen || !isShareable) {
    return null;
  }

  const shareItem = {
    shareType: 'gallery',
    entityId: Number(gallery?.id || 0),
    previewTitle: String(gallery?.galleryTitle || gallery?.title || 'Gallery').trim(),
    previewText: String(gallery?.galleryDescription || gallery?.description || '').trim(),
    previewMediaUrl: String(gallery?.coverPhoto || gallery?.coverImage || '').trim(),
    previewMediaKind: 'image',
  };

  const resolveShareLink = () => {
    const existingShareUrl = String(gallery?.shareUrl || '').trim();
    if (existingShareUrl) {
      return existingShareUrl;
    }

    const publicShareId = String(gallery?.publicShareId || '').trim();
    if (!publicShareId) {
      throw new Error('Share link is unavailable right now.');
    }

    return buildPublicGalleryShareUrl(publicShareId);
  };

  const handleCopyLink = async () => {
    setBusyAction('copy');
    try {
      const shareUrl = resolveShareLink();
      await copyTextToClipboard(shareUrl);
      toast.success('Link copied');
      onClose?.();
    } catch (error) {
      toast.error(error?.message || 'Unable to copy the link right now.');
    } finally {
      setBusyAction('');
    }
  };

  const handleNativeShare = async () => {
    setBusyAction('share');
    try {
      const shareUrl = resolveShareLink();

      if (!navigator?.share) {
        await copyTextToClipboard(shareUrl);
        toast.success('Link copied');
        onClose?.();
        return;
      }

      await navigator.share({
        title: SHARE_COPY.title,
        text: SHARE_COPY.text,
        url: shareUrl,
      });

      onClose?.();
    } catch (error) {
      if (error?.name === 'AbortError') {
        return;
      }

      toast.error(error?.message || 'Unable to share this gallery right now.');
    } finally {
      setBusyAction('');
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 backdrop-blur-sm px-4 pb-4"
        onClick={() => onClose?.()}
      >
        <div
          className="w-full max-w-md overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-5 pb-3 pt-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Share gallery</h3>
              <p className="text-sm text-gray-500">
                Share this gallery into chat, or use a public link when available.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onClose?.()}
              className="grid h-10 w-10 place-items-center rounded-full text-gray-500 hover:bg-gray-100"
              aria-label="Close share options"
            >
              <FiX size={18} />
            </button>
          </div>

          <div className="p-3">
            <button
              type="button"
              onClick={() => setShareToChatOpen(true)}
              disabled={!!busyAction}
              className="flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left hover:bg-gray-50 disabled:opacity-60"
            >
              <span className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-50 text-violet-600">
                  <FiMessageCircle size={18} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-gray-900">Share to Chat</span>
                  <span className="block text-xs text-gray-500">Send it inside Familyss chat</span>
                </span>
              </span>
            </button>

            {isPublicShareable ? (
              <button
                type="button"
                onClick={handleNativeShare}
                disabled={!!busyAction}
                className="flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left hover:bg-gray-50 disabled:opacity-60"
              >
                <span className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-600">
                    <FiShare2 size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-gray-900">Share Link</span>
                    <span className="block text-xs text-gray-500">Open the native share sheet</span>
                  </span>
                </span>
              </button>
            ) : null}

            {isPublicShareable ? (
              <button
                type="button"
                onClick={handleCopyLink}
                disabled={!!busyAction}
                className="flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left hover:bg-gray-50 disabled:opacity-60"
              >
                <span className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <FiCopy size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-gray-900">Copy Link</span>
                    <span className="block text-xs text-gray-500">Copy the secure public URL</span>
                  </span>
                </span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => onClose?.()}
              disabled={!!busyAction}
              className="mt-1 w-full rounded-2xl px-4 py-4 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>

          {shareLabel ? <div className="px-5 pb-4 text-xs text-gray-500">{shareLabel}</div> : null}
        </div>
      </div>
      <ChatShareTargetModal
        currentUserId={currentUserId}
        isOpen={shareToChatOpen}
        shareItem={shareItem}
        onClose={(result) => {
          setShareToChatOpen(false);
          if (result?.shared) {
            onClose?.();
          }
        }}
      />
    </>
  );
};

PublicGalleryShareSheet.propTypes = {
  currentUserId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  isOpen: PropTypes.bool,
  gallery: PropTypes.shape({
    coverImage: PropTypes.string,
    coverPhoto: PropTypes.string,
    description: PropTypes.string,
    galleryDescription: PropTypes.string,
    galleryTitle: PropTypes.string,
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    privacy: PropTypes.string,
    publicShareId: PropTypes.string,
    shareUrl: PropTypes.string,
    title: PropTypes.string,
  }),
  onClose: PropTypes.func,
};

PublicGalleryShareSheet.defaultProps = {
  currentUserId: null,
  isOpen: false,
  gallery: null,
  onClose: undefined,
};

export default PublicGalleryShareSheet;
