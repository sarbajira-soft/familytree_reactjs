import React, { useState, useEffect, useRef } from "react";
import { FaRegHeart, FaHeart, FaCommentDots, FaTimes, FaUndoAlt } from "react-icons/fa";
import { FiShare2, FiSmile, FiSend } from "react-icons/fi";
import { AnimatePresence, motion } from "framer-motion";
import EmojiPicker from "emoji-picker-react";
import CommentItem from "./CommentItem";
import { countComments } from "../utils/commentUtils";

import { authFetchResponse } from "../utils/authFetch";
import PublicPostShareSheet from "./PublicPostShareSheet";

const COMMENTS_PAGE_SIZE = 10;

const PostViewerModal = ({
  isOpen,
  onClose,
  post,
  onLikePost,
  authToken,
  currentUser,
}) => {
  const currentUserId =
    currentUser?.userId ??
    currentUser?.id ??
    currentUser?.user?.userId ??
    currentUser?.user?.id ??
    null;
  const postOwnerId =
    post?.authorId ??
    post?.createdBy ??
    post?.user?.userId ??
    post?.userId ??
    null;
  const isPostOwner = Number(postOwnerId) === Number(currentUserId);

  const [likeCount, setLikeCount] = useState(post?.likes || 0);
  const [isLiked, setIsLiked] = useState(post?.isLiked || false);
  const [comments, setComments] = useState([]);
  const [commentPage, setCommentPage] = useState(1);
  const [hasMoreComments, setHasMoreComments] = useState(false);
  const [totalCommentCount, setTotalCommentCount] = useState(post?.commentCount ?? post?.comments ?? 0);
  const [newComment, setNewComment] = useState("");
  const [isCommentLoading, setIsCommentLoading] = useState(false);
  const [isCommentsFetching, setIsCommentsFetching] = useState(false);
  const [loadingMoreComments, setLoadingMoreComments] = useState(false);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const commentsRef = useRef(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const textareaRef = useRef(null);
  const emojiPickerRef = useRef(null);

  useEffect(() => {
    if (isOpen && post) {
      setIsLiked(post.isLiked);
      setLikeCount(post.likes);
      setComments([]);
      setCommentPage(1);
      setHasMoreComments(false);
      setTotalCommentCount(Number(post?.commentCount ?? post?.comments ?? 0));
      fetchComments(1, true);
    }
  }, [isOpen, post]);

  useEffect(() => {
    if (!isOpen) return;
    if (typeof onClose !== "function") return;
    if (!window.__appModalBackStack) window.__appModalBackStack = [];

    const handler = () => {
      onClose();
    };

    window.__appModalBackStack.push(handler);

    return () => {
      const stack = window.__appModalBackStack;
      if (!Array.isArray(stack)) return;
      const idx = stack.lastIndexOf(handler);
      if (idx >= 0) stack.splice(idx, 1);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isFullScreen) return;
    if (!window.__appModalBackStack) window.__appModalBackStack = [];

    const handler = () => {
      setIsFullScreen(false);
    };

    window.__appModalBackStack.push(handler);

    return () => {
      const stack = window.__appModalBackStack;
      if (!Array.isArray(stack)) return;
      const idx = stack.lastIndexOf(handler);
      if (idx >= 0) stack.splice(idx, 1);
    };
  }, [isFullScreen]);

  useEffect(() => {
    const handleClickOutsideEmoji = (event) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target)
      ) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutsideEmoji);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutsideEmoji);
    };
  }, [showEmojiPicker]);

  const mergePaginatedComments = (existingComments = [], incomingComments = []) => {
    const merged = [...(Array.isArray(existingComments) ? existingComments : [])];

    incomingComments.forEach((incomingComment) => {
      const existingIndex = merged.findIndex(
        (existingComment) => Number(existingComment?.id) === Number(incomingComment?.id),
      );

      if (existingIndex >= 0) {
        merged[existingIndex] = incomingComment;
      } else {
        merged.push(incomingComment);
      }
    });

    return merged;
  };

  const getRemovedCommentCount = (commentTree = [], targetCommentId) => {
    for (const comment of commentTree) {
      if (Number(comment?.id) === Number(targetCommentId)) {
        return 1 + countComments(comment?.replies || []);
      }

      const nestedCount = getRemovedCommentCount(comment?.replies || [], targetCommentId);
      if (nestedCount > 0) {
        return nestedCount;
      }
    }

    return 0;
  };

  const fetchComments = async (pageToLoad = 1, replace = true) => {
    if (!post?.id) return;

    if (replace) {
      setIsCommentsFetching(true);
    } else {
      setLoadingMoreComments(true);
    }

    try {
      const response = await authFetchResponse(
        `/post/${post.id}/comments?page=${pageToLoad}&limit=${COMMENTS_PAGE_SIZE}`,
        {
        method: "GET",
        skipThrow: true,
        },
      );
      const data = await response.json();
      if (data?.comments) {
        const nextComments = Array.isArray(data.comments) ? data.comments : [];
        const resolvedPage = Number(data?.page || pageToLoad);
        const resolvedLimit = Number(data?.limit || COMMENTS_PAGE_SIZE);
        const totalRoots = Number(data?.total || 0);

        setComments((prev) =>
          replace ? nextComments : mergePaginatedComments(prev, nextComments)
        );
        setCommentPage(resolvedPage);
        setHasMoreComments(resolvedPage * resolvedLimit < totalRoots);

        if (replace) {
          setTimeout(() => {
            if (commentsRef.current) {
              commentsRef.current.scrollTop = commentsRef.current.scrollHeight;
            }
          }, 100);
        }
      }
    } catch (error) {
      console.error("Failed to fetch comments:", error);
    } finally {
      setIsCommentsFetching(false);
      setLoadingMoreComments(false);
    }
  };

  const handleLikeClick = async () => {
    setIsLikeLoading(true);
    try {
      const response = await authFetchResponse(`/post/${post.id}/like-toggle`, {
        method: "POST",
        skipThrow: true,
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      if (response.ok) {
        setIsLiked(data.liked);
        setLikeCount(data.totalLikes);
      } else {
        console.error(
          "Failed to toggle like:",
          data.message || response.statusText
        );
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    }
    setTimeout(() => setIsLikeLoading(false), 2000);
  };

  const handleEmojiClick = (emojiData) => {
    const { emoji } = emojiData;
    const textarea = textareaRef.current;

    if (!textarea) {
      setNewComment((prev) => (prev || "") + emoji);
      return;
    }

    const currentValue = newComment || "";
    const start = textarea.selectionStart ?? currentValue.length;
    const end = textarea.selectionEnd ?? start;
    const before = currentValue.substring(0, start);
    const after = currentValue.substring(end);
    const updated = before + emoji + after;

    setNewComment(updated);

    setTimeout(() => {
      if (textareaRef.current) {
        const el = textareaRef.current;
        const caretPosition = start + emoji.length;
        el.focus();
        el.setSelectionRange(caretPosition, caretPosition);
      }
    }, 0);
  };

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    setIsCommentLoading(true);
    try {
      const response = await authFetchResponse(`/post/${post.id}/comment`, {
        method: "POST",
        skipThrow: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ comment: newComment.trim() }),
      });

      if (response.ok) {
        setNewComment("");
        setShowEmojiPicker(false);
        setTotalCommentCount((prev) => prev + 1);
        await fetchComments(1, true);
      } else {
        const errorData = await response.json();
        console.error(
          "Failed to post comment:",
          errorData.message || response.statusText
        );
      }
    } catch (error) {
      console.error("Error posting comment:", error);
    }
    setIsCommentLoading(false);
  };

  const handleEditComment = async (commentId, newText) => {
    try {
      const response = await authFetchResponse(`/post/comment/${commentId}`, {
        method: "PUT",
        skipThrow: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ comment: newText }),
      });
      if (response.ok) {
        await fetchComments(1, true);
      }
    } catch (error) {
      console.error("Failed to edit comment:", error);
      throw error;
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      const removedCount = getRemovedCommentCount(comments, commentId) || 1;
      const response = await authFetchResponse(`/post/comment/${commentId}`, {
        method: "DELETE",
        skipThrow: true,
      });
      if (response.ok) {
        setTotalCommentCount((prev) => Math.max(0, prev - removedCount));
        await fetchComments(1, true);
      }
    } catch (error) {
      console.error("Failed to delete comment:", error);
      throw error;
    }
  };

  const handleReplyComment = async (parentCommentId, replyText) => {
    try {
      const response = await authFetchResponse(`/post/comment/reply`, {
        method: "POST",
        skipThrow: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postId: post.id,
          parentCommentId,
          comment: replyText,
        }),
      });
      if (response.ok) {
        setTotalCommentCount((prev) => prev + 1);
        await fetchComments(1, true);
      }
    } catch (error) {
      console.error("Failed to reply to comment:", error);
      throw error;
    }
  };

  if (!post) return null;

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.3 } },
  };

  const modalVariants = {
    hidden: { scale: 0.97, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: { type: "spring", stiffness: 200, damping: 18 },
    },
    exit: { scale: 0.96, opacity: 0, transition: { duration: 0.18 } },
  };

  return (
    
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur pt-4 pb-24 md:pt-0 md:pb-0"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
        >
          <motion.div
            className="relative bg-white rounded-3xl m-2 shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden"
            style={{ height: "calc(100dvh - 140px)", maxHeight: "calc(100dvh - 140px)" }}
            variants={modalVariants}
            onClick={(e) => e.stopPropagation()}
          >
            {/* CLOSE BUTTON */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 text-gray-800 hover:text-black bg-white rounded-full p-2 shadow z-50"
            >
              <FaTimes size={21} />
            </button>

            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
              {/* MEDIA - left */}
              <div className="md:w-1/2 bg-black flex items-center justify-center p-0 md:p-5 h-[40vh] md:h-auto relative overflow-hidden">
                {post.postVideo ? (
                  <video
                    src={post.postVideo}
                    className="max-h-full max-w-full object-contain rounded-2xl shadow"
                    controls
                  />
                ) : post.url || post.fullImageUrl ? (
                  <img
                    src={post.url || post.fullImageUrl}
                    alt="Post"
                    className="max-h-full max-w-full object-contain rounded-2xl shadow cursor-pointer"
                    onClick={() => setIsFullScreen(true)} // enable click to full-screen
                  />
                ) : (
                  <div className="text-gray-200 text-lg italic text-center w-full">
                    No media available.
                  </div>
                )}
              </div>

              {/* RIGHT PANEL - info/comments */}
              <div className="flex-1 flex flex-col h-full bg-gray-50 border-t md:border-t-0 md:border-l border-gray-200 min-h-0 overflow-hidden">
                {/* Caption + actions */}
                <div className="p-4 pb-2 border-b flex-shrink-0">
                  <div className="text-gray-900 text-base font-medium mb-2 break-words">
                    {post.caption || "No Caption"}
                  </div>
                  <div className="flex items-center gap-3 mb-1">
                    <button
                      onClick={handleLikeClick}
                      disabled={isLikeLoading}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-base font-semibold shadow-sm transition
                      ${
                        isLiked
                          ? "bg-red-500 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-red-200 hover:text-red-700"
                      }
                    `}
                    >
                      {isLikeLoading ? (
                        <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      ) : isLiked ? (
                        <FaHeart size={18} />
                      ) : (
                        <FaRegHeart size={18} />
                      )}
                      <span>{likeCount}</span>
                    </button>
                    <span className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-200 text-gray-700">
                      <FaCommentDots size={18} /> {totalCommentCount}
                    </span>
                    {String(post?.privacy || "").toLowerCase() === "public" ? (
                      <button
                        type="button"
                        onClick={() => setShareSheetOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                      >
                        <FiShare2 size={18} />
                        <span>Share</span>
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Comments */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <h4 className="px-4 pt-4 pb-2 font-semibold text-base text-gray-800 flex-shrink-0">
                    Comments ({totalCommentCount})
                  </h4>
                  <div
                    ref={commentsRef}
                    className="flex-1 overflow-y-auto overflow-x-auto px-4 pb-4 custom-scrollbar no-scrollbar min-h-0 overscroll-contain"
                  >
                    {isCommentsFetching ? (
                      <div className="flex justify-center py-6 text-gray-500">
                        Loading comments...
                      </div>
                    ) : comments.length > 0 ? (
                      <div className="min-w-max space-y-3">
                        {comments.map((comment, index) => (
                          <CommentItem
                            key={comment.id || `comment-${index}`}
                            comment={comment}
                            currentUserId={currentUserId}
                            isPostOwner={isPostOwner}
                            maxDepth={1}
                            onEdit={handleEditComment}
                            onDelete={handleDeleteComment}
                            onReply={handleReplyComment}
                          />
                        ))}
                        {hasMoreComments ? (
                          <div className="flex justify-center pt-2">
                            <button
                              type="button"
                              onClick={() => fetchComments(commentPage + 1, false)}
                              disabled={loadingMoreComments}
                              className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {loadingMoreComments ? "Loading..." : "Load more comments"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic p-3 bg-gray-100 rounded-lg text-center">
                        Be the first to leave a comment!
                      </p>
                    )}
                  </div>
                  {/* Comment input (sticks at bottom) */}
                  <div className="px-4 pt-2 pb-4 bg-gray-50 flex-shrink-0 border-t relative">
                    <div className="flex items-center gap-2 px-3 py-1 bg-white text-gray-700 rounded-lg border border-gray-200 shadow-sm sm:py-1.5">
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker((prev) => !prev)}
                        className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full hover:bg-gray-100 text-primary-500 transition-colors"
                      >
                        <FiSmile size={16} />
                      </button>
                      <input
                        ref={textareaRef}
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a comment..."
                        maxLength={100}
                        className="flex-1 bg-transparent border-none text-[11px] sm:text-sm placeholder-gray-400 focus:outline-none"
                      />
                      <button
                        onClick={handlePostComment}
                        disabled={!newComment.trim() || isCommentLoading}
                        className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full text-primary-500 hover:text-white hover:bg-primary-500 disabled:opacity-40"
                      >
                        {isCommentLoading ? (
                          <span className="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full" />
                        ) : (
                          <FiSend size={16} />
                        )}
                      </button>
                    </div>
                    {showEmojiPicker && (
                      <div
                        ref={emojiPickerRef}
                        className="absolute bottom-16 left-4 z-50 shadow-2xl rounded-xl bg-white"
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
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      <AnimatePresence>
        {isFullScreen && (
          <motion.div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-85 backdrop-blur"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsFullScreen(false)}
          >
            {/* Close & Rotate Buttons */}
            <div
              className="fixed right-4 flex gap-3 z-50"
              style={{ top: "calc(env(safe-area-inset-top, 16px) + 8px)" }}
            >
              {/* ROTATE BUTTON */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRotation((prev) => prev + 90);
                }}
                className="bg-white/70 hover:bg-white/90 rounded-full p-2 shadow"
                title="Rotate"
              >
                <FaUndoAlt size={26} />
              </button>

              {/* CLOSE BUTTON */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFullScreen(false);
                }}
                className="bg-white/70 hover:bg-white/90 rounded-full p-2 shadow"
                title="Close"
              >
                <FaTimes size={28} />
              </button>
            </div>

            {/* IMAGE WRAPPER */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-full max-h-full p-4 flex items-center justify-center"
            >
              <img
                src={post.url || post.fullImageUrl}
                alt="Full screen"
                className="max-w-screen max-h-screen object-contain transition-transform duration-300"
                style={{
                  transform: `rotate(${rotation % 360}deg)`,
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PublicPostShareSheet
        isOpen={shareSheetOpen}
        post={post}
        onClose={() => setShareSheetOpen(false)}
      />
    </AnimatePresence>
    
  );
};

export default PostViewerModal;
