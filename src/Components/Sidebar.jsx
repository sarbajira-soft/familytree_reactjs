import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  FiHome,
  FiUser,
  FiShare2,
  FiImage,
  FiGift,
  FiUsers,
  FiClock,
  FiChevronDown,
  FiCalendar,
  FiPackage,
  FiLink,
} from "react-icons/fi";
import { RiGitMergeLine } from "react-icons/ri";
import { FaTimes } from "react-icons/fa";
import { useUser } from "../Contexts/UserContext";

const Sidebar = ({
  isMobile,
  onCloseMobile,
  setActiveTab,
  activeTab,
  collapsed,
  variant,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedParents, setExpandedParents] = useState({});
  const { userInfo } = useUser();

  // Check if user is admin
  const isAdmin = userInfo && userInfo.role === 3;

  // Check if user is approved
  const isApproved = userInfo && userInfo.approveStatus === "approved";

  const menuItems = [
    {
      id: "home",
      label: "Home",
      route: "/dashboard",
      icon: <FiHome size={19} />,
      // requiresApproval: true,
    },
    {
      id: "events",
      label: "Events",
      route: "/events",
      icon: <FiCalendar size={19} />,
      // requiresApproval: true,
    },
    {
      id: "familyTree",
      label: "Family Tree",
      route: "/family-tree",
      icon: <RiGitMergeLine size={19} />,
    },
    {
      id: "familyManagement",
      label: "Family Management",
      icon: <FiUsers size={19} />,
      children: [
        {
          id: "myFamily",
          label: "My Family",
          route: "/my-family",
          icon: <FiUsers size={17} />,
        },
        {
          id: "myFamilyMembers",
          label: "All Members",
          route: "/my-family-member",
          icon: <FiUsers size={17} />,
        },
        {
          id: "pendingRequests",
          label: "Invite Links",
          route: "/pending-request",
          icon: <FiLink size={17} />,
          requiresApproval: true,
        },
        // Only show Suggestion Approving for admins
        ...(userInfo?.role === 2 || userInfo?.role === 3
          ? [
              {
                id: "suggestionApproving",
                label: "Suggestion Approving",
                route: "/suggestion-approving",
                icon: <FiClock size={17} />,
              },
            ]
          : []),
      ],
    },
    // {
    //   id: "posts",
    //   label: "Posts & Stories",
    //   route: "/posts-and-feeds",
    //   icon: <FiShare2 size={19} />,
    // },
    {
      id: "gallery",
      label: "Gallery Hub",
      route: "/family-gallery",
      icon: <FiImage size={19} />,
    },
    {
      id: "gifts",
      label: "Gifts & Memories",
      route: "/gifts-memories",
      icon: <FiGift size={19} />,
    },
    {
      id: "orders",
      label: "Order Management",
      route: "/orders",
      icon: <FiPackage size={19} />,
    },
  ];

  const filteredMenuItems = menuItems
    .filter((item) => {
      // Filter out orders if not admin
      if (item.id === "orders" && !isAdmin) return false;

      // Filter out items that require approval if user is not approved
      if (item.requiresApproval && !isApproved) return false;

      // For items with children, filter children that require approval
      if (item.children) {
        const filteredChildren = item.children.filter((child) => {
          if (child.requiresApproval && !isApproved) return false;
          return true;
        });

        // Only show parent if it has visible children
        return filteredChildren.length > 0;
      }

      return true;
    })
    .map((item) => {
      // For items with children, filter the children array
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

  useEffect(() => {
    const newExpandedParents = {};
    filteredMenuItems.forEach((item) => {
      if (item.children) {
        // Expand parent if any child route starts with the current path
        newExpandedParents[item.id] = item.children.some((child) =>
          location.pathname.startsWith(child.route)
        );
      }
    });
    setExpandedParents(newExpandedParents);
  }, [location.pathname]);

  const isLinkActive = (item) => {
    if (item.route) {
      return location.pathname === item.route; //  Use exact match
    }
    if (item.children) {
      return item.children.some((child) => location.pathname === child.route); //  Exact match for children
    }
    return false;
  };

  const isChildActive = (child) => {
    return location.pathname === child.route; //  Use exact match for child items
  };

  const handleItemClick = (item) => {
    if (item.id === "logout") {
      // handleLogout logic should be in Layout or passed as a prop
      // For now, it will just log
      console.log("Logout clicked from sidebar");
      if (isMobile && onCloseMobile) onCloseMobile(); // Close sidebar on logout click
      return;
    }

    if (item.children) {
      setExpandedParents((prev) => ({
        ...prev,
        [item.id]: !prev[item.id],
      }));
      return;
    }

    if (item.route) {
      // Sync with bottom nav tab if applicable
      if (setActiveTab) {
        // Map sidebar menu ids to bottom nav tab ids
        const routeToTabId = {
          "/myprofile": "profile",
          "/upcoming-events": "upcomingEvent",
          "/events": "upcomingEvent",
          "/posts-and-feeds": "postsStories",
          "/pending-approvals": "pendingApprovals",
          "/gifts": "gifts",
          "/gifts-memories": "gifts",
        };
        const tabId = routeToTabId[item.route];
        if (tabId) setActiveTab(tabId);
      }
      navigate(item.route);
    }

    if (isMobile && onCloseMobile) onCloseMobile();
  };

  return (
    <div
      className={`flex flex-col bg-white border-gray-100 shadow-xl sidebar-content transition-all duration-200 ${
        variant === "dropdown"
          ? "w-full"
          : collapsed
            ? "w-20"
            : "w-74"
      } ${variant === "dropdown" ? "max-h-[70vh]" : "h-full"}`}
    >
      {/* Removed Logo and Heading */}
      <div
        className={`${
          isMobile || variant === "dropdown" ? "pt-0" : "pt-6"
        } flex-1 overflow-y-auto py-5 px-4 custom-scrollbar scroll-smooth`}
      >
        <nav className="space-y-1.5">
          {filteredMenuItems.map((item) => (
            <div key={item.id}>
              {item.children ? (
                <div>
                  <button
                    className={`bg-unset flex items-center w-full px-4 py-3 rounded-lg text-left transition-all duration-200 focus:outline-none focus:ring-2
                      ${
                        isLinkActive(item)
                          ? "text-primary-700 bg-primary-50 font-semibold"
                          : "text-gray-700 hover:text-primary-600 hover:bg-gray-50"
                      }`}
                    onClick={() => handleItemClick(item)}
                  >
                    <span
                      className={`mr-4 text-xl ${
                        isLinkActive(item)
                          ? "text-primary-500"
                          : "text-gray-500"
                      }`}
                    >
                      {item.icon}
                    </span>
                    {!collapsed && (
                      <span className="flex-1 text-base">{item.label}</span>
                    )}
                    {!collapsed && (
                      <span
                        className={`transform transition-transform duration-200 text-gray-500 ${
                          expandedParents[item.id] ? "rotate-180" : ""
                        }`}
                      >
                        <FiChevronDown size={16} />
                      </span>
                    )}
                  </button>
                  {expandedParents[item.id] && !collapsed && (
                    <div className="ml-12 mt-1 space-y-1 border-l border-gray-200 pl-2">
                      {item.children.map((child) => (
                        <button
                          key={child.id}
                          className={`bg-unset flex items-center w-full px-4 py-2.5 rounded-lg text-left text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-200
                            ${
                              isChildActive(child)
                                ? "text-primary-600 bg-primary-50 font-medium"
                                : "text-gray-600 hover:text-primary-500 hover:bg-gray-100"
                            }`}
                          onClick={() => handleItemClick(child)}
                        >
                          <span
                            className={`mr-3 ${
                              isChildActive(child)
                                ? "text-primary-400"
                                : "text-gray-400"
                            }`}
                          >
                            {child.icon}
                          </span>
                          {!collapsed && child.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  className={`bg-unset flex items-center w-full px-4 py-3 rounded-lg text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-300
                    ${
                      isLinkActive(item)
                        ? "text-primary-700 bg-primary-50 font-semibold"
                        : "text-gray-700 hover:text-primary-600 hover:bg-gray-50"
                    }`}
                  onClick={() => handleItemClick(item)}
                >
                  <span
                    className={`mr-4 text-xl ${
                      isLinkActive(item) ? "text-primary-500" : "text-gray-500"
                    }`}
                  >
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <span className="text-base">{item.label}</span>
                  )}
                </button>
              )}
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default Sidebar;
