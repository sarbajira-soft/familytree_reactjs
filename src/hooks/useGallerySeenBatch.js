import { useEffect, useRef } from "react";

import { authFetchResponse } from "../utils/authFetch";

const DEFAULT_BATCH_SIZE = 3;
const DEFAULT_FLUSH_INTERVAL_MS = 15000;
const DEFAULT_RETRY_DELAY_MS = 1000;

export default function useGallerySeenBatch({
  galleries,
  onMarkSeenLocal,
  batchSize = DEFAULT_BATCH_SIZE,
  flushIntervalMs = DEFAULT_FLUSH_INTERVAL_MS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
}) {
  const seenQueueRef = useRef(new Set());
  const seenIdsRef = useRef(new Set());
  const flushInFlightRef = useRef(false);
  const retryTimeoutRef = useRef(null);
  const flushTimeoutRef = useRef(null);

  useEffect(() => {
    (Array.isArray(galleries) ? galleries : []).forEach((gallery) => {
      const galleryId = Number(gallery?.id);
      if (!Number.isFinite(galleryId) || galleryId <= 0) {
        return;
      }

      if (gallery?.isSeen || gallery?.seen) {
        seenIdsRef.current.add(String(galleryId));
      }
    });
  }, [galleries]);

  const clearFlushTimeout = () => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
  };

  const scheduleFlush = () => {
    if (flushTimeoutRef.current || seenQueueRef.current.size === 0) {
      return;
    }

    flushTimeoutRef.current = setTimeout(() => {
      flushTimeoutRef.current = null;
      void flushSeenQueue();
    }, flushIntervalMs);
  };

  const flushSeenQueue = async ({ keepalive = false, retryAttempt = 0 } = {}) => {
    if (flushInFlightRef.current) {
      return;
    }

    const galleryIds = Array.from(seenQueueRef.current)
      .map((galleryId) => Number(galleryId))
      .filter((galleryId) => Number.isFinite(galleryId) && galleryId > 0);

    if (galleryIds.length === 0) {
      return;
    }

    clearFlushTimeout();
    seenQueueRef.current = new Set();
    flushInFlightRef.current = true;

    let shouldRetry = false;

    try {
      const response = await authFetchResponse("/gallery/seen-batch", {
        method: "POST",
        body: JSON.stringify({ galleryIds }),
        skipThrow: true,
        keepalive,
      });

      shouldRetry = !response.ok;
    } catch (_) {
      shouldRetry = true;
    } finally {
      flushInFlightRef.current = false;
    }

    if (shouldRetry) {
      galleryIds.forEach((galleryId) => {
        seenQueueRef.current.add(galleryId);
      });

      scheduleFlush();

      if (retryAttempt < 1 && !retryTimeoutRef.current) {
        retryTimeoutRef.current = setTimeout(() => {
          retryTimeoutRef.current = null;
          void flushSeenQueue({ retryAttempt: retryAttempt + 1 });
        }, retryDelayMs);
      }
      return;
    }

    if (seenQueueRef.current.size >= batchSize) {
      void flushSeenQueue();
      return;
    }

    scheduleFlush();
  };

  const queueSeenGallery = (galleryId) => {
    const normalizedGalleryId = Number(galleryId);
    if (!Number.isFinite(normalizedGalleryId) || normalizedGalleryId <= 0) {
      return;
    }

    const key = String(normalizedGalleryId);
    if (seenIdsRef.current.has(key)) {
      return;
    }

    seenIdsRef.current.add(key);
    seenQueueRef.current.add(normalizedGalleryId);

    if (typeof onMarkSeenLocal === "function") {
      onMarkSeenLocal(normalizedGalleryId);
    }

    if (seenQueueRef.current.size >= batchSize) {
      clearFlushTimeout();
      void flushSeenQueue();
      return;
    }

    scheduleFlush();
  };

  useEffect(() => {
    const flushOnExit = () => {
      if (seenQueueRef.current.size > 0) {
        void flushSeenQueue({ keepalive: true });
      }
    };

    window.addEventListener("beforeunload", flushOnExit);
    window.addEventListener("pagehide", flushOnExit);

    return () => {
      window.removeEventListener("beforeunload", flushOnExit);
      window.removeEventListener("pagehide", flushOnExit);
      flushOnExit();
    };
  }, []);

  useEffect(() => {
    return () => {
      clearFlushTimeout();
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []);

  return {
    queueSeenGallery,
    flushSeenQueue,
  };
}
