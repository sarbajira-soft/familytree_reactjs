import React, { useState, useEffect, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import BottomNavBar from "./BottomNavBar";
import { useNotificationSocket } from "../hooks/useNotificationSocket";
import {
  FiMenu,
  FiBell,
  FiChevronDown,
  FiHome,
  FiCalendar,
  FiImage,
  FiGift,
  FiUsers,
  FiPackage,
  FiLink,
  FiClock,
} from "react-icons/fi";
import { RiUser3Line } from "react-icons/ri";
import { RiGitMergeLine } from "react-icons/ri";
import { useUser } from "../Contexts/UserContext";
import { MEDUSA_TOKEN_KEY, MEDUSA_CART_ID_KEY } from "../Retail/utils/constants";
import ProfileFormModal from "./ProfileFormModal";
import NotificationPanel from "./NotificationPanel";

const Layout = ({ noScroll = false }) => {
  const [activeTab, setActiveTab] = useState("profile");
  const location = useLocation();
  const navigate = useNavigate();

  // Update active tab based on current route
  useEffect(() => {
    const pathToTabId = {
      "/dashboard": "home",
      "/myprofile": "profile",
      "/events": "upcomingEvent",
      "/upcoming-events": "upcomingEvent",
      // "/posts-and-feeds": "postsStories",
      "/gifts": "gifts",
      "/gifts-memories": "gifts",
    };
    const tabId = pathToTabId[location.pathname];
    if (tabId) setActiveTab(tabId);
  }, [location.pathname]);

  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [familyMenuOpen, setFamilyMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);

  const menuButtonRef = useRef(null);
  const sidebarRef = useRef(null);
  const familyMenuButtonRef = useRef(null);
  const familyMenuRef = useRef(null);
  const profileRef = useRef(null);

  const { userInfo, userLoading, logout } = useUser();
  const { isConnected, unreadCount, refetchUnreadCount, notifications } =
    useNotificationSocket(userInfo);

  // Responsive layout handling
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(e.target)
      ) {
        setSidebarOpen(false);
      }

      if (
        familyMenuRef.current &&
        !familyMenuRef.current.contains(e.target) &&
        familyMenuButtonRef.current &&
        !familyMenuButtonRef.current.contains(e.target)
      ) {
        setFamilyMenuOpen(false);
      }

      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const isAdmin = userInfo && userInfo.role === 3;
  const isApproved = userInfo && userInfo.approveStatus === "approved";

  const headerNavItems = [
    {
      id: "home",
      label: "Home",
      route: "/dashboard",
      icon: <FiHome size={20} />,
    },
    {
      id: "events",
      label: "Events",
      route: "/events",
      icon: <FiCalendar size={20} />,
    },
    {
      id: "familyTree",
      label: "Family Tree",
      route: "/family-tree",
      icon: <RiGitMergeLine size={20} />,
    },
    {
      id: "familyManagement",
      label: "Family",
      icon: <FiUsers size={20} />,
      children: [
        {
          id: "myFamily",
          label: "My Family",
          route: "/my-family",
          icon: <FiUsers size={18} />,
        },
        {
          id: "myFamilyMembers",
          label: "All Members",
          route: "/my-family-member",
          icon: <FiUsers size={18} />,
        },
        {
          id: "pendingRequests",
          label: "Invite Links",
          route: "/pending-request",
          icon: <FiLink size={18} />,
          requiresApproval: true,
        },
        ...(userInfo?.role === 2 || userInfo?.role === 3
          ? [
              {
                id: "suggestionApproving",
                label: "Suggestion Approving",
                route: "/suggestion-approving",
                icon: <FiClock size={18} />,
              },
            ]
          : []),
      ],
    },
    {
      id: "gallery",
      label: "Gallery",
      route: "/family-gallery",
      icon: <FiImage size={20} />,
    },
    {
      id: "gifts",
      label: "Gifts",
      route: "/gifts-memories",
      icon: <FiGift size={20} />,
    },
    {
      id: "orders",
      label: "Orders",
      route: "/orders",
      icon: <FiPackage size={20} />,
    },
  ]
    .filter((item) => {
      if (item.id === "orders" && !isAdmin) return false;
      if (item.requiresApproval && !isApproved) return false;

      if (item.children) {
        const visibleChildren = item.children.filter((child) => {
          if (child.requiresApproval && !isApproved) return false;
          return true;
        });
        return visibleChildren.length > 0;
      }

      return true;
    })
    .map((item) => {
      if (item.children) {
        return {
          ...item,
          children: item.children.filter((child) => {
            if (child.requiresApproval && !isApproved) return false;
            return true;
          }),
        };
      }
      return item;
    });

  const isHeaderItemActive = (item) => {
    if (item.route) return location.pathname === item.route;
    if (item.children) {
      return item.children.some((child) => location.pathname === child.route);
    }
    return false;
  };

  const navigateTo = (route) => {
    setFamilyMenuOpen(false);
    setSidebarOpen(false);
    navigate(route);
  };

  const handleLogout = () => {
    logout();
    localStorage.removeItem("userInfo");
    localStorage.removeItem(MEDUSA_TOKEN_KEY);
    localStorage.removeItem(MEDUSA_CART_ID_KEY);
    navigate("/login");
  };

  const openAddMemberModal = () => {
    setIsAddMemberModalOpen(true);
    setProfileOpen(false);
  };

  const closeAddMemberModal = () => {
    setIsAddMemberModalOpen(false);
  };

  const decrementUnreadCount = () => {
    refetchUnreadCount();
  };

  if (userLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 text-gray-800">
      <main className="h-full flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-4 lg:px-6 sticky top-0 z-50 shadow-md">
          <div className="flex items-center justify-between h-16">
            {/* Left Section */}
            <div className="flex items-center gap-2">
              {isMobile && (
                <button
                  ref={menuButtonRef}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSidebarOpen((prev) => !prev);
                    setProfileOpen(false);
                    setNotificationOpen(false);
                    setFamilyMenuOpen(false);
                  }}
                  className="p-2 rounded-xl bg-primary-600 text-white shadow-sm hover:bg-primary-700"
                >
                  <FiMenu size={18} />
                </button>
              )}

              <div className={`flex items-center ${isMobile ? "gap-1.5" : "gap-2"}`}>
                <div className={isMobile ? "w-9 h-9" : "w-12 h-12"}>
                  <img
                    src="/assets/family-logo.png"
                    alt="Familyss Logo"
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* <h2 className="font-semibold text-lg text-primary-700">Familyss</h2> */}
                <img
                  src="/assets/familyss.png"
                  alt="Familyss"
                  className={isMobile ? "h-10 w-auto" : "h-16 w-auto"}
                />

              </div>
            </div>

            {/* Center Section (Desktop Nav) */}
            {!isMobile && (
              <nav className="flex items-center gap-1">
                {headerNavItems.map((item) => {
                  const active = isHeaderItemActive(item);

                  if (item.children) {
                    return (
                      <div key={item.id} className="relative">
                        <button
                          ref={familyMenuButtonRef}
                          onClick={(e) => {
                            e.stopPropagation();
                            setFamilyMenuOpen((prev) => !prev);
                            setProfileOpen(false);
                            setNotificationOpen(false);
                          }}
                          className={`bg-unset flex flex-col items-center justify-center w-24 py-1.5 rounded-lg hover:bg-gray-100 transition-colors ${
                            active
                              ? "text-primary-700"
                              : "text-gray-600 hover:text-primary-700"
                          }`}
                        >
                          <span className={active ? "text-primary-700" : "text-gray-600"}>
                            {item.icon}
                          </span>
                          <span className="text-xs mt-0.5">{item.label}</span>
                        </button>

                        {familyMenuOpen && (
                          <div
                            ref={familyMenuRef}
                            className="absolute left-0 mt-2 w-60 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50"
                          >
                            <div className="py-2">
                              {item.children.map((child) => {
                                const childActive = location.pathname === child.route;
                                return (
                                  <button
                                    key={child.id}
                                    onClick={() => navigateTo(child.route)}
                                    className={`bg-unset w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-gray-50 ${
                                      childActive
                                        ? "text-primary-700 font-medium"
                                        : "text-gray-700"
                                    }`}
                                  >
                                    <span
                                      className={
                                        childActive ? "text-primary-600" : "text-gray-500"
                                      }
                                    >
                                      {child.icon}
                                    </span>
                                    <span>{child.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <button
                      key={item.id}
                      onClick={() => navigateTo(item.route)}
                      className={`bg-unset flex flex-col items-center justify-center w-24 py-1.5 rounded-lg hover:bg-gray-100 transition-colors ${
                        active
                          ? "text-primary-700"
                          : "text-gray-600 hover:text-primary-700"
                      }`}
                    >
                      <span className={active ? "text-primary-700" : "text-gray-600"}>
                        {item.icon}
                      </span>
                      <span className="text-xs mt-0.5">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            )}

            {/* Right Section */}
            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setNotificationOpen(!notificationOpen);
                  }}
                  className="p-1 bg-unset text-primary-600 relative rounded-3xl hover:bg-gray-100"
                >
                  <FiBell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                  {isConnected && (
                    <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-white"></span>
                  )}
                </button>
              </div>

              {/* Profile Dropdown */}
              <div ref={profileRef} className="relative z-50">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setProfileOpen(!profileOpen);
                  }}
                  className="bg-unset flex items-center space-x-2 p-1 rounded-lg hover:bg-gray-100"
                >
                  {userInfo?.profileUrl ? (
                    <img
                      src={userInfo.profileUrl}
                      alt="User Profile"
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary-500 to-primary-600 flex items-center justify-center text-white">
                      <RiUser3Line size={16} />
                    </div>
                  )}
                  {!isMobile && (
                    <FiChevronDown
                      size={16}
                      className={`transition-transform ${
                        profileOpen ? "rotate-180" : ""
                      }`}
                    />
                  )}
                </button>

                {profileOpen && (
                  <div
                    className="fixed md:absolute right-4 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-50 border border-gray-200"
                    style={{ top: "4rem" }}
                  >
                    <div className="px-4 py-2  text-sm text-gray-800 border-b border-gray-100">
                      <p className="font-semibold">
                        {userInfo?.firstName} {userInfo?.lastName}
                      </p>
                      {userInfo?.familyCode && (
                        <p className="text-gray-500 text-xs">
                          Family Code: {userInfo.familyCode}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => navigate("/myprofile")}
                      className="block w-full bg-white text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      My Profile
                    </button>
                    <button
                      onClick={openAddMemberModal}
                      className="block w-full bg-white text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Edit Profile
                    </button>
                    <div className="border-t border-gray-200"></div>
                    <button
                      onClick={handleLogout}
                      className="block w-full bg-white text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {isMobile && sidebarOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/20"
              onClick={() => setSidebarOpen(false)}
            />
            <div
              ref={sidebarRef}
              className="fixed top-16 bottom-0 left-0 z-50 bg-white shadow-2xl border-r border-gray-200 overflow-hidden"
            >
              <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                isMobile
                onCloseMobile={() => setSidebarOpen(false)}
                collapsed={false}
                variant="sidebar"
              />
            </div>
          </>
        )}

        {/* Page Outlet (Content changes, layout persists) */}
        <div
          className={`flex-1 ${
            noScroll ? "overflow-hidden" : "overflow-y-auto"
          } pt-0 px-1 pb-1 md:px-2 md:pb-2 bg-gray-50`}
        >
          <Outlet />
        </div>

        {/* Bottom Navbar for Mobile */}
        {isMobile && (
          <BottomNavBar activeTab={activeTab} setActiveTab={setActiveTab} />
        )}
      </main>

      {/* Notification Panel */}
      <NotificationPanel
        open={notificationOpen}
        onClose={() => setNotificationOpen(false)}
        onNotificationCountUpdate={decrementUnreadCount}
        wsNotifications={notifications}
        isConnected={isConnected}
        refetchUnreadCount={refetchUnreadCount}
      />

      {/* Settings/Profile Modal */}
      <ProfileFormModal
        isOpen={isAddMemberModalOpen}
        onClose={closeAddMemberModal}
        mode="edit-profile"
      />
    </div>
  );
};

export default Layout;
