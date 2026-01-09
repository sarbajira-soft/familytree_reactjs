import React, { useState, useEffect } from "react";
import { getToken } from "../utils/auth";
import { useUser } from "../Contexts/UserContext";
import Swal from "sweetalert2";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  FiCalendar,
  FiClock,
  FiMapPin,
  FiUsers,
  FiPlusSquare,
  FiList,
  FiClock as FiUpcoming,
  FiLoader,
  FiImage,
  FiArrowRight,
  FiStar,
  FiGlobe,
  FiEdit3,
  FiTrash2,
  FiGift,
  FiHeart,
  FiUser,
} from "react-icons/fi";

import CreateEventModal from "../Components/CreateEventModal";
import EventViewerModal from "../Components/EventViewerModal";
import EditEventModal from "../Components/EditEventModal";
import NoFamilyView from "../Components/NoFamilyView";
import PendingApprovalView from "../Components/PendingApprovalView";
import CreateFamilyModal from "../Components/CreateFamilyModal";
import JoinFamilyModal from "../Components/JoinFamilyModal";

const EventsPage = () => {
  const { userInfo, userLoading } = useUser();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("upcoming");
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);
  const [isEventViewerOpen, setIsEventViewerOpen] = useState(false);
  const [isEditEventModalOpen, setIsEditEventModalOpen] = useState(false);
  const [isCreateFamilyModalOpen, setIsCreateFamilyModalOpen] = useState(false);
  const [isJoinFamilyModalOpen, setIsJoinFamilyModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Use React Query for events with tab-based caching
  const { data: allEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["events", activeTab, userInfo?.familyCode],
    queryFn: async () => {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
      let endpoint;

      if (activeTab === "upcoming") {
        endpoint = `${apiBaseUrl}/event/upcoming/all`;
      } else if (activeTab === "my-events") {
        endpoint = `${apiBaseUrl}/event/my-events`;
      } else if (activeTab === "all") {
        endpoint = `${apiBaseUrl}/event/all`;
      }

      const token = localStorage.getItem("access_token");
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }

      const data = await response.json();
      return data.map((item) => {
        let eventData = {
          id: item.id,
          title: item.eventTitle,
          description: item.eventDescription,
          date: item.eventDate,
          time: item.eventTime,
          location: item.location,
          eventType: item.eventType || "custom",
          eventImages:
            item.eventImages && item.eventImages.length > 0
              ? item.eventImages
              : item.images && item.images.length > 0
              ? item.images.map(
                  (img) => `${apiBaseUrl}/uploads/event/${img.imageUrl}`
                )
              : [],
          attendeesCount: null,
        };

        if (item.eventType === "birthday" && item.memberDetails) {
          eventData = {
            ...eventData,
            memberDetails: item.memberDetails,
            profileImage: item.memberDetails.profileImage,
            age: item.memberDetails.age,
            message: item.memberDetails.message,
          };
        } else if (item.eventType === "anniversary" && item.memberDetails) {
          eventData = {
            ...eventData,
            memberDetails: item.memberDetails,
            profileImage: item.memberDetails.profileImage,
            spouseName: item.memberDetails.spouseName,
            yearsOfMarriage: item.memberDetails.yearsOfMarriage,
            message: item.memberDetails.message,
          };
        }

        return eventData;
      });
    },
    enabled: !!userInfo?.familyCode && userInfo?.approveStatus === "approved",
    staleTime: 2 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });

  const handleCreateEventClick = () => setIsCreateEventModalOpen(true);

  const handleViewEvent = (event) => {
    setSelectedEvent(event);
    setIsEventViewerOpen(true);
  };

  const handleCloseEventViewer = () => {
    setIsEventViewerOpen(false);
    setSelectedEvent(null);
  };

  const handleEditEvent = () => {
    setIsEventViewerOpen(false);
    setIsEditEventModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditEventModalOpen(false);
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
      const token = getToken();
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
      const deleteEndpoint = `${apiBaseUrl}/event/${selectedEvent.id}`;

      const response = await fetch(deleteEndpoint, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Delete event API error:", errorText);
        Swal.fire({
          icon: "error",
          title: "Delete Event Error",
          text: `Delete Event Error: ${response.status} - ${errorText}`,
          confirmButtonColor: "#d33",
        });
        return;
      }

      console.log("✅ Event deleted successfully");

      await Swal.fire({
        icon: "success",
        title: "Deleted!",
        text: "Event has been deleted successfully.",
        confirmButtonColor: "#10b981",
      });

      setIsEventViewerOpen(false);
      setSelectedEvent(null);
      queryClient.invalidateQueries(["events"]);
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
    queryClient.invalidateQueries(["events"]);
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

  const displayedEvents = allEvents;

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

  const handleEditEventFromCard = (event, e) => {
    e.stopPropagation();
    setSelectedEvent(event);
    setIsEditEventModalOpen(true);
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
      const token = getToken();
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
      const deleteEndpoint = `${apiBaseUrl}/event/${event.id}`;

      const response = await fetch(deleteEndpoint, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Delete event API error:", errorText);
        Swal.fire({
          icon: "error",
          title: "Delete Event Error",
          text: `Delete Event Error: ${response.status} - ${errorText}`,
          confirmButtonColor: "#d33",
        });
        return;
      }

      console.log("✅ Event deleted successfully");
      await Swal.fire({
        icon: "success",
        title: "Deleted!",
        text: "Event has been deleted successfully.",
        confirmButtonColor: "#10b981",
      });
      queryClient.invalidateQueries(["events"]);
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
    return (
      <>
        <div className="max-w-7xl mx-auto px-4 py-8 md:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center py-20">
            <FiLoader className="text-6xl text-[#1976D2] animate-spin mb-4" />
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">
              Loading User Data...
            </h2>
            <p className="text-gray-500">
              Please wait while we fetch your information.
            </p>
          </div>
        </div>
      </>
    );
  }

  if (!userInfo?.familyCode) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <NoFamilyView
            onCreateFamily={handleCreateFamily}
            onJoinFamily={handleJoinFamily}
          />
        </div>
      </>
    );
  }

  if (userInfo?.familyCode && userInfo?.approveStatus !== "approved") {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <PendingApprovalView
            familyCode={userInfo.familyCode}
            onJoinFamily={handleJoinFamily}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 pb-16">
        <div className="max-w-7xl mx-auto px-4 py-8 md:px-6 lg:px-8 space-y-5">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            {/* Left Block */}
            <div className="flex flex-col w-full sm:w-auto">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#1976D2] rounded-lg flex items-center justify-center">
                  <FiCalendar size={22} className="text-white" />
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold text-[#1976D2]">
                   Events
                </h1>
              </div>

              <p className="text-gray-600 mt-1 text-sm sm:text-lg">
                Create, manage and celebrate memorable moments
              </p>

              {/* Legend */}
              {/* <div className="flex items-center gap-4 mt-3 text-xs sm:text-sm">
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 bg-pink-500 rounded-full"></div>
                  <span>Birthdays</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 bg-red-500 rounded-full"></div>
                  <span>Anniversaries</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 bg-[#1976D2] rounded-full"></div>
                  <span>Custom Events</span>
                </div>
              </div> */}
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

          {/* Filter Tabs – Responsive (Mobile vs Desktop) */}
          <div className="flex justify-center w-full mt-1">
            {/* Container */}
            <div className="bg-white rounded-2xl shadow-md p-2 border border-gray-200 w-full">
              {/* Desktop View (Old UI) */}
              <div className="hidden md:flex items-center justify-center gap-4">
                {/* Upcoming */}
                <button
                  onClick={() => setActiveTab("upcoming")}
                  className={`flex items-center gap-2 py-3 px-6 rounded-xl font-semibold transition-all
        ${
          activeTab === "upcoming"
            ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg scale-105"
            : "bg-[#1976D2] text-white hover:bg-[#1565C0]"
        }`}
                >
                  <FiCalendar size={18} />
                  <span>Upcoming Events</span>
                </button>

                {/* My Events */}
                <button
                  onClick={() => setActiveTab("my-events")}
                  className={`flex items-center gap-2 py-3 px-6 rounded-xl font-semibold transition-all
        ${
          activeTab === "my-events"
            ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg scale-105"
            : "bg-[#1976D2] text-white hover:bg-[#1565C0]"
        }`}
                >
                  <FiList size={18} />
                  <span>My Events</span>
                </button>

                {/* All Events */}
                <button
                  onClick={() => setActiveTab("all")}
                  className={`flex items-center gap-2 py-3 px-6 rounded-xl font-semibold transition-all
        ${
          activeTab === "all"
            ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg scale-105"
            : "bg-[#1976D2] text-white hover:bg-[#1565C0]"
        }`}
                >
                  <FiGlobe size={18} />
                  <span>All Events</span>
                </button>
              </div>

              {/* Mobile View (Compact UI) */}
              <div className="flex md:hidden items-center justify-between gap-2">
                {/* Upcoming */}
                <button
                  onClick={() => setActiveTab("upcoming")}
                  className={`flex items-center justify-center gap-1 py-2 px-3 text-xs w-full rounded-lg font-semibold transition-all
        ${
          activeTab === "upcoming"
            ? "bg-orange-500 text-white shadow-md"
            : "bg-[#1976D2] text-white hover:bg-[#1565C0]"
        }`}
                >
                  <FiCalendar size={14} />
                  Upcoming
                </button>

                {/* My Events */}
                <button
                  onClick={() => setActiveTab("my-events")}
                  className={`flex items-center justify-center gap-1 py-2 px-3 text-xs w-full rounded-lg font-semibold transition-all
        ${
          activeTab === "my-events"
            ? "bg-orange-500 text-white shadow-md"
            : "bg-[#1976D2] text-white hover:bg-[#1565C0]"
        }`}
                >
                  <FiList size={14} />
                  My Events
                </button>

                {/* All */}
                <button
                  onClick={() => setActiveTab("all")}
                  className={`flex items-center justify-center gap-1 py-2 px-3 text-xs w-full rounded-lg font-semibold transition-all
        ${
          activeTab === "all"
            ? "bg-orange-500 text-white shadow-md"
            : "bg-[#1976D2] text-white hover:bg-[#1565C0]"
        }`}
                >
                  <FiGlobe size={14} />
                  All
                </button>
              </div>
            </div>
          </div>

          {/* Events Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {eventsLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden animate-pulse"
                >
                  <div className="h-40 bg-gray-200" />
                  <div className="p-3 space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-full" />
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-gray-200 rounded flex-shrink-0" />
                        <div className="h-3 bg-gray-200 rounded w-1/2" />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-gray-200 rounded flex-shrink-0" />
                        <div className="h-3 bg-gray-200 rounded w-2/3" />
                      </div>
                    </div>
                    <div className="h-3 bg-gray-100 rounded w-full" />
                  </div>
                </div>
              ))
            ) : displayedEvents.length > 0 ? (
              displayedEvents.map((event) => {
                const eventStyle = getEventTypeStyle(event.eventType);
                const EventIcon = eventStyle.icon;

                return (
                  <div
                    key={event.id}
                    className={`group bg-white rounded-2xl shadow-lg transition-all duration-300 border ${
                      eventStyle.borderColor
                    } overflow-hidden ${
                      event.eventType === "custom"
                        ? "cursor-pointer hover:shadow-xl transform hover:scale-105"
                        : "cursor-default"
                    }`}
                    onClick={
                      event.eventType === "custom"
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
                        <div className="absolute bottom-3 right-3 bg-white/90 text-pink-600 px-2 py-1 rounded-full text-xs font-bold">
                          {event.age} years
                        </div>
                      )}
                      {event.eventType === "anniversary" &&
                        event.yearsOfMarriage && (
                          <div className="absolute bottom-3 right-3 bg-white/90 text-red-600 px-2 py-1 rounded-full text-xs font-bold">
                            {event.yearsOfMarriage} years
                          </div>
                        )}
                    </div>

                    {/* Event Content */}
                    <div className="p-3 space-y-2">
                      <h3
                        className={`text-base font-bold text-gray-900 line-clamp-2 group-hover:${eventStyle.textColor} transition-colors duration-300`}
                      >
                        {event.title}
                      </h3>

                      {event.message && (
                        <p className="text-xs text-gray-600 italic bg-gray-50 p-2 rounded-lg line-clamp-2">
                          "{event.message}"
                        </p>
                      )}

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-gray-700">
                          <div
                            className={`w-6 h-6 ${eventStyle.bgColor} rounded flex items-center justify-center flex-shrink-0`}
                          >
                            <FiCalendar size={14} className="text-white" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Date & Time</p>
                            <p className="text-sm font-semibold">
                              {event.date} {event.time && `• ${event.time}`}
                            </p>
                          </div>
                        </div>

                        {event.location && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <div
                              className={`w-6 h-6 ${eventStyle.bgColor} rounded flex items-center justify-center flex-shrink-0`}
                            >
                              <FiMapPin size={14} className="text-white" />
                            </div>
                            <p className="text-sm font-semibold line-clamp-1">
                              {event.location}
                            </p>
                          </div>
                        )}
                      </div>

                      {event.description && (
                        <p className="text-gray-600 text-xs leading-relaxed line-clamp-2">
                          {event.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-4 text-sm text-gray-600">
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
                                  className="bg-unset p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                                  title="Delete Event"
                                >
                                  <FiTrash2 size={14} />
                                </button>
                              </>
                            )}

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
              <div className="col-span-full text-center py-12 text-gray-500">
                No events found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateEventModal
        isOpen={isCreateEventModalOpen}
        onClose={() => setIsCreateEventModalOpen(false)}
      />
      <EventViewerModal
        isOpen={isEventViewerOpen}
        onClose={handleCloseEventViewer}
        event={selectedEvent}
        isMyEvent={activeTab === "my-events"}
        onEdit={handleEditEvent}
        onDelete={handleDeleteEvent}
      />
      <EditEventModal
        isOpen={isEditEventModalOpen}
        onClose={handleCloseEditModal}
        event={selectedEvent}
        onEventUpdated={handleEventUpdated}
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
