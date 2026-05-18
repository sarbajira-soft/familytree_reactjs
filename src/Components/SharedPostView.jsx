import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Capacitor } from '@capacitor/core';
import EmojiPicker from 'emoji-picker-react';
import { FaCommentDots, FaHeart, FaRegHeart, FaTimes } from 'react-icons/fa';
import { FiArrowLeft, FiExternalLink, FiSend, FiSmile } from 'react-icons/fi';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useUser } from '../Contexts/UserContext';
import { getToken } from '../utils/auth';
import { authFetchResponse } from '../utils/authFetch';
import { buildPublicPostShareUrl } from '../utils/publicPostShare';
import AuthPromptModal from './AuthPromptModal';
import ContentUnavailableState from './ContentUnavailableState';

const DEFAULT_AVATAR = '/assets/user.png';

const SharedPostView = ({ context }) => {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { userInfo } = useUser();
  const articleRef = useRef(null);
  const commentInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const seenObserverRef = useRef(null);
  const seenTimeoutRef = useRef(null);
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isSeen, setIsSeen] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [comments, setComments] = useState([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const isAuthenticated = Boolean(getToken());
  const isNative = Capacitor.isNativePlatform();

  const openAuthPrompt = () => setShowAuthPrompt(true);
  const closeAuthPrompt = () => setShowAuthPrompt(false);

  const goToFeed = () => {
    navigate(isAuthenticated ? '/dashboard' : '/');
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

  const fetchPublicPost = async () => {
    setLoading(true);
    setUnavailable(false);

    try {
      const response = await authFetchResponse(`/public/posts/${shareId}`, {
        method: 'GET',
        skipThrow: true,
      });

      if (response.status === 404) {
        setUnavailable(true);
        setPost(null);
        return;
      }

      if (!response.ok) {
        throw new Error('Unable to load this post right now.');
      }

      const data = await response.json();
      setPost({
        ...data,
        likeCount: Number(data?.likeCount || 0),
        commentCount: Number(data?.commentCount || 0),
      });
    } catch (error) {
      toast.error(error?.message || 'Unable to load this post right now.');
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
      const response = await authFetchResponse(`/public/posts/${shareId}/comments`, {
        method: 'GET',
        skipThrow: true,
      });

      if (response.status === 404) {
        setUnavailable(true);
        setPost(null);
        return;
      }

      if (!response.ok) {
        throw new Error('Unable to load comments right now.');
      }

      const data = await response.json();
      setComments(Array.isArray(data?.comments) ? data.comments : []);
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
      const response = await authFetchResponse(`/public/posts/${shareId}/state`, {
        method: 'GET',
        skipThrow: true,
      });

      if (response.status === 404) {
        setUnavailable(true);
        setPost(null);
        return;
      }

      if (!response.ok) {
        throw new Error('Unable to load your post actions right now.');
      }

      const data = await response.json();
      setIsLiked(Boolean(data?.isLiked));
      setIsSeen(Boolean(data?.isSeen));
      setPost((prev) =>
        prev
          ? {
              ...prev,
              likeCount: Number(data?.likeCount ?? prev.likeCount ?? 0),
              commentCount: Number(data?.commentCount ?? prev.commentCount ?? 0),
            }
          : prev,
      );
    } catch (error) {
      toast.error(error?.message || 'Unable to load your post actions right now.');
    }
  };

  useEffect(() => {
    setComments([]);
    setCommentsLoaded(false);
    setShowComments(false);
    setShowEmojiPicker(false);
    setCommentDraft('');
    setSelectedMedia(null);
    setIsSeen(false);
    fetchPublicPost();
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
    if (!isAuthenticated || loading || unavailable || !post || isSeen) {
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

    const hasVideo = Array.isArray(post?.media) && post.media.some((item) => item?.type === 'video');
    const seenDelayMs = hasVideo ? 5000 : 2000;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (entry?.isIntersecting && entry.intersectionRatio >= 0.6) {
          if (!seenTimeoutRef.current) {
            seenTimeoutRef.current = window.setTimeout(async () => {
              seenTimeoutRef.current = null;
              try {
                const response = await authFetchResponse(`/public/posts/${shareId}/seen`, {
                  method: 'POST',
                  skipThrow: true,
                });

                if (response.ok) {
                  setIsSeen(true);
                }
              } catch {
                return;
              }
            }, seenDelayMs);
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
  }, [isAuthenticated, isSeen, loading, post, shareId, unavailable]);

  const shareUrl = useMemo(() => {
    const safeUrl = String(post?.shareUrl || '').trim();
    if (safeUrl) {
      return safeUrl;
    }

    try {
      return buildPublicPostShareUrl(shareId);
    } catch {
      return '';
    }
  }, [post?.shareUrl, shareId]);

  const canOpenInApp = Boolean(!isAuthenticated && !isNative && context === 'web' && shareUrl);
  const createdAtLabel = post?.createdAt ? new Date(post.createdAt).toLocaleString() : '';

  const handleLike = async () => {
    if (!isAuthenticated) {
      openAuthPrompt();
      return;
    }

    if (likeBusy || !post) {
      return;
    }

    const previousLiked = isLiked;
    const previousLikeCount = Number(post.likeCount || 0);
    const nextLiked = !previousLiked;
    const nextLikeCount = nextLiked ? previousLikeCount + 1 : Math.max(previousLikeCount - 1, 0);

    setLikeBusy(true);
    if (nextLiked) {
      setShowHeart(true);
      window.setTimeout(() => setShowHeart(false), 1000);
    }

    setIsLiked(nextLiked);
    setPost((prev) =>
      prev
        ? {
            ...prev,
            likeCount: nextLikeCount,
          }
        : prev,
    );

    try {
      const response = await authFetchResponse(`/public/posts/${shareId}/like-toggle`, {
        method: 'POST',
        skipThrow: true,
      });

      if (response.status === 404) {
        setUnavailable(true);
        setPost(null);
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Unable to update your like right now.');
      }

      setIsLiked(Boolean(data?.liked));
      setPost((prev) =>
        prev
          ? {
              ...prev,
              likeCount: Number(data?.totalLikes || 0),
            }
          : prev,
      );
    } catch (error) {
      setIsLiked(previousLiked);
      setPost((prev) =>
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
      const response = await authFetchResponse(`/public/posts/${shareId}/comment`, {
        method: 'POST',
        skipThrow: true,
        body: JSON.stringify({ comment: trimmed }),
      });

      if (response.status === 404) {
        setUnavailable(true);
        setPost(null);
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Unable to post your comment right now.');
      }

      setCommentDraft('');
      setShowEmojiPicker(false);
      setComments((prev) => [data, ...prev]);
      setCommentsLoaded(true);
      setPost((prev) =>
        prev
          ? {
              ...prev,
              commentCount: Number(prev.commentCount || 0) + 1,
            }
          : prev,
      );
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

  const handleMediaClick = (media) => {
    if (!isAuthenticated) {
      return;
    }

    setSelectedMedia(media);
  };

  const handleLogin = () => {
    closeAuthPrompt();
    navigate('/login', {
      state: {
        from: `${location.pathname}${location.search || ''}`,
      },
    });
  };

  const handleOpenInApp = () => {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-6 sm:py-8">
        <div className="mx-auto max-w-2xl animate-pulse">
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

  if (unavailable || !post) {
    return (
      <ContentUnavailableState
        title="This content is unavailable"
        description="The post may have been removed, deleted or is no longer public."
        action={
          <button
            type="button"
            onClick={goToFeed}
            className="mt-6 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {isAuthenticated ? 'Go to feed' : 'Go to home'}
          </button>
        }
      />
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 px-4 py-6 sm:py-8">
        <div className="mx-auto max-w-2xl">
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
                onClick={handleOpenInApp}
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                Open in Familyss
                <FiExternalLink size={16} />
              </button>
            ) : null}
          </div>

          <article
            ref={articleRef}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white pb-3 shadow-sm"
          >
            <div className="flex items-center justify-between p-3">
              <button
                type="button"
                onClick={() => goToUserProfile(post?.creator?.userId)}
                className="flex items-center gap-3 bg-transparent p-0 text-left"
              >
                <img
                  src={post?.creator?.profileImage || DEFAULT_AVATAR}
                  alt={post?.creator?.displayName || 'Familyss User'}
                  className="h-9 w-9 rounded-full border object-cover"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = DEFAULT_AVATAR;
                  }}
                />
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {post?.creator?.displayName || 'Familyss User'}
                  </p>
                  <p className="text-xs text-gray-500">{createdAtLabel}</p>
                </div>
              </button>

              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                Public
              </span>
            </div>

            {post?.caption ? (
              <div className="px-4 pb-2 text-sm text-gray-800">{post.caption}</div>
            ) : null}

            {Array.isArray(post?.media) && post.media.length > 0 ? (
              <div className="relative bg-black">
                {post.media.map((media, index) =>
                  media?.type === 'video' ? (
                    <video
                      key={`media-${index}`}
                      src={media.url}
                      controls
                      controlsList="nodownload noplaybackrate"
                      disablePictureInPicture
                      className="max-h-[60vh] w-full object-contain"
                    />
                  ) : (
                    <button
                      key={`media-${index}`}
                      type="button"
                      onClick={() => handleMediaClick(media)}
                      className="relative block w-full bg-black p-0"
                    >
                      <img
                        src={media.url}
                        alt={post?.caption || 'Shared Familyss post'}
                        className={`max-h-[60vh] w-full object-contain ${isAuthenticated ? 'cursor-pointer' : ''}`}
                      />
                    </button>
                  ),
                )}

                {showHeart ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-transparent">
                    <FaHeart className="text-secondary-600 text-7xl drop-shadow-lg" />
                  </div>
                ) : null}
              </div>
            ) : null}

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
                <span className="text-sm">{post.likeCount}</span>
              </button>

              <button
                type="button"
                onClick={handleCommentButton}
                className="flex items-center gap-2 bg-white text-gray-700 transition-colors duration-200 hover:text-blue-600"
              >
                <FaCommentDots size={19} />
                <span className="text-sm">{post.commentCount}</span>
              </button>
            </div>

            {!isAuthenticated ? (
              <div className="px-4 pt-2 text-xs text-gray-500">
                Log in to like, Comment on this post
              </div>
            ) : null}

            {showComments ? (
              <div className="mt-2 border-t border-gray-100 px-4 pb-4 animate-fadeIn">
                <div className="w-full">
                  <div className="flex flex-col">
                    <h3 className="mt-3 mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
                      <FaCommentDots size={19} className="text-gray-600" />
                      Comments ({post.commentCount})
                    </h3>

                    <div className="max-h-[45vh] overflow-y-auto overflow-x-hidden custom-scrollbar">
                      {commentsLoading ? (
                        <p className="rounded-2xl bg-gray-50 px-4 py-5 text-sm text-gray-500">
                          Loading comments...
                        </p>
                      ) : comments.length ? (
                        <div className="space-y-3">
                          {comments.map((comment) => {
                            const commenterId = comment?.user?.userId ?? comment?.userId;
                            const commenterName =
                              comment?.user
                                ? `${comment.user.firstName || ''} ${comment.user.lastName || ''}`.trim() ||
                                  'Familyss User'
                                : 'Familyss User';
                            const commenterAvatar =
                              comment?.user?.profile || comment?.user?.profileImage || DEFAULT_AVATAR;

                            return (
                              <div key={comment.id || `${commenterId}-${comment.createdAt}`} className="flex gap-3">
                                <button
                                  type="button"
                                  className="bg-transparent p-0"
                                  onClick={() => goToUserProfile(commenterId)}
                                >
                                  <img
                                    src={commenterAvatar}
                                    alt={commenterName}
                                    className="h-9 w-9 rounded-full border border-gray-300 object-cover"
                                    onError={(event) => {
                                      event.currentTarget.onerror = null;
                                      event.currentTarget.src = DEFAULT_AVATAR;
                                    }}
                                  />
                                </button>
                                <div className="min-w-0 flex-1 rounded-2xl bg-gray-50 px-4 py-3">
                                  <button
                                    type="button"
                                    onClick={() => goToUserProfile(commenterId)}
                                    className="bg-transparent p-0 text-left text-sm font-semibold text-gray-900"
                                  >
                                    {commenterName}
                                  </button>
                                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                                    {comment.comment || comment.content || ''}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="rounded-2xl bg-gray-50 px-4 py-5 text-sm text-gray-500">
                          Be the first to leave a comment.
                        </p>
                      )}
                    </div>

                    <div className="mt-3 relative w-full flex-shrink-0">
                      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1 text-gray-700 shadow-sm sm:py-1.5">
                        <button
                          type="button"
                          onClick={() => setShowEmojiPicker((prev) => !prev)}
                          className="flex h-6 w-6 items-center justify-center rounded-full text-primary-500 transition-colors hover:bg-gray-100 sm:h-7 sm:w-7"
                        >
                          <FiSmile size={16} />
                        </button>
                        <input
                          ref={commentInputRef}
                          type="text"
                          value={commentDraft}
                          onChange={(event) => setCommentDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && commentDraft.trim()) {
                              event.preventDefault();
                              handleSubmitComment();
                            }
                          }}
                          placeholder="Add a comment..."
                          maxLength={100}
                          className="flex-1 border-none bg-transparent text-[11px] placeholder-gray-400 focus:outline-none sm:text-sm"
                        />
                        <button
                          type="button"
                          onClick={handleSubmitComment}
                          disabled={commentBusy || !commentDraft.trim()}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-primary-500 hover:bg-primary-500 hover:text-white disabled:opacity-40 sm:h-8 sm:w-8"
                        >
                          {commentBusy ? (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                          ) : (
                            <FiSend size={16} />
                          )}
                        </button>
                      </div>

                      {showEmojiPicker ? (
                        <div
                          ref={emojiPickerRef}
                          className="absolute bottom-16 left-0 z-50 rounded-xl bg-white shadow-2xl"
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

      {selectedMedia ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4 backdrop-blur"
          onClick={() => setSelectedMedia(null)}
        >
          <button
            type="button"
            onClick={() => setSelectedMedia(null)}
            className="absolute right-4 top-4 rounded-full bg-white/85 p-2 text-gray-900 shadow"
          >
            <FaTimes size={22} />
          </button>
          <div
            className="relative flex max-h-full max-w-full items-center justify-center"
            onClick={(event) => event.stopPropagation()}
          >
            {selectedMedia?.type === 'video' ? (
              <video src={selectedMedia.url} controls autoPlay className="max-h-[90vh] max-w-full object-contain" />
            ) : (
              <img
                src={selectedMedia.url}
                alt={post?.caption || 'Shared Familyss post'}
                className="max-h-[90vh] max-w-full object-contain"
              />
            )}
          </div>
        </div>
      ) : null}

      <AuthPromptModal
        isOpen={showAuthPrompt}
        onClose={closeAuthPrompt}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />
    </>
  );
};

SharedPostView.propTypes = {
  context: PropTypes.oneOf(['web', 'app']),
};

SharedPostView.defaultProps = {
  context: 'web',
};

export default SharedPostView;
