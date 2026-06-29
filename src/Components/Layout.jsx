import React, { Suspense, useCallback, useMemo, useRef, useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { App as CapacitorApp } from "@capacitor/app";
import Sidebar from "./Sidebar";
import BottomNavBar from "./BottomNavBar";
import { ChatProvider, useChat } from "../Contexts/ChatContext";
import { useNotificationSocket } from "../hooks/useNotificationSocket";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiBell,
  FiBookOpen,
  FiCalendar,
  FiChevronDown,
  FiChevronRight,
  FiEdit2,
  FiFileText,
  FiHelpCircle,
  FiCpu,
  FiHome,
  FiImage,
  FiLink,
  FiLogOut,
  FiMail,
  FiMenu,
  FiMessageCircle,
  FiMoon,
  FiShield,
  FiSun,
  FiUsers,
} from "react-icons/fi";
import { RiUser3Line } from "react-icons/ri";
import { RiGitMergeLine } from "react-icons/ri";
import { Sparkles } from "lucide-react";
import { useUser } from "../Contexts/UserContext";
import { useTheme } from "../Contexts/ThemeContext";
import NotificationPanel from "./NotificationPanel";
import SupportHelpModal from "./SupportHelpModal";

const PullToRefresh = ({ children, onRefresh, disabled }) => {
  const containerRef = useRef(null);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const refreshingRef = useRef(false);

  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const maxPull = 110;
  const threshold = 70;

  const canStartPull = () => {
    const el = containerRef.current;
    if (!el) return false;
    return el.scrollTop <= 0;
  };

  const handleTouchStart = (e) => {
    if (disabled || isRefreshing) return;
    if (!e.touches || e.touches.length !== 1) return;
    startYRef.current = e.touches[0].clientY;
    pullingRef.current = false;
    setPullDistance(0);
  };

  const handleTouchMove = (e) => {
    if (disabled || isRefreshing) return;
    if (!e.touches || e.touches.length !== 1) return;

    const currentY = e.touches[0].clientY;
    const dy = currentY - startYRef.current;

    if (dy <= 0) {
      if (pullingRef.current) {
        pullingRef.current = false;
        setPullDistance(0);
      }
      return;
    }

    if (!pullingRef.current) {
      if (!canStartPull()) return;
      pullingRef.current = true;
    }

    e.preventDefault();
    const eased = Math.min(maxPull, dy * 0.55);
    setPullDistance(eased);
  };

  const handleTouchEnd = async () => {
    if (disabled || isRefreshing) {
      setPullDistance(0);
      pullingRef.current = false;
      return;
    }

    const shouldRefresh = pullingRef.current && pullDistance >= threshold;
    pullingRef.current = false;

    if (!shouldRefresh || typeof onRefresh !== "function") {
      setPullDistance(0);
      return;
    }

    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setIsRefreshing(true);
    setPullDistance(threshold);

    try {
      await onRefresh();
    } finally {
      refreshingRef.current = false;
      setIsRefreshing(false);
      setPullDistance(0);
    }
  };

  const indicatorText = isRefreshing
    ? "Refreshing..."
    : pullDistance >= threshold
      ? "Release to refresh"
      : "Pull to refresh";


  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-y-auto"
      style={{ WebkitOverflowScrolling: "touch" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-end justify-center" style={{ height: pullDistance }}>
        <div className="pb-2 text-[11px] font-medium text-gray-500 dark:text-slate-300">
          {indicatorText}
        </div>
      </div>
      {children}
    </div>
  );
};

const LayoutContent = ({ noScroll = false }) => {
  const [activeTab, setActiveTab] = useState("profile");
  const location = useLocation();
  const navigate = useNavigate();

  const DEFAULT_AVATAR = "/assets/user.png";

  useEffect(() => {
    if (!window.__appModalBackStack) {
      window.__appModalBackStack = [];
    }
  }, []);

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
      "/family-gallery": "gallery",
      "/chat": "chat",
      "/ai-assistant": "aiAssistant",
    };
    const tabId =
      pathToTabId[location.pathname] ||
      (location.pathname.startsWith("/chat/") ? "chat" : null);
    if (tabId) setActiveTab(tabId);
  }, [location.pathname]);

  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [familyMenuOpen, setFamilyMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileMenuView, setProfileMenuView] = useState("root");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [supportHelpOpen, setSupportHelpOpen] = useState(false);
  const [supportHelpMode, setSupportHelpMode] = useState("report");
  const menuButtonRef = useRef(null);
  const sidebarRef = useRef(null);
  const familyMenuButtonRef = useRef(null);
  const familyMenuRef = useRef(null);
  const profileRef = useRef(null);
  const notificationRef = useRef(null);

  const overlayStateRef = useRef({
    sidebarOpen: false,
    notificationOpen: false,
    profileOpen: false,
    profileMenuView: "root",
    familyMenuOpen: false,
    supportHelpOpen: false,
    aiChatOpen: false,
  });

  useEffect(() => {
    overlayStateRef.current = {
      sidebarOpen,
      notificationOpen,
      profileOpen,
      profileMenuView,
      familyMenuOpen,
      supportHelpOpen,
      aiChatOpen,
    };
  }, [
    sidebarOpen,
    notificationOpen,
    profileOpen,
    profileMenuView,
    familyMenuOpen,
    supportHelpOpen,
    aiChatOpen,
  ]);

  const closeProfileMenu = useCallback(() => {
    setProfileOpen(false);
    setProfileMenuView("root");
  }, []);

  const handleToggleAiChat = useCallback(() => {
    setAiChatOpen((prev) => {
      const next = !prev;
      if (next) {
        setNotificationOpen(false);
        setProfileOpen(false);
        setFamilyMenuOpen(false);
      }
      return next;
    });
  }, []);

  const handleGlobalBack = useCallback(() => {
    try {
      const stack = window.__appModalBackStack;
      if (Array.isArray(stack) && stack.length > 0) {
        const handler = stack[stack.length - 1];
        if (typeof handler === 'function') {
          handler();
          return true;
        }
      }
    } catch {}

    try {
      const reactModalOverlay = document.querySelector(
        '.ReactModal__Overlay.ReactModal__Overlay--after-open'
      );
      if (reactModalOverlay) {
        const escEvent = new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          keyCode: 27,
          which: 27,
          bubbles: true,
        });
        document.dispatchEvent(escEvent);

        if (typeof reactModalOverlay.click === 'function') {
          reactModalOverlay.click();
        }
        return true;
      }
    } catch {}

    const current = overlayStateRef.current;
    if (current.aiChatOpen) {
      setAiChatOpen(false);
      return true;
    }
    if (current.notificationOpen) {
      setNotificationOpen(false);
      return true;
    }
    if (current.supportHelpOpen) {
      setSupportHelpOpen(false);
      setSupportHelpMode("report");
      return true;
    }
    if (current.profileOpen && current.profileMenuView !== "root") {
      setProfileMenuView("root");
      return true;
    }
    if (current.profileOpen) {
      setProfileOpen(false);
      setProfileMenuView("root");
      return true;
    }
    if (current.familyMenuOpen) {
      setFamilyMenuOpen(false);
      return true;
    }
    if (current.sidebarOpen) {
      setSidebarOpen(false);
      return true;
    }

    if (location.pathname !== '/dashboard') {
      navigate('/dashboard');
      return true;
    }

    try {
      if (CapacitorApp?.exitApp) {
        CapacitorApp.exitApp();
        return true;
      }
    } catch {}

    return false;
  }, [location.pathname, navigate]);

  useEffect(() => {
    let removeCapacitorListener = null;
    try {
      const maybePromise = CapacitorApp.addListener("backButton", () => {
        handleGlobalBack();
      });
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then((handle) => {
          removeCapacitorListener = () => handle && handle.remove && handle.remove();
        });
      } else {
        removeCapacitorListener = () => maybePromise && maybePromise.remove && maybePromise.remove();
      }
    } catch {
      // ignore
    }

    const onCordovaBack = (e) => {
      const handled = handleGlobalBack();
      if (handled && e && typeof e.preventDefault === "function") {
        e.preventDefault();
      }
    };
    document.addEventListener("backbutton", onCordovaBack, false);

    return () => {
      document.removeEventListener("backbutton", onCordovaBack, false);
      if (removeCapacitorListener) removeCapacitorListener();
    };
  }, [handleGlobalBack]);

  const { userInfo, userLoading, logout } = useUser();
  const { theme, toggleTheme } = useTheme();
  const { unreadChatCount } = useChat();
  const profileDisplayName = [userInfo?.firstName, userInfo?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim() || userInfo?.name || userInfo?.email || (userInfo?.mobile ? `${userInfo?.countryCode || ''} ${userInfo.mobile}`.trim() : 'My Account');
  const profileSecondaryInfo = userInfo?.familyCode || userInfo?.email || (userInfo?.mobile ? `${userInfo?.countryCode || ''} ${userInfo.mobile}`.trim() : '');
  const supportEmail = String(import.meta.env.VITE_SUPPORT_EMAIL || "support@familyss.com").trim();
  const supportContactHref = useMemo(() => {
    return `mailto:${supportEmail}?subject=${encodeURIComponent("Support Request - Familyss")}`;
  }, [supportEmail]);
  const {
    isConnected,
    unreadCount,
    refetchUnreadCount,
    notifications,
  } =
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
        closeProfileMenu();
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [closeProfileMenu]);

  const isApproved = userInfo && userInfo.approveStatus === "approved";

  const isRestrictedUser = useMemo(() => {
    if (!userInfo) return false;
    return !userInfo.familyCode || userInfo.approveStatus !== "approved";
  }, [userInfo]);

  const hasChatAccess = useMemo(() => {
    const status = String(userInfo?.approveStatus || "").toLowerCase();
    return Boolean(userInfo?.familyCode) && ["approved", "associated"].includes(status);
  }, [userInfo]);

  const shouldLockScroll = useMemo(
    () => noScroll,
    [noScroll]
  );

  const isChatRoute =
    location.pathname === "/chat" || location.pathname.startsWith("/chat/");

  const isTreeRoute =
    location.pathname.startsWith("/family-tree") ||
    location.pathname.startsWith("/associated-family-tree") ||
    location.pathname.startsWith("/associated-family-tree-user") ||
    location.pathname.startsWith("/linked-family-trees") ||
    location.pathname.startsWith("/family-tree-hierarchical");

  const pullDisabled = useMemo(() => {
    if (shouldLockScroll) return true;
    if (isChatRoute) return true;
    if (isRestrictedUser) return true;
    return sidebarOpen || notificationOpen || supportHelpOpen;
  }, [shouldLockScroll, isChatRoute, isRestrictedUser, sidebarOpen, notificationOpen, supportHelpOpen]);

  const handlePullRefresh = useCallback(async () => {
    window.location.reload();
  }, []);

  const outletFallback = (
    <div className="flex items-center justify-center py-10">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mb-3"></div>
        <p className="text-gray-600 text-sm">Loading...</p>
      </div>
    </div>
  );

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
  ]
    .filter((item) => {
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
    closeProfileMenu();
    setAiChatOpen(false);
    navigate(route);
  };

  const handleLogout = () => {
    closeProfileMenu();
    setSupportHelpOpen(false);
    setSupportHelpMode("report");
    setAiChatOpen(false);
    logout();
    localStorage.removeItem("userInfo");
    navigate("/login");
  };

  const handleViewProfile = () => {
    closeProfileMenu();
    navigate("/myprofile");
  };

  const handleEditProfile = () => {
    closeProfileMenu();
    navigate("/profile/edit");
  };

  const handleOpenSettingsPanel = () => {
    setProfileMenuView("settings");
  };

  const handleOpenSupportPanel = () => {
    closeProfileMenu();
    setSupportHelpMode("report");
    setSupportHelpOpen(true);
  };



  const handleToggleTheme = () => {
    toggleTheme();
    closeProfileMenu();
  };

  const handleContactSupport = () => {
    closeProfileMenu();
    setSupportHelpMode("contact");
    setSupportHelpOpen(true);
  };

  const handleOpenSupportReport = () => {
    closeProfileMenu();
    setSupportHelpMode("report");
    setSupportHelpOpen(true);
  };

  const decrementUnreadCount = () => {
    refetchUnreadCount();
  };

  if (userLoading && !userInfo) {
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
      className="min-h-screen bg-gray-50 text-gray-800 dark:bg-slate-950 dark:text-slate-100"
      style={{
        paddingTop:
          "var(--safe-area-inset-top, env(safe-area-inset-top, 0px))",
        height: "100dvh",
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
              {hasChatAccess && (
                <div className="relative">
                  <button
                    onClick={() => navigateTo("/chat")}
                    aria-label="Open chat"
                    className={`bg-unset relative rounded-3xl transition-colors ${
                      isChatRoute
                        ? "bg-primary-50 text-primary-700 dark:bg-slate-800 dark:text-slate-100"
                        : "text-primary-600 hover:bg-gray-100 dark:hover:bg-slate-800"
                    } ${isMobile ? "p-1" : "p-1.5"}`}
                  >
                    <FiMessageCircle size={isMobile ? 18 : 20} />
                    {unreadChatCount > 0 && (
                      <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
                        {unreadChatCount > 99 ? "99+" : unreadChatCount}
                      </span>
                    )}
                  </button>
                </div>
              )}



              {/* Guide Button (Web View Only) */}
              {!isMobile && (
                <button
                  onClick={() => navigateTo("/tutorials")}
                  aria-label="Open Tutorials Guide"
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full transition-all duration-200 border ${
                    location.pathname.startsWith("/tutorials")
                      ? "bg-primary-50 border-primary-300 text-primary-700 dark:bg-slate-800 dark:border-primary-900 dark:text-slate-200 shadow-sm"
                      : "bg-white border-gray-200 text-slate-600 hover:bg-gray-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800 hover:border-primary-300 dark:hover:border-primary-900/50 shadow-sm"
                  }`}
                >
                  <FiBookOpen
                    size={15}
                    className={
                      location.pathname.startsWith("/tutorials")
                        ? "text-primary-700 dark:text-primary-400"
                        : "text-primary-600 dark:text-primary-400"
                    }
                  />
                  <span className="text-xs font-bold tracking-wide">Guide</span>
                </button>
              )}

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setNotificationOpen(!notificationOpen);
                    setAiChatOpen(false);
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
                    const nextProfileOpen = !profileOpen;
                    setProfileOpen(nextProfileOpen);
                    setProfileMenuView("root");
                    if (nextProfileOpen) {
                      setFamilyMenuOpen(false);
                      setNotificationOpen(false);
                      setAiChatOpen(false);
                    }
                  }}
                  className={`bg-unset flex items-center space-x-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 ${isMobile ? "p-0.5" : "p-1"}`}
                >
                  {userInfo?.profileUrl ? (
                    <img
                      src={userInfo.profileUrl}
                      alt="User Profile"
                      className={`${isMobile ? "w-7 h-7" : "w-8 h-8"} rounded-full object-cover`}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = DEFAULT_AVATAR;
                      }}
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
                    className="fixed md:absolute right-4 md:right-0 mt-2 w-[17rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl z-50 dark:bg-slate-800 dark:border-slate-700"
                    style={{ top: isMobile ? "3.5rem" : "4rem" }}
                  >
                    <div className="border-b border-gray-100 px-4 py-3 dark:border-slate-700">
                      {profileMenuView === "root" ? (
                        <div className="min-w-0 text-sm text-gray-800 dark:text-slate-100">
                          <p className="font-semibold truncate overflow-hidden text-ellipsis whitespace-nowrap" title={profileDisplayName}>{profileDisplayName}</p>
                          {profileSecondaryInfo && (
                            <p className="text-xs text-gray-500 dark:text-slate-300 truncate overflow-hidden text-ellipsis whitespace-nowrap" title={userInfo?.familyCode ? `Family Code: ${profileSecondaryInfo}` : profileSecondaryInfo}>
                              {userInfo?.familyCode ? `Family Code: ${profileSecondaryInfo}` : profileSecondaryInfo}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => setProfileMenuView("root")}
                            className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                            aria-label="Back to profile menu"
                          >
                            <FiArrowLeft size={16} />
                          </button>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                              {profileMenuView === "settings" ? "Settings & Privacy" : "Help & Support"}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-slate-400">
                              {profileMenuView === "settings"
                                ? "Manage privacy, appearance, and policies."
                                : "Contact support or send a guided issue report."}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-1">
                      {profileMenuView === "root" ? (
                        <>
                          <button
                            onClick={handleViewProfile}
                            className="bg-unset flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left transition hover:bg-gray-100 dark:hover:bg-slate-700"
                          >
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-200">
                              <RiUser3Line size={16} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-medium leading-5 text-gray-800 dark:text-slate-100">My Profile</span>
                            </span>
                          </button>

                          <button
                            onClick={handleEditProfile}
                            className="bg-unset flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left transition hover:bg-gray-100 dark:hover:bg-slate-700"
                          >
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-200">
                              <FiEdit2 size={15} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-medium leading-5 text-gray-800 dark:text-slate-100">Edit Profile</span>
                            </span>
                          </button>

                          <button
                            onClick={handleOpenSettingsPanel}
                            className="bg-unset flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left transition hover:bg-gray-100 dark:hover:bg-slate-700"
                          >
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-200">
                              <FiShield size={15} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-medium leading-5 text-gray-800 dark:text-slate-100">Settings & Privacy</span>
                            </span>
                            <FiChevronRight size={14} className="text-gray-400 dark:text-slate-500" />
                          </button>

                          <button
                            onClick={handleOpenSupportPanel}
                            className="bg-unset flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left transition hover:bg-gray-100 dark:hover:bg-slate-700"
                          >
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-200">
                              <FiHelpCircle size={15} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-medium leading-5 text-gray-800 dark:text-slate-100">Help & Support</span>
                            </span>
                            <FiChevronRight size={14} className="text-gray-400 dark:text-slate-500" />
                          </button>

                          <button
                            onClick={() => navigateTo("/tutorials")}
                            className="bg-unset flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left transition hover:bg-gray-100 dark:hover:bg-slate-700"
                          >
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-200">
                              <FiBookOpen size={15} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-medium leading-5 text-gray-800 dark:text-slate-100">Tutorials</span>
                            </span>
                          </button>

                          <div className="my-1 border-t border-gray-200 dark:border-slate-700"></div>

                          <button
                            onClick={handleLogout}
                            className="bg-unset flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left transition hover:bg-red-50 dark:hover:bg-red-500/10"
                          >
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
                              <FiLogOut size={15} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-medium leading-5 text-gray-800 dark:text-slate-100">Sign Out</span>
                            </span>
                          </button>
                        </>
                      ) : profileMenuView === "settings" ? (
                        <>
                          <button
                            onClick={() => navigateTo("/blocked-members")}
                            className="bg-unset flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left transition hover:bg-gray-100 dark:hover:bg-slate-700"
                          >
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-200">
                              <FiShield size={15} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-medium leading-5 text-gray-800 dark:text-slate-100">Blocked Members</span>
                            </span>
                          </button>

                          <button
                            onClick={() => {
                              closeProfileMenu();
                              window.open("/terms-and-privacy", "_blank", "noopener,noreferrer");
                            }}
                            className="bg-unset flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left transition hover:bg-gray-100 dark:hover:bg-slate-700"
                          >
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-200">
                              <FiFileText size={15} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-medium leading-5 text-gray-800 dark:text-slate-100">Terms & Privacy</span>
                            </span>
                          </button>

                          <button
                            onClick={handleToggleTheme}
                            className="bg-unset flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left transition hover:bg-gray-100 dark:hover:bg-slate-700"
                          >
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-200">
                              {theme === "dark" ? <FiSun size={15} /> : <FiMoon size={15} />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-medium leading-5 text-gray-800 dark:text-slate-100">
                                {theme === "dark" ? "Light Mode" : "Dark Mode"}
                              </span>
                            </span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={handleContactSupport}
                            className="bg-unset flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left transition hover:bg-gray-100 dark:hover:bg-slate-700"
                          >
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-200">
                              <FiMail size={15} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-medium leading-5 text-gray-800 dark:text-slate-100">Contact Support</span>
                            </span>
                          </button>

                          <button
                            onClick={handleOpenSupportReport}
                            className="bg-unset flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left transition hover:bg-red-50 dark:hover:bg-red-500/10"
                          >
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
                              <FiAlertCircle size={15} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-medium leading-5 text-gray-800 dark:text-slate-100">Report a Problem</span>
                            </span>
                          </button></>
                      )}
                    </div>
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
          className={`flex-1 min-h-0 bg-gray-50 ${
            shouldLockScroll
              ? "overflow-hidden"
              : isChatRoute
                ? "overflow-hidden pt-0 px-0 pb-0"
              : isTreeRoute
                ? "overflow-hidden pt-0 px-0 pb-0"
                : "overflow-y-auto pt-0 px-1 pb-11 md:px-2 md:pb-12 lg:pb-4"
          }`}
        >
          {shouldLockScroll ? (
            <Suspense fallback={outletFallback}>
              <Outlet />
            </Suspense>
          ) : isChatRoute || isTreeRoute ? (
            <Suspense fallback={outletFallback}>
              <Outlet />
            </Suspense>
          ) : (
            <PullToRefresh onRefresh={handlePullRefresh} disabled={pullDisabled}>
              <div className="pt-0 px-1 md:px-2">
                <Suspense fallback={outletFallback}>
                  <Outlet />
                </Suspense>
              </div>
            </PullToRefresh>
          )}
        </div>

        {/* Bottom Navbar for Mobile */}
        {isMobile && (
          <BottomNavBar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onNavigate={() => {
              setNotificationOpen(false);
            }}
            chatBadge={unreadChatCount}
            hasChatAccess={hasChatAccess}
          />
        )}
      </main>

      <SupportHelpModal
        isOpen={supportHelpOpen}
        onClose={() => {
          setSupportHelpOpen(false);
          setSupportHelpMode("report");
        }}
        supportEmail={supportEmail}
        userInfo={userInfo}
        currentPath={location.pathname}
        mode={supportHelpMode}
      />



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

const Layout = (props) => (
  <ChatProvider>
    <LayoutContent {...props} />
  </ChatProvider>
);

export default Layout;





