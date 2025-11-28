import React, { useState, useMemo } from "react";
import { useUser } from "../Contexts/UserContext";
import CreateEventModal from "../Components/CreateEventModal";
import ProfileFormModal from "../Components/ProfileFormModal";
import CreateAlbumModal from "../Components/CreateAlbumModal";
import CreatePostModal from "../Components/CreatePostModal";
import { useNavigate } from "react-router-dom";
import {
  FiUsers,
  FiCalendar,
  FiGift,
  FiImage,
  FiLoader,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import Swal from "sweetalert2";
import { fetchUserFamilyCodes } from "../utils/familyTreeApi";
import { getToken } from "../utils/auth";
import { useQuery } from "@tanstack/react-query";
import PostPage from "./PostPage";
import DashboardShimmer from "./DashboardShimmer";
import GalleryViewerModal from "../Components/GalleryViewerModal";

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
                className={`
    relative h-7 flex items-center justify-center rounded-md text-[11px] cursor-pointer transition
    
    ${
      // CASE 1: Today + Event
      key === todayKey && hasEvent
        ? "bg-secondary-400 text-white font-semibold"
        : // CASE 2: Today (no event)
        key === todayKey
        ? "bg-primary-600 text-white font-semibold"
        : // CASE 3: Selected day
        isSelected
        ? "bg-gray-200 text-gray-900 font-semibold"
        : // CASE 4: Event day (not today & not selected)
        hasEvent
        ? "bg-secondary-400 text-white font-semibold"
        : // CASE 5: Normal day
          "bg-white text-gray-700 hover:bg-gray-50"
    }
  `}
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
            {selectedDateEvents.map((event) => {
              const imageSrc =
                (event.eventImages && event.eventImages[0]) ||
                event.profileImage ||
                "https://placehold.co/800x450/e0f2fe/0369a1?text=Event";
              const title = event.eventTitle || event.title || "Event";
              const dateDisplay = `${event.eventDate || event.date || ""}$${
                event.eventTime ? " • " + event.eventTime : ""
              }`;
              const location = event.location;
              const description = event.eventDescription || event.description;

              return (
                <div
                  key={event.id}
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

const Dashboard = ({ apiBaseUrl = import.meta.env.VITE_API_BASE_URL }) => {
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCreateAlbumModalOpen, setIsCreateAlbumModalOpen] = useState(false);
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
  const { userInfo } = useUser();
  const navigate = useNavigate();
  const token = getToken();
    const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
    const [selectedAlbum, setSelectedAlbum] = useState(null);
  // Dashboard data query
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["dashboardData", userInfo?.familyCode],
    queryFn: async () => {
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };
      const [postsRes, statsRes, eventsRes, galleryRes, productsRes] =
        await Promise.all([
          fetch(
            `${apiBaseUrl}/post/by-options?privacy=private&familyCode=${userInfo.familyCode}`,
            { headers }
          ),
          fetch(`${apiBaseUrl}/family/member/${userInfo.familyCode}/stats`, {
            headers,
          }),
          fetch(`${apiBaseUrl}/event/upcoming`, { headers }),
          fetch(
            `${apiBaseUrl}/gallery/by-options?familyCode=${userInfo.familyCode}`,
            { headers }
          ),
          fetch(`${apiBaseUrl}/product`, { headers: { accept: "*/*" } }),
        ]);

      const [posts, stats, events, gallery, products] = await Promise.all([
        postsRes.json(),
        statsRes.json(),
        eventsRes.json(),
        galleryRes.json(),
        productsRes.json(),
      ]);
      return { posts, stats, events, gallery, products };
    },
    enabled: !!userInfo?.familyCode && !!token,
  });

  const processedData = useMemo(() => {
    if (!dashboardData)
      return {
        familyStats: { totalMembers: 0 },
        upcomingEventsCount: 0,
        galleryCount: 0,
        productCount: 0,
      };
    const { stats, events, gallery, products } = dashboardData;
    return {
      familyStats: stats?.data || { totalMembers: 0 },
      upcomingEventsCount: Array.isArray(events?.data)
        ? events.data.length
        : events.length || 0,
      galleryCount: Array.isArray(gallery?.data)
        ? gallery.data.length
        : gallery.length || 0,
      productCount: Array.isArray(products?.data)
        ? products.data.length
        : products.length || 0,
    };
  }, [dashboardData]);

  const { familyStats, upcomingEventsCount, galleryCount, productCount } =
    processedData;

  const upcomingEventsPreview = useMemo(() => {
    if (!dashboardData?.events) return [];
    const rawEvents = dashboardData.events;
    const list = Array.isArray(rawEvents?.data) ? rawEvents.data : rawEvents;
    return Array.isArray(list) ? list : [];
  }, [dashboardData]);

  const galleryPreview = useMemo(() => {
    if (!dashboardData?.gallery) return [];
    const rawGallery = dashboardData.gallery;
    const list = Array.isArray(rawGallery?.data) ? rawGallery.data : rawGallery;
    return Array.isArray(list) ? list.slice(0, 6) : [];
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
    return (
      <>
        {/* <div className="flex flex-col items-center justify-center h-screen">
          <FiLoader className="text-5xl text-blue-500 animate-spin mb-4" />
          <p className="text-gray-600">Loading Dashboard...</p>
        </div> */}
        <DashboardShimmer/>
      </>
    );
  }

  const dashboardCards = [
    {
      name: "Family",
      icon: <FiUsers size={32} />,
      count: familyStats.totalMembers,
      onClick: () => navigate("/my-family-member"),
    },
    {
      name: "Events",
      icon: <FiCalendar size={32} />,
      count: upcomingEventsCount,
      onClick: () => navigate("/events"),
    },
    {
      name: "Gifts",
      icon: <FiGift size={32} />,
      count: productCount,
      onClick: () => navigate("/gifts-memories"),
    },
    {
      name: "Gallery",
      icon: <FiImage size={32} />,
      count: galleryCount,
      onClick: () => navigate("/family-gallery"),
    },
  ];

  return (
    <>
      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-6 pt-3 space-y-7">
        {/* Header */}
        {/* <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <h1 className="text-md sm:text-2xl font-bold text-gray-900">
              Your Family Hub
            </h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              Welcome, {userInfo?.firstName || "User"}{" "}
              {userInfo?.lastName || ""}!
            </p>
          </div>
        </div> */}

        {/* Cards Section */}
        {/* <div className="hidden lg:grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
          {dashboardCards.map((card) => (
            <div
              key={card.name}
              onClick={card.onClick}
              className="relative bg-white rounded-xl border border-gray-200 shadow-sm 
                 flex items-center p-1 sm:p-2 gap-3 cursor-pointer group 
                 hover:shadow-md hover:scale-[1.02] transition-all duration-300"
            >
              <div
                className="absolute inset-0 bg-primary-50 opacity-0 group-hover:opacity-100 
                      transition-opacity rounded-xl"
              ></div>

              <div className="relative z-10 ml-5 flex items-center justify-center">
                <div
                  className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 
                        rounded-lg bg-primary-700 text-white shadow-sm 
                        group-hover:bg-secondary-500 transition-all duration-300"
                >
                  {card.icon}
                </div>

                <span
                  className="absolute -top-1 -right-2 bg-secondary-500 text-white text-[10px] 
                         rounded-full w-5 h-5 flex items-center justify-center 
                         font-semibold shadow-sm group-hover:scale-110 
                         transition-transform duration-300"
                >
                  {card.count}
                </span>
              </div>

              <div className="flex flex-col ml-10 justify-center z-10">
                <h3
                  className="text-gray-800 font-semibold text-sm sm:text-base 
                      group-hover:text-blue-600 transition-colors"
                >
                  {card.name}
                </h3>
              </div>
            </div>
          ))}
        </div> */}

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {/* Upload Photo */}
          <button
            onClick={() => setIsCreateAlbumModalOpen(true)}
            className="flex items-center justify-center gap-1 sm:gap-2 
               bg-primary-700 text-white rounded-md sm:rounded-lg 
               px-1 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm 
               hover:bg-primary-800 hover:-translate-y-1 hover:shadow-md 
               transition-all duration-300"
          >
            <FiImage className="text-base sm:text-lg" />
            <span className="hidden sm:inline">Upload Photo</span>
            <span className="sm:hidden">Photo</span>
          </button>

          {/* Send Gift */}
          <button
            onClick={() => navigate("/gifts-memories")}
            className="flex items-center justify-center gap-1 sm:gap-2 
               bg-secondary-500 text-white rounded-md sm:rounded-lg 
               px-1 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm 
               hover:bg-secondary-600 hover:-translate-y-1 hover:shadow-md 
               transition-all duration-300"
          >
            <FiGift className="text-base sm:text-lg" />
            <span className="hidden sm:inline">Send Gift</span>
            <span className="sm:hidden">Gift</span>
          </button>

          {/* Schedule Event */}
          <button
            onClick={() => setIsCreateEventModalOpen(true)}
            className="flex items-center justify-center gap-1 sm:gap-2 
               bg-primary-700 text-white rounded-md sm:rounded-lg 
               px-1 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm 
               hover:bg-primary-800 hover:-translate-y-1 hover:shadow-md 
               transition-all duration-300"
          >
            <FiCalendar className="text-base sm:text-lg" />
            <span className="hidden sm:inline">Schedule Event</span>
            <span className="sm:hidden">Event</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
          <div className="lg:col-span-8 space-y-4">
            {/* Posts Section */}
            <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-gray-100">
              <PostPage />
            </div>
          </div>

          <div className="space-y-4 lg:col-span-4">
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
                      <div
                        key={album.id}
                        className="relative w-full pt-[100%] overflow-hidden rounded-lg cursor-pointer group"
                        onClick={() => openGalleryModal(album)}
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
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mini event calendar under photos */}
            <MiniEventCalendar events={upcomingEventsPreview} />

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
                    return (
                      <div
                        key={event.id || index}
                        className="group relative rounded-xl overflow-hidden bg-white shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                        style={{
                          animation: `fadeInUp 0.5s ease-out ${
                            index * 0.05
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
                              onClick={() => navigate("/gifts-memories")}
                              className="ml-3 inline-flex bg-white items-center gap-1 text-[11px] font-semibold text-secondary-600 hover:text-secondary-800 whitespace-nowrap"
                            >
                              <FiGift className="text-[13px]" />
                              <span>Send Gift</span>
                            </button>
                          </div>
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

        {/* Modals */}
        <CreateEventModal
          isOpen={isCreateEventModalOpen}
          onClose={() => setIsCreateEventModalOpen(false)}
        />
        <ProfileFormModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
        />
        <CreateAlbumModal
          isOpen={isCreateAlbumModalOpen}
          onClose={() => setIsCreateAlbumModalOpen(false)}
        />
        <CreatePostModal
          isOpen={isCreatePostModalOpen}
          onClose={() => setIsCreatePostModalOpen(false)}
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
    </>
  );
};

export default Dashboard;
