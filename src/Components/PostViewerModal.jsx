import React, { useState, useEffect, useRef } from "react";
import { FaRegHeart, FaHeart, FaCommentDots, FaTimes, FaUndoAlt } from "react-icons/fa";
import { AnimatePresence, motion } from "framer-motion";
import CommentItem from "./CommentItem";
import { buildCommentTree, countComments } from "../utils/commentUtils";

const PostViewerModal = ({
  isOpen,
  onClose,
  post,
  onLikePost,
  authToken,
  currentUser,
}) => {
  const [likeCount, setLikeCount] = useState(post?.likes || 0);
  const [isLiked, setIsLiked] = useState(post?.isLiked || false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isCommentLoading, setIsCommentLoading] = useState(false);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const commentsRef = useRef(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (isOpen && post) {
      setIsLiked(post.isLiked);
      setLikeCount(post.likes);
      fetchComments();
    }
  }, [isOpen, post]);

  const fetchComments = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/post/${post.id}/comments`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      const data = await response.json();
      if (data?.comments) {
        setComments(data.comments);
        setTimeout(() => {
          if (commentsRef.current) {
            commentsRef.current.scrollTop = commentsRef.current.scrollHeight;
          }
        }, 100);
      }
    } catch (error) {
      console.error("Failed to fetch comments:", error);
    }
  };

  const handleLikeClick = async () => {
    setIsLikeLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/post/${post.id}/like-toggle`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
        }
      );
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

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    setIsCommentLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/post/${post.id}/comment`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ comment: newComment.trim() }),
        }
      );

      if (response.ok) {
        setNewComment("");
        await fetchComments();
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
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/post/comment/${commentId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ comment: newText }),
        }
      );
      if (response.ok) {
        await fetchComments();
      }
    } catch (error) {
      console.error("Failed to edit comment:", error);
      throw error;
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/post/comment/${commentId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      if (response.ok) {
        await fetchComments();
      }
    } catch (error) {
      console.error("Failed to delete comment:", error);
      throw error;
    }
  };

  const handleReplyComment = async (parentCommentId, replyText) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/post/comment/reply`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            postId: post.id,
            parentCommentId,
            comment: replyText,
          }),
        }
      );
      if (response.ok) {
        await fetchComments();
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
        >
          <motion.div
            className="relative bg-white rounded-3xl  shadow-2xl w-full max-w-4xl h-[100vh] flex flex-col overflow-hidden"
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
              {/* IMAGE - left */}
              <div className="md:w-1/2 bg-black flex items-center justify-center p-0 md:p-5 h-[40vh] md:h-auto relative overflow-hidden">
                {post.url || post.fullImageUrl ? (
                  <img
                    src={post.url || post.fullImageUrl}
                    alt="Post"
                    className="max-h-full max-w-full object-contain rounded-2xl shadow cursor-pointer"
                    onClick={() => setIsFullScreen(true)} // enable click to full-screen
                  />
                ) : (
                  <div className="text-gray-200 text-lg italic text-center w-full">
                    No image available.
                  </div>
                )}
              </div>

              {/* RIGHT PANEL - info/comments */}
              <div className="flex-1 flex flex-col h-full bg-gray-50 border-t md:border-t-0 md:border-l border-gray-200 min-h-0">
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
                      <FaCommentDots size={18} /> {comments.length}
                    </span>
                  </div>
                </div>

                {/* Comments */}
                <div className="flex-1 flex flex-col min-h-0">
                  <h4 className="px-4 pt-4 pb-2 font-semibold text-base text-gray-800 flex-shrink-0">
                    Comments ({countComments(buildCommentTree(comments))})
                  </h4>
                  <div
                    ref={commentsRef}
                    className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 custom-scrollbar min-h-0"
                  >
                    {comments.length > 0 ? (
                      buildCommentTree(comments).map((comment) => (
                        <CommentItem
                          key={comment.id}
                          comment={comment}
                          currentUserId={currentUser?.userId}
                          onEdit={handleEditComment}
                          onDelete={handleDeleteComment}
                          onReply={handleReplyComment}
                        />
                      ))
                    ) : (
                      <p className="text-gray-500 italic p-3 bg-gray-100 rounded-lg text-center">
                        Be the first to leave a comment!
                      </p>
                    )}
                  </div>
                  {/* Comment input (sticks at bottom) */}
                  <div className="flex mb-14  items-end gap-2 p-4 pt-0 bg-gray-50 flex-shrink-0 border-t">
                    <textarea
                      rows="1"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Write a comment..."
                      className="flex-1 p-3 mt-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 text-sm resize-none min-h-[38px] max-h-[100px] md:min-h-[38px] md:max-h-[60px]"
                      style={{ lineHeight: "1.4" }}
                    />
                    <button
                      onClick={handlePostComment}
                      disabled={!newComment.trim() || isCommentLoading}
                      className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap shadow-md
                        ${
                          isCommentLoading
                            ? "bg-gray-400 text-white"
                            : "bg-primary-600 hover:bg-primary-700 text-white"
                        }
                      `}
                      style={{ minHeight: "38px", height: "auto" }}
                    >
                      {isCommentLoading ? "..." : "Post"}
                    </button>
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
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-95"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsFullScreen(false)}
          >
            {/* Close & Rotate Buttons */}
            <div className="fixed top-4 right-4 flex gap-3 z-50">
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
    </AnimatePresence>
  );
};

export default PostViewerModal;
