import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import {
  FiEdit3,
  FiHeart,
  FiMessageCircle,
  FiGrid,
  FiPlusSquare,
  FiImage,
  FiSettings,
  FiCamera,
  FiTrash2,
} from "react-icons/fi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import CreatePostModal from "../Components/CreatePostModal";
import CreateAlbumModal from "../Components/CreateAlbumModal";
import ProfileFormModal from "../Components/ProfileFormModal";
import GalleryViewerModal from "../Components/GalleryViewerModal";
import PostViewerModal from "../Components/PostViewerModal";
import { UserProvider, useUser } from "../Contexts/UserContext";
import { Phone, Mail } from "lucide-react";
import ShimmerImageCard from "./ShimmerImageCard";

const ProfilePage = () => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const { userInfo, userLoading, refetchUser } = useUser();
  const queryClient = useQueryClient();

  const [showPosts, setShowPosts] = useState(true);
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
  const [isCreateAlbumModalOpen, setIsCreateAlbumModalOpen] = useState(false);
  const [isProfileFormModalOpen, setIsProfileFormModalOpen] = useState(false);

  const [isGalleryViewerOpen, setIsGalleryViewerOpen] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState(null);

  const [isPostViewerOpen, setIsPostViewerOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);

  // --- State for Edit operations ---
  const [isEditPostModalOpen, setIsEditPostModalOpen] = useState(false);
  const [postToEditDetails, setPostToEditDetails] = useState(null); // This will hold the detailed API response for edit
  const [isEditAlbumModalOpen, setIsEditAlbumModalOpen] = useState(false);
  const [albumToEdit, setAlbumToEdit] = useState(null);
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  const toggleBioExpanded = () => setIsBioExpanded(!isBioExpanded);

  const privacyMutation = useMutation({
    mutationFn: async (isPrivate) => {
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/user/privacy`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ isPrivate }),
        },
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to update privacy');
      }

      return response.json();
    },
    onSuccess: async () => {
      await refetchUser();
      Swal.fire({
        icon: 'success',
        title: 'Updated',
        text: 'Privacy updated successfully.',
        timer: 1500,
        showConfirmButton: false,
      });
    },
    onError: (err) => {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err?.message || 'Failed to update privacy',
      });
    },
  });

  useEffect(() => {
    const storedToken = localStorage.getItem("access_token");
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  useEffect(() => {
    if (!userInfo) return;

    const userObj = {
      profileImage: userInfo.profileUrl || "/assets/user.png",
      name: userInfo.name || "Username",
      fullName: `${userInfo.firstName || ""} ${userInfo.lastName || ""}`.trim(),
      basicInfo: userInfo.bio ? userInfo.bio.split(".")[0] : "Family member",
      bio: userInfo.bio || "No bio yet",
      contactNumber: userInfo.contactNumber || "",
      email: userInfo.email || "",
      familyCode:
        userInfo.familyCode ||
        userInfo.raw?.familyMember?.familyCode ||
        "Not assigned",
      postsCount: 0,
      galleryCount: 0,
    };

    setUser(userObj);
  }, [userInfo]);

  // Use React Query for posts with caching
  const { data: userPosts = [], isLoading: loadingPosts } = useQuery({
    queryKey: ["userPosts", userInfo?.userId],
    queryFn: async () => {
      const headers = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/post/by-options?createdBy=${
          userInfo.userId
        }`,
        { headers }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const json = await response.json();
      const list = Array.isArray(json)
        ? json
        : Array.isArray(json?.data)
        ? json.data
        : [];

      return list.map((post) => ({
        id: post.id,
        type: post.postVideo ? "video" : "image",
        url: post.postImage,
        fullImageUrl: post.postImage,
        postVideo: post.postVideo,
        caption: post.caption,
        likes: post.likeCount,
        isLiked: post.isLiked,
        comments: new Array(post.commentCount).fill(""),
        privacy: post.privacy,
        familyCode: post.familyCode,
      }));
    },
    enabled: !!userInfo?.userId && !!token,
    staleTime: 3 * 60 * 1000, // 3 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });

  // Use React Query for galleries with caching
  const { data: userGalleries = [], isLoading: loadingGalleries } = useQuery({
    queryKey: ["userGalleries", userInfo?.userId],
    queryFn: async () => {
      const headers = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/gallery/by-options?createdBy=${
          userInfo.userId
        }`,
        { headers }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const json = await response.json();
      const list = Array.isArray(json)
        ? json
        : Array.isArray(json?.data)
        ? json.data
        : [];

      return list.map((gallery) => ({
        id: gallery.id,
        title: gallery.galleryTitle,
        description: gallery.galleryDescription,
        author: userInfo.firstName + " " + userInfo.lastName,
        cover: gallery.coverPhoto,
        photosCount: gallery.galleryAlbums.length,
        likes: gallery.likeCount,
        isLiked: gallery.isLiked,
        comments: new Array(gallery.commentCount).fill(""),
        photos: gallery.galleryAlbums.map((photo, index) => ({
          id: photo.id,
          url: photo.album,
          caption: `Photo ${index + 1}`,
          likes: 0,
          comments: [],
        })),
      }));
    },
    enabled: !!userInfo?.userId && !!token,
    staleTime: 3 * 60 * 1000, // 3 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });

  // Update user profile when userInfo or counts change
  useEffect(() => {
    if (!userInfo) {
      setUser(null);
      return;
    }

    const userObj = {
      profileImage: userInfo.profileUrl || "/assets/user.png",
      name: userInfo.name || "Username",
      fullName: `${userInfo.firstName || ""} ${userInfo.lastName || ""}`.trim(),
      basicInfo: userInfo.bio ? userInfo.bio.split(".")[0] : "Family member",
      bio: userInfo.bio || "No bio yet",
      contactNumber: userInfo.contactNumber || "",
      email: userInfo.email || "",
      familyCode:
        userInfo.familyCode ||
        userInfo.raw?.familyMember?.familyCode ||
        "Not assigned",
      postsCount: userPosts.length,
      galleryCount: userGalleries.length,
    };

    setUser(userObj);
  }, [userInfo, userPosts.length, userGalleries.length]);

  const handlePostCreated = () => {
    queryClient.invalidateQueries({
      queryKey: ["userPosts", userInfo?.userId],
    });
  };

  const onGalleryCreated = () => {
    queryClient.invalidateQueries({
      queryKey: ["userGalleries", userInfo?.userId],
    });
  };

  const handleCreatePostClick = () => setIsCreatePostModalOpen(true);
  const handleCreateAlbumClick = () => setIsCreateAlbumModalOpen(true);
  const handleEditProfileClick = () => setIsProfileFormModalOpen(true);

  const handleViewAlbum = (album) => {
    setSelectedAlbum(album);
    setIsGalleryViewerOpen(true);
  };

  const handleCloseGalleryViewer = () => {
    setIsGalleryViewerOpen(false);
    setSelectedAlbum(null);
  };

  const handleViewPost = (post) => {
    setSelectedPost(post);
    setIsPostViewerOpen(true);
  };

  const handleClosePostViewer = () => {
    setIsPostViewerOpen(false);
    setSelectedPost(null);
  };

  const handleLikePostInModal = (postId) => {
    setUserPosts((prevPosts) =>
      prevPosts.map((post) => {
        if (post.id === postId) {
          const newIsLiked = !post.isLiked;
          const newLikes = newIsLiked ? post.likes + 1 : post.likes - 1;
          return { ...post, likes: newLikes, isLiked: newIsLiked };
        }
        return post;
      })
    );
    setSelectedPost((prevPost) => {
      if (!prevPost || prevPost.id !== postId) return prevPost;
      const newIsLiked = !prevPost.isLiked;
      const newLikes = newIsLiked ? prevPost.likes + 1 : prevPost.likes - 1;
      return { ...prevPost, likes: newLikes, isLiked: newIsLiked };
    });
  };

  // Use mutation for like toggle with optimistic updates
  const likeMutation = useMutation({
    mutationFn: async ({ postId, currentIsLiked }) => {
      const url = `${import.meta.env.VITE_API_BASE_URL}/post/${postId}/like-toggle`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to toggle like: ${response.statusText}`);
      }
      return response.json();
    },
    onMutate: async ({ postId, currentIsLiked }) => {
      // Optimistically update the cache
      await queryClient.cancelQueries({
        queryKey: ["userPosts", userInfo?.userId],
      });
      const previousPosts = queryClient.getQueryData([
        "userPosts",
        userInfo?.userId,
      ]);

      queryClient.setQueryData(["userPosts", userInfo?.userId], (old) =>
        old?.map((post) =>
          post.id === postId
            ? {
                ...post,
                isLiked: !currentIsLiked,
                likes: currentIsLiked ? post.likes - 1 : post.likes + 1,
              }
            : post
        )
      );

      return { previousPosts };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      queryClient.setQueryData(
        ["userPosts", userInfo?.userId],
        context.previousPosts
      );
      console.error("Error toggling like:", err);
    },
  });

  const handleLikeToggle = (postId, currentIsLiked) => {
    likeMutation.mutate({ postId, currentIsLiked });
  };

  // --- Edit Handler for Posts ---
  const handleEditPost = async (e, postId) => {
    // Now accepts postId directly
    e.stopPropagation();
    try {
      const headers = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/post/${postId}`,
        { headers }
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch post details: ${response.statusText}`);
      }
      const data = await response.json();

      // Format the fetched data to match what your modal expects
      const formattedPostDetails = {
        id: data.data.id,
        caption: data.data.caption,
        privacy: data.data.privacy,
        familyCode: data.data.familyCode,
        url: data.data.postImage,
        postVideo: data.data.postVideo,
      };

      setPostToEditDetails(formattedPostDetails);
      setIsEditPostModalOpen(true);
    } catch (error) {
      console.error("Error fetching post for edit:", error);
      Swal.fire({
        icon: "error",
        title: "Failed to load",
        text: "Failed to load post for editing.",
      });
    }
  };

  const handleDeletePost = async (e, postId) => {
    e.stopPropagation();
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "This post and all related comments/likes will be permanently deleted.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    });

    if (result.isConfirmed) {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/post/delete/${postId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to delete post: ${response.statusText}`);
        }

        await Swal.fire({
          icon: "success",
          title: "Deleted!",
          text: "Post has been deleted successfully.",
          confirmButtonColor: "#3f982c",
        });

        queryClient.invalidateQueries({
          queryKey: ["userPosts", userInfo?.userId],
        }); // Refresh posts
      } catch (error) {
        console.error("Error deleting post:", error);
        Swal.fire({
          icon: "error",
          title: "Error!",
          text: "Failed to delete the post. Please try again later.",
          confirmButtonColor: "#d33",
        });
      }
    }
  };

  const handlePostUpdated = () => {
    setIsEditPostModalOpen(false);
    setPostToEditDetails(null);
    queryClient.invalidateQueries({
      queryKey: ["userPosts", userInfo?.userId],
    });
  };

  const handleEditAlbum = async (e, albumId, userId) => {
    e.stopPropagation();
    try {
      const response = await fetch(
        `${
          import.meta.env.VITE_API_BASE_URL
        }/gallery/${albumId}?userId=${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch album: ${response.statusText}`);
      }

      const data = await response.json();

      // Format the album data for the edit modal
      const formattedAlbum = {
        id: data.id,
        title: data.galleryTitle,
        description: data.galleryDescription,
        privacy: data.privacy,
        familyCode: data.familyCode,
        coverPhotoUrl: data.coverPhoto,
        galleryPhotos: data.galleryAlbums.map((photo) => ({
          id: photo.id,
          url: photo.album,
        })),
      };

      setAlbumToEdit(formattedAlbum);
      setIsEditAlbumModalOpen(true);
    } catch (error) {
      console.error("Error fetching album for edit:", error);
      Swal.fire({
        icon: "error",
        title: "Error!",
        text: "Failed to load album for editing.",
        confirmButtonColor: "#d33",
      });
    }
  };

  const handleAlbumUpdated = () => {
    setIsEditAlbumModalOpen(false);
    setAlbumToEdit(null);
    queryClient.invalidateQueries({
      queryKey: ["userGalleries", userInfo?.userId],
    });
  };

  const handleDeleteAlbum = async (e, albumId) => {
    e.stopPropagation();

    const result = await Swal.fire({
      title: "Are you sure?",
      text: "This gallery and all its photos will be permanently deleted.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    });

    if (result.isConfirmed) {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/gallery/${albumId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to delete gallery: ${response.statusText}`);
        }

        await Swal.fire({
          icon: "success",
          title: "Deleted!",
          text: "Gallery has been deleted successfully.",
          confirmButtonColor: "#3f982c",
        });

        queryClient.invalidateQueries({
          queryKey: ["userGalleries", userInfo?.userId],
        }); // Refresh album list
      } catch (error) {
        console.error("Error deleting gallery:", error);
        Swal.fire({
          icon: "error",
          title: "Error!",
          text: "Failed to delete the gallery. Please try again later.",
          confirmButtonColor: "#d33",
        });
      }
    }
  };

  const loadingUserProfile = userLoading || !user;

  return (
    <>
      <div className="mx-auto px-4 pt-4 pb-24 md:px-6 lg:px-8 space-y-8  font-inter">
        {/* Profile Header Section */}
        {loadingUserProfile ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-primary-600 border-solid"></div>
          </div>
        ) : (
          user && (
            <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-8 border border-gray-100">
              <div className="flex-shrink-0">
                <img
                  src={user.profileImage}
                  alt="Profile"
                  className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-primary-400 shadow-lg"
                />
              </div>
              <div className="flex-grow text-center md:text-left">
                <div className="flex flex-col md:flex-row items-center md:justify-between mb-3 gap-2">
                  <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 leading-tight">
                      {user.name}
                    </h1>
                    {user.familyCode && (
                      <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
                        <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                          Family Code: {user.familyCode}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
                      <FiSettings size={18} />
                      <span className="font-medium">Private Account</span>
                      <button
                        type="button"
                        onClick={() =>
                          privacyMutation.mutate(!Boolean(userInfo?.isPrivate))
                        }
                        disabled={
                          privacyMutation.isPending ||
                          !token ||
                          typeof userInfo?.isPrivate !== 'boolean'
                        }
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-opacity-75 ${
                          userInfo?.isPrivate ? 'bg-primary-600' : 'bg-gray-300'
                        } ${
                          privacyMutation.isPending || !token
                            ? 'opacity-60 cursor-not-allowed'
                            : 'cursor-pointer'
                        }`}
                        aria-pressed={Boolean(userInfo?.isPrivate)}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            userInfo?.isPrivate
                              ? 'translate-x-5'
                              : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </label>

                    <button
                      onClick={handleEditProfileClick}
                      className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-5 py-2.5 rounded-xl shadow-lg hover:bg-secondary-700 transition duration-300 flex items-center gap-2 font-medium text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-opacity-75"
                    >
                      <FiEdit3 size={18} /> Edit Profile
                    </button>
                  </div>
                </div>

                <div className="text-gray-800 leading-relaxed text-sm md:text-base whitespace-pre-wrap">
                  <p className={isBioExpanded ? "" : "line-clamp-2"}>
                    {user.bio}
                  </p>
                  {user.bio.length > 100 && (
                    <button
                      onClick={toggleBioExpanded}
                      className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-full shadow hover:bg-primary-700 transition"
                    >
                      {isBioExpanded ? "See Less" : "See More"}
                    </button>
                  )}
                </div>

                {(user.contactNumber || user.email) && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex flex-col sm:flex-row gap-4">
                      {user.contactNumber && (
                        <div className="flex items-center gap-2 text-gray-700 text-sm">
                          <Phone size={16} className="text-gray-500" />
                          <span>{user.contactNumber}</span>
                        </div>
                      )}
                      {user.email && (
                        <div className="flex items-center gap-2 text-gray-700 text-sm">
                          <Mail size={16} className="text-gray-500" />
                          <span>{user.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex justify-center md:justify-start gap-8 mt-5 pt-4 border-t border-gray-100">
                  <div className="text-center">
                    <span className="block font-bold text-xl md:text-2xl text-gray-900">
                      {user.postsCount}
                    </span>
                    <span className="block text-sm text-gray-500">Posts</span>
                  </div>
                  <div className="text-center">
                    <span className="block font-bold text-xl md:text-2xl text-gray-900">
                      {user.galleryCount}
                    </span>
                    <span className="block text-sm text-gray-500">
                      Galleries
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        )}

        {/* Content Toggles and Add Buttons */}
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm p-2 md:p-3 border border-gray-100 gap-1 md:gap-3 w-full">
          <div className="flex flex-1 items-center gap-1 md:gap-2">
            <button
              onClick={() => setShowPosts(true)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg font-semibold text-sm transition-all duration-300 ${
                showPosts
                  ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow"
                  : "text-white bg-primary-700 hover:bg-primary-800"
              }`}
            >
              <FiGrid size={20} />
              <span className="hidden sm:inline">Created Posts</span>
              <span className="sm:hidden">Posts</span>
            </button>
            <button
              onClick={handleCreatePostClick}
              className="p-2 rounded-full bg-primary-600 text-white shadow hover:bg-primary-700 transition duration-300 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-opacity-75"
              title="Create New Post"
            >
              <FiPlusSquare size={20} />
            </button>
          </div>
          <span className="text-gray-200 px-1 md:px-2" style={{ fontSize: 18 }}>
            |
          </span>
          <div className="flex flex-1 items-center gap-1 md:gap-2">
            <button
              onClick={() => setShowPosts(false)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg font-semibold text-sm transition-all duration-300 ${
                !showPosts
                  ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow"
                  : "text-white hover:bg-primary-700"
              }`}
            >
              <FiImage size={20} />
              <span className="hidden sm:inline">Created Galleries</span>
              <span className="sm:hidden">Galleries</span>
            </button>
            <button
              onClick={handleCreateAlbumClick}
              className="p-2 rounded-full bg-primary-600 text-white shadow hover:bg-primary-700 transition duration-300 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-opacity-75"
              title="Create New Gallery"
            >
              <FiCamera size={20} />
            </button>
          </div>
        </div>

        {/* Content Display Area */}
        {showPosts ? (
          loadingPosts ? (
            <div className="flex flex-col sm:flex-row gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <ShimmerImageCard key={i} width={380} height={280} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {userPosts.length > 0 ? (
                userPosts.map((post) => (
                  <div
                    key={post.id}
                    className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100
                                            transform hover:scale-[1.02] hover:shadow-lg transition-all duration-300 cursor-pointer group relative"
                    onClick={() => handleViewPost(post)}
                  >
                    <div className="relative w-full h-64 overflow-hidden">
                      {post.postVideo ? (
                        <video
                          src={post.postVideo}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                          controls
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : post.fullImageUrl ? (
                        <img
                          src={post.fullImageUrl}
                          alt="Post image"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                      ) : (
                        <div className="text-white text-center text-lg italic">
                          No media available for this post.
                        </div>
                      )}

                      <div
                        className="absolute top-2 right-2 flex gap-2
     opacity-100
     md:opacity-0 md:group-hover:opacity-100
     transition-opacity duration-300"
                      >
                        <button
                          onClick={(e) => handleEditPost(e, post.id)}
                          className="bg-white p-1.5 rounded-full shadow-md text-gray-700 hover:text-primary-600 hover:bg-gray-100 transition-colors"
                          title="Edit Post"
                        >
                          <FiEdit3 size={16} />
                        </button>

                        <button
                          onClick={(e) => handleDeletePost(e, post.id)}
                          className="bg-white p-1.5 rounded-full shadow-md text-red-500 hover:text-red-700 hover:bg-gray-100 transition-colors"
                          title="Delete Post"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="text-sm font-medium text-gray-800 mb-2 line-clamp-2">
                        {post.caption}
                      </p>
                      <div className="flex items-center text-gray-500 text-xs gap-4">
                        <span
                          className="flex items-center gap-1 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLikeToggle(post.id, post.isLiked);
                          }}
                        >
                          <FiHeart
                            size={14}
                            className={
                              post.isLiked
                                ? "text-secondary-600"
                                : "text-gray-400"
                            }
                          />
                          {post.likes}
                        </span>
                        <span className="flex items-center gap-1">
                          <FiMessageCircle size={14} /> {post.comments.length}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="lg:col-span-3 text-center py-12 bg-white rounded-2xl shadow-md border border-gray-100">
                  <p className="text-gray-500 text-lg mb-4">
                    No posts yet. Share your first family moment!
                  </p>
                </div>
              )}
            </div>
          )
        ) : loadingGalleries ? (
          <div className="flex flex-col sm:flex-row gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <ShimmerImageCard key={i} width={380} height={280} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {userGalleries.length > 0 ? (
              userGalleries.map((gallery) => (
                <div
                  key={gallery.id}
                  className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100
                                            transform hover:scale-[1.02] hover:shadow-lg transition-all duration-300 cursor-pointer group relative"
                  onClick={() => handleViewAlbum(gallery)}
                >
                  <div className="relative w-full h-64 overflow-hidden">
                    <img
                      src={gallery.cover}
                      alt={gallery.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-4">
                      <div className="text-white">
                        <h3 className="text-lg font-semibold mb-0.5">
                          {gallery.title}
                        </h3>
                        <p className="text-sm opacity-90">
                          {gallery.photosCount} photos
                        </p>
                      </div>
                    </div>
                    <div
                      className="absolute top-2 right-2 flex gap-2
     opacity-100
     md:opacity-0 md:group-hover:opacity-100
     transition-opacity duration-300"
                    >
                      <button
                        onClick={(e) =>
                          handleEditAlbum(e, gallery.id, gallery.createdBy)
                        }
                        className="bg-white p-1.5 rounded-full shadow-md text-gray-700 hover:text-primary-600 hover:bg-gray-100 transition-colors"
                        title="Edit Gallery"
                      >
                        <FiEdit3 size={16} />
                      </button>

                      <button
                        onClick={(e) => handleDeleteAlbum(e, gallery.id)}
                        className="bg-white p-1.5 rounded-full shadow-md text-red-500 hover:text-red-700 hover:bg-gray-100 transition-colors"
                        title="Delete Gallery"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="lg:col-span-3 text-center py-12 bg-white rounded-2xl shadow-md border border-gray-100">
                <p className="text-gray-500 text-lg mb-4">
                  No galleries yet. Organize your cherished memories!
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}

      <CreateAlbumModal
        isOpen={isCreateAlbumModalOpen}
        onClose={() => setIsCreateAlbumModalOpen(false)}
        onCreateAlbum={onGalleryCreated}
        currentUser={userInfo}
        authToken={token}
        mode="create"
      />
      <CreateAlbumModal
        isOpen={isEditAlbumModalOpen}
        onClose={() => setIsEditAlbumModalOpen(false)}
        onCreateAlbum={handleAlbumUpdated}
        currentUser={userInfo}
        authToken={token}
        mode="edit"
        albumData={albumToEdit}
      />
      <ProfileFormModal
        isOpen={isProfileFormModalOpen}
        onClose={() => setIsProfileFormModalOpen(false)}
        mode="edit-profile"
        onProfileUpdated={refetchUser}
      />
      <CreatePostModal
        isOpen={isCreatePostModalOpen}
        onClose={() => setIsCreatePostModalOpen(false)}
        onPostCreated={handlePostCreated}
        currentUser={userInfo}
        authToken={token}
        mode="create"
      />
      <CreatePostModal
        isOpen={isEditPostModalOpen}
        onClose={() => setIsEditPostModalOpen(false)}
        onPostCreated={handlePostUpdated}
        currentUser={userInfo}
        authToken={token}
        mode="edit"
        postData={postToEditDetails}
      />
      <GalleryViewerModal
        isOpen={isGalleryViewerOpen}
        onClose={handleCloseGalleryViewer}
        album={selectedAlbum || null}
        currentUser={userInfo}
        authToken={token}
      />
      <PostViewerModal
        isOpen={isPostViewerOpen}
        onClose={handleClosePostViewer}
        post={selectedPost}
        onLikePost={handleLikePostInModal}
        authToken={token}
        currentUser={user}
      />
    </>
  );
};

export default ProfilePage;
