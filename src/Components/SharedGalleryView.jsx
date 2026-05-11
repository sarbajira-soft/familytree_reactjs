import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Capacitor } from '@capacitor/core';
import EmojiPicker from 'emoji-picker-react';
import {
  FaChevronLeft,
  FaChevronRight,
  FaCommentDots,
  FaHeart,
  FaRegHeart,
  FaTimes,
} from 'react-icons/fa';
import { FiArrowLeft, FiExternalLink, FiSend, FiSmile } from 'react-icons/fi';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useUser } from '../Contexts/UserContext';
import { getToken } from '../utils/auth';
import { authFetchResponse } from '../utils/authFetch';
import { buildCommentTree } from '../utils/commentUtils';
import { buildPublicGalleryShareUrl } from '../utils/publicPostShare';
import AuthPromptModal from './AuthPromptModal';
import ContentUnavailableState from './ContentUnavailableState';

const DEFAULT_AVATAR = '/assets/user.png';

const SharedGalleryView = ({ context }) => {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { userInfo } = useUser();
  const articleRef = useRef(null);
  const commentInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const seenObserverRef = useRef(null);
  const seenTimeoutRef = useRef(null);
  const [gallery, setGallery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isSeen, setIsSeen] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentRows, setCommentRows] = useState([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const isAuthenticated = Boolean(getToken());
  const isNative = Capacitor.isNativePlatform();

  const images = Array.isArray(gallery?.images) ? gallery.images : [];
  const comments = useMemo(() => buildCommentTree(commentRows), [commentRows]);

  const openAuthPrompt = () => setShowAuthPrompt(true);
  const closeAuthPrompt = () => setShowAuthPrompt(false);

  const goToFeed = () => {
    navigate(isAuthenticated ? '/family-gallery' : '/');
  };

  const goToUserProfile = (targetUserId) => {
    if (!targetUserId) {
      return;
    }

    if (!isAuthenticated) {
      openAuthPrompt();
      return;
    }

    if (Number(targetUserId) === Number(userInfo?.userId)) {
      navigate('/myprofile');
      return;
    }

    navigate(`/user/${targetUserId}`);
  };

  const fetchPublicGallery = async () => {
    setLoading(true);
    setUnavailable(false);

    try {
      const response = await authFetchResponse(`/public/galleries/${shareId}`, {
        method: 'GET',
        skipThrow: true,
      });

      if (response.status === 404) {
        setUnavailable(true);
        setGallery(null);
        return;
      }

      if (!response.ok) {
        throw new Error('Unable to load this gallery right now.');
      }

      const data = await response.json();
      setGallery({
        ...data,
        likeCount: Number(data?.likeCount || 0),
        commentCount: Number(data?.commentCount || 0),
        imageCount: Number(data?.imageCount || 0),
        images: Array.isArray(data?.images) ? data.images : [],
      });
    } catch (error) {
      toast.error(error?.message || 'Unable to load this gallery right now.');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    if (!isAuthenticated) {
      return;
    }

    setCommentsLoading(true);
    try {
      const response = await authFetchResponse(`/public/galleries/${shareId}/comments`, {
        method: 'GET',
        skipThrow: true,
      });

      if (response.status === 404) {
        setUnavailable(true);
        setGallery(null);
        return;
      }

      if (!response.ok) {
        throw new Error('Unable to load comments right now.');
      }

      const data = await response.json();
      setCommentRows(Array.isArray(data?.comments) ? data.comments : []);
      setCommentsLoaded(true);
    } catch (error) {
      toast.error(error?.message || 'Unable to load comments right now.');
    } finally {
      setCommentsLoading(false);
    }
  };

  const fetchInteractionState = async () => {
    if (!isAuthenticated) {
      setIsLiked(false);
      setIsSeen(false);
      return;
    }

    try {
      const response = await authFetchResponse(`/public/galleries/${shareId}/state`, {
        method: 'GET',
        skipThrow: true,
      });

      if (response.status === 404) {
        setUnavailable(true);
        setGallery(null);
        return;
      }

      if (!response.ok) {
        throw new Error('Unable to load your gallery actions right now.');
      }

      const data = await response.json();
      setIsLiked(Boolean(data?.isLiked));
      setIsSeen(Boolean(data?.isSeen));
      setGallery((prev) =>
        prev
          ? {
              ...prev,
              likeCount: Number(data?.likeCount ?? prev.likeCount ?? 0),
              commentCount: Number(data?.commentCount ?? prev.commentCount ?? 0),
            }
          : prev,
      );
    } catch (error) {
      toast.error(error?.message || 'Unable to load your gallery actions right now.');
    }
  };

  useEffect(() => {
    setCommentRows([]);
    setCommentsLoaded(false);
    setShowComments(false);
    setShowEmojiPicker(false);
    setCommentDraft('');
    setCurrentImageIndex(0);
    setSelectedImageIndex(null);
    setIsSeen(false);
    fetchPublicGallery();
  }, [shareId]);

  useEffect(() => {
    if (!loading && !unavailable && shareId && isAuthenticated) {
      fetchInteractionState();
    }
  }, [isAuthenticated, loading, shareId, unavailable]);

  useEffect(() => {
    const handleClickOutsideEmoji = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutsideEmoji);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutsideEmoji);
    };
  }, [showEmojiPicker]);

  useEffect(() => {
    if (!isAuthenticated || loading || unavailable || !gallery || isSeen) {
      if (seenObserverRef.current) {
        seenObserverRef.current.disconnect();
        seenObserverRef.current = null;
      }
      if (seenTimeoutRef.current) {
        clearTimeout(seenTimeoutRef.current);
        seenTimeoutRef.current = null;
      }
      return undefined;
    }

    const target = articleRef.current;
    if (!target) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (entry?.isIntersecting && entry.intersectionRatio >= 0.6) {
          if (!seenTimeoutRef.current) {
            seenTimeoutRef.current = window.setTimeout(async () => {
              seenTimeoutRef.current = null;
              try {
                const response = await authFetchResponse(`/public/galleries/${shareId}/seen`, {
                  method: 'POST',
                  skipThrow: true,
                });

                if (response.ok) {
                  setIsSeen(true);
                }
              } catch {
                return;
              }
            }, 2500);
          }
          return;
        }

        if (seenTimeoutRef.current) {
          clearTimeout(seenTimeoutRef.current);
          seenTimeoutRef.current = null;
        }
      },
      {
        threshold: [0.6],
        rootMargin: '0px 0px -15% 0px',
      },
    );

    observer.observe(target);
    seenObserverRef.current = observer;

    return () => {
      observer.disconnect();
      seenObserverRef.current = null;
      if (seenTimeoutRef.current) {
        clearTimeout(seenTimeoutRef.current);
        seenTimeoutRef.current = null;
      }
    };
  }, [gallery, isAuthenticated, isSeen, loading, shareId, unavailable]);

  const shareUrl = useMemo(() => {
    const safeUrl = String(gallery?.shareUrl || '').trim();
    if (safeUrl) {
      return safeUrl;
    }

    try {
      return buildPublicGalleryShareUrl(shareId);
    } catch {
      return '';
    }
  }, [gallery?.shareUrl, shareId]);

  const canOpenInApp = Boolean(!isAuthenticated && !isNative && context === 'web' && shareUrl);
  const createdAtLabel = gallery?.createdAt ? new Date(gallery.createdAt).toLocaleString() : '';

  const handleLike = async () => {
    if (!isAuthenticated) {
      openAuthPrompt();
      return;
    }

    if (likeBusy || !gallery) {
      return;
    }

    const previousLiked = isLiked;
    const previousLikeCount = Number(gallery.likeCount || 0);
    const nextLiked = !previousLiked;
    const nextLikeCount = nextLiked ? previousLikeCount + 1 : Math.max(previousLikeCount - 1, 0);

    setLikeBusy(true);
    setIsLiked(nextLiked);
    setGallery((prev) =>
      prev
        ? {
            ...prev,
            likeCount: nextLikeCount,
          }
        : prev,
    );

    try {
      const response = await authFetchResponse(`/public/galleries/${shareId}/like-toggle`, {
        method: 'POST',
        skipThrow: true,
      });

      if (response.status === 404) {
        setUnavailable(true);
        setGallery(null);
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Unable to update your like right now.');
      }

      setIsLiked(Boolean(data?.liked));
      setGallery((prev) =>
        prev
          ? {
              ...prev,
              likeCount: Number(data?.totalLikes || 0),
            }
          : prev,
      );
    } catch (error) {
      setIsLiked(previousLiked);
      setGallery((prev) =>
        prev
          ? {
              ...prev,
              likeCount: previousLikeCount,
            }
          : prev,
      );
      toast.error(error?.message || 'Unable to update your like right now.');
    } finally {
      setLikeBusy(false);
    }
  };

  const handleCommentButton = async () => {
    if (!isAuthenticated) {
      openAuthPrompt();
      return;
    }

    const nextShowComments = !showComments;
    setShowComments(nextShowComments);

    if (!nextShowComments) {
      setShowEmojiPicker(false);
      return;
    }

    if (!commentsLoaded) {
      await fetchComments();
    }

    window.setTimeout(() => {
      commentInputRef.current?.focus?.();
    }, 0);
  };

  const handleSubmitComment = async () => {
    const trimmed = String(commentDraft || '').trim();
    if (!trimmed) {
      return;
    }

    if (!isAuthenticated) {
      openAuthPrompt();
      return;
    }

    setCommentBusy(true);
    try {
      const response = await authFetchResponse(`/public/galleries/${shareId}/comment`, {
        method: 'POST',
        skipThrow: true,
        body: JSON.stringify({ comment: trimmed }),
      });

      if (response.status === 404) {
        setUnavailable(true);
        setGallery(null);
        return;
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || 'Unable to post your comment right now.');
      }

      setCommentDraft('');
      setShowEmojiPicker(false);
      setCommentsLoaded(true);
      setGallery((prev) =>
        prev
          ? {
              ...prev,
              commentCount: Number(prev.commentCount || 0) + 1,
            }
          : prev,
      );
      await fetchComments();
    } catch (error) {
      toast.error(error?.message || 'Unable to post your comment right now.');
    } finally {
      setCommentBusy(false);
    }
  };

  const handleEmojiClick = (emojiData) => {
    const { emoji } = emojiData;
    const inputEl = commentInputRef.current;
    const currentValue = commentDraft || '';

    if (!inputEl) {
      setCommentDraft((prev) => `${prev || ''}${emoji}`);
      return;
    }

    const start = inputEl.selectionStart ?? currentValue.length;
    const end = inputEl.selectionEnd ?? start;
    const before = currentValue.substring(0, start);
    const after = currentValue.substring(end);
    const updated = before + emoji + after;

    setCommentDraft(updated);

    window.setTimeout(() => {
      const el = commentInputRef.current;
      if (!el) {
        return;
      }
      const caretPosition = start + emoji.length;
      el.focus();
      el.setSelectionRange(caretPosition, caretPosition);
    }, 0);
  };

  const handleImageClick = (index) => {
    if (!isAuthenticated) {
      return;
    }

    setSelectedImageIndex(index);
  };

  const handleLogin = () => {
    closeAuthPrompt();
    navigate('/login', {
      state: {
        from: `${location.pathname}${location.search || ''}`,
      },
    });
  };

  const handleRegister = () => {
    closeAuthPrompt();
    navigate('/register', {
      state: {
        from: `${location.pathname}${location.search || ''}`,
      },
    });
  };

  const showPrevImage = () => {
    if (!images.length) {
      return;
    }
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const showNextImage = () => {
    if (!images.length) {
      return;
    }
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const showPrevFullscreenImage = () => {
    if (!images.length || selectedImageIndex === null) {
      return;
    }
    setSelectedImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const showNextFullscreenImage = () => {
    if (!images.length || selectedImageIndex === null) {
      return;
    }
    setSelectedImageIndex((prev) => (prev + 1) % images.length);
  };

  const renderCommentNode = (comment, depth = 0) => {
    const fullName = `${comment?.user?.firstName || 'Familyss'} ${comment?.user?.lastName || 'User'}`.trim();
    const profileImage = comment?.user?.profile || DEFAULT_AVATAR;

    return (
      <div key={comment.id} className={depth > 0 ? 'ml-8 border-l border-gray-100 pl-4' : ''}>
        <div className="flex items-start gap-3 rounded-2xl bg-gray-50 px-3 py-3">
          <button
            type="button"
            onClick={() => goToUserProfile(comment?.user?.userId || comment?.userId)}
            className="bg-transparent p-0"
          >
            <img
              src={profileImage}
              alt={fullName}
              className="h-9 w-9 rounded-full border object-cover"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = DEFAULT_AVATAR;
              }}
            />
          </button>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => goToUserProfile(comment?.user?.userId || comment?.userId)}
              className="bg-transparent p-0 text-left text-sm font-semibold text-gray-900"
            >
              {fullName}
            </button>
            <p className="mt-1 text-sm text-gray-700">{comment.comment || comment.content || ''}</p>
            <p className="mt-1 text-xs text-gray-400">
              {comment?.createdAt ? new Date(comment.createdAt).toLocaleString() : ''}
            </p>
          </div>
        </div>
        {Array.isArray(comment?.replies) && comment.replies.length > 0 ? (
          <div className="mt-3 space-y-3">
            {comment.replies.map((reply) => renderCommentNode(reply, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-6 sm:py-8">
        <div className="mx-auto max-w-3xl animate-pulse">
          <div className="mb-4 h-10 w-28 rounded-full bg-gray-200" />
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 p-3">
              <div className="h-10 w-10 rounded-full bg-gray-200" />
              <div className="space-y-2">
                <div className="h-4 w-40 rounded bg-gray-200" />
                <div className="h-3 w-28 rounded bg-gray-100" />
              </div>
            </div>
            <div className="mx-4 mb-3 h-4 w-2/3 rounded bg-gray-100" />
            <div className="h-72 bg-gray-100" />
            <div className="px-4 py-4">
              <div className="h-10 w-full rounded-xl bg-gray-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (unavailable || !gallery) {
    return (
      <ContentUnavailableState
        title="This content is unavailable"
        description="The gallery may have been removed, deleted or is no longer public."
        action={
          <button
            type="button"
            onClick={goToFeed}
            className="mt-6 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {isAuthenticated ? 'Go to gallery feed' : 'Go to home'}
          </button>
        }
      />
    );
  }

  const activeImage = images[currentImageIndex] || null;
  const fullscreenImage =
    selectedImageIndex !== null && selectedImageIndex >= 0 ? images[selectedImageIndex] : null;

  return (
    <>
      <div className="min-h-screen bg-gray-50 px-4 py-6 sm:py-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goToFeed}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-100"
            >
              <FiArrowLeft size={16} />
              Back
            </button>

            {canOpenInApp ? (
              <button
                type="button"
                onClick={() => window.location.assign(shareUrl)}
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                Open in App
                <FiExternalLink size={16} />
              </button>
            ) : null}
          </div>

          <article
            ref={articleRef}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white pb-3 shadow-sm"
          >
            <div className="flex items-center justify-between p-4">
              <button
                type="button"
                onClick={() => goToUserProfile(gallery?.creator?.userId)}
                className="flex items-center gap-3 bg-transparent p-0 text-left"
              >
                <img
                  src={gallery?.creator?.profileImage || DEFAULT_AVATAR}
                  alt={gallery?.creator?.displayName || 'Familyss User'}
                  className="h-10 w-10 rounded-full border object-cover"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = DEFAULT_AVATAR;
                  }}
                />
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {gallery?.creator?.displayName || 'Familyss User'}
                  </p>
                  <p className="text-xs text-gray-500">{createdAtLabel}</p>
                </div>
              </button>

              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                Public
              </span>
            </div>

            <div className="px-4 pb-3">
              <h1 className="text-xl font-semibold text-gray-900">{gallery?.galleryTitle || 'Album'}</h1>
              {gallery?.galleryDescription ? (
                <p className="mt-2 text-sm text-gray-700">{gallery.galleryDescription}</p>
              ) : null}
            </div>

            <div className="relative bg-black">
              {activeImage ? (
                <button
                  type="button"
                  onClick={() => handleImageClick(currentImageIndex)}
                  className="block w-full bg-black p-0"
                >
                  <img
                    src={activeImage.url}
                    alt={activeImage.caption || gallery?.galleryTitle || 'Shared gallery'}
                    className={`max-h-[65vh] w-full object-contain ${isAuthenticated ? 'cursor-pointer' : ''}`}
                  />
                </button>
              ) : (
                <div className="flex h-72 items-center justify-center text-sm text-white/80">
                  No photos available for this gallery.
                </div>
              )}

              {images.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={showPrevImage}
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white shadow-lg"
                  >
                    <FaChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={showNextImage}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white shadow-lg"
                  >
                    <FaChevronRight size={18} />
                  </button>
                  <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
                    {images.map((image, index) => (
                      <button
                        key={image.id || `image-${index}`}
                        type="button"
                        onClick={() => setCurrentImageIndex(index)}
                        className={`h-2.5 w-2.5 rounded-full ${
                          index === currentImageIndex ? 'bg-white' : 'bg-white/45'
                        }`}
                        aria-label={`Go to image ${index + 1}`}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            <div className="flex items-center gap-8 px-4 pt-3 pb-1">
              <button
                type="button"
                onClick={handleLike}
                disabled={likeBusy}
                className="flex items-center gap-2 bg-white text-gray-700 transition-colors duration-200 hover:text-secondary-600 disabled:opacity-60"
              >
                {isLiked ? (
                  <FaHeart size={20} className="text-secondary-600" />
                ) : (
                  <FaRegHeart size={20} />
                )}
                <span className="text-sm">{gallery.likeCount}</span>
              </button>

              <button
                type="button"
                onClick={handleCommentButton}
                className="flex items-center gap-2 bg-white text-gray-700 transition-colors duration-200 hover:text-blue-600"
              >
                <FaCommentDots size={19} />
                <span className="text-sm">{gallery.commentCount}</span>
              </button>

              {/* <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  isSeen ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {isSeen ? 'Seen' : 'Unseen'}
              </span> */}
            </div>

            <div className="px-4 pt-2 text-xs text-gray-500">
              {gallery.imageCount} {gallery.imageCount === 1 ? 'photo' : 'photos'}
            </div>

            {!isAuthenticated ? (
              <div className="px-4 pt-2 text-xs text-gray-500">
                Log in to like and comment on this gallery
              </div>
            ) : null}

            {showComments ? (
              <div className="mt-2 border-t border-gray-100 px-4 pb-4 animate-fadeIn">
                <div className="w-full">
                  <div className="flex flex-col">
                    <h3 className="mt-3 mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
                      <FaCommentDots size={19} className="text-gray-600" />
                      Comments ({gallery.commentCount})
                    </h3>

                    <div className="max-h-[45vh] space-y-3 overflow-y-auto overflow-x-hidden custom-scrollbar">
                      {commentsLoading ? (
                        <p className="rounded-2xl bg-gray-50 px-4 py-5 text-sm text-gray-500">
                          Loading comments...
                        </p>
                      ) : comments.length ? (
                        comments.map((comment) => renderCommentNode(comment))
                      ) : (
                        <p className="rounded-2xl bg-gray-50 px-4 py-5 text-sm text-gray-500">
                          Be the first to leave a comment.
                        </p>
                      )}
                    </div>

                    <div className="relative mt-4">
                      <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
                        <button
                          type="button"
                          onClick={() => setShowEmojiPicker((prev) => !prev)}
                          className="grid h-9 w-9 place-items-center rounded-full text-primary-500 transition-colors hover:bg-gray-100"
                        >
                          <FiSmile size={18} />
                        </button>
                        <input
                          ref={commentInputRef}
                          type="text"
                          value={commentDraft}
                          onChange={(event) => setCommentDraft(event.target.value)}
                          placeholder="Add a comment..."
                          maxLength={100}
                          className="flex-1 bg-transparent text-sm placeholder-gray-400 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleSubmitComment}
                          disabled={!commentDraft.trim() || commentBusy}
                          className="grid h-9 w-9 place-items-center rounded-full text-primary-500 transition-colors hover:bg-primary-500 hover:text-white disabled:opacity-40"
                        >
                          {commentBusy ? (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                          ) : (
                            <FiSend size={17} />
                          )}
                        </button>
                      </div>

                      {showEmojiPicker ? (
                        <div
                          ref={emojiPickerRef}
                          className="absolute left-0 bottom-14 z-30 overflow-hidden rounded-2xl bg-white shadow-2xl"
                        >
                          <EmojiPicker
                            onEmojiClick={handleEmojiClick}
                            width={300}
                            height={350}
                            previewConfig={{ showPreview: false }}
                            searchDisabled
                            skinTonesDisabled
                            lazyLoadEmojis
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </article>
        </div>
      </div>

      {fullscreenImage ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 px-4"
          onClick={() => setSelectedImageIndex(null)}
        >
          <div
            className="relative flex h-full w-full max-w-6xl items-center justify-center"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedImageIndex(null)}
              className="absolute right-4 top-4 z-10 rounded-full bg-white/90 p-3 text-gray-800 shadow-lg hover:bg-white"
            >
              <FaTimes size={20} />
            </button>

            {images.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={showPrevFullscreenImage}
                  className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white shadow-lg"
                >
                  <FaChevronLeft size={22} />
                </button>
                <button
                  type="button"
                  onClick={showNextFullscreenImage}
                  className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white shadow-lg"
                >
                  <FaChevronRight size={22} />
                </button>
              </>
            ) : null}

            <img
              src={fullscreenImage.url}
              alt={fullscreenImage.caption || gallery?.galleryTitle || 'Shared gallery image'}
              className="max-h-[90vh] max-w-full object-contain"
            />
          </div>
        </div>
      ) : null}

      <AuthPromptModal
        isOpen={showAuthPrompt}
        onClose={closeAuthPrompt}
        onLogin={handleLogin}
        onRegister={handleRegister}
        contentLabel="gallery"
      />
    </>
  );
};

SharedGalleryView.propTypes = {
  context: PropTypes.oneOf(['web', 'app']),
};

SharedGalleryView.defaultProps = {
  context: 'web',
};

export default SharedGalleryView;
