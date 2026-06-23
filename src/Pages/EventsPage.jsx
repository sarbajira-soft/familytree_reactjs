import React, { useEffect, useMemo, useState } from "react";
import { useUser } from "../Contexts/UserContext";
import Swal from "sweetalert2";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { authFetch, authFetchResponse } from "../utils/authFetch";
import { getToken } from "../utils/auth";

import {
  FiCalendar,
  FiMapPin,
  FiUsers,
  FiPlusSquare,
  FiPlusCircle,
  FiList,
  FiArrowRight,
  FiGlobe,
  FiEdit3,
  FiTrash2,
  FiGift,
  FiHeart,
  FiMoreVertical,
} from "react-icons/fi";

import EventModal from "../Components/EventModal";
import EventViewerModal from "../Components/EventViewerModal";
import NoFamilyView from "../Components/NoFamilyView";
import PendingApprovalView from "../Components/PendingApprovalView";
import CreateFamilyModal from "../Components/CreateFamilyModal";
import JoinFamilyModal from "../Components/JoinFamilyModal";
import EventsShimmer from "./EventsShimmer";
import ReportContentModal from "../Components/ReportContentModal";
import EmptyState from "../Components/EmptyState";
import { hasFamilyAccess, hasFamilyAccessStatus } from "../utils/familyAccess";
import {
  formatEventDateLabel,
  formatScheduleHeadline,
  formatTimeRangeLabel,
  getNextUpcomingSchedule,
  normalizeEventSchedulesInput,
} from "../utils/eventValidation";

const EVENTS_PAGE_SIZE = 20;

const getEventFeedEndpoint = (activeTab) => {
  if (activeTab === "upcoming") return "/events/upcoming";
  if (activeTab === "my-events") return "/events/mine";
  return "/events";
};

const normalizeBooleanLike = (value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
};

const normalizeEventItem = (item, apiBaseUrl) => {
  const schedules = normalizeEventSchedulesInput(item);
  const fallbackNextSchedule = item?.nextEventDate
    ? {
        scheduleTitle: item?.title || item?.eventTitle || "Event",
        scheduleDate: item.nextEventDate,
        isAllDay: true,
        times: [],
      }
    : null;
  const nextScheduleTimes = item?.nextSchedule?.startTime
    ? [
        {
          startTime: item.nextSchedule.startTime,
          endTime: item.nextSchedule.endTime || "",
        },
      ]
    : Array.isArray(item?.nextSchedule?.times)
      ? item.nextSchedule.times
      : [];
  const nextSchedule = item?.nextSchedule
    ? {
        ...item.nextSchedule,
        scheduleTitle:
          item.nextSchedule.scheduleTitle ||
          item.nextSchedule.schedule_title ||
          item.nextSchedule.title ||
          item.title ||
          item.eventTitle,
        isAllDay:
          nextScheduleTimes.length > 0
            ? false
            : normalizeBooleanLike(item.nextSchedule.isAllDay),
        times: nextScheduleTimes,
      }
    : getNextUpcomingSchedule(schedules) || fallbackNextSchedule;
  const primarySchedule = nextSchedule || schedules[0] || null;
  const primaryTimeLabel = primarySchedule?.isAllDay
    ? "All day"
    : primarySchedule?.times?.[0]
      ? formatTimeRangeLabel(primarySchedule.times[0])
      : item.eventTime || item.time || null;

  let eventData = {
    id: item.id,
    title: item.title || item.eventTitle,
    description: item.description || item.eventDescription || "",
    date: primarySchedule?.scheduleDate || item.nextEventDate || item.eventDate || item.date,
    time: primaryTimeLabel,
    location: item.location || "",
    familyCode: item.familyCode,
    createdBy: item.createdBy ?? item.userId ?? item.created_by,
    updatedAt: item.updatedAt,
    eventType: item.eventType || "custom",
    schedules,
    nextSchedule: primarySchedule,
    hasMultipleDates: item.hasMultipleDates || schedules.length > 1,
    eventImages:
      item.eventImages && item.eventImages.length > 0
        ? item.eventImages
        : item.coverImage
          ? [item.coverImage]
          : item.images && item.images.length > 0
            ? item.images.map((img) => `${apiBaseUrl}/uploads/event/${img.imageUrl}`)
            : [],
    attendeesCount: null,
    memberDetails: item.memberDetails || null,
    createdAt: item.createdAt || null,
  };

  if (item.eventType === "birthday" && item.memberDetails) {
    eventData = {
      ...eventData,
      profileImage: item.memberDetails.profileImage || item.coverImage || null,
      age: item.memberDetails.age,
      message: item.memberDetails.message,
    };
  } else if (item.eventType === "anniversary" && item.memberDetails) {
    eventData = {
      ...eventData,
      profileImage: item.memberDetails.profileImage || item.coverImage || null,
      spouseName: item.memberDetails.spouseName,
      yearsOfMarriage: item.memberDetails.yearsOfMarriage,
      message: item.memberDetails.message,
    };
  }

  return eventData;
};

const EventsPage = () => {
  const { userInfo, userLoading } = useUser();
  const canAccessFamilyEvents = hasFamilyAccess(userInfo);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("upcoming");
  const [eventModalMode, setEventModalMode] = useState(null);
  const [isEventViewerOpen, setIsEventViewerOpen] = useState(false);
  const [isCreateFamilyModalOpen, setIsCreateFamilyModalOpen] = useState(false);
  const [isJoinFamilyModalOpen, setIsJoinFamilyModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventActionMenuEventId, setEventActionMenuEventId] = useState(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [isEventDetailLoading, setIsEventDetailLoading] = useState(false);

  const openReportModalForEvent = (event) => {
    if (!event?.id) return;
    setReportTarget({
      targetType: "event",
      targetId: event.id,
      targetLabel: event?.title ? String(event.title).slice(0, 80) : "Event",
    });
    setReportModalOpen(true);
  };

  const closeReportModal = () => {
    setReportModalOpen(false);
    setReportTarget(null);
  };

  useEffect(() => {
    if (!eventActionMenuEventId) return;
    const handleDocMouseDown = (e) => {
      const el = e.target;
      if (el?.closest?.('[data-event-action-menu]')) return;
      setEventActionMenuEventId(null);
    };
    document.addEventListener("mousedown", handleDocMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleDocMouseDown);
    };
  }, [eventActionMenuEventId]);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

  const {
    data: pagedEvents,
    isLoading: eventsLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["events", activeTab, userInfo?.familyCode],
    queryFn: async ({ pageParam }) => {
      const endpoint = getEventFeedEndpoint(activeTab);
      const params = new URLSearchParams({
        limit: String(EVENTS_PAGE_SIZE),
      });
      if (pageParam) {
        params.set("cursor", pageParam);
      }

      const response = await authFetch(`${apiBaseUrl}${endpoint}?${params.toString()}`, {
        method: "GET",
      });

      if (Array.isArray(response)) {
        return { data: response, nextCursor: null };
      }

      return {
        data: Array.isArray(response?.data) ? response.data : [],
        nextCursor: response?.nextCursor || null,
      };
    },
    getNextPageParam: (lastPage) => lastPage?.nextCursor?.cursor || undefined,
    initialPageParam: null,
    enabled: canAccessFamilyEvents,
    staleTime: 2 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });

  const displayedEvents = useMemo(() => {
    const pages = Array.isArray(pagedEvents?.pages) ? pagedEvents.pages : [];
    return pages
      .flatMap((page) => (Array.isArray(page?.data) ? page.data : []))
      .map((item) => normalizeEventItem(item, apiBaseUrl));
  }, [apiBaseUrl, pagedEvents]);

  const fetchEventDetails = async (eventId) => {
    const eventDetail = await authFetch(`${apiBaseUrl}/event/${eventId}`, {
      method: "GET",
    });
    return normalizeEventItem(eventDetail, apiBaseUrl);
  };

  const handleCreateEventClick = () => {
    setSelectedEvent(null);
    setEventModalMode("create");
  };

  const handleViewEvent = async (event) => {
    if (!event?.id) return;
    try {
      setIsEventDetailLoading(true);
      const detailedEvent = await fetchEventDetails(event.id);
      setSelectedEvent(detailedEvent);
      setIsEventViewerOpen(true);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Unable to load event",
        text: error?.message || "Please try again.",
        confirmButtonColor: "#d33",
      });
    } finally {
      setIsEventDetailLoading(false);
    }
  };

  const handleCloseEventViewer = () => {
    setIsEventViewerOpen(false);
    setSelectedEvent(null);
  };

  const handleEditEvent = () => {
    setIsEventViewerOpen(false);
    setEventModalMode("edit");
  };

  const handleCloseEventModal = () => {
    setEventModalMode(null);
    setSelectedEvent(null);
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;

    const result = await Swal.fire({
      title: "Are you sure?",
      text: "Are you sure you want to delete this event? This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    });

    if (!result.isConfirmed) return;

    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
      const deleteEndpoint = `${apiBaseUrl}/event/${selectedEvent.id}`;

      await authFetchResponse(deleteEndpoint, {
        method: "DELETE",
      });

      console.log("✅ Event deleted successfully");

      await Swal.fire({
        icon: "success",
        title: "Deleted!",
        text: "Event has been deleted successfully.",
        confirmButtonColor: "#10b981",
      });

      setIsEventViewerOpen(false);
      setSelectedEvent(null);
      queryClient.invalidateQueries({ queryKey: ["events"] });
    } catch (error) {
      console.error("Error deleting event:", error);
      Swal.fire({
        icon: "error",
        title: "Error deleting event",
        text: `Error deleting event: ${error.message}`,
        confirmButtonColor: "#d33",
      });
    }
  };

  const handleEventUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ["events"] });
  };

  const handleEventCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["events"] });
  };

  const handleCreateFamily = () => {
    setIsCreateFamilyModalOpen(true);
  };

  const handleJoinFamily = (familyCode = null) => {
    if (familyCode) {
      console.log("Joining family with code:", familyCode);
      setIsJoinFamilyModalOpen(true);
    } else {
      setIsJoinFamilyModalOpen(true);
    }
  };

  const handleFamilyJoined = (familyData) => {
    setIsJoinFamilyModalOpen(false);
    window.location.reload();
  };

  const handleFamilyCreated = (newFamilyDetails) => {
    setIsCreateFamilyModalOpen(false);
  };

  const formatEventDate = (rawDate) => {
    return formatEventDateLabel(rawDate);
  };

  const getEventSchedulePreview = (event) => {
    if (event.hasMultipleDates && event.nextSchedule) {
      return `Multiple schedules (next: ${formatScheduleHeadline(event.nextSchedule)})`;
    }

    if (event.nextSchedule) {
      return formatScheduleHeadline(event.nextSchedule);
    }

    if (event.date) {
      return `${formatEventDate(event.date)}${event.time ? ` at ${event.time}` : ""}`;
    }

    return "";
  };

  const getEventTypeStyle = (eventType) => {
    switch (eventType) {
      case "birthday":
        return {
          bgColor: "bg-pink-500",
          textColor: "text-pink-600",
          icon: FiGift,
          label: "BIRTHDAY",
          borderColor: "border-pink-200",
          hoverColor: "hover:text-pink-700",
        };
      case "anniversary":
        return {
          bgColor: "bg-red-500",
          textColor: "text-red-600",
          icon: FiHeart,
          label: "ANNIVERSARY",
          borderColor: "border-red-200",
          hoverColor: "hover:text-red-700",
        };
      default:
        return {
          bgColor: "bg-[#1976D2]",
          textColor: "text-[#1976D2]",
          icon: FiCalendar,
          label: "EVENT",
          borderColor: "border-[#1976D2]/20",
          hoverColor: "hover:text-[#1976D2]",
        };
    }
  };

  const handleEditEventFromCard = async (event, e) => {
    e.stopPropagation();
    if (!event?.id) return;
    try {
      setIsEventDetailLoading(true);
      const detailedEvent = await fetchEventDetails(event.id);
      setSelectedEvent(detailedEvent);
      setEventModalMode("edit");
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Unable to load event",
        text: error?.message || "Please try again.",
        confirmButtonColor: "#d33",
      });
    } finally {
      setIsEventDetailLoading(false);
    }
  };

  const handleDeleteEventFromCard = async (event, e) => {
    e.stopPropagation();

    const result = await Swal.fire({
      title: "Are you sure?",
      text: "Are you sure you want to delete this event? This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    });
    if (!result.isConfirmed) return;

    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
      const deleteEndpoint = `${apiBaseUrl}/event/${event.id}`;

      await authFetchResponse(deleteEndpoint, {
        method: "DELETE",
      });

      console.log("✅ Event deleted successfully");
      await Swal.fire({
        icon: "success",
        title: "Deleted!",
        text: "Event has been deleted successfully.",
        confirmButtonColor: "#10b981",
      });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    } catch (error) {
      console.error("Error deleting event:", error);
      Swal.fire({
        icon: "error",
        title: "Error deleting event",
        text: `Error deleting event: ${error.message}`,
        confirmButtonColor: "#d33",
      });
    }
  };

  if (userLoading) {
    return <EventsShimmer />;
  }

  const pendingFamilyCode = userInfo?.pendingFamilyCode || '';
  const hasPendingRequest = userInfo?.approveStatus === "pending" && Boolean(pendingFamilyCode);

  const accessView = !userInfo?.familyCode && !hasPendingRequest ? (
    <NoFamilyView
      onCreateFamily={handleCreateFamily}
      onJoinFamily={handleJoinFamily}
      type="events"
    />
  ) : !hasFamilyAccessStatus(userInfo?.approveStatus) ? (
    <PendingApprovalView
      familyCode={pendingFamilyCode || userInfo.familyCode}
      onJoinFamily={handleJoinFamily}
    />
  ) : null;

  return (
    <>
      {accessView ? (
        <div className="min-h-[calc(100vh-6rem)] bg-gray-50 dark:bg-slate-950 flex items-center justify-center px-4 py-6">
          {accessView}
        </div>
      ) : (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-16">
          <div className="max-w-7xl mx-auto px-4 py-8 md:px-6 lg:px-8 space-y-5">
            {/* Header Section (Mobile only) */}
            <div className="flex md:hidden flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              {/* Left Block - hidden on mobile to keep header compact */}
              <div className="hidden sm:flex sm:flex-col w-full sm:w-auto">
               
              </div>

              {/* Right Button */}
              <button
                onClick={handleCreateEventClick}
                className="bg-gradient-to-r from-orange-500 to-orange-600 
      text-white px-4 py-2 sm:px-8 sm:py-4 rounded-xl shadow-lg 
      hover:opacity-90 transition duration-300 flex items-center gap-2 sm:gap-3 
      text-sm sm:text-lg font-semibold w-full sm:w-auto justify-center"
              >
                <FiPlusSquare size={20} /> Create Event
              </button>
            </div>

            {/* Desktop View Tab Bar and Create Event Button (Image 2 Layout) */}
            <div className="hidden md:flex justify-between items-center w-full mb-6">
              {/* Tabs on Left */}
              <div className="flex items-center gap-3">
                {/* Upcoming */}
                <button
                  onClick={() => setActiveTab("upcoming")}
                  className={`flex items-center gap-2 py-2.5 px-6 rounded-full font-semibold transition-all text-sm shadow-sm
                    ${activeTab === "upcoming"
                      ? "bg-orange-500 hover:bg-orange-600 text-white shadow-md"
                      : "bg-[#1976D2] hover:bg-[#1565C0] text-white"
                    }`}
                >
                  <FiCalendar size={16} />
                  <span>Upcoming Events</span>
                </button>

                {/* My Events */}
                <button
                  onClick={() => setActiveTab("my-events")}
                  className={`flex items-center gap-2 py-2.5 px-6 rounded-full font-semibold transition-all text-sm shadow-sm
                    ${activeTab === "my-events"
                      ? "bg-orange-500 hover:bg-orange-600 text-white shadow-md"
                      : "bg-[#1976D2] hover:bg-[#1565C0] text-white"
                    }`}
                >
                  <FiList size={16} />
                  <span>My Events</span>
                </button>

                {/* All Events */}
                <button
                  onClick={() => setActiveTab("all")}
                  className={`flex items-center gap-2 py-2.5 px-6 rounded-full font-semibold transition-all text-sm shadow-sm
                    ${activeTab === "all"
                      ? "bg-orange-500 hover:bg-orange-600 text-white shadow-md"
                      : "bg-[#1976D2] hover:bg-[#1565C0] text-white"
                    }`}
                >
                  <FiGlobe size={16} />
                  <span>All Events</span>
                </button>
              </div>

              {/* Create Event Button on Right */}
              <button
                onClick={handleCreateEventClick}
                className="bg-[#1976D2] hover:bg-[#1565C0] text-white px-6 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 text-sm font-semibold"
              >
                <FiPlusCircle size={18} />
                <span>Create Event</span>
              </button>
            </div>

            {/* Filter Tabs – Responsive (Mobile only) */}
            <div className="flex md:hidden justify-center w-full mt-1">
              {/* Container */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-md p-2 border border-gray-200 dark:border-slate-800 w-full">
                {/* Mobile View (Compact UI) */}
                <div className="flex items-center gap-2">
                  {/* Upcoming */}
                  <button
                    onClick={() => setActiveTab("upcoming")}
                    className={`flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-1.5 text-[10px] rounded-full font-semibold transition-all
        ${activeTab === "upcoming"
                        ? "bg-orange-500 text-white shadow-md"
                        : "bg-white text-[#1976D2] border border-[#1976D2]/30"
                      }`}
                  >
                    <FiCalendar size={14} />
                    <span className="whitespace-nowrap">Upcoming</span>
                  </button>

                  {/* My Events */}
                  <button
                    onClick={() => setActiveTab("my-events")}
                    className={`flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-1.5 text-[10px] rounded-full font-semibold transition-all
        ${activeTab === "my-events"
                        ? "bg-orange-500 text-white shadow-md"
                        : "bg-white text-[#1976D2] border border-[#1976D2]/30"
                      }`}
                  >
                    <FiList size={14} />
                    <span className="whitespace-nowrap">My Events</span>
                  </button>

                  {/* All */}
                  <button
                    onClick={() => setActiveTab("all")}
                    className={`flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-1.5 text-[10px] rounded-full font-semibold transition-all
        ${activeTab === "all"
                        ? "bg-orange-500 text-white shadow-md"
                        : "bg-white text-[#1976D2] border border-[#1976D2]/30"
                      }`}
                  >
                    <FiGlobe size={14} />
                    <span className="whitespace-nowrap">All</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Events Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {eventsLoading ? (
                <div className="col-span-full">
                  <EventsShimmer />
                </div>
              ) : displayedEvents.length > 0 ? (
                displayedEvents.map((event) => {
                  const eventStyle = getEventTypeStyle(event.eventType);
                  const EventIcon = eventStyle.icon;
                  const canReport =
                    userInfo?.userId &&
                    event?.createdBy &&
                    Number(event.createdBy) !== Number(userInfo.userId);

                  return (
                    <div
                      key={event.id}
                      className={`group bg-white dark:bg-slate-900 rounded-2xl shadow-lg transition-all duration-300 border h-full flex flex-col ${eventStyle.borderColor
                        } dark:border-slate-800 ${event.eventType === "custom"
                          ? "cursor-pointer hover:shadow-xl transform hover:scale-105"
                          : "cursor-default"
                        }`}
                      onClick={
                        event.eventType === "custom" && !isEventDetailLoading
                          ? () => handleViewEvent(event)
                          : undefined
                      }
                    >
                      {/* Event Image */}
                      <div className="relative h-40 overflow-hidden">
                        {event.eventImages && event.eventImages.length > 0 ? (
                          <img
                            src={event.eventImages[0]}
                            alt={event.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src =
                                "https://placehold.co/800x450/e0f2fe/0369a1?text=Event+Image";
                            }}
                          />
                        ) : event.profileImage ? (
                          <img
                            src={event.profileImage}
                            alt={event.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src =
                                "https://placehold.co/800x450/e0f2fe/0369a1?text=Event+Image";
                            }}
                          />
                        ) : (
                          <div
                            className={`w-full h-full ${eventStyle.bgColor} flex items-center justify-center`}
                          >
                            <EventIcon size={40} className="text-white" />
                          </div>
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                        {event.eventImages && event.eventImages.length > 1 && (
                          <div className="absolute top-3 right-3 bg-black/80 text-white px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm">
                            +{event.eventImages.length - 1} photos
                          </div>
                        )}

                        <div
                          className={`absolute top-3 left-3 ${eventStyle.bgColor} text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1`}
                        >
                          <EventIcon size={12} />
                          {eventStyle.label}
                        </div>

                        {event.eventType === "birthday" && event.age && (
                          <div className="absolute bottom-3 right-3 bg-white/90 text-pink-600 px-2 py-1 rounded-full text-xs font-bold dark:bg-slate-900/90 dark:text-pink-200">
                            {event.age} years
                          </div>
                        )}
                        {event.eventType === "anniversary" &&
                          event.yearsOfMarriage && (
                            <div className="absolute bottom-3 right-3 bg-white/90 text-red-600 px-2 py-1 rounded-full text-xs font-bold dark:bg-slate-900/90 dark:text-red-200">
                              {event.yearsOfMarriage} years
                            </div>
                          )}
                      </div>

                      {/* Event Content */}
                      <div className="p-3 flex-1 flex flex-col">
                        <div className="space-y-2">
                          <div className="space-y-2">
                            <h3
                              className={`text-base font-bold text-gray-900 dark:text-slate-100 line-clamp-2 group-hover:${eventStyle.textColor} transition-colors duration-300`}
                            >
                              {event.title}
                            </h3>
                            {event.eventType === "custom" && event.hasMultipleDates ? (
                              <span className="inline-flex w-fit items-center rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-700 dark:bg-primary-500/15 dark:text-primary-200">
                                Multiple schedules
                              </span>
                            ) : null}
                          </div>

                          {event.message && (
                            <p className="text-xs text-gray-600 dark:text-slate-300 italic bg-gray-50 dark:bg-slate-800 p-2 rounded-lg line-clamp-2">
                              "{event.message}"
                            </p>
                          )}

                          {/* Keep info rows a consistent height so icons/footers align in grid rows */}
                          <div className="space-y-2 min-h-[64px]">
                            <div className="flex items-center gap-2 text-gray-700 dark:text-slate-200">
                              <div
                                className={`w-6 h-6 ${eventStyle.bgColor} rounded flex items-center justify-center flex-shrink-0`}
                              >
                                <FiCalendar size={14} className="text-white" />
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 dark:text-slate-400">Date & Time</p>
                                <p className="text-sm font-semibold">
                                  {getEventSchedulePreview(event)}
                                </p>
                              </div>
                            </div>

                            <div
                              className={`flex items-center gap-2 text-gray-700 dark:text-slate-200 ${event.location ? "" : "opacity-0 pointer-events-none"
                                }`}
                              aria-hidden={!event.location}
                            >
                              <div
                                className={`w-6 h-6 ${eventStyle.bgColor} rounded flex items-center justify-center flex-shrink-0`}
                              >
                                <FiMapPin size={14} className="text-white" />
                              </div>
                              <p className="text-sm font-semibold line-clamp-1">
                                {event.location || "—"}
                              </p>
                            </div>
                          </div>

                          {/* {event.description && (
                            <p className="text-gray-600 dark:text-slate-300 text-xs leading-relaxed line-clamp-2">
                              {event.description}
                            </p>
                          )} */}
                        </div>

                        <div className="flex items-center justify-between pt-2 mt-auto border-t border-gray-100 dark:border-slate-800">
                          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-slate-300">
                            {event.attendeesCount && (
                              <div className="flex items-center gap-2">
                                <FiUsers size={14} />
                                <span className="font-medium">
                                  {event.attendeesCount}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {activeTab === "my-events" &&
                              event.eventType === "custom" && (
                                <>
                                  <button
                                    disabled={isEventDetailLoading}
                                    onClick={(e) =>
                                      handleEditEventFromCard(event, e)
                                    }
                                    className="bg-unset p-1.5 text-gray-500 hover:text-[#1976D2] hover:bg-[#1976D2]/10 rounded-lg transition-all duration-200"
                                    title="Edit Event"
                                  >
                                    <FiEdit3 size={14} />
                                  </button>
                                  <button
                                    onClick={(e) =>
                                      handleDeleteEventFromCard(event, e)
                                    }
                                    className="bg-unset p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all duration-200"
                                    title="Delete Event"
                                  >
                                    <FiTrash2 size={14} />
                                  </button>
                                </>
                              )}

                            {canReport ? (
                              <div
                                className="relative"
                                data-event-action-menu
                                onPointerDown={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  aria-label="Event actions"
                                  className="bg-unset p-1.5 text-gray-500 dark:text-slate-300 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-all duration-200"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEventActionMenuEventId((prev) =>
                                      prev === event.id ? null : event.id,
                                    );
                                  }}
                                >
                                  <FiMoreVertical size={16} />
                                </button>

                                {eventActionMenuEventId === event.id && (
                                  <div className="absolute z-[1000] right-0 bottom-full mb-2 w-40 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
                                    <button
                                      type="button"
                                      className="w-full flex items-center  rounded-lg px-3 py-2 text-left text-sm text-gray-700 dark:text-slate-200 hover:bg-red-50 dark:hover:bg-slate-800 active:bg-red-100 dark:active:bg-slate-700 transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEventActionMenuEventId(null);
                                        openReportModalForEvent(event);
                                      }}
                                    >
                                      Report
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : null}

                            {event.eventType === "custom" && (
                              <div
                                className={`flex items-center gap-1 ${eventStyle.textColor} font-semibold group-hover:${eventStyle.hoverColor} transition-colors`}
                              >
                                <span className="text-xs">View</span>
                                <FiArrowRight
                                  size={12}
                                  className="transform group-hover:translate-x-1 transition-transform"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full py-6">
                  <EmptyState
                    type="events"
                  />
                </div>
              )}
            </div>

            {hasNextPage ? (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="rounded-xl bg-[#1976D2] px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#1565C0] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isFetchingNextPage ? "Loading..." : "Load More Events"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Modals */}
      <EventModal
        isOpen={Boolean(eventModalMode)}
        onClose={handleCloseEventModal}
        mode={eventModalMode || "create"}
        event={eventModalMode === "edit" ? selectedEvent : null}
        onEventCreated={handleEventCreated}
        onEventUpdated={handleEventUpdated}
      />
      <EventViewerModal
        isOpen={isEventViewerOpen}
        onClose={handleCloseEventViewer}
        event={selectedEvent}
        isMyEvent={activeTab === "my-events"}
        onEdit={handleEditEvent}
        onDelete={handleDeleteEvent}
      />

      <ReportContentModal
        isOpen={reportModalOpen}
        onClose={closeReportModal}
        targetType={reportTarget?.targetType}
        targetId={reportTarget?.targetId}
        targetLabel={reportTarget?.targetLabel}
      />
      <CreateFamilyModal
        isOpen={isCreateFamilyModalOpen}
        onClose={() => setIsCreateFamilyModalOpen(false)}
        onFamilyCreated={handleFamilyCreated}
        token={getToken()}
      />

      <JoinFamilyModal
        isOpen={isJoinFamilyModalOpen}
        onClose={() => setIsJoinFamilyModalOpen(false)}
        onFamilyJoined={handleFamilyJoined}
        token={getToken()}
      />
    </>
  );
};

export default EventsPage;

