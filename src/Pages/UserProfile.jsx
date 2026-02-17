import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate, useParams } from "react-router-dom";
import { FiGrid, FiImage } from "react-icons/fi";
import { useQuery } from "@tanstack/react-query";

import PostViewerModal from "../Components/PostViewerModal";
import GalleryViewerModal from "../Components/GalleryViewerModal";
import ShimmerImageCard from "./ShimmerImageCard";
import { useUser } from "../Contexts/UserContext";

import { authFetchResponse } from "../utils/authFetch";
import { getToken } from "../utils/auth";

const EMPTY_VTT_TRACK_SRC = "data:text/vtt,WEBVTT";
const SHIMMER_CARD_KEYS = ["a", "b", "c"];

const getListFromApiResponse = (json) => {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  return [];
};

const renderPostMedia = (post) => {
  if (post.postVideo) {
    return (
      <video
        src={post.postVideo}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
        preload="metadata"
        controls
        muted
        playsInline
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
    );
  }

  if (post.fullImageUrl) {
    return (
      <img
        src={post.fullImageUrl}
        alt={post.caption || "Post"}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
      />
    );
  }

  return (
    <div className="text-white text-center text-lg italic">
      No media available for this post.
    </div>
  );
};

const renderPostsContent = ({ loadingPosts, userPosts, handleViewPost }) => {
  if (loadingPosts) {
    return (
      <div className="flex flex-col sm:flex-row gap-4">
        {SHIMMER_CARD_KEYS.map((k) => (
          <ShimmerImageCard
            key={`shimmer-post-${k}`}
            width={320}
            height={220}
          />
        ))}
      </div>
    );
  }

  if (userPosts.length > 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {userPosts.map((post) => (
          <button
            type="button"
            key={post.id}
            className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 transform hover:scale-[1.02] hover:shadow-lg transition-all duration-300 cursor-pointer group relative text-left"
            onClick={() => handleViewPost(post)}
          >
            <div className="relative w-full h-64 overflow-hidden">
              {renderPostMedia(post)}
            </div>
            <div className="p-4">
              <p className="text-sm font-medium text-gray-800 mb-2 line-clamp-2">
                {post.caption}
              </p>
            </div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="lg:col-span-3 text-center py-12 bg-white rounded-2xl shadow-md border border-gray-100">
      <p className="text-gray-500 text-lg mb-4">No posts yet.</p>
    </div>
  );
};

const renderGalleriesContent = ({ loadingGalleries, userGalleries, handleViewAlbum }) => {
  if (loadingGalleries) {
    return (
      <div className="flex flex-col sm:flex-row gap-4">
        {SHIMMER_CARD_KEYS.map((k) => (
          <ShimmerImageCard
            key={`shimmer-gallery-${k}`}
            width={320}
            height={220}
          />
        ))}
      </div>
    );
  }

  if (userGalleries.length > 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {userGalleries.map((gallery) => (
          <button
            type="button"
            key={gallery.id}
            className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 transform hover:scale-[1.02] hover:shadow-lg transition-all duration-300 cursor-pointer group relative text-left"
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
                  <h3 className="text-lg font-semibold mb-0.5">{gallery.title}</h3>
                  <p className="text-sm opacity-90">{gallery.photosCount} photos</p>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="lg:col-span-3 text-center py-12 bg-white rounded-2xl shadow-md border border-gray-100">
      <p className="text-gray-500 text-lg mb-4">No galleries yet.</p>
    </div>
  );
};

const UserProfileView = ({
  loadingProfile,
  error,
  profile,
  avatar,
  displayName,
  bio,
  isBioExpanded,
  toggleBioExpanded,
  userPosts,
  userGalleries,
  loadingPosts,
  loadingGalleries,
  isPrivateAccount,
  showPosts,
  setShowPosts,
  handleViewPost,
  handleViewAlbum,
  navigate,
  isGalleryViewerOpen,
  selectedAlbum,
  handleCloseGalleryViewer,
  userInfo,
  token,
  isPostViewerOpen,
  selectedPost,
  handleClosePostViewer,
}) => {
  const isGalleriesSelected = showPosts === false;

  if (loadingProfile) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-primary-600 border-solid"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        {error}
      </div>
    );
  }

  if (profile == null) {
    return <div className="text-gray-600">Profile not found</div>;
  }

  const headerSection = (
      <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-8 border border-gray-100">
        <div className="flex-shrink-0">
          <img
            src={avatar}
            alt="User profile"
            className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-primary-400 shadow-lg"
          />
        </div>
        <div className="flex-grow text-center md:text-left">
          <div className="flex flex-col md:flex-row items-center md:justify-between mb-3 gap-2">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 leading-tight">
                {displayName}
              </h1>
            </div>
            <button
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
              onClick={() => navigate(-1)}
            >
              Back
            </button>
          </div>

          <div className="text-gray-800 leading-relaxed text-sm md:text-base whitespace-pre-wrap">
            <p className={isBioExpanded ? "" : "line-clamp-2"}>{bio}</p>
            {bio.length > 100 && (
              <button
                onClick={toggleBioExpanded}
                className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-full shadow hover:bg-primary-700 transition"
              >
                {isBioExpanded ? "See Less" : "See More"}
              </button>
            )}
          </div>

          <div className="flex justify-center md:justify-start gap-8 mt-5 pt-4 border-t border-gray-100">
            <div className="text-center">
              <span className="block font-bold text-xl md:text-2xl text-gray-900">
                {userPosts.length}
              </span>
              <span className="block text-sm text-gray-500">Posts</span>
            </div>
            <div className="text-center">
              <span className="block font-bold text-xl md:text-2xl text-gray-900">
                {userGalleries.length}
              </span>
              <span className="block text-sm text-gray-500">Galleries</span>
            </div>
          </div>
        </div>
      </div>
    );

  const privateSection = isPrivateAccount ? (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 text-center">
      <p className="text-gray-900 font-semibold text-lg">This account is private</p>
      <p className="text-gray-500 text-sm mt-1">Posts and galleries are hidden.</p>
    </div>
  ) : null;

  const toggleSection = isPrivateAccount
    ? null
    : (
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
          </div>
          <span className="text-gray-200 px-1 md:px-2" style={{ fontSize: 18 }}>
            |
          </span>
          <div className="flex flex-1 items-center gap-1 md:gap-2">
            <button
              onClick={() => setShowPosts(false)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg font-semibold text-sm transition-all duration-300 ${
                isGalleriesSelected
                  ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow"
                  : "text-white hover:bg-primary-700"
              }`}
            >
              <FiImage size={20} />
              <span className="hidden sm:inline">Created Galleries</span>
              <span className="sm:hidden">Galleries</span>
            </button>
          </div>
        </div>
      );

  let contentSection = null;
  if (!isPrivateAccount) {
    contentSection = showPosts
      ? renderPostsContent({ loadingPosts, userPosts, handleViewPost })
      : renderGalleriesContent({
          loadingGalleries,
          userGalleries,
          handleViewAlbum,
        });
  }

  return (
    <>
      <div className="mx-auto px-4 pt-4 pb-24 md:px-6 lg:px-8 space-y-8  font-inter">
        {headerSection}
        {privateSection}
        {toggleSection}
        {contentSection}
      </div>

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
        onLikePost={() => {}}
        authToken={token}
        currentUser={userInfo}
      />
    </>
  );
};

UserProfileView.propTypes = {
  loadingProfile: PropTypes.bool,
  error: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Error)]),
  profile: PropTypes.any,
  avatar: PropTypes.string,
  displayName: PropTypes.string,
  bio: PropTypes.string,
  isBioExpanded: PropTypes.bool,
  toggleBioExpanded: PropTypes.func,
  userPosts: PropTypes.arrayOf(PropTypes.object),
  userGalleries: PropTypes.arrayOf(PropTypes.object),
  loadingPosts: PropTypes.bool,
  loadingGalleries: PropTypes.bool,
  isPrivateAccount: PropTypes.bool,
  showPosts: PropTypes.bool,
  setShowPosts: PropTypes.func,
  handleViewPost: PropTypes.func,
  handleViewAlbum: PropTypes.func,
  navigate: PropTypes.func,
  isGalleryViewerOpen: PropTypes.bool,
  selectedAlbum: PropTypes.any,
  handleCloseGalleryViewer: PropTypes.func,
  userInfo: PropTypes.any,
  token: PropTypes.string,
  isPostViewerOpen: PropTypes.bool,
  selectedPost: PropTypes.any,
  handleClosePostViewer: PropTypes.func,
};

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useUser();

  const [token, setToken] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);

  const [showPosts, setShowPosts] = useState(true);
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  const toggleBioExpanded = () => setIsBioExpanded(!isBioExpanded);

  const [isGalleryViewerOpen, setIsGalleryViewerOpen] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState(null);

  const [isPostViewerOpen, setIsPostViewerOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);

  useEffect(() => {
    const storedToken = getToken();
    if (storedToken) {
      setToken(storedToken);
    } else {
      setError("Not authenticated");
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    if (!userId || !userInfo?.userId) return;
    if (Number(userId) === Number(userInfo.userId)) {
      navigate("/myprofile", { replace: true });
    }
  }, [userId, userInfo?.userId, navigate]);

  useEffect(() => {
    if (!token || !userId) return;

    const fetchProfile = async () => {
      try {
        setLoadingProfile(true);
        setError(null);

        const res = await authFetchResponse(`/user/profile/${userId}`, {
          method: "GET",
          skipThrow: true,
        });

        if (!res.ok) {
          let msg = `Failed to load profile (${res.status})`;
          try {
            const j = await res.json();
            msg =
              j?.message ||
              j?.error ||
              j?.details ||
              (typeof j === "string" ? j : msg);
          } catch (err) {
            console.warn("Failed to parse profile error response:", err);
          }
          throw new Error(msg);
        }

        const json = await res.json();
        setProfile(json?.data || null);
      } catch (e) {
        setError(e?.message || "Failed to load profile");
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [token, userId]);

  const userProfile = profile?.userProfile || null;
  const isPrivateAccount = !!userProfile?.isPrivate;

  const displayName = useMemo(() => {
    const n = `${userProfile?.firstName || ""} ${userProfile?.lastName || ""}`
      .trim()
      .trim();
    return n || profile?.name || "User";
  }, [profile?.name, userProfile?.firstName, userProfile?.lastName]);

  const avatar = userProfile?.profile || "/assets/user.png";
  const bio = userProfile?.bio || "No bio yet";

  const { data: userPosts = [], isLoading: loadingPosts } = useQuery({
    queryKey: ["userPosts", Number(userId)],
    queryFn: async () => {
      const response = await authFetchResponse(
        `/post/by-options?createdBy=${userId}`,
        { method: "GET", skipThrow: true }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const json = await response.json();
      const list = getListFromApiResponse(json);

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
    enabled: !!userId && !!token && !isPrivateAccount,
    staleTime: 3 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });

  const { data: userGalleries = [], isLoading: loadingGalleries } = useQuery({
    queryKey: ["userGalleries", Number(userId)],
    queryFn: async () => {
      const response = await authFetchResponse(
        `/gallery/by-options?createdBy=${userId}`,
        { method: "GET", skipThrow: true }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const json = await response.json();
      const list = getListFromApiResponse(json);

      return list.map((gallery) => ({
        id: gallery.id,
        title: gallery.galleryTitle,
        description: gallery.galleryDescription,
        author: displayName,
        cover: gallery.coverPhoto,
        photosCount: Array.isArray(gallery.galleryAlbums)
          ? gallery.galleryAlbums.length
          : 0,
        likes: gallery.likeCount,
        isLiked: gallery.isLiked,
        comments: new Array(gallery.commentCount).fill(""),
        photos: (gallery.galleryAlbums || []).map((photo, index) => ({
          id: photo.id,
          url: photo.album,
          caption: `Photo ${index + 1}`,
          likes: 0,
          comments: [],
        })),
      }));
    },
    enabled: !!userId && !!token && !isPrivateAccount,
    staleTime: 3 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });

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

  return (
    <UserProfileView
      loadingProfile={loadingProfile}
      error={error}
      profile={profile}
      avatar={avatar}
      displayName={displayName}
      bio={bio}
      isBioExpanded={isBioExpanded}
      toggleBioExpanded={toggleBioExpanded}
      userPosts={userPosts}
      userGalleries={userGalleries}
      loadingPosts={loadingPosts}
      loadingGalleries={loadingGalleries}
      isPrivateAccount={isPrivateAccount}
      showPosts={showPosts}
      setShowPosts={setShowPosts}
      handleViewPost={handleViewPost}
      handleViewAlbum={handleViewAlbum}
      navigate={navigate}
      isGalleryViewerOpen={isGalleryViewerOpen}
      selectedAlbum={selectedAlbum}
      handleCloseGalleryViewer={handleCloseGalleryViewer}
      userInfo={userInfo}
      token={token}
      isPostViewerOpen={isPostViewerOpen}
      selectedPost={selectedPost}
      handleClosePostViewer={handleClosePostViewer}
    />
  );
};

export default UserProfile;
