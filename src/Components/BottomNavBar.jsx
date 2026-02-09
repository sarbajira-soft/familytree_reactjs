// BottomNavBar.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiHome,
  FiCalendar,
  FiGift,
  FiImage,
  FiUsers,
} from "react-icons/fi";

import { RiGitMergeLine } from "react-icons/ri";
const BottomNavBar = ({ activeTab, setActiveTab }) => {
  const navigate = useNavigate();

  const tabs = [
    {
      id: "home",
      label: "Home",
      icon: <FiHome size={18} />,
      path: "/dashboard",
    },
    {
      id: "upcomingEvent",
      label: "Events",
      icon: <FiCalendar size={18} />,
      path: "/events",
    },
    // { id: 'postsStories', label: 'Posts', icon: <FiShare2 size={20} />, path: '/posts-and-feeds' },
    {
      id: "familyTree",
      label: "Tree",
      path: "/family-tree",
      icon: <RiGitMergeLine size={18} />,
    },
    {
      id: "familyManagement",
      label: "Family",
      icon: <FiUsers size={18} />,
      path: "/family-management",
    },
    {
      id: "gallery",
      label: "Gallery",
      icon: <FiImage size={18} />,
      path: "/family-gallery",
    },
    {
      id: "gifts",
      label: "Gifts",
      icon: <FiGift size={18} />,
      path: "/gifts-memories",
    },
  ];

  const handleItemClick = (item) => {
    setActiveTab(item.id);
    if (item.path) {
      navigate(item.path);
    }
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-primary z-[9999] w-full max-w-full shadow-lg"
      style={{
        paddingBottom:
          "var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="flex justify-between items-center px-2 py-0">
        {tabs.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <div
              key={item.id}
              onClick={() => handleItemClick(item)}
              className="flex flex-col items-center justify-center flex-1 py-0 cursor-pointer"
            >
              <div className={`p-0 ${isActive ? 'text-white' : 'text-white/80'}`}>
                {item.icon}
              </div>
              <span className={`text-xs mt-0 ${isActive ? 'text-white font-semibold' : 'text-white/80'}`}>
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNavBar;
