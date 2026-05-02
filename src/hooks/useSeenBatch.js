import { useEffect, useRef } from "react";

import { authFetchResponse } from "../utils/authFetch";

const DEFAULT_BATCH_SIZE = 5;
const DEFAULT_FLUSH_INTERVAL_MS = 10000;
const DEFAULT_RETRY_DELAY_MS = 1000;
const DEFAULT_INTERSECTION_THRESHOLD = 0.6;

export default function useSeenBatch({
  posts,
  onMarkSeenLocal,
  batchSize = DEFAULT_BATCH_SIZE,
  flushIntervalMs = DEFAULT_FLUSH_INTERVAL_MS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  intersectionThreshold = DEFAULT_INTERSECTION_THRESHOLD,
}) {
  const postsRef = useRef(Array.isArray(posts) ? posts : []);
  const observerRef = useRef(null);
  const targetElementsRef = useRef({});
  const visibilityTimersRef = useRef(new Map());
  const seenQueueRef = useRef(new Set());
  const seenIdsRef = useRef(new Set());
  const flushInFlightRef = useRef(false);
  const retryTimeoutRef = useRef(null);

  useEffect(() => {
    postsRef.current = Array.isArray(posts) ? posts : [];
  }, [posts]);

  const clearVisibilityTimer = (postId) => {
    const key = String(postId);
    const existingTimeout = visibilityTimersRef.current.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      visibilityTimersRef.current.delete(key);
    }
  };

  const flushSeenQueue = async ({ keepalive = false, retryAttempt = 0 } = {}) => {
    if (flushInFlightRef.current) {
      return;
    }

    const postIds = Array.from(seenQueueRef.current)
      .map((postId) => Number(postId))
      .filter((postId) => Number.isFinite(postId) && postId > 0);

    if (postIds.length === 0) {
      return;
    }

    seenQueueRef.current = new Set();
    flushInFlightRef.current = true;

    let shouldRetry = false;

    try {
      const response = await authFetchResponse("/posts/seen-batch", {
        method: "POST",
        body: JSON.stringify({ postIds }),
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
      postIds.forEach((postId) => {
        seenQueueRef.current.add(postId);
      });

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
    }
  };

  const queueSeenPost = (postId) => {
    const normalizedPostId = Number(postId);
    if (!Number.isFinite(normalizedPostId) || normalizedPostId <= 0) {
      return;
    }

    const key = String(normalizedPostId);
    if (seenIdsRef.current.has(key)) {
      return;
    }

    seenIdsRef.current.add(key);
    seenQueueRef.current.add(normalizedPostId);
    if (typeof onMarkSeenLocal === "function") {
      onMarkSeenLocal(normalizedPostId);
    }

    if (seenQueueRef.current.size >= batchSize) {
      void flushSeenQueue();
    }
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (seenQueueRef.current.size > 0) {
        void flushSeenQueue();
      }
    }, flushIntervalMs);

    return () => {
      clearInterval(intervalId);
    };
  }, [flushIntervalMs]);

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
    if (observerRef.current) {
      try {
        observerRef.current.disconnect();
      } catch {}
    }

    for (const timeoutId of visibilityTimersRef.current.values()) {
      clearTimeout(timeoutId);
    }
    visibilityTimersRef.current.clear();

    if (!postsRef.current.length) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const postId = entry?.target?.dataset?.postid;
          if (!postId) {
            return;
          }

          const matchedPost = postsRef.current.find(
            (post) => String(post?.id) === String(postId),
          );
          if (!matchedPost || matchedPost.seen || seenIdsRef.current.has(String(postId))) {
            clearVisibilityTimer(postId);
            return;
          }

          if (entry.isIntersecting && entry.intersectionRatio >= intersectionThreshold) {
            if (!visibilityTimersRef.current.has(String(postId))) {
              const delayMs = matchedPost.postVideo ? 5000 : 2000;
              const timeoutId = setTimeout(() => {
                visibilityTimersRef.current.delete(String(postId));
                queueSeenPost(Number(postId));
              }, delayMs);
              visibilityTimersRef.current.set(String(postId), timeoutId);
            }
            return;
          }

          clearVisibilityTimer(postId);
        });
      },
      {
        threshold: [intersectionThreshold],
        rootMargin: "0px 0px -15% 0px",
      },
    );

    observerRef.current = observer;

    Object.values(targetElementsRef.current || {}).forEach((element) => {
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      try {
        observer.disconnect();
      } catch {}
      for (const timeoutId of visibilityTimersRef.current.values()) {
        clearTimeout(timeoutId);
      }
      visibilityTimersRef.current.clear();
    };
  }, [posts, intersectionThreshold]);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []);

  const registerSeenTarget = (postId) => (element) => {
    const key = String(postId);

    if (!element) {
      delete targetElementsRef.current[key];
      clearVisibilityTimer(key);
      return;
    }

    targetElementsRef.current[key] = element;
    if (observerRef.current) {
      observerRef.current.observe(element);
    }
  };

  return {
    registerSeenTarget,
    flushSeenQueue,
  };
}
