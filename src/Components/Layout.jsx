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
  FiMoon,
  FiSun,
} from "react-icons/fi";
import { RiUser3Line } from "react-icons/ri";
import { RiGitMergeLine } from "react-icons/ri";
import { useUser } from "../Contexts/UserContext";
import { useTheme } from "../Contexts/ThemeContext";
import { MEDUSA_TOKEN_KEY, MEDUSA_CART_ID_KEY } from "../Retail/utils/constants";
import NotificationPanel from "./NotificationPanel";

const Layout = ({ noScroll = false }) => {
  const [activeTab, setActiveTab] = useState("profile");
  const location = useLocation();
  const navigate = useNavigate();

  // Update active tab based on current route
  useEffect(() => {
    const pathToTabId = {
      "/dashboard": "home",
      "/events": "upcomingEvent",
      "/upcoming-events": "upcomingEvent",
      "/family-tree": "familyTree",
      "/family-management": "familyManagement",
      "/my-family": "familyManagement",
      "/my-family-member": "familyManagement",
      "/pending-request": "familyManagement",
      "/suggestion-approving": "familyManagement",
      // "/posts-and-feeds": "postsStories",
      "/family-gallery": "gallery",
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

  const menuButtonRef = useRef(null);
  const sidebarRef = useRef(null);
  const familyMenuButtonRef = useRef(null);
  const familyMenuRef = useRef(null);
  const profileRef = useRef(null);

  const { userInfo, userLoading, logout } = useUser();
  const { theme, toggleTheme } = useTheme();
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
      route: "/family-management",
      icon: <FiUsers size={20} />,
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
    if (item.id === "familyManagement") {
      const familyPaths = [
        "/family-management",
        "/my-family",
        "/my-family-member",
        "/pending-request",
        "/suggestion-approving",
      ];
      return familyPaths.includes(location.pathname);
    }

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

  const handleEditProfile = () => {
    setProfileOpen(false);
    navigate("/profile/edit");
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
    <div
      className="h-screen bg-gray-50 text-gray-800 dark:bg-slate-950 dark:text-slate-100"
      style={{
        paddingTop:
          "var(--safe-area-inset-top, env(safe-area-inset-top, 0px))",
      }}
    >
      <main className="h-full flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-4 lg:px-6 sticky top-0 z-50 shadow-md dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between h-14 lg:h-16">
            {/* Left Section */}
            <div className="flex items-center gap-2">
              {false && isMobile && (
                <button
                  ref={menuButtonRef}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSidebarOpen((prev) => !prev);
                    setProfileOpen(false);
                    setNotificationOpen(false);
                    setFamilyMenuOpen(false);
                  }}
                  className="p-1.5 rounded-lg bg-primary-600 text-white shadow-sm hover:bg-primary-700"
                >
                  <FiMenu size={16} />
                </button>
              )}

              <div className={`flex items-center ${isMobile ? "gap-1.5" : "gap-2"}`}>
                <div className={isMobile ? "w-8 h-8" : "w-12 h-12"}>
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
                  className={isMobile ? "h-8 w-auto" : "h-16 w-auto"}
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
            <div className={`flex items-center ${isMobile ? "space-x-3" : "space-x-4"}`}>
              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setNotificationOpen(!notificationOpen);
                  }}
                  className={`bg-unset text-primary-600 relative rounded-3xl hover:bg-gray-100 dark:hover:bg-slate-800 ${isMobile ? "p-1" : "p-1.5"}`}
                >
                  <FiBell size={isMobile ? 18 : 20} />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                  {isConnected && (
                    <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-white dark:border-slate-900"></span>
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
                  className={`bg-unset flex items-center space-x-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 ${isMobile ? "p-0.5" : "p-1"}`}
                >
                  {userInfo?.profileUrl ? (
                    <img
                      src={userInfo.profileUrl}
                      alt="User Profile"
                      className={`${isMobile ? "w-7 h-7" : "w-8 h-8"} rounded-full object-cover`}
                    />
                  ) : (
                    <div className={`${isMobile ? "w-7 h-7" : "w-8 h-8"} rounded-full bg-gradient-to-r from-primary-500 to-primary-600 flex items-center justify-center text-white`}>
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
                    className="fixed md:absolute right-4 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-50 border border-gray-200 dark:bg-slate-800 dark:border-slate-700"
                    style={{ top: isMobile ? "3.5rem" : "4rem" }}
                  >
                    <div className="px-4 py-2  text-sm text-gray-800 border-b border-gray-100 dark:text-slate-100 dark:border-slate-700">
                      <p className="font-semibold">
                        {userInfo?.firstName} {userInfo?.lastName}
                      </p>
                      {userInfo?.familyCode && (
                        <p className="text-gray-500 text-xs dark:text-slate-300">
                          Family Code: {userInfo.familyCode}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => navigate("/myprofile")}
                      className="block w-full bg-white text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      My Profile
                    </button>
                    <button
                      onClick={handleEditProfile}
                      className="block w-full bg-white text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      Edit Profile
                    </button>
                    <button
                      onClick={() => {
                        toggleTheme();
                        setProfileOpen(false);
                      }}
                      className="block w-full bg-white text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 flex items-center justify-between"
                    >
                      <span>
                         {theme === "dark" ? "Light" : "Dark"} Mode
                      </span>
                      <span className="ml-2 text-primary-600 dark:text-primary-400">
                        {theme === "dark" ? <FiSun size={16} /> : <FiMoon size={16} />}
                      </span>
                    </button>
                    <div className="border-t border-gray-200 dark:border-slate-700"></div>
                    <button
                      onClick={handleLogout}
                      className="block w-full bg-white text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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
                className="fixed top-14 lg:top-16 bottom-0 left-0 z-50 bg-white shadow-2xl border-r border-gray-200 overflow-hidden"
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

        {/* Page Outlet (Content changes, layout persists)
            Note: extra bottom padding ensures content is not hidden
            behind the fixed mobile BottomNavBar. */}
        <div
          className={`flex-1 ${
            noScroll ? "overflow-hidden" : "overflow-y-auto"
           } pt-0 px-1 pb-20 md:px-2 md:pb-16 lg:pb-6 bg-gray-50`}
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

    </div>
  );
};

export default Layout;
