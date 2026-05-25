import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiHeart, FiMessageCircle, FiMoreVertical, FiPlusCircle, FiShare2 } from "react-icons/fi";
import { MdPeople, MdPublic } from "react-icons/md";

import GalleryViewerModal from "../Components/GalleryViewerModal";
import PublicGalleryShareSheet from "../Components/PublicGalleryShareSheet";
import ReportContentModal from "../Components/ReportContentModal";
import CreateAlbumModal from "../Components/CreateAlbumModal";
import { useUser } from "../Contexts/UserContext";
import GalleryPageShimmer from "./GalleryPageShimmer";
import useGallerySeenBatch from "../hooks/useGallerySeenBatch";
import { authFetchResponse } from "../utils/authFetch";
import { getToken } from "../utils/auth";
import { hasFamilyAccess } from "../utils/familyAccess";
import {
  getGalleryListFromApiResponse,
  mapGallerySummary,
} from "../utils/galleryAdapter";

const FamilyGalleryPage = () => {
  const { userInfo } = useUser();
  const canAccessFamilyFeed = hasFamilyAccess(userInfo);
  const [token] = useState(() => getToken());
  const navigate = useNavigate();

  const [activeFeed, setActiveFeed] = useState("public");
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [isCreateAlbumModalOpen, setIsCreateAlbumModalOpen] = useState(false);
  const [galleryAlbums, setGalleryAlbums] = useState([]);
  const [loadingAlbums, setLoadingAlbums] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [feedError, setFeedError] = useState("");
  const [searchCaption, setSearchCaption] = useState("");
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [albumActionMenuAlbumId, setAlbumActionMenuAlbumId] = useState(null);
  const [shareGallery, setShareGallery] = useState(null);

  const searchTimeoutRef = useRef(null);
  const requestIdRef = useRef(0);
  const paginationCursorRef = useRef(null);
  const loadMoreTriggerRef = useRef(null);
  const activeReplaceRequestKeyRef = useRef(null);

  const markGallerySeenLocal = (galleryId) => {
    const normalizedGalleryId = Number(galleryId);

    setGalleryAlbums((prev) =>
      prev.map((gallery) =>
        Number(gallery?.id) === normalizedGalleryId
          ? { ...gallery, isSeen: true, seen: true }
          : gallery,
      ),
    );

    setSelectedAlbum((prev) =>
      Number(prev?.id) === normalizedGalleryId
        ? { ...prev, isSeen: true, seen: true }
        : prev,
    );
  };

  const { queueSeenGallery } = useGallerySeenBatch({
    galleries: galleryAlbums,
    onMarkSeenLocal: markGallerySeenLocal,
    batchSize: 3,
    flushIntervalMs: 15000,
  });

  const fetchGalleries = async ({
    cursor = null,
    galleryTitleSearch = "",
    replace = true,
  } = {}) => {
    const normalizedSearch = String(galleryTitleSearch || "").trim();
    const cursorKey = cursor || "__initial__";
    const requestKey = `${activeFeed}|${cursorKey}|${normalizedSearch}`;

    if (activeFeed === "family" && !canAccessFamilyFeed) {
      setGalleryAlbums([]);
      setLoadingAlbums(false);
      setLoadingMore(false);
      setFeedError("");
      setHasMore(false);
      setNextCursor(null);
      return;
    }

    if (!userInfo || !token) {
      setLoadingAlbums(false);
      setLoadingMore(false);
      return;
    }

    if (!replace) {
      if (!cursor || paginationCursorRef.current === cursorKey) {
        return;
      }
      paginationCursorRef.current = cursorKey;
      setLoadingMore(true);
    } else {
      if (activeReplaceRequestKeyRef.current === requestKey) {
        return;
      }

      activeReplaceRequestKeyRef.current = requestKey;
      setLoadingAlbums(true);
      setNextCursor(null);
      paginationCursorRef.current = null;
    }

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    setFeedError("");

    try {
      let endpoint = `/gallery/feed?privacy=${activeFeed}&limit=20`;

      if (cursor) {
        endpoint += `&cursor=${encodeURIComponent(cursor)}`;
      }

      if (normalizedSearch) {
        endpoint += `&galleryTitle=${encodeURIComponent(normalizedSearch)}`;
      }

      const response = await authFetchResponse(endpoint, {
        method: "GET",
        skipThrow: true,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message || "Failed to fetch galleries.");
      }

      if (requestId !== requestIdRef.current) {
        return;
      }

      const formattedGalleries = getGalleryListFromApiResponse(payload).map(
        mapGallerySummary,
      );

      setGalleryAlbums((prev) => {
        if (replace) {
          return formattedGalleries;
        }

        const seenIds = new Set(prev.map((gallery) => Number(gallery?.id)));
        return [
          ...prev,
          ...formattedGalleries.filter(
            (gallery) => !seenIds.has(Number(gallery?.id)),
          ),
        ];
      });
      setHasMore(Boolean(payload?.hasMore));
      setNextCursor(payload?.nextCursor || null);
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      console.error("Failed to fetch galleries:", error);
      setFeedError(error?.message || "Failed to load galleries.");
      if (replace) {
        setGalleryAlbums([]);
        setHasMore(false);
        setNextCursor(null);
      }
    } finally {
      const isCurrentRequest = requestId === requestIdRef.current;

      if (replace) {
        if (isCurrentRequest) {
          setLoadingAlbums(false);
        }
        if (isCurrentRequest && activeReplaceRequestKeyRef.current === requestKey) {
          activeReplaceRequestKeyRef.current = null;
        }
      } else {
        if (isCurrentRequest) {
          setLoadingMore(false);
        }
        paginationCursorRef.current = null;
      }
    }
  };

  useEffect(() => {
    void fetchGalleries({
      cursor: null,
      galleryTitleSearch: searchCaption,
      replace: true,
    });
  }, [
    activeFeed,
    userInfo?.userId,
    userInfo?.familyCode,
    userInfo?.approveStatus,
    token,
  ]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const target = loadMoreTriggerRef.current;
    if (!target || !hasMore || !nextCursor || loadingAlbums || loadingMore) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) {
          return;
        }

        void fetchGalleries({
          cursor: nextCursor,
          galleryTitleSearch: searchCaption,
          replace: false,
        });
      },
      {
        rootMargin: "320px 0px",
      },
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, nextCursor, loadingAlbums, loadingMore, searchCaption]);

  const filteredAlbums = galleryAlbums;

  const goToUserProfile = (targetUserId) => {
    if (!targetUserId) return;
    const myId = userInfo?.userId;
    if (myId && Number(targetUserId) === Number(myId)) {
      navigate("/myprofile");
    } else {
      navigate(`/user/${targetUserId}`);
    }
  };

  const openGalleryModal = (album) => {
    setSelectedAlbum(album);
    setIsGalleryModalOpen(true);
  };

  const openReportModalForAlbum = (album) => {
    if (!album?.id) return;
    setReportTarget({
      targetType: "gallery",
      targetId: album.id,
      targetLabel: album?.title ? `Album: ${album.title}` : "Album",
    });
    setReportModalOpen(true);
  };

  const closeReportModal = () => {
    setReportModalOpen(false);
    setReportTarget(null);
  };

  const onGalleryCreated = () => {
    fetchGalleries({
      cursor: null,
      galleryTitleSearch: searchCaption,
      replace: true,
    });
  };

  useEffect(() => {
    if (!albumActionMenuAlbumId) return undefined;

    const handleDocMouseDown = (event) => {
      if (event?.target?.closest?.("[data-album-action-menu]")) return;
      setAlbumActionMenuAlbumId(null);
    };

    document.addEventListener("mousedown", handleDocMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleDocMouseDown);
    };
  }, [albumActionMenuAlbumId]);

  return (
    <>
      <div className="mx-auto flex max-w-7xl flex-col px-4 py-8 md:px-6 lg:px-8">
        <div className="w-full">
          <div className="mb-6 flex flex-col items-start justify-between gap-4 border-b border-gray-200 pb-6 sm:flex-row sm:items-center">
            <h1 className="text-2xl font-extrabold leading-none text-gray-900 sm:text-3xl">
              Gallery Hub
            </h1>

            <div className="flex w-full flex-col items-start gap-3 sm:w-auto sm:flex-row sm:items-center">
              <div className="flex w-full flex-row gap-2">
                <div className="flex flex-1 justify-between gap-2 rounded-full bg-gray-100 p-1 sm:flex-none sm:justify-start">
                  <button
                    onClick={() => setActiveFeed("public")}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-all sm:flex-none sm:px-4 sm:text-sm ${
                      activeFeed === "public"
                        ? "bg-gradient-to-r from-secondary-500 to-secondary-600 text-white shadow"
                        : "bg-primary-700 text-white hover:bg-primary-800"
                    }`}
                  >
                    <MdPublic size={16} /> Public
                  </button>

                  {canAccessFamilyFeed ? (
                    <button
                      onClick={() => setActiveFeed("family")}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-all sm:flex-none sm:px-4 sm:text-sm ${
                        activeFeed === "family"
                          ? "bg-gradient-to-r from-secondary-500 to-secondary-600 text-white shadow"
                          : "bg-primary-700 text-white hover:bg-primary-800"
                      }`}
                    >
                      <MdPeople size={16} /> Family
                    </button>
                  ) : null}
                </div>

                <button
                  className="flex flex-none items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-primary-700 px-2.5 py-1.5 text-xs font-semibold text-white shadow transition-all hover:bg-primary-800 sm:px-4 sm:text-sm"
                  onClick={() => setIsCreateAlbumModalOpen(true)}
                >
                  <FiPlusCircle size={16} /> Create Album
                </button>
              </div>

              <input
                type="text"
                autoFocus
                placeholder="Search Albums..."
                value={searchCaption}
                onChange={(event) => {
                  const value = event.target.value;
                  setSearchCaption(value);

                  if (searchTimeoutRef.current) {
                    clearTimeout(searchTimeoutRef.current);
                  }

                  searchTimeoutRef.current = setTimeout(() => {
                    void fetchGalleries({
                      cursor: null,
                      galleryTitleSearch: value,
                      replace: true,
                    });
                  }, 400);
                }}
                className="w-full rounded-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 dark:bg-slate-800 dark:text-white sm:w-48"
              />
            </div>
          </div>

          {loadingAlbums ? (
            <GalleryPageShimmer />
          ) : (
            <>
              {feedError ? (
                <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {feedError}
                </div>
              ) : null}

              <div className="grid auto-rows-fr grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {filteredAlbums.length > 0 ? (
                  filteredAlbums.map((album) => (
                    <div
                      key={album.id}
                      className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl transition-all duration-300 ease-in-out hover:scale-[1.03]"
                    >
                      <button
                        type="button"
                        className="relative h-56 w-full overflow-hidden bg-gray-100 text-left"
                        onClick={() => openGalleryModal(album)}
                        aria-label={`Open album ${album.title || ""}`}
                      >
                        <img
                          src={album.coverPhoto}
                          alt={album.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                          {album.photosCount > 0 ? (
                            <span className="rounded-full bg-black/50 px-2 py-1 text-sm font-semibold text-white backdrop-blur-sm">
                              {album.photosCount} Photos
                            </span>
                          ) : null}
                        </div>
                        {album.photosCount > 1 ? (
                          <div className="animate-bounce-slow absolute right-3 top-3 rounded-full bg-primary-600 px-3 py-1.5 text-xs font-bold text-white shadow-md">
                            +{album.photosCount - 1} More
                          </div>
                        ) : null}
                        {!album.isSeen ? (
                          <div className="absolute left-3 top-3 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow">
                            New
                          </div>
                        ) : null}
                      </button>

                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="mb-2 line-clamp-1 text-xl font-bold text-gray-900">
                            {album.title}
                          </h3>

                          {album?.authorId &&
                          userInfo?.userId &&
                          Number(album.authorId) !== Number(userInfo.userId) ? (
                            <div className="relative" data-album-action-menu>
                              <button
                                type="button"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100 active:bg-gray-200"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setAlbumActionMenuAlbumId((prev) =>
                                    prev === album.id ? null : album.id,
                                  );
                                }}
                                aria-label="Album actions"
                              >
                                <FiMoreVertical />
                              </button>

                              {albumActionMenuAlbumId === album.id ? (
                                <div className="absolute right-0 z-10 mt-2 w-40 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                                  <button
                                    type="button"
                                    className="w-full px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-red-50 active:bg-red-100"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setAlbumActionMenuAlbumId(null);
                                      openReportModalForAlbum(album);
                                    }}
                                  >
                                    Report
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        <p className="mb-3 text-sm text-gray-600">
                          by{" "}
                          <span
                            className="cursor-pointer font-medium text-primary-700"
                            onClick={(event) => {
                              event.stopPropagation();
                              goToUserProfile(album.authorId);
                            }}
                          >
                            {album.author}
                          </span>
                        </p>

                        <div className="flex items-center justify-between gap-3 text-sm text-gray-500">
                          {album.privacy === "family" ? (
                            <span
                              className="flex items-center dark:bg-slate-900 gap-1 rounded-full bg-primary-50 px-3 py-1 font-medium text-primary-600"
                              title="Family Album"
                            >
                              <MdPeople size={16} /> 
                            </span>
                          ) : (
                            <span
                              className="flex items-center gap-1 dark:bg-slate-900 rounded-full bg-secondary-50 px-3 py-1 font-medium text-secondary-400"
                              title="Public Album"
                            >
                              <MdPublic size={16} /> 
                            </span>
                          )}

                          <div className="flex items-center gap-3 text-xs font-medium text-gray-500">
                             <span className="flex items-center gap-1 ">{album.likeCount || 0} <FiHeart size={14} className="text-red-500" /></span>
                            <span className="flex items-center gap-1">{album.commentCount || 0} <FiMessageCircle size={14} className="text-blue-500" /></span>
                            {album.privacy === "public" ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setShareGallery(album);
                                }}
                                className="inline-flex items-center gap-1 rounded-full  px-3 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-200"
                              >
                                <FiShare2 size={14} />
                                {/* Share */}
                              </button>
                            ) : null}
                           
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center rounded-2xl border border-gray-100 bg-white p-10 text-center text-gray-600 shadow-xl sm:col-span-2 md:col-span-3 lg:col-span-4">
                    <div>
                      <p className="mb-4 text-2xl font-bold text-gray-800">
                        No albums here yet!
                      </p>
                      <p className="text-lg">
                        Looks like the {activeFeed === "family" ? "Family" : "Public"} feed is a bit quiet. Why not be the first to share?
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {filteredAlbums.length > 0 ? (
                <div ref={loadMoreTriggerRef} className="mt-6 flex justify-center py-4">
                  {loadingMore ? (
                    <span className="text-sm font-medium text-gray-500">
                      Loading more galleries...
                    </span>
                  ) : hasMore ? (
                    <span className="text-sm text-gray-400">
                      Scroll to load more
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">
                      You&apos;re all caught up
                    </span>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {selectedAlbum ? (
        <GalleryViewerModal
          isOpen={isGalleryModalOpen}
          onClose={() => setIsGalleryModalOpen(false)}
          album={selectedAlbum}
          currentUser={userInfo}
          authToken={token}
          onSeenEligible={queueSeenGallery}
        />
      ) : null}

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

      <PublicGalleryShareSheet
        isOpen={Boolean(shareGallery)}
        gallery={shareGallery}
        onClose={() => setShareGallery(null)}
      />
    </>
  );
};

export default FamilyGalleryPage;
