import React, { useState, useEffect, useRef } from "react";
import CreatePostModal from "../Components/CreatePostModal";
import PostViewerModal from "../Components/PostViewerModal";
import { useUser } from "../Contexts/UserContext";
import { useNavigate } from "react-router-dom";
import {
  FiImage,
  FiUsers,
  FiPlusCircle,
  FiFeather,
  FiGlobe,
  FiClock,
  FiSmile,
  FiChevronDown,
  FiSend,
} from "react-icons/fi";
import { FaRegHeart, FaHeart, FaCommentDots } from "react-icons/fa";
import { MdPublic, MdPeople } from "react-icons/md";
import PostsShimmer from "./PostsShimmer";
import EmojiPicker from "emoji-picker-react";

const EMPTY_VTT_TRACK_SRC = "data:text/vtt,WEBVTT";

const PostPage = () => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [activeFeed, setActiveFeed] = useState("public");
  const [posts, setPosts] = useState([]);
  const [likeLoadingIds, setLikeLoadingIds] = useState(new Set());
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPostViewerOpen, setIsPostViewerOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const { userInfo } = useUser();
  const [postComments, setPostComments] = useState({});
  const [loadingComments, setLoadingComments] = useState(new Set());
  const [postingComment, setPostingComment] = useState(new Set());
  const [newComment, setNewComment] = useState({});
  const [visibleComments, setVisibleComments] = useState({});
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [likedPostId, setLikedPostId] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState({});
  const [replyingToCommentId, setReplyingToCommentId] = useState(null);
  const [replyText, setReplyText] = useState({});
  const [activeEmojiPostId, setActiveEmojiPostId] = useState(null);
  const [feedMenuOpen, setFeedMenuOpen] = useState(false);
  const commentInputRefs = useRef({});
  const emojiPickerRef = useRef(null);
  const feedMenuRef = useRef(null);
  const feedMenuButtonRef = useRef(null);
  const navigate = useNavigate();

  const goToUserProfile = (targetUserId) => {
    if (!targetUserId) return;
    const myId = userInfo?.userId;
    if (myId && Number(targetUserId) === Number(myId)) {
      navigate("/myprofile");
    } else {
      navigate(`/user/${targetUserId}`);
    }
  };

  useEffect(() => {
    const storedToken = localStorage.getItem("access_token");
    if (storedToken) setToken(storedToken);
  }, []);

  useEffect(() => {
    if (!userInfo) return;
    setUser({
      id: userInfo.userId,
      avatar: userInfo.profileUrl || "/assets/user.png",
      name: userInfo.name || "Username",
      bio: userInfo.bio || "No bio yet",
      familyCode: userInfo.familyCode || "Not assigned",
    });
  }, [userInfo]);

  useEffect(() => {
    const handleClickOutsideEmoji = (event) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target)
      ) {
        setActiveEmojiPostId(null);
      }
    };

    if (activeEmojiPostId !== null) {
      document.addEventListener("mousedown", handleClickOutsideEmoji);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutsideEmoji);
    };
  }, [activeEmojiPostId]);

  useEffect(() => {
    const handleClickOutsideFeedMenu = (event) => {
      if (
        feedMenuRef.current &&
        !feedMenuRef.current.contains(event.target) &&
        feedMenuButtonRef.current &&
        !feedMenuButtonRef.current.contains(event.target)
      ) {
        setFeedMenuOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutsideFeedMenu);
    return () => {
      document.removeEventListener("click", handleClickOutsideFeedMenu);
    };
  }, []);

  const fetchPosts = async (captionSearch = "") => {
    setLoadingFeed(true);
    try {
      const currentToken = localStorage.getItem("access_token");
      const headers = currentToken
        ? { Authorization: `Bearer ${currentToken}` }
        : {};

      let url =
        activeFeed === "family"
          ? `${import.meta.env.VITE_API_BASE_URL}/post/by-options?familyCode=${
              userInfo.familyCode
            }&privacy=private`
          : `${
              import.meta.env.VITE_API_BASE_URL
            }/post/by-options?privacy=public`;

      if (captionSearch.trim())
        url += `&caption=${encodeURIComponent(captionSearch.trim())}`;

      const res = await fetch(url, { headers });
      const data = await res.json();
      setPosts(
        Array.isArray(data)
          ? data.map((p) => ({
              id: p.id,
              author: p.user?.name || "Unknown",
              authorId: p.user?.userId || p.createdBy || null,
              avatar: p.user?.profile || "/assets/user.png",
              time: new Date(p.createdAt).toLocaleString(),
              caption: p.caption,
              fullImageUrl: p.postImage,
              postVideo: p.postVideo,
              likes: p.likeCount,
              comments: p.commentCount,
              liked: p.isLiked,
              privacy: p.privacy,
            }))
          : []
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingFeed(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [activeFeed]);

  const toggleLike = async (postId) => {
     // prevent multiple clicks during loading
    // Add postId to loading set
    setLikeLoadingIds((prev) => new Set(prev).add(postId));

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/post/${postId}/like-toggle`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      const data = await response.json();

      if (response.ok) {
        // Update post like status and like count in posts array
        setPosts((prevPosts) =>
          prevPosts.map((post) =>
            post.id === postId
              ? { ...post, liked: data.liked, likes: data.totalLikes }
              : post
          )
        );
      } else {
        console.error(
          "Failed to toggle like:",
          data.message || response.statusText
        );
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    }

    // Remove postId from loading set
    setLikeLoadingIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(postId);
      return newSet;
    });
  };

  const handleEmojiClickForPost = (postId, emojiData) => {
    const { emoji } = emojiData;
    const inputEl = commentInputRefs.current[postId];
    const currentValue = newComment[postId] || "";

    if (!inputEl) {
      setNewComment((prev) => ({
        ...prev,
        [postId]: (prev[postId] || "") + emoji,
      }));
      return;
    }

    const start = inputEl.selectionStart ?? currentValue.length;
    const end = inputEl.selectionEnd ?? start;
    const before = currentValue.substring(0, start);
    const after = currentValue.substring(end);
    const updated = before + emoji + after;

    setNewComment((prev) => ({
      ...prev,
      [postId]: updated,
    }));

    setTimeout(() => {
      const el = commentInputRefs.current[postId];
      if (el) {
        const caretPosition = start + emoji.length;
        el.focus();
        el.setSelectionRange(caretPosition, caretPosition);
      }
    }, 0);
  };

    const handlePostComment = async (postId) => {
      const commentText = newComment[postId]?.trim();
      if (!commentText) return;

      const authToken = localStorage.getItem("access_token");
      if (!authToken) {
        console.error("No auth token found");
        return;
      }

      // 🟢 Optimistic temporary comment
      const tempComment = {
        id: Date.now(),
        content: commentText,
        createdAt: new Date().toISOString(),
        user: {
          firstName: userInfo?.firstName || "You",
          lastName: userInfo?.lastName || "",
          profile: userInfo?.profile || "/assets/user.png",
        },
        isTemp: true,
      };

      // Add optimistic comment
      setPostComments((prev) => ({
        ...prev,
        [postId]: prev[postId] ? [tempComment, ...prev[postId]] : [tempComment],
      }));

      // Clear input + set loading
      setNewComment((prev) => ({ ...prev, [postId]: "" }));
      setPostingComment((prev) => new Set(prev).add(postId));

      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/post/${postId}/comment`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${authToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ comment: commentText }),
          }
        );

        if (res.ok) {
          const newCommentData = await res.json(); // ✅ backend returns the same structure
          console.log("Received Comment:", newCommentData);

          // Replace temp comment with actual comment object from backend
          setPostComments((prev) => ({
            ...prev,
            [postId]: prev[postId].map((c) =>
              c.id === tempComment.id ? newCommentData : c
            ),
          }));
          setActiveEmojiPostId((prev) => (prev === postId ? null : prev));
        } else {
          console.error("Failed to post comment");
          // Rollback
          setPostComments((prev) => ({
            ...prev,
            [postId]: prev[postId].filter((c) => c.id !== tempComment.id),
          }));
        }
      } catch (err) {
        console.error("Error posting comment:", err);
        // Rollback
        setPostComments((prev) => ({
          ...prev,
          [postId]: prev[postId].filter((c) => c.id !== tempComment.id),
        }));
      } finally {
        setPostingComment((prev) => {
          const updated = new Set(prev);
          updated.delete(postId);
          return updated;
        });
      }
    };



    const handleLike = async (postId) => {
      if (likeLoadingIds.has(postId)) return;

      console.log("Post ID liked:", postId);
      await toggleLike(postId); // Your existing like toggle logic
      setLikedPostId(postId);
      setShowHeartAnimation(true);
      globalThis.setTimeout(() => {
        setShowHeartAnimation(false);
        setLikedPostId(null);
      }, 1000);
    };

    const handleShowMoreComments = (postId) => {
      setVisibleComments((prev) => {
        const current = prev[postId] || 3;
        return { ...prev, [postId]: current + 3 };
      });
    };


   const fetchComments = async (postId, authToken) => {
     try {
       const response = await fetch(
         `${import.meta.env.VITE_API_BASE_URL}/post/${postId}/comments`,
         {
           headers: {
             Authorization: `Bearer ${authToken}`,
           },
         }
       );
       const data = await response.json();
       return data?.comments || [];
     } catch (error) {
       console.error("Failed to fetch comments:", error);
       return [];
     }
   };

   // Build comment tree for nested replies (Instagram style)
   const buildCommentTree = (comments) => {
     const commentMap = {};
     const rootComments = [];

     // First pass: create a map of all comments
     comments.forEach(comment => {
       commentMap[comment.id] = { ...comment, replies: [] };
     });

     // Second pass: build the tree
     comments.forEach(comment => {
       if (comment.parentCommentId && commentMap[comment.parentCommentId]) {
         commentMap[comment.parentCommentId].replies.push(commentMap[comment.id]);
       } else {
         rootComments.push(commentMap[comment.id]);
       }
     });

     return rootComments;
   };

   // Handle inline edit comment
   const handleEditComment = async (commentId, postId) => {
     const newText = editCommentText[commentId]?.trim();
     if (!newText) return;

     try {
       const response = await fetch(
         `${import.meta.env.VITE_API_BASE_URL}/post/comment/${commentId}`,
         {
           method: "PUT",
           headers: {
             Authorization: `Bearer ${token}`,
             "Content-Type": "application/json",
           },
           body: JSON.stringify({ comment: newText }),
         }
       );

       if (response.ok) {
         const updatedComment = await response.json(); // ✅ use backend response directly

         setPostComments((prev) => ({
           ...prev,
           [postId]: prev[postId].map((c) =>
             c.id === commentId ? updatedComment : c
           ),
         }));

         // reset edit states
         setEditingCommentId(null);
         setEditCommentText({});
       } else {
         console.error("Failed to edit comment");
         alert("Failed to edit comment");
       }
     } catch (error) {
       console.error("Error editing comment:", error);
       alert("Error editing comment");
     }
   };


   // Handle delete comment (with cascade for children)
   const handleDeleteComment = async (commentId, postId) => {
     if (!confirm('Are you sure you want to delete this comment?')) return;

     try {
       const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/post/comment/${commentId}`, {
         method: 'DELETE',
         headers: {
           'Authorization': `Bearer ${token}`
         }
       });

       if (!response.ok) {
         alert('Failed to delete comment');
         return;
       }

       const getAllChildIds = (parentId, comments) => {
         const childIds = [];
         const children = comments.filter((c) => c.parentCommentId === parentId);
         children.forEach((child) => {
           childIds.push(child.id, ...getAllChildIds(child.id, comments));
         });
         return childIds;
       };

       setPostComments((prev) => {
         const currentComments = prev[postId] || [];
         const childIds = getAllChildIds(commentId, currentComments);
         const idsToRemove = new Set([commentId, ...childIds]);

         return {
           ...prev,
           [postId]: currentComments.filter((c) => !idsToRemove.has(c.id)),
         };
       });
     } catch (error) {
       console.error('Failed to delete comment:', error);
       alert('Failed to delete comment');
     }
   };

   // Handle reply to comment
   const handleReplyToComment = async (parentCommentId, postId) => {
     const replyContent = replyText[parentCommentId]?.trim();
     if (!replyContent) return;

     try {
       const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/post/comment/reply`, {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${token}`,
           'Content-Type': 'application/json'
         },
         body: JSON.stringify({
           postId,
           parentCommentId,
           comment: replyContent
         })
       });
       
       if (response.ok) {
         const comments = await fetchComments(postId, token);
         setPostComments(prev => ({ ...prev, [postId]: comments }));
         setReplyingToCommentId(null);
         setReplyText({});
       }
     } catch (error) {
       console.error('Failed to reply to comment:', error);
       alert('Failed to post reply');
     }
   };

   const handleCommentClick = async (postId) => {
     const targetPost = posts.find((p) => p.id === postId);

     // Toggle comments visibility if already loaded
     if (targetPost.showComments && postComments[postId]) {
       setPosts((prev) =>
         prev.map((p) => (p.id === postId ? { ...p, showComments: false } : p))
       );
       return;
     } 

     // Otherwise, fetch comments
     setLoadingComments((prev) => new Set(prev).add(postId));

     const comments = await fetchComments(postId, token);
     setPostComments((prev) => ({ ...prev, [postId]: comments }));

     setPosts((prev) =>
       prev.map((p) => (p.id === postId ? { ...p, showComments: true } : p))
     );

     setLoadingComments((prev) => {
       const updated = new Set(prev);
       updated.delete(postId);
       return updated;
     });
   };


  const handleViewPost = (post) => {
    setSelectedPost(post);
    setIsPostViewerOpen(true);
  };

  const renderComment = (cmt, postId, isReply = false) => {
    const isOwner = cmt.userId === user?.id || cmt.userId === userInfo?.userId;

    return (
      <div key={cmt.id} className={isReply ? "ml-10 mt-2" : ""}>
        <div className="flex items-start gap-2.5 opacity-0 animate-fadeIn">
          <img
            src={cmt.user?.profile || "/assets/user.png"}
            alt="User"
            className="w-8 h-8 rounded-full object-cover border border-gray-200"
          />
          <div className="flex-1">
            {editingCommentId === cmt.id ? (
              <div className="mt-1">
                <input
                  type="text"
                  autoFocus
                  value={editCommentText[cmt.id] || ""}
                  onChange={(e) =>
                    setEditCommentText({
                      ...editCommentText,
                      [cmt.id]: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleEditComment(cmt.id, postId)}
                    className="px-3 py-1 bg-blue-500 text-white rounded-lg text-xs hover:bg-blue-600"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingCommentId(null);
                      setEditCommentText({});
                    }}
                    className="px-3 py-1 bg-gray-300 text-gray-700 rounded-lg text-xs hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-[13px]">
                  <span className="font-semibold text-gray-900 mr-2">
                    {cmt.user?.firstName} {cmt.user?.lastName}
                  </span>
                  <span className="text-gray-700">{cmt.content}</span>
                </div>

                <div className="flex items-center gap-4 mt-1 text-[12px] text-gray-500">
                  <span className="text-[11px]">
                    {new Date(cmt.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <button
                    onClick={() => setReplyingToCommentId(cmt.id)}
                    className="font-medium hover:text-gray-700 bg-transparent"
                  >
                    Reply
                  </button>
                  {isOwner && (
                    <>
                      <button
                        onClick={() => {
                          setEditingCommentId(cmt.id);
                          setEditCommentText({
                            [cmt.id]: cmt.content,
                          });
                        }}
                        className="font-medium hover:text-gray-700 bg-transparent"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteComment(cmt.id, postId)}
                        className="font-medium text-red-500 hover:text-red-700 bg-transparent"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>

                {replyingToCommentId === cmt.id && (
                  <div className="mt-2">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Write a reply..."
                      value={replyText[cmt.id] || ""}
                      onChange={(e) =>
                        setReplyText({
                          ...replyText,
                          [cmt.id]: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleReplyToComment(cmt.id, postId)}
                        className="px-3 py-1 bg-blue-500 text-white rounded-lg text-xs hover:bg-blue-600"
                      >
                        Reply
                      </button>
                      <button
                        onClick={() => {
                          setReplyingToCommentId(null);
                          setReplyText({});
                        }}
                        className="px-3 py-1 bg-gray-300 text-gray-700 rounded-lg text-xs hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Render nested replies */}
        {cmt.replies && cmt.replies.length > 0 && (
          <div className="ml-10 mt-2 space-y-2">
            {cmt.replies.map((reply) => renderComment(reply, postId, true))}
          </div>
        )}
      </div>
    );
  };

  const renderCommentsBody = (post) => {
    if (loadingComments.has(post.id)) {
      return (
        <div className="space-y-3 mt-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-start gap-3 bg-gray-50 border border-gray-200/60 p-2.5 rounded-xl animate-pulse"
            >
              <div className="w-8 h-8 rounded-full bg-gray-300"></div>
              <div className="flex-1 space-y-2">
                <div className="w-24 h-3 bg-gray-300 rounded"></div>
                <div className="w-3/4 h-3 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    const currentComments = postComments[post.id];
    if (currentComments?.length) {
      const visibleCount = visibleComments[post.id] || 3;
      const commentTree = buildCommentTree(currentComments);

      return (
        <>
          <div className="sp mt-2 space-y-3">
            {commentTree
              .slice(0, visibleCount)
              .map((comment) => renderComment(comment, post.id))}
          </div>

          {currentComments.length > visibleCount && (
            <button
              type="button"
              onClick={() => handleShowMoreComments(post.id)}
              className="text-[13px] bg-white text-gray-500 hover:text-gray-700 mt-2 font-normal"
            >
              View more comments
            </button>
          )}

          {currentComments.length > 3 && (
            <button
              onClick={() => handleViewPost(post)}
              className="text-[13px] bg-white text-gray-500 hover:text-gray-700 mt-2 font-normal"
            >
              View all {currentComments.length} comments
            </button>
          )}
        </>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-4 text-gray-500 text-sm italic">
        No comments yet.
      </div>
    );
  };

  let feedSection = null;
  if (loadingFeed) {
    feedSection = (
      <div className="space-y-5 animate-pulse">
        <PostsShimmer/>
      </div>
    );
  } else if (posts.length) {
    feedSection = (
      <div className="">
        {posts.map((post) => (
          <div
            key={post.id}
            className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="bg-transparent p-0"
                  onClick={() => goToUserProfile(post.authorId)}
                >
                  <img
                    src={post.avatar}
                    alt={post.author}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border object-cover"
                  />
                </button>
                <div>
                  <button
                    type="button"
                    className="font-semibold text-gray-900 text-sm sm:text-base bg-transparent p-0"
                    onClick={() => goToUserProfile(post.authorId)}
                  >
                    {post.author}
                  </button>
                  <p className="text-xs text-gray-500">{post.time}</p>
                </div>
              </div>
              <span className="text-blue-500 flex items-center gap-1 text-xs sm:text-sm">
                {post.privacy === "family" ? <FiUsers /> : <FiGlobe />}
                {post.privacy === "family" ? "Family" : "Public"}
              </span>
            </div>

            {/* Media */}
            {post.postVideo ? (
              <div className="relative w-full bg-black group overflow-hidden">
                <video
                  src={post.postVideo}
                  className="w-full h-auto max-h-[700px] object-contain transition-transform duration-500"
                  controls
                  onClick={(e) => e.stopPropagation()}
                >
                  <track
                    kind="captions"
                    src={EMPTY_VTT_TRACK_SRC}
                    srcLang="en"
                    label="English"
                    default
                  />
                </video>
              </div>
            ) : (
              post.fullImageUrl && (
                <button
                  type="button"
                  className="relative w-full bg-black cursor-pointer group overflow-hidden"
                  onClick={() => handleViewPost(post)}
                >
                  <img
                    src={post.fullImageUrl}
                    alt="Post"
                    className="w-full h-auto max-h-[700px] object-contain transition-transform duration-500"
                    loading="lazy"
                  />

                  {/* ❤️ Like animation overlay */}
                  {likedPostId === post.id && showHeartAnimation && (
                    <div className="absolute inset-0 flex items-center justify-center bg-transparent animate-heart-pop">
                      <FaHeart className="text-pink-700 text-7xl drop-shadow-lg" />
                    </div>
                  )}
                </button>
              )
            )}

            {/* Caption */}
            {post.caption && (
              <div className="px-4 py-2 text-sm text-gray-700">
                <button
                  type="button"
                  className="font-semibold mr-1 bg-transparent p-0"
                  onClick={() => goToUserProfile(post.authorId)}
                >
                  {post.author}
                </button>
                {post.caption}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <div className="flex items-center gap-8">
                {/* Like */}
                <button
                  onClick={() => handleLike(post.id)}
                  disabled={likeLoadingIds.has(post.id)}
                  className="flex items-center bg-white gap-2 text-gray-700 hover:text-pink-600 transition-colors duration-200 active:scale-95 disabled:opacity-60"
                >
                  {post.liked ? (
                    <FaHeart size={20} className="text-pink-600" />
                  ) : (
                    <FaRegHeart size={20} />
                  )}
                  <span className="text-sm">{post.likes}</span>
                </button>

                {/* Comment */}
                <button
                  onClick={() => handleCommentClick(post.id)}
                  className="flex items-center bg-white gap-2 text-gray-700 hover:text-blue-600 transition-colors duration-200 active:scale-95"
                >
                  <FaCommentDots size={19} />
                  <span className="text-sm">{post.comments}</span>
                </button>
              </div>
            </div>

            {/* Comments */}
            {post.showComments && (
              <div className="px-4 pb-4 border-t border-gray-100 mt-2 animate-fadeIn">
                <div className="max-w-[80%] sm:max-w-[70%] ml-6 mx-auto">
                  <h4 className="text-sm font-semibold text-gray-800 mt-3 mb-2 flex items-center gap-2">
                    <FaCommentDots size={19} className="text-gray-600" />
                    Comments
                  </h4>

                  {renderCommentsBody(post)}

                  {/* ✏️ Add comment box */}
                  <div className="mt-3 relative max-w-[95%] sm:max-w-full mx-auto">
                    <div className="flex items-center gap-2 px-3 py-1 bg-white text-gray-700 rounded-lg border border-gray-200 shadow-sm sm:py-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveEmojiPostId((prev) =>
                            prev === post.id ? null : post.id
                          )
                        }
                        className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full hover:bg-gray-100 text-primary-500 transition-colors"
                      >
                        <FiSmile size={16} />
                      </button>
                      <input
                        ref={(el) => (commentInputRefs.current[post.id] = el)}
                        type="text"
                        placeholder="Add a comment..."
                        value={newComment[post.id] || ""}
                        onChange={(e) =>
                          setNewComment((prev) => ({
                            ...prev,
                            [post.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            !e.shiftKey &&
                            newComment[post.id]?.trim()
                          ) {
                            e.preventDefault();
                            handlePostComment(post.id);
                          }
                        }}
                        className="flex-1 bg-transparent border-none text-[11px] sm:text-sm placeholder-gray-400 focus:outline-none"
                      />
                      <button
                        onClick={() => handlePostComment(post.id)}
                        disabled={
                          postingComment.has(post.id) ||
                          !newComment[post.id]?.trim()
                        }
                        className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full text-primary-500 hover:text-white hover:bg-primary-500 disabled:opacity-40"
                      >
                        {postingComment.has(post.id) ? (
                          <span className="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full" />
                        ) : (
                          <FiSend size={16} />
                        )}
                      </button>
                    </div>

                    {activeEmojiPostId === post.id && (
                      <div
                        ref={emojiPickerRef}
                        className="absolute bottom-12 left-0 z-40 shadow-2xl rounded-xl bg-white"
                      >
                        <EmojiPicker
                          onEmojiClick={(emojiData) =>
                            handleEmojiClickForPost(post.id, emojiData)
                          }
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
            )}
          </div>
        ))}

        {/* All Caught Up Message */}
        <div className="flex flex-col items-center justify-center py-8 text-center text-gray-500">
          <div className="w-16 h-16 flex items-center justify-center rounded-full bg-gradient-to-br from-pink-100 to-blue-100 mb-3">
            <FiClock className="text-gray-600 text-3xl" />
          </div>
          <h3 className="font-semibold text-gray-700 text-lg">You’re all caught up!</h3>
          <p className="text-sm text-gray-500 mt-1">You’ve seen all new posts.</p>
        </div>
      </div>
    );
  } else {
    feedSection = (
      <div className="text-center bg-white rounded-xl border p-10 shadow-sm">
        <p className="text-gray-600 mb-4">No posts in the {activeFeed} feed yet.</p>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700 transition-all flex items-center gap-2 mx-auto"
        >
          <FiFeather /> Create First Post
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-0 sm:px-4 py-2 sm:py-6">
      {/* Post Creator */}
      {user && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3 sm:p-4 flex items-center gap-3 mb-4 sm:mb-6 hover:shadow-md transition-all">
          <img
            src={user.avatar}
            alt="User"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-blue-200 object-cover"
          />

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex-1 bg-gray-100 text-gray-600 rounded-full py-2 px-4 text-left text-sm hover:bg-blue-50 hover:text-blue-600 transition-all"
          >
            What&apos;s on your mind, {user.name.split("_")[0]}?
          </button>

          <div className="relative flex items-center gap-2">
            <button
              ref={feedMenuButtonRef}
              onClick={(e) => {
                e.stopPropagation();
                if (!userInfo?.familyCode) return;
                setFeedMenuOpen((prev) => !prev);
              }}
              className={`bg-unset flex items-center gap-1.5 px-3 py-2 rounded-full text-xs sm:text-sm font-medium border transition-all ${
                activeFeed === "family"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-orange-500 text-white border-orange-500"
              } ${userInfo?.familyCode ? "cursor-pointer" : "cursor-default"}`}
              title="Choose feed"
            >
              {activeFeed === "family" ? (
                <MdPeople size={16} />
              ) : (
                <MdPublic size={16} />
              )}
              <span className="hidden sm:inline">
                {activeFeed === "family" ? "Family" : "Public"}
              </span>
              {userInfo?.familyCode && <FiChevronDown size={14} />}
            </button>

            {feedMenuOpen && userInfo?.familyCode && (
              <div
                ref={feedMenuRef}
                className="absolute right-0 top-11 w-44 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50"
              >
                <button
                  onClick={() => {
                    setActiveFeed("public");
                    setFeedMenuOpen(false);
                  }}
                  className={`bg-unset w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-gray-50 ${
                    activeFeed === "public"
                      ? "text-gray-900 font-medium"
                      : "text-gray-700"
                  }`}
                >
                  <MdPublic size={16} />
                  <span>Public</span>
                </button>
                <button
                  onClick={() => {
                    setActiveFeed("family");
                    setFeedMenuOpen(false);
                  }}
                  className={`bg-unset w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-gray-50 ${
                    activeFeed === "family"
                      ? "text-gray-900 font-medium"
                      : "text-gray-700"
                  }`}
                >
                  <MdPeople size={16} />
                  <span>Family</span>
                </button>
              </div>
            )}

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="p-2 sm:p-2.5 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-all"
            >
              <FiImage size={18} />
            </button>
          </div>
        </div>
      )}

    {/* Feed */}
    {
      loadingFeed ? (
        <div className="space-y-5 animate-pulse">
          <PostsShimmer/>
        </div>
      ) : posts.length ? (
        <div className="">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <img
                    src={post.avatar}
                    alt={post.author}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border object-cover cursor-pointer"
                    onClick={() => goToUserProfile(post.authorId)}
                  />
                  <div>
                    <p
                      className="font-semibold text-gray-900 text-sm sm:text-base cursor-pointer"
                      onClick={() => goToUserProfile(post.authorId)}
                    >
                      {post.author}
                    </p>
                    <p className="text-xs text-gray-500">{post.time}</p>
                  </div>
                </div>
                <span className="text-blue-500 flex items-center gap-1 text-xs sm:text-sm">
                  {post.privacy === "family" ? <FiUsers /> : <FiGlobe />}
                  {post.privacy === "family" ? "Family" : "Public"}
                </span>
              </div>

              {/* Media */}
              {post.postVideo ? (
                <div
                  className="relative w-full bg-black group overflow-hidden"
                >
                  <video
                    src={post.postVideo}
                    className="w-full h-auto max-h-[700px] object-contain transition-transform duration-500"
                    controls
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              ) : (
                post.fullImageUrl && (
                  <div
                    className="relative w-full bg-black cursor-pointer group overflow-hidden"
                    onClick={() => handleViewPost(post)}
                  >
                    <img
                      src={post.fullImageUrl}
                      alt="Post"
                      className="w-full h-auto max-h-[700px] object-contain transition-transform duration-500"
                      loading="lazy"
                    />

                    {/* ❤️ Like animation overlay */}
                    {likedPostId === post.id && showHeartAnimation && (
                      <div className="absolute inset-0 flex items-center justify-center bg-transparent animate-heart-pop">
                        <FaHeart className="text-pink-700 text-7xl drop-shadow-lg" />
                      </div>
                    )}
                  </div>
                )
              )}

              {/* Caption */}
              {post.caption && (
                <div className="px-4 py-2 text-sm text-gray-700">
                  <span
                    className="font-semibold mr-1 cursor-pointer"
                    onClick={() => goToUserProfile(post.authorId)}
                  >
                    {post.author}
                  </span>
                  {post.caption}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <div className="flex items-center gap-8">
                  {/* Like */}
                  <button
                    onClick={() => handleLike(post.id)}
                    className="flex items-center bg-white gap-2 text-gray-700 hover:text-pink-600 transition-colors duration-200 active:scale-95"
                  >
                    {post.liked ? (
                      <FaHeart size={20} className="text-pink-600" />
                    ) : (
                      <FaRegHeart size={20} />
                    )}
                    <span className="text-sm">{post.likes}</span>
                  </button>

                  {/* Comment */}
                  <button
                    onClick={() => handleCommentClick(post.id)}
                    className="flex items-center bg-white gap-2 text-gray-700 hover:text-blue-600 transition-colors duration-200 active:scale-95"
                  >
                    <FaCommentDots size={19} />
                    <span className="text-sm">{post.comments}</span>
                  </button>
                </div>
              </div>

              {/* Comments */}
              {post.showComments && (
                <div className="px-4 pb-4 border-t border-gray-100 mt-2 animate-fadeIn">
                  <div className="max-w-[80%] sm:max-w-[70%] ml-6 mx-auto">
                    <h4 className="text-sm font-semibold text-gray-800 mt-3 mb-2 flex items-center gap-2">
                      <FaCommentDots size={19} className="text-gray-600" />
                      Comments
                    </h4>

                    {/* 🌀 Loading Skeleton */}
                    {loadingComments.has(post.id) ? (
                      <div className="space-y-3 mt-3">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="flex items-start gap-3 bg-gray-50 border border-gray-200/60 p-2.5 rounded-xl animate-pulse"
                          >
                            <div className="w-8 h-8 rounded-full bg-gray-300"></div>
                            <div className="flex-1 space-y-2">
                              <div className="w-24 h-3 bg-gray-300 rounded"></div>
                              <div className="w-3/4 h-3 bg-gray-200 rounded"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : postComments[post.id]?.length ? (
                      <>
                        {/* 💬 Show limited comments - Instagram style with nested replies */}
                        <div className="sp mt-2 space-y-3">
                          {buildCommentTree(postComments[post.id])
                            .slice(0, visibleComments[post.id] || 3)
                            .map((comment) => {
                              const renderComment = (cmt, isReply = false) => {
                                const isOwner =
                                  cmt.userId === user?.id ||
                                  cmt.userId === userInfo?.userId;

                                const commentKey =
                                  cmt.id !== undefined && cmt.id !== null && cmt.id !== ""
                                    ? String(cmt.id)
                                    : `comment-${post.id}-${cmt.createdAt || ""}-${
                                        cmt.userId || cmt.user?.userId || ""
                                      }`;

                                return (
                                  <div
                                    key={commentKey}
                                    className={isReply ? "ml-10 mt-2" : ""}
                                  >
                                    <div className="flex items-start gap-2.5 opacity-0 animate-fadeIn">
                                      <img
                                        src={
                                          cmt.user?.profile ||
                                          "/assets/user.png"
                                        }
                                        alt="User"
                                        className="w-8 h-8 rounded-full object-cover border border-gray-200"
                                      />
                                      <div className="flex-1">
                                        {editingCommentId === cmt.id ? (
                                          <div className="mt-1">
                                            <input
                                              type="text"
                                              autoFocus
                                              value={
                                                editCommentText[cmt.id] || ""
                                              }
                                              onChange={(e) =>
                                                setEditCommentText({
                                                  ...editCommentText,
                                                  [cmt.id]: e.target.value,
                                                })
                                              }
                                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                            <div className="flex gap-2 mt-2">
                                              <button
                                                onClick={() =>
                                                  handleEditComment(
                                                    cmt.id,
                                                    post.id
                                                  )
                                                }
                                                className="px-3 py-1 bg-blue-500 text-white rounded-lg text-xs hover:bg-blue-600"
                                              >
                                                Save
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setEditingCommentId(null);
                                                  setEditCommentText({});
                                                }}
                                                className="px-3 py-1 bg-gray-300 text-gray-700 rounded-lg text-xs hover:bg-gray-400"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <>
                                            <div className="text-[13px]">
                                              <span className="font-semibold text-gray-900 mr-2">
                                                {cmt.user?.firstName}{" "}
                                                {cmt.user?.lastName}
                                              </span>
                                              <span className="text-gray-700">
                                                {cmt.content}
                                              </span>
                                            </div>

                                            <div className="flex items-center gap-4 mt-1 text-[12px] text-gray-500">
                                              <span className="text-[11px]">
                                                {new Date(
                                                  cmt.createdAt
                                                ).toLocaleDateString("en-US", {
                                                  month: "short",
                                                  day: "numeric",
                                                })}
                                              </span>
                                              <button
                                                onClick={() =>
                                                  setReplyingToCommentId(cmt.id)
                                                }
                                                className="font-medium hover:text-gray-700 bg-transparent"
                                              >
                                                Reply
                                              </button>
                                              {isOwner && (
                                                <>
                                                  <button
                                                    onClick={() => {
                                                      setEditingCommentId(
                                                        cmt.id
                                                      );
                                                      setEditCommentText({
                                                        [cmt.id]: cmt.content,
                                                      });
                                                    }}
                                                    className="font-medium hover:text-gray-700 bg-transparent"
                                                  >
                                                    Edit
                                                  </button>
                                                  <button
                                                    onClick={() =>
                                                      handleDeleteComment(
                                                        cmt.id,
                                                        post.id
                                                      )
                                                    }
                                                    className="font-medium text-red-500 hover:text-red-700 bg-transparent"
                                                  >
                                                    Delete
                                                  </button>
                                                </>
                                              )}
                                            </div>

                                            {replyingToCommentId === cmt.id && (
                                              <div className="mt-2">
                                                <input
                                                  type="text"
                                                  autoFocus
                                                  placeholder="Write a reply..."
                                                  value={
                                                    replyText[cmt.id] || ""
                                                  }
                                                  onChange={(e) =>
                                                    setReplyText({
                                                      ...replyText,
                                                      [cmt.id]: e.target.value,
                                                    })
                                                  }
                                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                />
                                                <div className="flex gap-2 mt-2">
                                                  <button
                                                    onClick={() =>
                                                      handleReplyToComment(
                                                        cmt.id,
                                                        post.id
                                                      )
                                                    }
                                                    className="px-3 py-1 bg-blue-500 text-white rounded-lg text-xs hover:bg-blue-600"
                                                  >
                                                    Reply
                                                  </button>
                                                  <button
                                                    onClick={() => {
                                                      setReplyingToCommentId(
                                                        null
                                                      );
                                                      setReplyText({});
                                                    }}
                                                    className="px-3 py-1 bg-gray-300 text-gray-700 rounded-lg text-xs hover:bg-gray-400"
                                                  >
                                                    Cancel
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>

                                    {/* Render nested replies */}
                                    {cmt.replies && cmt.replies.length > 0 && (
                                      <div className="ml-10 mt-2 space-y-2">
                                        {cmt.replies.map((reply) =>
                                          renderComment(reply, true)
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              };

                              return renderComment(comment);
                            })}
                        </div>

                        {/* 🔽 View all comments link - Instagram style */}
                        {postComments[post.id].length > 3 && (
                          <button
                            onClick={() => handleViewPost(post)}
                            className="text-[13px] bg-white text-gray-500 hover:text-gray-700 mt-2 font-normal"
                          >
                            View all {postComments[post.id].length} comments
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-4 text-gray-500 text-sm italic">
                        No comments yet.
                      </div>
                    )}

                    {/* ✏️ Add comment box */}
                    <div className="mt-3 relative max-w-[95%] sm:max-w-full mx-auto">
                      <div className="flex items-center gap-2 px-3 py-1 bg-white text-gray-700 rounded-lg border border-gray-200 shadow-sm sm:py-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveEmojiPostId((prev) =>
                              prev === post.id ? null : post.id
                            )
                          }
                          className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full hover:bg-gray-100 text-primary-500 transition-colors"
                        >
                          <FiSmile size={16} />
                        </button>
                        <input
                          ref={(el) => (commentInputRefs.current[post.id] = el)}
                          type="text"
                          placeholder="Add a comment..."
                          value={newComment[post.id] || ""}
                          onChange={(e) =>
                            setNewComment((prev) => ({
                              ...prev,
                              [post.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (
                              e.key === "Enter" &&
                              !e.shiftKey &&
                              newComment[post.id]?.trim()
                            ) {
                              e.preventDefault();
                              handlePostComment(post.id);
                            }
                          }}
                          className="flex-1 bg-transparent border-none text-[11px] sm:text-sm placeholder-gray-400 focus:outline-none"
                        />
                        <button
                          onClick={() => handlePostComment(post.id)}
                          disabled={
                            postingComment.has(post.id) ||
                            !newComment[post.id]?.trim()
                          }
                          className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full text-primary-500 hover:text-white hover:bg-primary-500 disabled:opacity-40"
                        >
                          {postingComment.has(post.id) ? (
                            <span className="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full" />
                          ) : (
                            <FiSend size={16} />
                          )}
                        </button>
                      </div>

                      {activeEmojiPostId === post.id && (
                        <div
                          ref={emojiPickerRef}
                          className="absolute bottom-12 left-0 z-40 shadow-2xl rounded-xl bg-white"
                        >
                          <EmojiPicker
                            onEmojiClick={(emojiData) =>
                              handleEmojiClickForPost(post.id, emojiData)
                            }
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
              )}
            </div>
          ))}

          {/* All Caught Up Message */}
          <div className="flex flex-col items-center justify-center py-8 text-center text-gray-500">
            <div className="w-16 h-16 flex items-center justify-center rounded-full bg-gradient-to-br from-pink-100 to-blue-100 mb-3">
              <FiClock className="text-gray-600 text-3xl" />
            </div>
            <h3 className="font-semibold text-gray-700 text-lg">
              You’re all caught up!
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              You’ve seen all new posts.
            </p>
          </div>
        </div>
      ) : (
        <div className="text-center bg-white rounded-xl border p-10 shadow-sm">
          <p className="text-gray-600 mb-4">
            No posts in the {activeFeed} feed yet.
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700 transition-all flex items-center gap-2 mx-auto"
          >
            <FiFeather /> Create First Post
          </button>
        </div>
      )}

      {/* Floating Create Button */}
      <button
        onClick={() => setIsCreateModalOpen(true)}
        className="fixed bottom-32 right-5 sm:right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 hover:scale-110 transition-all lg:hidden"
      >
        <FiPlusCircle size={26} />
      </button>

      <CreatePostModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onPostCreated={fetchPosts}
        currentUser={userInfo}
        authToken={token}
        mode="create"
      />

      <PostViewerModal
        isOpen={isPostViewerOpen}
        onClose={() => setIsPostViewerOpen(false)}
        post={selectedPost}
        authToken={token}
        currentUser={user}
      />
    </div>
  );
};

export default PostPage;
