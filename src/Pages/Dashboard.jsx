import { useQuery } from "@tanstack/react-query";
import PropTypes from "prop-types";
import React, { useEffect, useMemo, useState } from "react";
import {
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiGift,
  FiImage
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import CreateAlbumModal from "../Components/CreateAlbumModal";
import CreateEventModal from "../Components/CreateEventModal";
import CreatePostModal from "../Components/CreatePostModal";
import DashboardGiftProductModal from "../Components/DashboardGiftProductModal";
import GalleryViewerModal from "../Components/GalleryViewerModal";
import { useGiftEvent } from "../Contexts/GiftEventContext";
import { useUser } from "../Contexts/UserContext";
import { fetchProducts as fetchMedusaProducts, fetchRegions } from "../Retail/services/productService";
import { getProductThumbnail } from "../Retail/utils/helpers";
import { getToken } from "../utils/auth";
import { authFetch } from "../utils/authFetch";
import DashboardShimmer from "./DashboardShimmer";
import PostPage from "./PostPage";
import { MEDUSA_REGION_ID_KEY } from "../Retail/utils/constants";

const getLocalDateKey = (dateValue) => {
  if (!dateValue) return "";
  if (typeof dateValue === "string") {
    const [datePart] = dateValue.split("T");
    return datePart;
  }
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const MiniEventCalendar = ({ events = [] }) => {
  const todayKey = getLocalDateKey(new Date());
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [selectedDateKey, setSelectedDateKey] = useState(() => {
    return getLocalDateKey(new Date());
  });

  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach((event) => {
      const dateValue = event.eventDate || event.date;
      const key = getLocalDateKey(dateValue);
      if (!key) return;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [events]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay(); // 0 (Sun) - 6 (Sat)
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const weeks = [];
  let day = 1 - startWeekday;
  for (let week = 0; week < 6; week++) {
    const days = [];
    for (let i = 0; i < 7; i++, day++) {
      if (day < 1 || day > daysInMonth) {
        days.push(null);
      } else {
        const cellDate = new Date(year, month, day);
        const key = getLocalDateKey(cellDate);
        const hasEvent = !!eventsByDate[key];
        days.push({ day, key, hasEvent });
      }
    }
    weeks.push(days);
  }

  const monthLabel = currentMonth.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const changeMonth = (offset) => {
    setCurrentMonth((prev) =>
      new Date(prev.getFullYear(), prev.getMonth() + offset, 1)
    );
  };

  const weekdayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const selectedDateEvents = useMemo(() => {
    if (!selectedDateKey || !events.length) return [];
    return events.filter((event) => {
      const key = getLocalDateKey(event.eventDate || event.date);
      return key === selectedDateKey;
    });
  }, [events, selectedDateKey]);

  const selectedDateLabel = useMemo(() => {
    if (!selectedDateKey) return "";
    const d = new Date(selectedDateKey);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, [selectedDateKey]);

  const getDayCellClass = (dayKey, hasEvent, isSelected) => {
    if (dayKey === todayKey && hasEvent) {
      return "bg-secondary-400 text-white font-semibold";
    }
    if (dayKey === todayKey) {
      return "bg-primary-600 text-white font-semibold";
    }
    if (isSelected) {
      return "bg-gray-200 text-gray-900 font-semibold";
    }
    if (hasEvent) {
      return "bg-secondary-400 text-white font-semibold";
    }
    return "bg-white text-gray-700 hover:bg-gray-50";
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-800">Event Calendar</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            className="bg-unset p-1 rounded-full hover:bg-gray-100 text-gray-600"
          >
            <FiChevronLeft size={14} />
          </button>
          <span className="text-xs font-medium text-gray-700">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            className="bg-unset p-1 rounded-full hover:bg-gray-100 text-gray-600"
          >
            <FiChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1 text-[11px] text-gray-500">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className="h-6 flex items-center justify-center font-medium"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-xs">
        {weeks.map((week, wi) =>
          week.map((cell, di) => {
            if (!cell) {
              return (
                <div
                  key={`${wi}-${di}`}
                  className="h-7 flex items-center justify-center text-[11px] text-gray-300"
                >

                </div>
              );
            }
            const { day: dayNum, hasEvent, key } = cell;
            const isSelected = key === selectedDateKey;
            return (
              <button
                key={`${wi}-${di}`}
                type="button"
                onClick={() => setSelectedDateKey(key)}
                className={`relative h-7 flex items-center justify-center rounded-md text-[11px] cursor-pointer transition ${getDayCellClass(
                  key,
                  hasEvent,
                  isSelected,
                )}`}
              >
                {dayNum}
              </button>
            );
          })
        )}
      </div>

      <div className="mt-3 border-t border-gray-100 pt-3">
        {selectedDateLabel && (
          <p className="text-[11px] font-semibold text-gray-700 mb-2">
            {selectedDateLabel}
          </p>
        )}
        {selectedDateEvents.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {selectedDateEvents.map((event, index) => {
              const imageSrc =
                (event.eventImages && event.eventImages[0]) ||
                event.profileImage ||
                "https://placehold.co/800x450/e0f2fe/0369a1?text=Event";
              const title = event.eventTitle || event.title || "Event";
              const dateKey = getLocalDateKey(event.eventDate || event.date);
              const timeKey = event.eventTime || event.time || "time";
              const eventKey = `${event.id || title || "event"}_${dateKey}_${timeKey}_${index}`;
              const dateDisplay = `${event.eventDate || event.date || ""}$$${event.eventTime ? " • " + event.eventTime : ""
                }`;
              const location = event.location;
              const description = event.eventDescription || event.description;

              return (
                <div
                  key={eventKey}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
                >
                  <div className="relative h-28 overflow-hidden">
                    <img
                      src={imageSrc}
                      alt={title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src =
                          "https://placehold.co/800x450/e0f2fe/0369a1?text=Event";
                      }}
                    />
                    <div className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] font-semibold px-2 py-1 rounded-full">
                      EVENT
                    </div>
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="text-xs font-semibold text-gray-900 truncate">
                      {title}
                    </p>
                    {dateDisplay.trim() && (
                      <p className="flex items-center gap-1 text-[11px] text-gray-600">
                        <FiCalendar size={11} />
                        <span className="truncate">{dateDisplay.replace("$", "")}</span>
                      </p>
                    )}
                    {location && (
                      <p className="text-[11px] text-gray-600 truncate">
                        {location}
                      </p>
                    )}
                    {description && (
                      <p className="text-[11px] text-gray-500 line-clamp-2">
                        {description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] text-gray-400">No events on this day</p>
        )}
      </div>
    </div>
  );
};

const buildGiftSuggestionsByEvent = (events, productSuggestionsPool, prev) => {
  const next = { ...prev };
  let changed = false;

  events.forEach((event, index) => {
    const key = event.id || index;
    const existing = next[key];

    if (!Array.isArray(existing) || existing.length === 0) {
      const shuffled = [...productSuggestionsPool].sort(
        () => Math.random() - 0.5,
      );
      next[key] = shuffled.slice(0, 3);
      changed = true;
    }
  });

  return changed ? next : prev;
};

const Dashboard = ({ apiBaseUrl = import.meta.env.VITE_API_BASE_URL }) => {
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);
  const [isCreateAlbumModalOpen, setIsCreateAlbumModalOpen] = useState(false);
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
  const [isScheduleOptionsOpen, setIsScheduleOptionsOpen] = useState(false);
  const [isEventCalendarModalOpen, setIsEventCalendarModalOpen] = useState(false);
  const [giftSuggestionsByEvent, setGiftSuggestionsByEvent] = useState({});
  const [medusaProducts, setMedusaProducts] = useState([]);
  const [isGiftDetailModalOpen, setIsGiftDetailModalOpen] = useState(false);
  const [selectedGiftProductId, setSelectedGiftProductId] = useState(null);
  const { userInfo } = useUser();
  const { setSelectedGiftEvent } = useGiftEvent();
  const navigate = useNavigate();
  const token = getToken();
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  // Dashboard data query
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["dashboardData", userInfo?.familyCode],
    queryFn: async () => {
      const [posts, stats, events, gallery] = await Promise.all([
        authFetch(
          // Bug 51: show family feed across linked families (spouse-connected families may have different codes)
          `${apiBaseUrl}/post/by-options?privacy=private`,
          { method: "GET" }
        ),
        authFetch(`${apiBaseUrl}/family/member/${userInfo.familyCode}/stats`, {
          method: "GET",
        }),
        authFetch(`${apiBaseUrl}/event/upcoming/all`, { method: "GET" }),
        authFetch(`${apiBaseUrl}/gallery/by-options?privacy=public`, { method: "GET" }),
      ]);
      return { posts, stats, events, gallery };
    },
    enabled: !!userInfo?.familyCode && !!token,
  });

  const upcomingEventsPreview = useMemo(() => {
    if (!dashboardData?.events) return [];
    const rawEvents = dashboardData.events;
    const list = Array.isArray(rawEvents?.data) ? rawEvents.data : rawEvents;
    return Array.isArray(list) ? list : [];
  }, [dashboardData]);

  const productSuggestionsPool = medusaProducts;

  const galleryPreview = useMemo(() => {
    if (!dashboardData?.gallery) return [];
    const rawGallery = dashboardData.gallery;
    const list = Array.isArray(rawGallery?.data) ? rawGallery.data : rawGallery;
    return Array.isArray(list) ? list.slice(0, 3) : [];
  }, [dashboardData]);

  const formatAlbumForModal = (album) => {
    return {
      id: album.id,
      title: album.galleryTitle || album.title || "Album",
      description: album.galleryDescription || album.description || "",
      author: album.user?.name || "Unknown",
      privacy: album.privacy,
      photosCount: album.galleryAlbums?.length || 0,
      likes: album.likeCount || 0,
      isLiked: album.isLiked || false,
      comments: new Array(album.commentCount || 0).fill(""),
      coverPhoto:
        album.coverPhoto ||
        (album.galleryAlbums &&
          album.galleryAlbums[0] &&
          album.galleryAlbums[0].album) ||
        "https://via.placeholder.com/400x300?text=Photo",
      photos: (album.galleryAlbums || []).map((photo, index) => ({
        id: photo.id,
        url: photo.album,
        caption: photo.caption || `Photo ${index + 1}`,
        likes: photo.likeCount || 0,
        comments: photo.commentCount
          ? new Array(photo.commentCount).fill("")
          : [],
      })),
    };
  };

  const openGalleryModal = (album) => {
    const formattedAlbum = formatAlbumForModal(album);
    setSelectedAlbum(formattedAlbum);
    setIsGalleryModalOpen(true);
  };

  const handleProductSuggestionClick = (product) => {
    if (!product || !product.id) {
      return;
    }
    setSelectedGiftProductId(product.id);
    setIsGiftDetailModalOpen(true);
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        let regionId = localStorage.getItem(MEDUSA_REGION_ID_KEY) || null;

        if (!regionId) {
          const regions = await fetchRegions();
          const primaryRegionId =
            (Array.isArray(regions) && regions.length > 0 && regions[0] && regions[0].id) || null;
          if (!primaryRegionId) return;
          localStorage.setItem(MEDUSA_REGION_ID_KEY, primaryRegionId);
          regionId = primaryRegionId;
        }

        const products = await fetchMedusaProducts({ regionId });
        if (isMounted && Array.isArray(products)) {
          setMedusaProducts(products);
        }
      } catch (err) {
        console.error("Failed to load gift products for suggestions", err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!upcomingEventsPreview.length) return;
    if (!productSuggestionsPool.length) return;

    setGiftSuggestionsByEvent((prev) =>
      buildGiftSuggestionsByEvent(
        upcomingEventsPreview,
        productSuggestionsPool,
        prev,
      ),
    );
  }, [upcomingEventsPreview, productSuggestionsPool]);

  const getEventCardStyle = (eventType) => {
    switch (eventType) {
      case "birthday":
        return {
          gradient: "from-pink-500 via-rose-500 to-red-500",
          badgeBg: "bg-pink-50",
          countdownBg: "bg-pink-50",
          countdownText: "text-pink-700",
          label: "Birthday",
          emoji: "🎂",
        };
      case "anniversary":
        return {
          gradient: "from-red-500 via-pink-500 to-rose-500",
          badgeBg: "bg-red-50",
          countdownBg: "bg-red-50",
          countdownText: "text-red-700",
          label: "Anniversary",
          emoji: "💕",
        };
      case "custom":
        return {
          gradient: "from-purple-500 via-indigo-500 to-blue-500",
          badgeBg: "bg-indigo-50",
          countdownBg: "bg-indigo-50",
          countdownText: "text-indigo-700",
          label: "Special Event",
          emoji: "🎉",
        };
      default:
        return {
          gradient: "from-blue-500 via-indigo-500 to-purple-500",
          badgeBg: "bg-blue-50",
          countdownBg: "bg-blue-50",
          countdownText: "text-blue-700",
          label: "Event",
          emoji: "📅",
        };
    }
  };

  const formatEventDate = (dateStr) => {
    if (!dateStr) return { day: "", month: "" };
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return { day: "", month: "" };
    return {
      day: d.getDate(),
      month: d.toLocaleDateString("en-US", { month: "short" }),
    };
  };

  const getDaysUntil = (dateStr) => {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    if (Number.isNaN(target.getTime())) return null;
    target.setHours(0, 0, 0, 0);
    const diffMs = target - today;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays < 7) return `In ${diffDays} days`;
    if (diffDays < 30) return `In ${Math.ceil(diffDays / 7)} weeks`;
    return `In ${Math.ceil(diffDays / 30)} months`;
  };

  const getEventTitle = (event) => {
    if (event.eventType === "birthday" && event.memberDetails?.firstName) {
      return `${event.memberDetails.firstName}'s Birthday`;
    }
    if (event.eventType === "anniversary" && event.memberDetails?.firstName) {
      return `${event.memberDetails.firstName}'s Anniversary`;
    }
    return event.eventTitle || event.title || "Special Event";
  };

  if (isLoading) {
    return <DashboardShimmer />;
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-5 py-4 pt-2 space-y-5">
      {/* Header */}


      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 pb-8">
        <div className="lg:col-span-8 space-y-3">
          {/* Posts Section */}
          <div className="bg-white rounded-xl shadow-md p-2 sm:p-3 border border-gray-100">
            <PostPage />
          </div>
        </div>

        <div className="hidden lg:block space-y-4 lg:col-span-4">

          <div className="space-y-4 lg:col-span-4">
            <div className="bg-white rounded-xl shadow-sm p-3 border border-gray-100">
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setIsCreateAlbumModalOpen(true)}
                  className="flex flex-col items-center justify-center gap-1 bg-primary-700 text-white rounded-lg px-2 py-2 text-[11px] font-semibold hover:bg-primary-800 transition-colors"
                >
                  <FiImage className="text-base" />
                  <span>Photo</span>
                </button>

                <button
                  onClick={() => navigate("/gifts-memories")}
                  className="flex flex-col items-center justify-center gap-1 bg-secondary-500 text-white rounded-lg px-2 py-2 text-[11px] font-semibold hover:bg-secondary-600 transition-colors"
                >
                  <FiGift className="text-base" />
                  <span>Gift</span>
                </button>

                <button
                  onClick={() => setIsScheduleOptionsOpen(true)}
                  className="flex flex-col items-center justify-center gap-1 bg-primary-700 text-white rounded-lg px-2 py-2 text-[11px] font-semibold hover:bg-primary-800 transition-colors"
                >
                  <FiCalendar className="text-base" />
                  <span>Event</span>
                </button>
              </div>
            </div>

            {/* Recent Photos at top */}
            {galleryPreview.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-800">
                    Recent Photos
                  </p>

                  <button
                    onClick={() => navigate("/family-gallery")}
                    className="text-xs font-semibold bg-white text-primary-700 hover:text-primary-900"
                  >
                    View all
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {galleryPreview.map((album) => {
                    const cover =
                      album.coverPhoto ||
                      (album.galleryAlbums &&
                        album.galleryAlbums[0] &&
                        album.galleryAlbums[0].album) ||
                      "https://via.placeholder.com/150x150?text=Photo";
                    return (
                      <button
                        type="button"
                        key={album.id}
                        className="relative w-full pt-[100%] overflow-hidden rounded-lg cursor-pointer group bg-transparent p-0 border-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                        onClick={() => openGalleryModal(album)}
                        aria-label={`Open album ${album.galleryTitle || album.title || "Album"
                          }`}
                      >
                        <img
                          src={cover}
                          alt={album.galleryTitle || album.title || "Album"}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        />

                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                          <div className="text-white text-xs font-semibold text-center px-2">
                            <p className="line-clamp-2">
                              {album.galleryTitle || album.title || "Album"}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Upcoming event cards under calendar */}
            {upcomingEventsPreview.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-800">
                    Upcoming Family Events
                  </p>
                  <button
                    onClick={() => navigate("/events")}
                    className="text-xs font-semibold bg-white text-primary-700 hover:text-primary-900"
                  >
                    View all
                  </button>
                </div>
                <div className="space-y-3">
                  {upcomingEventsPreview.map((event, index) => {
                    const style = getEventCardStyle(event.eventType);
                    const dateValue = event.eventDate || event.date;
                    const timeValue = event.eventTime || event.time;
                    const dateInfo = formatEventDate(dateValue);
                    const daysUntil = getDaysUntil(dateValue);
                    const title = getEventTitle(event);
                    const timeKey = timeValue || "time";
                    const eventKey = `${event.id || title || "event"}_${getLocalDateKey(
                      dateValue,
                    )}_${timeKey}_${index}`;
                    return (
                      <div
                        key={eventKey}
                        className="group relative rounded-xl overflow-hidden bg-white shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                        style={{
                          animation: `fadeInUp 0.5s ease-out ${index * 0.05
                            }s both`,
                        }}
                      >
                        <div
                          className={`relative h-14 bg-gradient-to-r ${style.gradient} overflow-hidden`}
                        >
                          <div className="absolute inset-0 opacity-20">
                            <div
                              className="absolute inset-0"
                              style={{
                                backgroundImage:
                                  "radial-gradient(circle at 20px 20px, white 2px, transparent 0)",
                                backgroundSize: "40px 40px",
                              }}
                            />
                          </div>
                          <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 shadow-sm">
                            <div className="text-center leading-none">
                              <div className="text-sm font-bold text-gray-900">
                                {dateInfo.day}
                              </div>
                              <div className="text-[9px] font-semibold text-gray-600 uppercase tracking-wide">
                                {dateInfo.month}
                              </div>
                            </div>
                          </div>
                          <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 shadow-sm flex items-center gap-1">
                            <span className="text-xs">{style.emoji}</span>
                            <span className="text-[9px] font-bold text-gray-700">
                              {style.label}
                            </span>
                          </div>
                        </div>

                        <div className="p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-xs font-semibold text-gray-900 truncate">
                              {title}
                            </h3>
                            {daysUntil && (
                              <div
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${style.countdownBg}`}
                              >
                                <span
                                  className={`text-[10px] font-semibold ${style.countdownText}`}
                                >
                                  {daysUntil}
                                </span>
                              </div>
                            )}
                          </div>

                          {event.eventDescription && (
                            <p className="text-[11px] text-gray-600 line-clamp-2">
                              {event.eventDescription}
                            </p>
                          )}

                          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                            <div className="flex flex-col gap-1 text-[11px] text-gray-600">
                              {(dateValue || timeValue) && (
                                <div className="flex items-center gap-1">
                                  <FiCalendar
                                    size={12}
                                    className="text-gray-500"
                                  />
                                  <span className="truncate">
                                    {dateValue}
                                    {timeValue ? ` • ${timeValue}` : ""}
                                  </span>
                                </div>
                              )}
                              {event.location && (
                                <div className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-secondary-500" />
                                  <span className="truncate max-w-[140px]">
                                    {event.location}
                                  </span>
                                </div>
                              )}
                            </div>

                            <button
                              onClick={() => {
                                setSelectedGiftEvent({
                                  eventId: event.id || null,
                                  eventTitle: title,
                                  eventType: event.eventType || "custom",
                                  eventDate: dateValue || null,
                                  eventTime: timeValue || null,
                                  location: event.location || null,
                                  memberDetails: event.memberDetails || null,
                                  createdBy: event.createdBy || null,
                                  userId:
                                    (event.memberDetails &&
                                      event.memberDetails.userId) ||
                                    event.createdBy ||
                                    null,
                                });
                                navigate("/gifts-memories");
                              }}
                              className="ml-3 inline-flex bg-white items-center gap-1 text-[11px] font-semibold text-secondary-600 hover:text-secondary-800 whitespace-nowrap"
                            >
                              <FiGift className="text-[13px]" />
                              <span>Send Gift</span>
                            </button>
                          </div>

                          {giftSuggestionsByEvent[event.id || index] &&
                            giftSuggestionsByEvent[event.id || index].length > 0 && (
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <div className="flex flex-1 gap-1.5">
                                  {giftSuggestionsByEvent[event.id || index].map((product) => {
                                    const image = getProductThumbnail(product);
                                    return (
                                      <button
                                        key={product.id}
                                        type="button"
                                        onClick={() => {
                                          setSelectedGiftEvent({
                                            eventId: event.id || null,
                                            eventTitle: title,
                                            eventType: event.eventType || "custom",
                                            eventDate: dateValue || null,
                                            eventTime: timeValue || null,
                                            location: event.location || null,
                                            memberDetails: event.memberDetails || null,
                                            createdBy: event.createdBy || null,
                                            userId:
                                              (event.memberDetails &&
                                                event.memberDetails.userId) ||
                                              event.createdBy ||
                                              null,
                                          });
                                          handleProductSuggestionClick(product);
                                        }}
                                        className="relative flex-1 overflow-hidden rounded-md bg-gray-100 aspect-square group"
                                      >
                                        <img
                                          src={image}
                                          alt={product.title || product.description || "Gift"}
                                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                          onError={(e) => {
                                            e.target.src = "https://placehold.co/80x80?text=Gift";
                                          }}
                                        />
                                      </button>
                                    );
                                  })}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedGiftEvent({
                                      eventId: event.id || null,
                                      eventTitle: title,
                                      eventType: event.eventType || "custom",
                                      eventDate: dateValue || null,
                                      eventTime: timeValue || null,
                                      location: event.location || null,
                                      memberDetails: event.memberDetails || null,
                                      createdBy: event.createdBy || null,
                                      userId:
                                        (event.memberDetails &&
                                          event.memberDetails.userId) ||
                                        event.createdBy ||
                                        null,
                                    });
                                    navigate("/gifts-memories");
                                  }}
                                  className="flex items-center justify-center w-7 h-7 rounded-full bg-secondary-500 text-white hover:bg-secondary-600 flex-shrink-0"
                                  aria-label="More gifts"
                                >
                                  <FiChevronRight size={14} />
                                </button>
                              </div>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Gift Ideas at bottom */}
            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-secondary-100 flex items-center justify-center">
                    <FiGift className="text-secondary-600" size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      Gift Ideas
                    </p>
                    <p className="text-xs text-gray-500">
                      Make upcoming events more special
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate("/gifts-memories")}
                  className="text-xs font-semibold bg-white text-secondary-600 hover:text-secondary-800"
                >
                  View all
                </button>
              </div>
              <button
                onClick={() => navigate("/gifts-memories")}
                className="w-full inline-flex items-center justify-center gap-2 text-xs font-semibold text-white bg-secondary-500 hover:bg-secondary-600 rounded-lg py-2 transition-colors"
              >
                <FiGift size={14} />
                <span>Browse Gift Ideas</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {isScheduleOptionsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-5">
            <h2 className="text-lg font-semibold text-gray-900">Schedule Event</h2>
            <p className="mt-1 text-sm text-gray-600">
              Choose how you want to manage your events.
            </p>
            <div className="mt-4 space-y-3">
              <button
                onClick={() => {
                  setIsScheduleOptionsOpen(false);
                  setIsCreateEventModalOpen(true);
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary-700 text-white text-sm font-semibold hover:bg-primary-800 transition-colors"
              >
                <span>Create new event</span>
              </button>
              <button
                onClick={() => {
                  setIsScheduleOptionsOpen(false);
                  setIsEventCalendarModalOpen(true);
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary-700 text-white text-sm font-semibold hover:bg-primary-800 transition-colors"
              >
                <span>View event calendar</span>
              </button>
            </div>
            <button
              onClick={() => setIsScheduleOptionsOpen(false)}
              className="mt-4 bg-white w-full text-center text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isEventCalendarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                Event Calendar
              </h2>
              <button
                type="button"
                onClick={() => setIsEventCalendarModalOpen(false)}
                className="bg-unset text-gray-500 hover:text-gray-700 text-xl leading-none px-2"
              >
                &times;
              </button>
            </div>
            <div className="p-3 sm:p-4 overflow-y-auto">
              <MiniEventCalendar events={upcomingEventsPreview} />
            </div>
          </div>
        </div>
      )}

      <CreateEventModal
        isOpen={isCreateEventModalOpen}
        onClose={() => setIsCreateEventModalOpen(false)}
      />
      <CreateAlbumModal
        isOpen={isCreateAlbumModalOpen}
        onClose={() => setIsCreateAlbumModalOpen(false)}
      />
      <CreatePostModal
        isOpen={isCreatePostModalOpen}
        onClose={() => setIsCreatePostModalOpen(false)}
      />
      <DashboardGiftProductModal
        isOpen={isGiftDetailModalOpen}
        productId={selectedGiftProductId}
        onClose={() => {
          setIsGiftDetailModalOpen(false);
          setSelectedGiftProductId(null);
        }}
      />
      {/* Gallery Viewer Modal */}
      {selectedAlbum && (
        <GalleryViewerModal
          isOpen={isGalleryModalOpen}
          onClose={() => setIsGalleryModalOpen(false)}
          album={selectedAlbum}
          currentUser={userInfo}
          authToken={token}
        />
      )}
    </div>
  );
};

MiniEventCalendar.propTypes = {
  events: PropTypes.arrayOf(PropTypes.object),
};

Dashboard.propTypes = {
  apiBaseUrl: PropTypes.string,
};

export default Dashboard;
