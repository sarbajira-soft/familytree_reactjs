import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import GalleryViewerModal from '../Components/GalleryViewerModal';
import ReportContentModal from '../Components/ReportContentModal';
import {  FiMoreVertical, FiPlusCircle } from 'react-icons/fi';
import { MdPublic, MdPeople } from 'react-icons/md';
import CreateAlbumModal from '../Components/CreateAlbumModal';
import { useUser } from '../Contexts/UserContext'; // Import useUser context
import GalleryPageShimmer from './GalleryPageShimmer';

import { authFetch } from '../utils/authFetch';
import { getToken } from '../utils/auth';
import { hasFamilyAccess } from '../utils/familyAccess';

const GalleryCollage = ({ photos = [], onOpenAlbum }) => {
  // ... (rest of the code remains the same)
};

const FamilyGalleryPage = () => {
  const { userInfo, userLoading } = useUser(); // Get user info from context
  const canAccessFamilyFeed = hasFamilyAccess(userInfo);
  const [token, setToken] = useState(null); // State to store the token
  const navigate = useNavigate();

  const [activeFeed, setActiveFeed] = useState('public'); // Changed to 'public' as default
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState(null); // To store the album currently viewed in modal
  const [isCreateAlbumModalOpen, setIsCreateAlbumModalOpen] = useState(false);
  const [galleryAlbums, setGalleryAlbums] = useState([]); // Initialize as empty array for API data
  const [loadingAlbums, setLoadingAlbums] = useState(true); // Loading state for albums
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [searchCaption, setSearchCaption] = useState('');

  const searchTimeoutRef = useRef(null);

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);

  const [albumActionMenuAlbumId, setAlbumActionMenuAlbumId] = useState(null);

  // Fetch token from localStorage on component mount
  useEffect(() => {
    const storedToken = getToken();
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  // Function to fetch gallery albums from the API
  const fetchGalleries = async (galleryTitleSearch = '') => {
    // For family feed, check if user has familyCode and is approved
    if (activeFeed === 'family' && !canAccessFamilyFeed) {
      setGalleryAlbums([]);
      setLoadingAlbums(false);
      return;
    }

    if (!userInfo || !token) {
      setLoadingAlbums(false);
      return;
    }

    setLoadingAlbums(true);
    try {
      let endpoint = '';

      // Determine the API URL based on the active feed
      if (activeFeed === 'family') {
        endpoint = `/gallery/by-options?privacy=private`;
      } else {
        endpoint = `/gallery/by-options?privacy=public`;
      }

      if (galleryTitleSearch.trim()) {
        endpoint += `&galleryTitle=${encodeURIComponent(galleryTitleSearch.trim())}`;
      }

      const data = await authFetch(endpoint, { method: 'GET' });

      // Format the API response to match the expected structure
      const formattedGalleries = data.map(gallery => ({
        id: gallery.id,
        title: gallery.galleryTitle,
        description: gallery.galleryDescription,
        author: gallery.user?.name || 'Unknown',
        authorId: gallery.user?.userId || gallery.createdBy || null,
        privacy: gallery.privacy,
        photosCount: gallery.galleryAlbums.length,
        likes: gallery.likeCount,
        isLiked: gallery.isLiked,
        comments: new Array(gallery.commentCount).fill(""),
        coverPhoto: gallery.coverPhoto || 'https://picsum.photos/seed/default_album_cover/400/300', // Default cover if none
        photos: gallery.galleryAlbums.map((photo, index) => ({
          id: photo.id,
          url: photo.album,
          caption: photo.caption || `Photo ${index + 1}`,
          likes: photo.likeCount || 0, 
          comments: photo.commentCount ? new Array(photo.commentCount).fill("") : [],
        })),
      }));
      setGalleryAlbums(formattedGalleries);
    } catch (error) {
      console.error('Failed to fetch galleries:', error);
      setGalleryAlbums([]); // Clear albums on error
    } finally {
      setLoadingAlbums(false);
    }
  };

  // Fetch galleries whenever activeFeed, userInfo, or token changes
  useEffect(() => {
    fetchGalleries();
  }, [activeFeed, canAccessFamilyFeed, userInfo?.familyCode, userInfo?.approveStatus, token]);

  const filteredAlbums = galleryAlbums; // No need to filter here, API should return filtered results

  const goToUserProfile = (targetUserId) => {
    if (!targetUserId) return;
    const myId = userInfo?.userId;
    if (myId && Number(targetUserId) === Number(myId)) {
      navigate('/myprofile');
    } else {
      navigate(`/user/${targetUserId}`);
    }
  };

  const collagePhotos = useMemo(() => {
    if (!filteredAlbums.length) return [];

    return filteredAlbums
      .filter((a) => a && a.coverPhoto) // prevents undefined
      .map((album) => ({
        id: album.id,
        url:
          album.coverPhoto || "https://picsum.photos/seed/default_album/400/300",
        caption: album.title,
        albumTitle: album.title,
        albumId: album.id,
      }));
  }, [filteredAlbums]);

  const openGalleryModal = (album) => {
    setSelectedAlbum(album);
    setIsGalleryModalOpen(true);
  };

  const openCreateAlbumModal = () => {
    setIsCreateAlbumModalOpen(true);
  };

  const openReportModalForAlbum = (album) => {
    if (!album?.id) return;
    setReportTarget({
      targetType: 'gallery',
      targetId: album.id,
      targetLabel: album?.title ? `Album: ${album.title}` : 'Album',
    });
    setReportModalOpen(true);
  };

  const closeReportModal = () => {
    setReportModalOpen(false);
    setReportTarget(null);
  };

  const handleCloseCreateAlbumModal = () => {
    setIsCreateAlbumModalOpen(false);
  };

  const onGalleryCreated = () => {
    fetchGalleries();
  };

  const handleOpenAlbumFromCollage = (albumId) => {
    const album = filteredAlbums.find((a) => a.id === albumId);
    if (album) {
      openGalleryModal(album);
    }
  };

  useEffect(() => {
    if (!albumActionMenuAlbumId) return;

    const handleDocMouseDown = (e) => {
      const el = e.target;
      if (el?.closest?.('[data-album-action-menu]')) return;
      setAlbumActionMenuAlbumId(null);
    };

    document.addEventListener('mousedown', handleDocMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleDocMouseDown);
    };
  }, [albumActionMenuAlbumId]);

  return (
    <>
      <div className="flex flex-col max-w-7xl mx-auto px-4 py-8 md:px-6 lg:px-8">
        {/* Main Content (Gallery) Column - Now full width */}
        <div className="w-full">

          {/* Top Bar - Enhanced with Create Album button */}
          <div
            className="
  flex flex-col sm:flex-row 
  items-start sm:items-center 
  justify-between gap-4 
  pb-6 mb-6 border-b border-gray-200
"
          >
            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-none">
              Gallery Hub
            </h1>

            {/* RIGHT SIDE ACTIONS */}
            <div
              className="
    w-full sm:w-auto 
    flex flex-col sm:flex-row 
    items-start sm:items-center 
    gap-3
  "
            >
              <div className="w-full flex flex-row gap-2">
                {/* FEED SWITCHER */}
                <div
                  className="
      flex flex-1 sm:flex-none 
      justify-between sm:justify-start 
      gap-2 bg-gray-100 p-1 rounded-full
    "
                >
                  <button
                    onClick={() => setActiveFeed("public")}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 
          py-1.5 px-2.5 sm:px-4 text-xs sm:text-sm font-semibold rounded-full transition-all
          ${
            activeFeed === "public"
              ? "bg-gradient-to-r from-secondary-500 to-secondary-600 text-white shadow"
              : "bg-primary-700 text-white hover:bg-primary-800"
          }`}
                  >
                    <MdPublic size={16} /> Public
                  </button>

                  {canAccessFamilyFeed && (
                      <button
                        onClick={() => setActiveFeed("family")}
                        className={`flex-1 sm:flex-none flex items-center justify-center 
            gap-1.5 py-1.5 px-2.5 sm:px-4 text-xs sm:text-sm font-semibold rounded-full transition-all
            ${
              activeFeed === "family"
                ? "bg-gradient-to-r from-secondary-500 to-secondary-600 text-white shadow"
                : "bg-primary-700 text-white hover:bg-primary-800"
            }`}
                      >
                        <MdPeople size={16} /> Family
                      </button>
                    )}
                </div>

                {/* CREATE ALBUM BTN */}
                <button
                  className="
        flex items-center justify-center 
        gap-1.5 px-2.5 sm:px-4 py-1.5 
        bg-primary-700 hover:bg-primary-800 text-white 
        text-xs sm:text-sm font-semibold rounded-full shadow 
        transition-all whitespace-nowrap flex-none
      "
                  onClick={openCreateAlbumModal}
                >
                  <FiPlusCircle size={16} /> Create Album
                </button>
              </div>

              {/* SEARCH */}
              <input
                type="text"
                autoFocus
                placeholder="Search Albums..."
                value={searchCaption}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchCaption(value);

                  if (searchTimeoutRef.current)
                    clearTimeout(searchTimeoutRef.current);

                  searchTimeoutRef.current = setTimeout(() => {
                    fetchGalleries(value);
                  }, 500);
                }}
                onBlur={() => {
                  if (!searchCaption) setShowSearchInput(false);
                }}
                className="
        w-full sm:w-48 px-3 py-2 
        rounded-full border border-gray-300 
        text-sm focus:outline-none 
        focus:ring-2 focus:ring-primary-400
        dark:bg-slate-800
        dark:text-white
      "
              />
            </div>
          </div>

          {/* Collage-style hero using photos from albums */}
          {collagePhotos.length > 0 && (
            <GalleryCollage
              photos={collagePhotos}
              onOpenAlbum={handleOpenAlbumFromCollage}
            />
          )}

          {/* Gallery Content - Updated to 4-column grid */}
          {loadingAlbums ? (
            <GalleryPageShimmer />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 auto-rows-fr">
              {filteredAlbums.length > 0 ? (
                filteredAlbums.map((album) => (
                  <div
                    key={album.id}
                    className="bg-white rounded-2xl overflow-hidden shadow-xl border border-gray-100 transform hover:scale-[1.03] transition-all duration-300 ease-in-out group relative"
                  >
                    <button
                      type="button"
                      className="relative w-full h-56 bg-gray-100 overflow-hidden text-left"
                      onClick={() => openGalleryModal(album)}
                      aria-label={`Open album ${album.title || ''}`}
                    >
                      <img
                        src={album.coverPhoto}
                        alt={album.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                        {album.photos.length > 0 && (
                          <span className="text-white text-sm font-semibold bg-black/50 px-2 py-1 rounded-full backdrop-blur-sm">
                            {album.photos.length} Photos
                          </span>
                        )}
                      </div>
                      {album.photos.length > 1 && (
                        <div className="absolute top-3 right-3 bg-primary-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-md animate-bounce-slow">
                          +{album.photos.length - 1} More
                        </div>
                      )}
                    </button>
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-bold text-xl text-gray-900 mb-2 line-clamp-1">
                          {album.title}
                        </h3>

                        {album?.authorId && userInfo?.userId &&
                        Number(album.authorId) !== Number(userInfo.userId) ? (
                          <div className="relative" data-album-action-menu>
                            <button
                              type="button"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAlbumActionMenuAlbumId((prev) =>
                                  prev === album.id ? null : album.id,
                                );
                              }}
                              aria-label="Album actions"
                            >
                              <FiMoreVertical />
                            </button>

                            {albumActionMenuAlbumId === album.id && (
                              <div className="absolute right-0 mt-2 w-40 rounded-xl border border-gray-200 bg-white shadow-lg z-10 overflow-hidden">
                                <button
                                  type="button"
                                  className="w-full flex items-center px-3 py-2 text-left text-sm text-gray-700 hover:bg-red-50 active:bg-red-100 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAlbumActionMenuAlbumId(null);
                                    openReportModalForAlbum(album);
                                  }}
                                >
                                  Report
                                </button>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>

                      <p className="text-sm text-gray-600 mb-3">
                        by{" "}
                        <span
                          className="font-medium text-primary-700 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            goToUserProfile(album.authorId);
                          }}
                        >
                          {album.author}
                        </span>
                      </p>

                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        {album.privacy === "private" ? ( // Changed 'family' to 'private' to match API
                          <span
                            className="flex items-center gap-1 text-primary-600 bg-primary-50 px-3 py-1 rounded-full font-medium"
                            title="Family Album"
                          >
                            <MdPeople size={16} /> Family
                          </span>
                        ) : (
                          <span
                            className="flex items-center gap-1 text-secondary-400 bg-secondary-50 px-3 py-1 rounded-full font-medium"
                            title="Public Album"
                          >
                            <MdPublic size={16} /> Public
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="lg:col-span-4 sm:col-span-2 md:col-span-3 bg-white rounded-2xl shadow-xl p-10 text-center text-gray-600 border border-gray-100 flex flex-col items-center justify-center">
                  <p className="text-2xl font-bold mb-4 text-gray-800">
                    No albums here yet!
                  </p>
                  <p className="text-lg mb-6">
                    Looks like the {activeFeed === 'family' ? 'Family' : 'Public'} feed is a bit quiet. Why
                    not be the first to share?
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Gallery Viewer Modal (Existing) */}
      {selectedAlbum && (
        <GalleryViewerModal
          isOpen={isGalleryModalOpen}
          onClose={() => setIsGalleryModalOpen(false)}
          album={selectedAlbum}
          currentUser={userInfo}
          authToken={token}
        />
      )}

      <ReportContentModal
        isOpen={reportModalOpen}
        onClose={closeReportModal}
        targetType={reportTarget?.targetType}
        targetId={reportTarget?.targetId}
        targetLabel={reportTarget?.targetLabel}
      />

      <CreateAlbumModal
        isOpen={isCreateAlbumModalOpen}
        onClose={() => setIsCreateAlbumModalOpen(false)}
        onCreateAlbum={onGalleryCreated}
        currentUser={userInfo}
        authToken={token}
        mode="create"
      />
    </>
  );
};

export default FamilyGalleryPage;


