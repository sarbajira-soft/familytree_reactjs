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
import { FiSmile } from "react-icons/fi";
import { AnimatePresence, motion } from "framer-motion";
import EmojiPicker from "emoji-picker-react";
import CommentItem from "./CommentItem";
import { buildCommentTree, countComments } from "../utils/commentUtils";

const GalleryViewerModal = ({
  isOpen,
  onClose,
  album,
  currentUser,
  authToken,
}) => {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
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
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/gallery/like`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ galleryId: album.id }),
        }
      );
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
  const fetchComments = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/gallery/${album.id}/comments`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      const data = await res.json();
      setComments(data.comments || []);
      setTimeout(() => {
        if (commentsRef.current) {
          commentsRef.current.scrollTop = commentsRef.current.scrollHeight;
        }
      }, 100);
    } catch (err) {
      console.error("Fetching comments failed", err);
    }
  };

  // Post comment
  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    setCommentLoading(true);
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/gallery/comment`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          galleryId: album.id,
          comments: newComment.trim(),
        }),
      });
      setNewComment("");
      setShowEmojiPicker(false);
      await fetchComments();
    } catch (err) {
      console.error("Post failed", err);
    }
    setCommentLoading(false);
  };

  const handleEditComment = async (commentId, newText) => {
    await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/gallery/comment/${commentId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ comment: newText }),
      }
    );
    fetchComments();
  };
  const handleDeleteComment = async (commentId) => {
    await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/gallery/comment/${commentId}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } }
    );
    fetchComments();
  };
  const handleReplyComment = async (parentCommentId, replyText) => {
    await fetch(`${import.meta.env.VITE_API_BASE_URL}/gallery/comment/reply`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        galleryId: album.id,
        parentCommentId,
        comment: replyText,
      }),
    });
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
        >
          <motion.div
            className="relative bg-white rounded-3xl m-2 shadow-2xl w-full max-w-5xl h-[95vh] flex flex-col overflow-hidden"
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
              <div className="flex-1 flex flex-col h-full bg-gray-50 border-t md:border-t-0 md:border-l border-gray-200 min-h-0">
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
                  {/* Comment input */}
                  <div className="flex mb-14 items-end gap-2 p-4 pt-0 bg-gray-50 flex-shrink-0 border-t relative">
                    <div className="flex items-end gap-2 flex-1">
                      <textarea
                        ref={textareaRef}
                        rows="1"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Write a comment..."
                        className="flex-1 p-3 mt-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 text-sm resize-none min-h-[38px] max-h-[100px] md:min-h-[38px] md:max-h-[60px]"
                        style={{ lineHeight: "1.4" }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker((prev) => !prev)}
                        className="mb-1 p-2 rounded-full bg-white text-primary-600 border border-gray-300 hover:bg-yellow-50 shadow-sm transition-colors flex items-center justify-center"
                      >
                        <FiSmile size={20} />
                      </button>
                    </div>
                    <button
                      onClick={handlePostComment}
                      disabled={!newComment.trim() || commentLoading}
                      className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap shadow-md
                        ${
                          commentLoading
                            ? "bg-gray-400 text-white"
                            : "bg-primary-600 hover:bg-primary-700 text-white"
                        }
                      `}
                      style={{ minHeight: "38px", height: "auto" }}
                    >
                      {commentLoading ? "..." : "Post"}
                    </button>
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
                  <div className="mt-2 pt-2 border-t text-center text-sm text-gray-600">
                    Photo {currentPhotoIndex + 1} of {album.photos.length}
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
              <div className="fixed top-5 right-7 flex gap-3 z-50">
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
