import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { FiCopy, FiShare2, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import {
  buildPublicPostShareUrl,
  copyTextToClipboard,
} from '../utils/publicPostShare';

const SHARE_COPY = {
  title: 'Familyss Post',
  text: 'Take a look at this public post on Familyss.',
};

const PublicPostShareSheet = ({ isOpen, post, onClose }) => {
  const [busyAction, setBusyAction] = useState('');
  const isShareable = String(post?.privacy || '').toLowerCase() === 'public' && Number(post?.id) > 0;

  const shareLabel = useMemo(() => {
    if (busyAction === 'share') return 'Opening share options...';
    if (busyAction === 'copy') return 'Copying link...';
    return null;
  }, [busyAction]);

  if (!isOpen || !isShareable) {
    return null;
  }

  const resolveShareLink = () => {
    const existingShareUrl = String(post?.shareUrl || '').trim();
    if (existingShareUrl) {
      return existingShareUrl;
    }

    const publicShareId = String(post?.publicShareId || '').trim();
    if (!publicShareId) {
      throw new Error('Share link is unavailable right now.');
    }

    return buildPublicPostShareUrl(publicShareId);
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

      toast.error(error?.message || 'Unable to share this post right now.');
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 backdrop-blur-sm px-4 pb-4"
      onClick={() => onClose?.()}
    >
      <div
        className="w-full max-w-md rounded-[28px] bg-white shadow-2xl border border-gray-200 overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Share post</h3>
            <p className="text-sm text-gray-500">Only public posts can be shared outside the app.</p>
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="h-10 w-10 grid place-items-center rounded-full text-gray-500 hover:bg-gray-100"
            aria-label="Close share options"
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={handleNativeShare}
            disabled={!!busyAction}
            className="w-full flex items-center justify-between rounded-2xl px-4 py-4 text-left hover:bg-gray-50 disabled:opacity-60"
          >
            <span className="flex items-center gap-3">
              <span className="h-11 w-11 grid place-items-center rounded-2xl bg-blue-50 text-blue-600">
                <FiShare2 size={18} />
              </span>
              <span>
                <span className="block text-sm font-semibold text-gray-900">Share Link</span>
                <span className="block text-xs text-gray-500">Open the native share sheet</span>
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            disabled={!!busyAction}
            className="w-full flex items-center justify-between rounded-2xl px-4 py-4 text-left hover:bg-gray-50 disabled:opacity-60"
          >
            <span className="flex items-center gap-3">
              <span className="h-11 w-11 grid place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                <FiCopy size={18} />
              </span>
              <span>
                <span className="block text-sm font-semibold text-gray-900">Copy Link</span>
                <span className="block text-xs text-gray-500">Copy the secure public URL</span>
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => onClose?.()}
            disabled={!!busyAction}
            className="mt-1 w-full rounded-2xl px-4 py-4 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
        </div>

        {shareLabel ? (
          <div className="px-5 pb-4 text-xs text-gray-500">{shareLabel}</div>
        ) : null}
      </div>
    </div>
  );
};

PublicPostShareSheet.propTypes = {
  isOpen: PropTypes.bool,
  post: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    privacy: PropTypes.string,
    publicShareId: PropTypes.string,
    shareUrl: PropTypes.string,
  }),
  onClose: PropTypes.func,
};

PublicPostShareSheet.defaultProps = {
  isOpen: false,
  post: null,
  onClose: undefined,
};

export default PublicPostShareSheet;
