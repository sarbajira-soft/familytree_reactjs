import React, { useState, useEffect, useRef } from "react";
import {
  FaRegHeart,
  FaHeart,
  FaCommentDots,
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
  FaUndoAlt,
} from "react-icons/fa";
import { FiSmile, FiSend } from "react-icons/fi";
import { AnimatePresence, motion } from "framer-motion";
import EmojiPicker from "emoji-picker-react";
import CommentItem from "./CommentItem";
import { buildCommentTree, countComments } from "../utils/commentUtils";
import Swal from "sweetalert2";

import { authFetchResponse } from "../utils/authFetch";

const GalleryViewerModal = ({
  isOpen,
  onClose,
  album,
  currentUser,
  authToken,
}) => {
  const currentUserId =
    currentUser?.userId ??
    currentUser?.id ??
    currentUser?.user?.userId ??
    currentUser?.user?.id ??
    null;
  const albumOwnerId =
    album?.userId ??
    album?.createdBy ??
    album?.user?.userId ??
    album?.authorId ??
    null;
  const isAlbumOwner = Number(albumOwnerId) === Number(currentUserId);

  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

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
  const [isLiked, setIsLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [totalLikes, setTotalLikes] = useState(0);
  const [newComment, setNewComment] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [comments, setComments] = useState([]);
  const commentsRef = useRef(null);
  const carouselRef = useRef(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const fsCarouselRef = useRef(null);
  const [rotation, setRotation] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef(null);
  const emojiPickerRef = useRef(null);

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

  const goToIndexFS = (i) => {
    if (fsCarouselRef.current) {
      fsCarouselRef.current.scrollTo({
        left: i * fsCarouselRef.current.clientWidth,
        behavior: "smooth",
      });
    }
    setCurrentPhotoIndex(i);
  };
  const goToPrevFS = () =>
    goToIndexFS(
      (currentPhotoIndex - 1 + album.photos.length) % album.photos.length
    );
  const goToNextFS = () =>
    goToIndexFS((currentPhotoIndex + 1) % album.photos.length);

  const goToPrev = () => {
    const width = carouselRef.current.clientWidth;
    carouselRef.current.scrollBy({ left: -width, behavior: "smooth" });
  };

  const goToNext = () => {
    const width = carouselRef.current.clientWidth;
    carouselRef.current.scrollBy({ left: width, behavior: "smooth" });
  };



  useEffect(() => {
    if (isOpen) setCurrentPhotoIndex(0);
  }, [isOpen]);
  useEffect(() => {
    if (album) {
      setIsLiked(album.isLiked || false);
      setTotalLikes(album.likes || 0);
      fetchComments();
    }
  }, [album]);

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

  if (!album || !album.photos || album.photos.length === 0) {
    return null;
  }

  const currentPhoto = album.photos[currentPhotoIndex];

  // Like API
  const toggleLike = async () => {
    if (likeLoading) return;
    setLikeLoading(true);
    try {
      const res = await authFetchResponse(`/gallery/like`, {
        method: "POST",
        skipThrow: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ galleryId: album.id }),
      });
      const data = await res.json();
      setIsLiked(Boolean(data.liked));
      setTotalLikes(data.totalLikes);
    } catch (err) {
      console.error("Like failed", err);
    }
    setLikeLoading(false);
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

  // Fetch comments
  async function fetchComments() {
    try {
      const res = await authFetchResponse(`/gallery/${album.id}/comments`, {
        method: "GET",
        skipThrow: true,
      });
      if (!res.ok) {
        throw new Error("Unable to load comments.");
      }
      const data = await res.json();
      setComments(data.comments || []);
      setTimeout(() => {
        if (commentsRef.current) {
          commentsRef.current.scrollTop = commentsRef.current.scrollHeight;
        }
      }, 100);
    } catch (err) {
      console.error("Fetching comments failed", err);
      Swal.fire({
        icon: "error",
        title: "Can’t load comments",
        text: err?.message || "Unable to load comments right now.",
      });
    }
  }

  // Post comment
  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    setCommentLoading(true);
    try {
      const res = await authFetchResponse(`/gallery/comment`, {
        method: "POST",
        skipThrow: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          galleryId: album.id,
          comments: newComment.trim(),
        }),
      });
      if (!res.ok) {
        throw new Error("Unable to post your comment.");
      }
      setNewComment("");
      setShowEmojiPicker(false);
      await fetchComments();
    } catch (err) {
      console.error("Post failed", err);
      Swal.fire({
        icon: "error",
        title: "Can’t post comment",
        text: err?.message || "Unable to post your comment right now.",
      });
    }
    setCommentLoading(false);
  };

  const handleEditComment = async (commentId, newText) => {
    const res = await authFetchResponse(`/gallery/comment/${commentId}`, {
      method: "PUT",
      skipThrow: true,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ comment: newText }),
    });
    if (!res.ok) {
      throw new Error("Unable to update your comment.");
    }
    fetchComments();
  };
  const handleDeleteComment = async (commentId) => {
    const res = await authFetchResponse(`/gallery/comment/${commentId}`, {
      method: "DELETE",
      skipThrow: true,
    });
    if (!res.ok) {
      throw new Error("Unable to delete your comment.");
    }
    fetchComments();
  };
  const handleReplyComment = async (parentCommentId, replyText) => {
    const res = await authFetchResponse(`/gallery/comment/reply`, {
      method: "POST",
      skipThrow: true,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        galleryId: album.id,
        parentCommentId,
        comment: replyText,
      }),
    });
    if (!res.ok) {
      throw new Error("Unable to post your reply.");
    }
    fetchComments();
  };

  // Scroll listener: update current image index
 const handleScroll = () => {
   const container = carouselRef.current;
   if (!container) return;
   const index = Math.round(container.scrollLeft / container.clientWidth);
   setCurrentPhotoIndex(index);
 };


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
            className="relative bg-white rounded-3xl m-2 shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden"
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
              {/* IMAGE/CAROUSEL - left */}
              <div className="md:w-1/2 bg-black relative flex items-center justify-center">
                {/* Carousel */}
                <div
                  ref={carouselRef}
                  className="w-full h-[35vh] md:h-[80vh] overflow-x-auto snap-x snap-mandatory no-scrollbar flex relative"
                  onScroll={handleScroll}
                >
                  {album.photos.map((img, idx) => (
                    <div
                      key={idx}
                      className="w-full h-full flex-shrink-0 snap-center flex items-center justify-center bg-black"
                    >
                      <img
                        src={img.url}
                        alt={img.caption}
                        className="max-w-full max-h-full object-contain mx-auto my-auto"
                        onClick={() => setIsFullScreen(true)}
                        onError={(e) => (e.target.src = "/fallback-image.png")}
                      />
                    </div>
                  ))}
                </div>

                {/* Prev Button — show only if NOT the first image */}
                {currentPhotoIndex > 0 && (
                  <button
                    onClick={goToPrev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 p-3 rounded-full text-white shadow-lg select-none z-20"
                  >
                    <FaChevronLeft size={24} />
                  </button>
                )}

                {/* Next Button — show only if NOT the last image */}
                {currentPhotoIndex < album.photos.length - 1 && (
                  <button
                    onClick={goToNext}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 p-3 rounded-full text-white shadow-lg select-none z-20"
                  >
                    <FaChevronRight size={24} />
                  </button>
                )}

                {/* Gradient Title */}
                <div className="absolute top-0 left-0 p-4 text-white bg-gradient-to-b from-black/70 to-transparent w-full z-10">
                  <h2 className="text-lg font-semibold">{album.title}</h2>
                  <p className="text-sm opacity-80">by {album.author}</p>
                </div>
              </div>

              {/* RIGHT PANEL - info/comments */}
              <div className="flex-1 flex flex-col h-full bg-gray-50 border-t md:border-t-0 md:border-l border-gray-200 min-h-0 overflow-hidden">
                {/* Likes & comments */}
                <div className="p-4 pb-2 border-b flex-shrink-0">
                  <div className="flex items-center gap-3 mb-3">
                    <button
                      onClick={toggleLike}
                      disabled={likeLoading}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-base font-semibold shadow-sm transition
                        ${
                          isLiked
                            ? "bg-red-500 text-white"
                            : "bg-gray-200 text-gray-700 hover:bg-red-200 hover:text-red-700"
                        }
                      `}
                    >
                      {likeLoading ? (
                        <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      ) : isLiked ? (
                        <FaHeart size={18} />
                      ) : (
                        <FaRegHeart size={18} />
                      )}
                      <span>{totalLikes}</span>
                    </button>
                    <span className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-200 text-gray-700">
                      <FaCommentDots size={18} /> {comments.length}
                    </span>
                  </div>
                </div>

                {/* Comments */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <h4 className="px-4 pt-4 pb-2 font-semibold text-base text-gray-800 flex-shrink-0">
                    Comments ({countComments(buildCommentTree(comments))})
                  </h4>
                  <div
                    ref={commentsRef}
                    className="flex-1 overflow-y-auto overflow-x-auto px-4 pb-4 custom-scrollbar no-scrollbar min-h-0 overscroll-contain"
                  >
                    {comments.length > 0 ? (
                      <div className="min-w-max space-y-3">
                        {buildCommentTree(comments).map((comment) => (
                          <CommentItem
                            key={comment.id}
                            comment={comment}
                            currentUserId={currentUserId}
                            isPostOwner={isAlbumOwner}
                            onEdit={handleEditComment}
                            onDelete={handleDeleteComment}
                            onReply={handleReplyComment}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic p-3 bg-gray-100 rounded-lg text-center">
                        Be the first to leave a comment!
                      </p>
                    )}
                  </div>
                  {/* Comment input */}
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
                        className="flex-1 bg-transparent border-none text-[11px] sm:text-sm placeholder-gray-400 focus:outline-none"
                      />
                      <button
                        onClick={handlePostComment}
                        disabled={!newComment.trim() || commentLoading}
                        className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full text-primary-500 hover:text-white hover:bg-primary-500 disabled:opacity-40"
                      >
                        {commentLoading ? (
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
                  {/* <div className="mt-2 pt-2 border-t text-center text-sm text-gray-600">
                    Photo {currentPhotoIndex + 1} of {album.photos.length}
                  </div> */}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      <AnimatePresence>
        {isFullScreen && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-85 backdrop-blur"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsFullScreen(false)}
          >
            <div
              className="relative w-full h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header action buttons */}
              <div
                className="fixed right-7 flex gap-3 z-50"
                style={{ top: "calc(env(safe-area-inset-top, 16px) + 8px)" }}
              >
                <button
                  onClick={() => setRotation((r) => r + 90)}
                  className="bg-white/70 hover:bg-white/90 rounded-full p-2 shadow"
                  title="Rotate"
                >
                  <FaUndoAlt size={26} />
                </button>
                <button
                  onClick={() => setIsFullScreen(false)}
                  className="bg-white/70 hover:bg-white/90 rounded-full p-2 shadow"
                  title="Close"
                >
                  <FaTimes size={28} />
                </button>
              </div>
              {/* Carousel */}
              <div
                ref={fsCarouselRef}
                className="w-full h-full flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
                onScroll={() => {
                  const container = fsCarouselRef.current;
                  if (!container) return;
                  const index = Math.round(
                    container.scrollLeft / container.clientWidth
                  );
                  setCurrentPhotoIndex(index);
                }}
              >
                {album.photos.map((img, idx) => (
                  <div
                    key={idx}
                    className="w-full h-full flex-shrink-0 snap-center flex items-center justify-center p-4"
                  >
                    <img
                      src={img.url}
                      alt={img.caption}
                      className="max-w-full max-h-full object-contain"
                      style={{
                        transform: `rotate(${rotation % 360}deg)`,
                        transition: "transform 0.3s",
                      }}
                    />
                  </div>
                ))}
              </div>
              {/* Prev/Next */}
              {/* Prev Button — show only if NOT the first image */}
              {currentPhotoIndex > 0 && (
                <button
                  onClick={goToPrevFS}
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 p-3 rounded-full text-white shadow-lg select-none z-20"
                >
                  <FaChevronLeft size={24} />
                </button>
              )}

              {/* Next Button — show only if NOT the last image */}
              {currentPhotoIndex < album.photos.length - 1 && (
                <button
                  onClick={goToNextFS}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 p-3 rounded-full text-white shadow-lg select-none z-20"
                >
                  <FaChevronRight size={24} />
                </button>
              )}

              {/* Pagination */}
              <div className="absolute bottom-7 w-full flex justify-center gap-2">
                {album.photos.map((_, idx) => (
                  <span
                    key={idx}
                    className={`inline-block w-2 h-2 rounded-full ${
                      idx === currentPhotoIndex
                        ? "bg-orange-500"
                        : "bg-gray-300"
                    }`}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
};

export default GalleryViewerModal;
