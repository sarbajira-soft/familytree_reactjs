import React, { useState, useEffect, useRef } from "react";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
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
import GalleryViewerModal from "../Components/GalleryViewerModal";
import PostViewerModal from "../Components/PostViewerModal";
import { UserProvider, useUser } from "../Contexts/UserContext";
import { Phone, Mail } from "lucide-react";
import ShimmerImageCard from "./ShimmerImageCard";
import ProfileShimmer from "./ProfileShimmer";

import DeleteConfirmationModal from "../Components/DeleteConfirmationModal";
import { authFetch, authFetchResponse } from "../utils/authFetch";
import { getToken } from "../utils/auth";
import { getGalleryListFromApiResponse, mapGalleryDetail, mapGallerySummary } from "../utils/galleryAdapter";
import { toast } from "react-toastify";

const PROFILE_ITEMS_PER_PAGE = 9;

const getPrivacyBadgeConfig = (privacy) => {
  const normalized = String(privacy || '').toLowerCase();

  if (normalized === 'family') {
    return { label: 'Family', className: 'bg-blue-600/90 text-white' };
  }

  if (normalized === 'public') {
    return { label: 'Public', className: 'bg-orange-600/90 text-white' };
  }

  if (normalized) {
    return { label: normalized.charAt(0).toUpperCase() + normalized.slice(1), className: 'bg-gray-800/80 text-white' };
  }

  return null;
};

const PaginationControls = ({
  page,
  totalPages,
  totalItems,
  currentItemsCount,
  itemLabel,
  isFetching,
  onPrevious,
  onNext,
}) => {
  if (!totalItems) {
    return null;
  }

  const safeTotalPages = Math.max(Number(totalPages) || 1, 1);
  const startItem = (page - 1) * PROFILE_ITEMS_PER_PAGE + 1;
  const endItem = Math.min(startItem + currentItemsCount - 1, totalItems);

  return (
    <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-gray-600">
        Showing {startItem}-{endItem} of {totalItems} {itemLabel}
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={page <= 1 || isFetching}
          className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-primary-300 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <span className="min-w-[90px] text-center text-sm font-semibold text-gray-700">
          Page {page} of {safeTotalPages}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= safeTotalPages || isFetching}
          className="rounded-full bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
};

const ProfilePage = () => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const { userInfo, userLoading, refetchUser } = useUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [localIsPrivate, setLocalIsPrivate] = useState(
    Boolean(userInfo?.isPrivate),
  );

  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const [profilePhotoError, setProfilePhotoError] = useState("");
  const [postPage, setPostPage] = useState(1);
  const [galleryPage, setGalleryPage] = useState(1);

  const profileFileInputRef = useRef(null);

  const [showPosts, setShowPosts] = useState(true);
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
  const [isCreateAlbumModalOpen, setIsCreateAlbumModalOpen] = useState(false);

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

  // Delete confirmation modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState(null); // 'post' or 'gallery'
  const [isDeleting, setIsDeleting] = useState(false);

  const privacyMutation = useMutation({
    mutationFn: async (isPrivate) => {
      const response = await authFetchResponse(`/user/privacy`, {
        method: "PATCH",
        skipThrow: true,
        body: JSON.stringify({ isPrivate }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || "Failed to update privacy");
      }

      return response.json();
    },
    onMutate: async (nextIsPrivate) => {
      const previous = localIsPrivate;
      setLocalIsPrivate(Boolean(nextIsPrivate));
      return { previous };
    },
    onSuccess: async () => {
      await refetchUser({ silent: true });
      toast.success('Privacy updated successfully.');
    },
    onError: (err, _variables, context) => {
      if (context && typeof context.previous !== 'undefined') {
        setLocalIsPrivate(Boolean(context.previous));
      }
      toast.error(err?.message || 'Failed to update privacy');
    },
  });

  useEffect(() => {
    const storedToken = getToken();
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  useEffect(() => {
    if (!userInfo) return;

    if (typeof userInfo?.isPrivate === 'boolean') {
      setLocalIsPrivate(Boolean(userInfo.isPrivate));
    }

    const userObj = {
      profileImage: userInfo.profileUrl || "/assets/user.png",
      name: userInfo.name || "Username",
      fullName: `${userInfo.firstName || ""} ${userInfo.lastName || ""}`.trim(),
      basicInfo: userInfo.bio ? userInfo.bio.split(".")[0] : "Family member",
      bio: userInfo.bio || "",
      contactNumber: userInfo.contactNumber || "",
      email: userInfo.email || "",
      familyCode:
        userInfo.familyCode ||
        "",
      postsCount: 0,
      galleryCount: 0,
    };

    setUser(userObj);
  }, [userInfo]);

  useEffect(() => {
    setPostPage(1);
    setGalleryPage(1);
  }, [userInfo?.userId]);

  const handleChangePhotoClick = () => {
    if (profileFileInputRef.current) {
      profileFileInputRef.current.click();
    }
  };

  const handleProfilePhotoClick = async () => {
    const profileUrl = (userInfo?.profileUrl || userInfo?.profile || "").trim();
    const hasProfilePhoto = Boolean(profileUrl) && !/\/assets\/user\.png$/i.test(profileUrl);

    const result = await Swal.fire({
      title: "Change Profile Photo",
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: "Upload Photo",
      denyButtonText: "Remove Photo",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#2563eb",
      denyButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      reverseButtons: false,
      didOpen: () => {
        const cancelBtn = Swal.getCancelButton();
        const confirmBtn = Swal.getConfirmButton();
        const denyBtn = Swal.getDenyButton();

        if (cancelBtn) cancelBtn.style.order = "1";
        if (confirmBtn) confirmBtn.style.order = "2";
        if (denyBtn) denyBtn.style.order = "3";
      },
    });

    if (result.isConfirmed) {
      handleChangePhotoClick();
      return;
    }

    if (result.isDenied) {
      await handleRemovePhotoClick({ skipConfirm: true });
    }
  };

  const handleProfilePhotoSelected = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;

    const allowedImageTypes = new Set([
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
    ]);

    if (!allowedImageTypes.has(String(file?.type || '').toLowerCase())) {
      const msg = 'Only image files (jpeg, jpg, png, gif) are allowed.';
      setProfilePhotoError(msg);
      toast.error(msg);
      if (e?.target) {
        e.target.value = '';
      }
      return;
    }

    if (Number(file?.size || 0) > MAX_IMAGE_BYTES) {
      setProfilePhotoError(
        "Image is too large. Please select an image less than 5MB.",
      );
      toast.error("Image is too large. Please select an image less than 5MB.");

      if (e?.target) {
        e.target.value = "";
      }
      return;
    }

    if (profilePhotoError) setProfilePhotoError("");

    try {
      const userId = userInfo?.userId || userInfo?.id;
      if (!userId) {
        throw new Error("User ID not found");
      }

      const formData = new FormData();
      formData.append("profile", file);

      const familyCode =
        userInfo?.familyCode || "";
      if (familyCode) {
        formData.append("familyCode", familyCode);
      }

      const response = await authFetchResponse(
        `/user/profile/update/${userId}`,
        {
          method: "PUT",
          skipThrow: true,
          body: formData,
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || "Failed to update profile picture");
      }

      await refetchUser({ silent: true });
      toast.success('Profile picture updated successfully.');
    } catch (error) {
      toast.error(error?.message || 'Failed to update profile picture');
    } finally {
      if (e?.target) {
        e.target.value = "";
      }
    }
  };

  const handleRemovePhotoClick = async (options = {}) => {
    const { skipConfirm = false } = options;
    const profileUrl = (userInfo?.profileUrl || userInfo?.profile || "").trim();
    const hasProfilePhoto = Boolean(profileUrl) && !/\/assets\/user\.png$/i.test(profileUrl);
    if (!hasProfilePhoto) {
      Swal.fire({
        icon: "info",
        title: "No photo",
        text: "No profile picture to remove.",
        timer: 1500,
        showConfirmButton: false,
      });
      return;
    }

    if (!skipConfirm) {
      const result = await Swal.fire({
        title: "Remove profile picture?",
        text: "Your profile picture will be removed.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Remove",
        cancelButtonText: "Cancel",
      });

      if (!result.isConfirmed) return;
    }

    try {
      const userId = userInfo?.userId || userInfo?.id;
      if (!userId) {
        throw new Error("User ID not found");
      }

      const formData = new FormData();
      formData.append("removeProfile", "true");

      const familyCode =
        userInfo?.familyCode || "";
      if (familyCode) {
        formData.append("familyCode", familyCode);
      }

      const response = await authFetchResponse(
        `/user/profile/update/${userId}`,
        {
          method: "PUT",
          skipThrow: true,
          body: formData,
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || "Failed to remove profile picture");
      }

      await refetchUser({ silent: true });
      toast.success('Profile picture removed successfully.');
    } catch (error) {
      toast.error(error?.message || 'Failed to remove profile picture');
    }
  };

  const userPostsQuery = useQuery({
    queryKey: ["userPosts", userInfo?.userId, postPage],
    queryFn: async () => {
      const json = await authFetch(
        `/post/by-options?createdBy=${userInfo.userId}&page=${postPage}&limit=${PROFILE_ITEMS_PER_PAGE}`,
        { method: "GET" }
      );
      const list = Array.isArray(json)
        ? json
        : Array.isArray(json?.data)
          ? json.data
          : [];

      return {
        items: list.map((post) => ({
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
        })),
        total: Number(json?.total ?? list.length),
        page: Number(json?.page || postPage),
        limit: Number(json?.limit || PROFILE_ITEMS_PER_PAGE),
        totalPages: Math.max(
          Number(
            json?.totalPages ??
            Math.ceil(Number(json?.total ?? list.length) / Number(json?.limit || PROFILE_ITEMS_PER_PAGE)),
          ),
          0,
        ),
        hasMore: Boolean(json?.hasMore),
      };
    },
    enabled: !!userInfo?.userId && !!token,
    placeholderData: (previousData) => previousData,
    staleTime: 3 * 60 * 1000, // 3 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });

  const userGalleriesQuery = useQuery({
    queryKey: ["userGalleries", userInfo?.userId, galleryPage],
    queryFn: async () => {
      const json = await authFetch(
        `/gallery/by-options?createdBy=${userInfo.userId}&page=${galleryPage}&limit=${PROFILE_ITEMS_PER_PAGE}`,
        { method: "GET" }
      );
      const list = getGalleryListFromApiResponse(json);

      return {
        items: list.map((gallery) =>
          mapGallerySummary({
            ...gallery,
            user: {
              ...(gallery.user || {}),
              name: `${userInfo.firstName || ""} ${userInfo.lastName || ""}`.trim() || "Unknown",
              userId: userInfo.userId,
            },
          }),
        ),
        total: Number(json?.total ?? list.length),
        page: Number(json?.page || galleryPage),
        limit: Number(json?.limit || PROFILE_ITEMS_PER_PAGE),
        totalPages: Math.max(
          Number(
            json?.totalPages ??
            Math.ceil(Number(json?.total ?? list.length) / Number(json?.limit || PROFILE_ITEMS_PER_PAGE)),
          ),
          0,
        ),
        hasMore: Boolean(json?.hasMore),
      };
    },
    enabled: !!userInfo?.userId && !!token,
    placeholderData: (previousData) => previousData,
    staleTime: 3 * 60 * 1000, // 3 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });

  const userPosts = userPostsQuery.data?.items || [];
  const userPostsTotal = Number(userPostsQuery.data?.total || 0);
  const userPostsTotalPages = Math.max(Number(userPostsQuery.data?.totalPages || 0), 1);
  const loadingPosts = userPostsQuery.isLoading;
  const fetchingPosts = userPostsQuery.isFetching;

  const userGalleries = userGalleriesQuery.data?.items || [];
  const userGalleriesTotal = Number(userGalleriesQuery.data?.total || 0);
  const userGalleriesTotalPages = Math.max(Number(userGalleriesQuery.data?.totalPages || 0), 1);
  const loadingGalleries = userGalleriesQuery.isLoading;
  const fetchingGalleries = userGalleriesQuery.isFetching;

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
      bio: userInfo.bio || "",
      contactNumber: userInfo.contactNumber || "",
      email: userInfo.email || "",
      familyCode:
        userInfo.familyCode ||
        "",
      postsCount: userPostsTotal,
      galleryCount: userGalleriesTotal,
    };

    setUser(userObj);
  }, [userInfo, userPostsTotal, userGalleriesTotal]);

  const handlePostCreated = async () => {
    setShowPosts(true);
    setPostPage(1);
    await queryClient.invalidateQueries({
      queryKey: ["userPosts", userInfo?.userId],
    });
  };

  const onGalleryCreated = async () => {
    setShowPosts(false);
    setGalleryPage(1);
    await queryClient.invalidateQueries({
      queryKey: ["userGalleries", userInfo?.userId],
    });
  };

  const handleCreatePostClick = () => setIsCreatePostModalOpen(true);
  const handleCreateAlbumClick = () => setIsCreateAlbumModalOpen(true);
  const handleEditProfileClick = () => navigate("/profile/edit");

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
    queryClient.setQueryData(["userPosts", userInfo?.userId, postPage], (old) => {
      if (!old || !Array.isArray(old.items)) {
        return old;
      }

      return {
        ...old,
        items: old.items.map((post) => {
          if (post.id !== postId) {
            return post;
          }

          const newIsLiked = !post.isLiked;
          const newLikes = newIsLiked ? post.likes + 1 : post.likes - 1;
          return { ...post, likes: newLikes, isLiked: newIsLiked };
        }),
      };
    });

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
      const response = await authFetchResponse(`/post/${postId}/like-toggle`, {
        method: "POST",
        skipThrow: true,
      });

      if (!response.ok) {
        throw new Error(`Failed to toggle like: ${response.statusText}`);
      }
      return response.json();
    },
    onMutate: async ({ postId, currentIsLiked }) => {
      // Optimistically update the cache
      await queryClient.cancelQueries({
        queryKey: ["userPosts", userInfo?.userId, postPage],
      });
      const previousPosts = queryClient.getQueryData([
        "userPosts",
        userInfo?.userId,
        postPage,
      ]);

      queryClient.setQueryData(["userPosts", userInfo?.userId, postPage], (old) => {
        if (!old || !Array.isArray(old.items)) {
          return old;
        }

        return {
          ...old,
          items: old.items.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  isLiked: !currentIsLiked,
                  likes: currentIsLiked ? post.likes - 1 : post.likes + 1,
                }
              : post,
          ),
        };
      });

      return { previousPosts };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      queryClient.setQueryData(
        ["userPosts", userInfo?.userId, postPage],
        context.previousPosts
      );
      console.error("Error toggling like:", err);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["userPosts", userInfo?.userId],
      });
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
      const response = await authFetchResponse(`/post/${postId}`, {
        method: "GET",
        skipThrow: true,
      });
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
        postImage: data.data.postImage,
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
    const post = userPosts.find((p) => p.id === postId);
    setItemToDelete({ id: postId, name: post?.caption?.substring(0, 50) || 'this post' });
    setDeleteType('post');
    setIsDeleteModalOpen(true);
  };

  const handlePostUpdated = async () => {
    setIsEditPostModalOpen(false);
    setPostToEditDetails(null);

    await queryClient.invalidateQueries({
      queryKey: ["userPosts", userInfo?.userId],
    });

    toast.success("Post updated successfully!");
  };

  const handleEditAlbum = async (e, albumId) => {
    e.stopPropagation();
    try {
      const response = await authFetchResponse(`/gallery/${albumId}`, {
        method: "GET",
        skipThrow: true,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch album: ${response.statusText}`);
      }

      const data = await response.json();
      const formattedAlbum = mapGalleryDetail(data);

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

  const handleAlbumUpdated = async () => {
    setIsEditAlbumModalOpen(false);
    setAlbumToEdit(null);

    await queryClient.invalidateQueries({
      queryKey: ["userGalleries", userInfo?.userId],
    });

    toast.success("Gallery updated successfully!");
  };

  const handleDeleteAlbum = async (e, albumId) => {
    e.stopPropagation();
    const album = userGalleries.find((g) => g.id === albumId);
    setItemToDelete({ id: albumId, name: album?.title || 'this gallery' });
    setDeleteType('gallery');
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete || !deleteType) return;
    
    setIsDeleting(true);
    try {
      if (deleteType === 'post') {
        const response = await authFetchResponse(`/post/delete/${itemToDelete.id}`, {
          method: "DELETE",
          skipThrow: true,
        });

        if (!response.ok) {
          throw new Error(`Failed to delete post: ${response.statusText}`);
        }

        const shouldGoToPreviousPostPage = postPage > 1 && userPosts.length === 1;
        if (shouldGoToPreviousPostPage) {
          setPostPage((prev) => Math.max(prev - 1, 1));
        }
        await queryClient.invalidateQueries({
          queryKey: ["userPosts", userInfo?.userId],
        });

        toast.success("Post deleted successfully!");
      } else if (deleteType === 'gallery') {
        const response = await authFetchResponse(`/gallery/${itemToDelete.id}`, {
          method: "DELETE",
          skipThrow: true,
        });

        if (!response.ok) {
          throw new Error(`Failed to delete gallery: ${response.statusText}`);
        }

        const shouldGoToPreviousGalleryPage = galleryPage > 1 && userGalleries.length === 1;
        if (shouldGoToPreviousGalleryPage) {
          setGalleryPage((prev) => Math.max(prev - 1, 1));
        }
        await queryClient.invalidateQueries({
          queryKey: ["userGalleries", userInfo?.userId],
        });

        toast.success("Gallery deleted successfully!");
      }
    } catch (error) {
      console.error(`Error deleting ${deleteType}:`, error);
      toast.error(`Failed to delete ${deleteType}. Please try again.`);
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
      setDeleteType(null);
    }
  };

  const loadingUserProfile = userLoading || !user;

  return (
    <>
      <div className="mx-auto px-4 pt-4 pb-24 md:px-6 lg:px-8 space-y-8  font-inter">
        {/* Profile Header Section */}
        {loadingUserProfile ? (
          <ProfileShimmer />
        ) : (
          user && (
            <div className="bg-gradient-to-r from-primary-600 via-primary-500 to-primary-300 rounded-2xl shadow-xl p-[1px]">
              <div className="relative rounded-2xl bg-white overflow-hidden">
                <div className="h-20 md:h-24 bg-gradient-to-r from-primary-600 via-primary-500 to-primary-300" />
                <div className="px-4 pb-4 md:px-8 md:pb-6">
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-6 -mt-10 md:-mt-12">
                    <div className="flex-shrink-0">
                      <div className="flex flex-col items-center gap-3">
                        <button
                          type="button"
                          onClick={handleProfilePhotoClick}
                          className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-opacity-75"
                          title="Change profile photo"
                        >
                          <img
                            src={user.profileImage}
                            alt="Profile"
                            className="w-24 h-24 md:w-28 md:h-28 rounded-full object-cover border-4 border-white shadow-xl cursor-pointer"
                          />
                        </button>

                        <input
                          ref={profileFileInputRef}
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/gif"
                          onChange={handleProfilePhotoSelected}
                          className="hidden"
                        />

                        {profilePhotoError ? (
                          <p className="text-red-600 text-xs text-center max-w-[260px]">
                            {profilePhotoError}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex-grow w-full md:grid md:grid-cols-[minmax(0,1.7fr)_minmax(0,1.3fr)] md:gap-6 items-start">
                      <div className="text-center md:text-left space-y-1 w-full">
                        <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-tight">
                          {user.name}
                        </h1>
                        {user.familyCode && (
                          <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
                            <span className="inline-flex items-center rounded-full bg-white/10 backdrop-blur-md px-3 py-1 text-[11px] font-semibold text-black dark:text-white  ring-1 ring-white/20">
                              Family Code: {user.familyCode}
                            </span>
                          </div>
                        )}

                        <div className="mt-1 text-xs leading-relaxed text-gray-700 md:text-sm whitespace-pre-wrap">
                          <p className={isBioExpanded ? '' : 'line-clamp-2'}>
                            {user.bio}
                          </p>
                          {user.bio.length > 100 && (
                            <button
                              onClick={toggleBioExpanded}
                              className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary-600 px-3 py-1 text-[11px] font-medium text-white shadow hover:bg-primary-700"
                            >
                              {isBioExpanded ? 'See less' : 'See more'}
                            </button>
                          )}
                        </div>

                        {(user.contactNumber || user.email) && (
                          <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs text-gray-700 md:justify-start">
                            {user.contactNumber && (
                              <div className="flex items-center gap-2">
                                <Phone size={16} className="text-gray-500" />
                                <span>{user.contactNumber}</span>
                              </div>
                            )}
                            {user.email && (
                              <div className="flex items-center gap-2">
                                <Mail size={16} className="text-gray-500" />
                                <span>{user.email}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="mt-3 md:mt-0 flex flex-col items-center md:items-end gap-3 w-full">
                        <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
                          <label className="inline-flex items-center justify-between gap-3 rounded-full bg-white/10 backdrop-blur-md px-4 py-1.5 text-[11px] text-white sm:bg-white/10 sm:px-4 shadow-sm border border-white/10">
                            <span className="flex items-center gap-2">
                              <FiSettings size={14} className="text-white/80" />
                              <span className="font-bold tracking-tight">Private account</span>
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                privacyMutation.mutate(!Boolean(localIsPrivate))
                              }
                              disabled={
                                privacyMutation.isPending ||
                                !token ||
                                typeof localIsPrivate !== 'boolean'
                              }
                              className={`relative inline-flex h-5 w-10 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white/50 ${localIsPrivate ? 'bg-orange-500 shadow-inner' : 'bg-white/20'
                                } ${privacyMutation.isPending || !token
                                  ? 'opacity-60 cursor-not-allowed'
                                  : 'cursor-pointer hover:scale-105'
                                }`}
                              aria-pressed={Boolean(localIsPrivate)}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${localIsPrivate
                                    ? 'translate-x-5'
                                    : 'translate-x-1'
                                  }`}
                              />
                            </button>
                          </label>

                          <button
                            onClick={handleEditProfileClick}
                            className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md hover:shadow-lg hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-opacity-75 md:text-sm md:px-5 md:py-2"
                          >
                            <FiEdit3 size={16} />
                            <span>Edit profile</span>
                          </button>
                        </div>

                        <div className="flex justify-center gap-8 md:gap-10">
                          <div className="text-center">
                            <span className="block text-xl font-bold text-gray-900 md:text-2xl">
                              {user.postsCount}
                            </span>
                            <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">
                              Posts
                            </span>
                          </div>
                          <div className="text-center">
                            <span className="block text-xl font-bold text-gray-900 md:text-2xl">
                              {user.galleryCount}
                            </span>
                            <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">
                              Galleries
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
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
              className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg font-semibold text-sm transition-all duration-300 ${showPosts
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
              className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg font-semibold text-sm transition-all duration-300 ${!showPosts
                  ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow"
                  : "bg-primary-700 text-white hover:bg-primary-800"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <ShimmerImageCard key={i} height={256} />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {userPosts.length > 0 ? (
                  userPosts.map((post) => (
                    <div
                      key={post.id}
                      className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100
                                            transform hover:scale-[1.02] hover:shadow-lg transition-all duration-300 group relative"
                      onClick={() => {
                        const hasMedia = Boolean(post?.postVideo || post?.fullImageUrl);
                        if (!hasMedia) return;
                        handleViewPost(post);
                      }}
                    >
                      <div className="relative w-full h-64 overflow-hidden">
                        {post.postVideo ? (
                          <video
                            src={post.postVideo}
                            className="hide-video-zoom w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                            controls
                            controlsList="nofullscreen nodownload noremoteplayback noplaybackrate"
                            disablePictureInPicture
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : post.fullImageUrl ? (
                          <img
                            src={post.fullImageUrl}
                            alt="Post image"
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                          />
                        ) : (
                          <div className="text-black text-center text-lg italic">
                            {/* No media available */}
                          </div>
                        )}

                        {(() => {
                          const badge = getPrivacyBadgeConfig(post.privacy);
                          if (!badge) return null;
                          return (
                            <div
                              className={`absolute bottom-2 right-2 rounded-full px-3 py-1 text-[11px] font-semibold shadow-sm ring-1 ring-white/30 ${badge.className}`}
                            >
                              {badge.label}
                            </div>
                          );
                        })()}

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
              <PaginationControls
                page={postPage}
                totalPages={userPostsTotalPages}
                totalItems={userPostsTotal}
                currentItemsCount={userPosts.length}
                itemLabel="posts"
                isFetching={fetchingPosts}
                onPrevious={() => setPostPage((prev) => Math.max(prev - 1, 1))}
                onNext={() => setPostPage((prev) => Math.min(prev + 1, userPostsTotalPages))}
              />
            </>
          )
        ) : loadingGalleries ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <ShimmerImageCard key={i} height={256} />
            ))}
          </div>
        ) : (
          <>
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

                      {(() => {
                        const badge = getPrivacyBadgeConfig(gallery.privacy);
                        if (!badge) return null;
                        return (
                          <div
                            className={`absolute bottom-2 right-2 rounded-full px-3 py-1 text-[11px] font-semibold shadow-sm ring-1 ring-white/30 ${badge.className}`}
                          >
                            {badge.label}
                          </div>
                        );
                      })()}
                      <div
                        className="absolute top-2 right-2 flex gap-2
     opacity-100
     md:opacity-0 md:group-hover:opacity-100
     transition-opacity duration-300"
                      >
                        <button
                          onClick={(e) =>
                            handleEditAlbum(e, gallery.id)
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
            <PaginationControls
              page={galleryPage}
              totalPages={userGalleriesTotalPages}
              totalItems={userGalleriesTotal}
              currentItemsCount={userGalleries.length}
              itemLabel="galleries"
              isFetching={fetchingGalleries}
              onPrevious={() => setGalleryPage((prev) => Math.max(prev - 1, 1))}
              onNext={() => setGalleryPage((prev) => Math.min(prev + 1, userGalleriesTotalPages))}
            />
          </>
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
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!isDeleting) {
            setIsDeleteModalOpen(false);
            setItemToDelete(null);
            setDeleteType(null);
          }
        }}
        onConfirm={handleConfirmDelete}
        title={deleteType === 'post' ? 'Delete Post' : 'Delete Gallery'}
        message={
          deleteType === 'post'
            ? 'This post and all related comments/likes will be permanently deleted. Are you sure you want to continue?'
            : 'This gallery and all its photos will be permanently deleted. Are you sure you want to continue?'
        }
        itemName={itemToDelete?.name}
        isDeleting={isDeleting}
      />
    </>
  );
};

export default ProfilePage;
