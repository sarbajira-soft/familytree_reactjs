import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import GalleryViewerModal from '../Components/GalleryViewerModal';
import { FiSearch, FiPlusCircle } from 'react-icons/fi';
import { MdPublic, MdPeople } from 'react-icons/md';
import CreateAlbumModal from '../Components/CreateAlbumModal';
import { useUser } from '../Contexts/UserContext'; // Import useUser context
import GalleryPageShimmer from './GalleryPageShimmer';

const GalleryCollage = ({ photos = [], onOpenAlbum }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (photos.length) {
      setActiveIndex(photos.length - 1);
    } else {
      setActiveIndex(0);
    }
  }, [photos.length]);

  useEffect(() => {
    if (!photos.length) return;
    const id = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % photos.length);
    }, 5000);
    return () => clearInterval(id);
  }, [photos.length]);

  if (!photos.length) return null;

  const peripheralPositions = [
    // Left column (top, middle, bottom)
    "top-[4%] left-4 w-[18%] h-[28%]",
    "top-[36%] left-4 w-[18%] h-[28%]",
    "top-[68%] left-4 w-[18%] h-[28%]",
    // Right column (top, middle, bottom)
    "top-[4%] left-[78%] w-[18%] h-[28%]",
    "top-[36%] left-[78%] w-[18%] h-[28%]",
    "top-[68%] left-[78%] w-[18%] h-[28%]",
  ];

  const peripheralRotations = [
    "rotate-0",
    "rotate-0",
    "rotate-0",
    "rotate-0",
    "rotate-0",
    "rotate-0",
  ];

  const total = photos.length;
  const visibleCount = Math.min(1 + peripheralPositions.length, total);

  const { orderedPhotos, orderedIndices } = useMemo(() => {
    if (!total) return { orderedPhotos: [], orderedIndices: [] };
    const orderedPhotos = [];
    const orderedIndices = [];

    orderedPhotos.push(photos[activeIndex]);
    orderedIndices.push(activeIndex);

    for (let i = 1; i < visibleCount; i++) {
      const idx = (activeIndex + i) % total;
      orderedPhotos.push(photos[idx]);
      orderedIndices.push(idx);
    }

    return { orderedPhotos, orderedIndices };
  }, [photos, activeIndex, total, visibleCount]);

  if (!orderedPhotos.length) return null;

  return (
    <div className="w-full mb-10">
      <div className="relative w-full aspect-[16/9] bg-black rounded-3xl overflow-hidden shadow-2xl">
        {orderedPhotos.map((photo, index) => {

           if (!photo) return null; 

          const globalIndex = orderedIndices[index];

          if (index === 0) {
            return (
              <div
                key={photo.id || globalIndex}
                className="absolute top-1/2 left-1/2 w-[62%] h-[68%] -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-out origin-center z-30 scale-105 rotate-0 shadow-2xl ring-4 ring-secondary-500 overflow-hidden rounded-3xl"
              >
                <img
                  src={photo.url}
                  alt={photo.caption || 'Family memory'}
                  className="w-full h-full object-cover border border-white/10"
                />
                {onOpenAlbum && photo.albumId && (
                  <button
                    type="button"
                    onClick={() => onOpenAlbum(photo.albumId)}
                    className="absolute bottom-4 right-4 px-4 py-2 text-xs font-semibold rounded-full bg-secondary-500 hover:bg-secondary-600 text-white shadow-md"
                  >
                    Open album
                  </button>
                )}
              </div>
            );
          }

          const peripheralIndex = index - 1;
          const pos = peripheralPositions[peripheralIndex] || "inset-4";
          const rotation = peripheralRotations[peripheralIndex] || "-rotate-2";

          return (
            <button
              key={photo.id || globalIndex}
              type="button"
              onClick={() => setActiveIndex(globalIndex)}
              className={`absolute ${pos} transition-all duration-500 ease-out origin-center z-20 opacity-80 hover:opacity-100 hover:scale-105 ${rotation} grayscale-[35%]`}
            >
              <img
                src={photo.url}
                alt={photo.caption || 'Family memory'}
                className="w-full h-full object-cover rounded-2xl border border-white/10"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};

const FamilyGalleryPage = () => {
  const { userInfo, userLoading } = useUser(); // Get user info from context
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

  // Fetch token from localStorage on component mount
  useEffect(() => {
    const storedToken = localStorage.getItem('access_token');
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  // Function to fetch gallery albums from the API
  const fetchGalleries = async (galleryTitleSearch = '') => {
    // For family feed, check if user has familyCode and is approved
    if (activeFeed === 'family' && (!userInfo?.familyCode || userInfo?.approveStatus !== 'approved')) {
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
      const headers = { Authorization: `Bearer ${token}` };
      let url = '';

      // Determine the API URL based on the active feed
      if (activeFeed === 'family') {
        url = `${import.meta.env.VITE_API_BASE_URL}/gallery/by-options?familyCode=${userInfo.familyCode}&privacy=private`;
      } else {
        url = `${import.meta.env.VITE_API_BASE_URL}/gallery/by-options?privacy=public`;
      }

      if (galleryTitleSearch.trim()) {
        url += `&galleryTitle=${encodeURIComponent(galleryTitleSearch.trim())}`;
      }

      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

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
  }, [activeFeed, userInfo?.familyCode, userInfo?.approveStatus, token]);

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

                  {userInfo?.familyCode &&
                    userInfo?.approveStatus === "approved" && (
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
                    className="bg-white rounded-2xl overflow-hidden shadow-xl border border-gray-100 cursor-pointer transform hover:scale-[1.03] transition-all duration-300 ease-in-out group relative"
                    onClick={() => openGalleryModal(album)}
                  >
                    <div className="relative w-full h-56 bg-gray-100 overflow-hidden">
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
                    </div>
                    <div className="p-5">
                      <h3 className="font-bold text-xl text-gray-900 mb-2 line-clamp-1">
                        {album.title}
                      </h3>
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
                    Looks like the **{activeFeed}** feed is a bit quiet. Why
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