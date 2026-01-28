// BottomNavBar.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiHome,
  FiCalendar,
  FiShare2,
  FiGift,
  FiUser,
  } from "react-icons/fi";

import { RiGitMergeLine } from "react-icons/ri";
const BottomNavBar = ({ activeTab, setActiveTab }) => {
  const navigate = useNavigate();

  const tabs = [
    {
      id: "home",
      label: "Home",
      icon: <FiHome size={20} />,
      path: "/dashboard",
    },
    {
      id: "upcomingEvent",
      label: "Events",
      icon: <FiCalendar size={20} />,
      path: "/events",
    },
    // { id: 'postsStories', label: 'Posts', icon: <FiShare2 size={20} />, path: '/posts-and-feeds' },
    {
      id: "familyTree",
      label: "Family",
      path: "/family-tree",
      icon: <RiGitMergeLine size={20} />,
    },
    {
      id: "gifts",
      label: "Gifts",
      icon: <FiGift size={20} />,
      path: "/gifts-memories",
    },
    {
      id: "profile",
      label: "Profile",
      icon: <FiUser size={20} />,
      path: "/myprofile",
    },
  ];

  const handleItemClick = (item) => {
    setActiveTab(item.id);
    if (item.path) {
      navigate(item.path);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-primary z-[9999] w-full max-w-full shadow-lg">
      <div className="flex justify-between items-center px-2 py-1">
        {tabs.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <div
              key={item.id}
              onClick={() => handleItemClick(item)}
              className="flex flex-col items-center justify-center flex-1 py-1 cursor-pointer"
            >
              <div className={`p-1 ${isActive ? 'text-white' : 'text-white/80'}`}>
                {item.icon}
              </div>
              <span className={`text-xs mt-0.5 ${isActive ? 'text-white font-semibold' : 'text-white/80'}`}>
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
