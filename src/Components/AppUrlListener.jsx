import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { useNavigate } from 'react-router-dom';

const SHARED_POST_PATH = /^\/p\/([^/?#]+)/i;
const SHARED_GALLERY_PATH = /^\/g\/([^/?#]+)/i;

const AppUrlListener = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let removeListener = null;

    const handleUrl = (incomingUrl) => {
      const rawUrl = String(incomingUrl || '').trim();
      if (!rawUrl) {
        return;
      }

      try {
        const parsed = new URL(rawUrl);
        const postMatch = parsed.pathname.match(SHARED_POST_PATH);
        const galleryMatch = parsed.pathname.match(SHARED_GALLERY_PATH);
        const postShareId = postMatch?.[1];
        const galleryShareId = galleryMatch?.[1];

        if (postShareId) {
          navigate(`/shared-post/${decodeURIComponent(postShareId)}`);
          return;
        }

        if (galleryShareId) {
          navigate(`/shared-gallery/${decodeURIComponent(galleryShareId)}`);
        }
      } catch {
        // Ignore malformed URLs.
      }
    };

    try {
      const maybePromise = CapacitorApp.addListener('appUrlOpen', ({ url }) => {
        handleUrl(url);
      });

      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then((handle) => {
          removeListener = () => handle?.remove?.();
        });
      } else {
        removeListener = () => maybePromise?.remove?.();
      }

      CapacitorApp.getLaunchUrl()
        .then((result) => {
          handleUrl(result?.url);
        })
        .catch(() => {
          // Ignore unavailable launch URL state.
        });
    } catch {
      // Ignore on unsupported platforms.
    }

    return () => {
      if (removeListener) {
        removeListener();
      }
    };
  }, [navigate]);

  return null;
};

export default AppUrlListener;
