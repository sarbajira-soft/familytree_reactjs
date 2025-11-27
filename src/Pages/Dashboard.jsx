import React, { useState, useMemo } from "react";
import { useUser } from "../Contexts/UserContext";
import CreateEventModal from "../Components/CreateEventModal";
import ProfileFormModal from "../Components/ProfileFormModal";
import CreateAlbumModal from "../Components/CreateAlbumModal";
import CreatePostModal from "../Components/CreatePostModal";
import { useNavigate } from "react-router-dom";
import { FiUsers, FiCalendar, FiGift, FiImage, FiLoader } from "react-icons/fi";
import Swal from "sweetalert2";
import { fetchUserFamilyCodes } from "../utils/familyTreeApi";
import { getToken } from "../utils/auth";
import { useQuery } from "@tanstack/react-query";
import PostPage from "./PostPage";
import DashboardShimmer from "./DashboardShimmer";

const Dashboard = ({ apiBaseUrl = import.meta.env.VITE_API_BASE_URL }) => {
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCreateAlbumModalOpen, setIsCreateAlbumModalOpen] = useState(false);
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
  const { userInfo } = useUser();
  const navigate = useNavigate();
  const token = getToken();

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
        <div className="hidden lg:grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
          {dashboardCards.map((card) => (
            <div
              key={card.name}
              onClick={card.onClick}
              className="relative bg-white rounded-xl border border-gray-200 shadow-sm 
                 flex items-center p-1 sm:p-2 gap-3 cursor-pointer group 
                 hover:shadow-md hover:scale-[1.02] transition-all duration-300"
            >
              {/* Hover background (soft blue/orange tint) */}
              <div
                className="absolute inset-0 bg-primary-50 opacity-0 group-hover:opacity-100 
                      transition-opacity rounded-xl"
              ></div>

              {/* Icon + Count */}
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

              {/* Name */}
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
        </div>

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

        {/* Posts Section */}
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-gray-100">
          <PostPage />
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
      </div>
    </>
  );
};

export default Dashboard;
