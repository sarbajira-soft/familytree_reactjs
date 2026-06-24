import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { FiUsers, FiPlus, FiLink, FiCalendar, FiGitBranch, FiImage, FiPlayCircle } from 'react-icons/fi';
import { useLanguage } from '../Contexts/LanguageContext';
import { fetchCreateFamilyTutorial } from '../services/tutorial.service';
import { toast } from 'react-toastify';

const renderEventsIllustration = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-28 h-28">
    <defs>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.1" />
      </filter>
    </defs>
    
    {/* Calendar shadow & background */}
    <g filter="url(#shadow)">
      {/* Calendar Base */}
      <rect x="30" y="24" width="60" height="56" rx="8" className="fill-white dark:fill-slate-900" />
      {/* Blue Header */}
      <path d="M30 32C30 28.6863 32.6863 26 36 26H84C87.3137 26 90 28.6863 90 32V38H30V32Z" fill="#1976D2" />
      
      {/* Calendar spirals */}
      <rect x="42" y="18" width="5" height="12" rx="2.5" fill="#93C5FD" stroke="#1565C0" strokeWidth="1.5" />
      <rect x="73" y="18" width="5" height="12" rx="2.5" fill="#93C5FD" stroke="#1565C0" strokeWidth="1.5" />
      
      {/* Calendar grid */}
      {/* Row 1 */}
      <rect x="36" y="44" width="6" height="6" rx="1" className="fill-[#E2E8F0] dark:fill-slate-800" />
      <rect x="45" y="44" width="6" height="6" rx="1" className="fill-[#E2E8F0] dark:fill-slate-800" />
      <rect x="54" y="44" width="6" height="6" rx="1" className="fill-[#E2E8F0] dark:fill-slate-800" />
      <rect x="63" y="44" width="6" height="6" rx="1" className="fill-[#E2E8F0] dark:fill-slate-800" />
      <rect x="72" y="44" width="6" height="6" rx="1" className="fill-[#E2E8F0] dark:fill-slate-800" />
      <rect x="81" y="44" width="6" height="6" rx="1" className="fill-[#E2E8F0] dark:fill-slate-800" />
      
      {/* Row 2 */}
      <rect x="36" y="54" width="6" height="6" rx="1" className="fill-[#E2E8F0] dark:fill-slate-800" />
      <rect x="45" y="54" width="6" height="6" rx="1" className="fill-[#E2E8F0] dark:fill-slate-800" />
      <rect x="54" y="54" width="6" height="6" rx="1" className="fill-[#E2E8F0] dark:fill-slate-800" />
      <rect x="63" y="54" width="6" height="6" rx="1" className="fill-[#E2E8F0] dark:fill-slate-800" />
      <rect x="72" y="54" width="6" height="6" rx="1" className="fill-[#E2E8F0] dark:fill-slate-800" />
      <rect x="81" y="54" width="6" height="6" rx="1" className="fill-[#E2E8F0] dark:fill-slate-800" />
      
      {/* Row 3 with Heart */}
      <rect x="36" y="64" width="6" height="6" rx="1" className="fill-[#E2E8F0] dark:fill-slate-800" />
      <rect x="45" y="64" width="6" height="6" rx="1" className="fill-[#E2E8F0] dark:fill-slate-800" />
      <rect x="54" y="64" width="6" height="6" rx="1" className="fill-[#E2E8F0] dark:fill-slate-800" />
      <rect x="63" y="64" width="6" height="6" rx="1" className="fill-[#E2E8F0] dark:fill-slate-800" />
      {/* Heart */}
      <path d="M75 64.5 C74.8 63.8 73.8 63.8 73.2 64.4 C72.6 65 72.6 66 73.6 67 L75 68.4 L76.4 67 C77.4 66 77.4 65 76.8 64.4 C76.2 63.8 75.2 63.8 75 64.5 Z" fill="#EF4444" />
      <rect x="81" y="64" width="6" height="6" rx="1" className="fill-[#E2E8F0] dark:fill-slate-800" />
    </g>

    {/* Cake on bottom-left */}
    <g transform="translate(18, 56)" filter="url(#shadow)">
      {/* Cake Plate */}
      <path d="M2 30 H26" className="stroke-[#1E3A8A] dark:stroke-blue-400" strokeWidth="2" strokeLinecap="round" />
      {/* Cake Layer */}
      <rect x="4" y="16" width="20" height="14" rx="2" className="fill-[#EBF5FF] dark:fill-blue-950/40 stroke-[#1976D2] dark:stroke-blue-400" strokeWidth="2" />
      {/* Cake Frosting Layer */}
      <path d="M4 22 C8 19 12 19 16 22 C20 19 22 20 24 22 V18 C24 16.9 23.1 16 22 16 H6 C4.9 16 4 16.9 4 18 V22Z" className="fill-[#93C5FD] dark:fill-blue-500/80" />
      {/* Cherry/decoration */}
      <circle cx="14" cy="16" r="2" fill="#EF4444" />
      {/* Candle */}
      <line x1="14" y1="8" x2="14" y2="16" className="stroke-[#1E3A8A] dark:stroke-blue-400" strokeWidth="2" strokeLinecap="round" />
      {/* Candle Flame */}
      <path d="M14 8 C14.8 6.2 15.2 5 14 3 C12.8 5 13.2 6.2 14 8 Z" fill="#F59E0B" />
    </g>

    {/* Balloons on top-right */}
    <g transform="translate(76, 10)">
      {/* Balloon Strings */}
      <path d="M16 22 C12 30 18 36 10 44" className="stroke-[#64748B] dark:stroke-slate-500" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M26 26 C22 34 26 38 10 44" className="stroke-[#64748B] dark:stroke-slate-500" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      
      {/* Balloon 1 (Orange) */}
      <g filter="url(#shadow)">
        <ellipse cx="16" cy="14" rx="10" ry="12" className="fill-orange-400 dark:fill-orange-500/80 stroke-orange-600 dark:stroke-orange-400" strokeWidth="2" />
        {/* Shine */}
        <path d="M11 9 A5 5 0 0 1 15 7" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      
      {/* Balloon 2 (Darker Blue) */}
      <g filter="url(#shadow)">
        <ellipse cx="26" cy="19" rx="8" ry="10" className="fill-[#3B82F6] dark:fill-blue-700/80 stroke-[#1565C0] dark:stroke-blue-500" strokeWidth="2" />
        {/* Shine */}
        <path d="M22 15 A4 4 0 0 1 25 13" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </g>
  </svg>
);

const renderTreeIllustration = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-28 h-28">
    <defs>
      <linearGradient id="nodeGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#60A5FA" />
        <stop offset="100%" stopColor="#1D4ED8" />
      </linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.1" />
      </filter>
    </defs>
    
    {/* Connection lines */}
    <path d="M60 36 V48 H36 V58 M60 48 H84 V58 M36 72 V82 H20 V88 M36 82 H52 V88 M84 72 V82 H68 V88 M84 82 H100 V88" className="stroke-[#93C5FD] dark:stroke-blue-800" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    
    {/* Row 1: Top Node */}
    <g filter="url(#shadow)">
      <circle cx="60" cy="24" r="12" fill="url(#nodeGrad)" stroke="#1D4ED8" strokeWidth="1.5" />
      {/* Silhouette */}
      <circle cx="60" cy="21" r="3.5" fill="#FFFFFF" />
      <path d="M54 31 C54 28 56.5 27 60 27 C63.5 27 66 28 66 31 Z" fill="#FFFFFF" />
    </g>
    
    {/* Row 2: Mid-Left Node */}
    <g filter="url(#shadow)">
      <circle cx="36" cy="60" r="12" fill="url(#nodeGrad)" stroke="#1D4ED8" strokeWidth="1.5" />
      {/* Silhouette */}
      <circle cx="36" cy="57" r="3.5" fill="#FFFFFF" />
      <path d="M30 67 C30 64 32.5 63 36 63 C39.5 63 42 64 42 67 Z" fill="#FFFFFF" />
    </g>
    
    {/* Row 2: Mid-Right Node */}
    <g filter="url(#shadow)">
      <circle cx="84" cy="60" r="12" fill="url(#nodeGrad)" stroke="#1D4ED8" strokeWidth="1.5" />
      {/* Silhouette */}
      <circle cx="84" cy="57" r="3.5" fill="#FFFFFF" />
      <path d="M78 67 C78 64 80.5 63 84 63 C87.5 63 90 64 90 67 Z" fill="#FFFFFF" />
    </g>
    
    {/* Row 3: Bottom Nodes */}
    <g filter="url(#shadow)">
      <circle cx="20" cy="94" r="9" fill="url(#nodeGrad)" stroke="#1D4ED8" strokeWidth="1.5" />
      <circle cx="20" cy="91.5" r="2.8" fill="#FFFFFF" />
      <path d="M15.5 99.5 C15.5 97.1 17.5 96.3 20 96.3 C22.5 96.3 24.5 97.1 24.5 99.5 Z" fill="#FFFFFF" />
    </g>
    
    <g filter="url(#shadow)">
      <circle cx="52" cy="94" r="9" fill="url(#nodeGrad)" stroke="#1D4ED8" strokeWidth="1.5" />
      <circle cx="52" cy="91.5" r="2.8" fill="#FFFFFF" />
      <path d="M47.5 99.5 C47.5 97.1 49.5 96.3 52 96.3 C54.5 96.3 56.5 97.1 56.5 99.5 Z" fill="#FFFFFF" />
    </g>
    
    <g filter="url(#shadow)">
      <circle cx="68" cy="94" r="9" fill="url(#nodeGrad)" stroke="#1D4ED8" strokeWidth="1.5" />
      <circle cx="68" cy="91.5" r="2.8" fill="#FFFFFF" />
      <path d="M63.5 99.5 C63.5 97.1 65.5 96.3 68 96.3 C70.5 96.3 72.5 97.1 72.5 99.5 Z" fill="#FFFFFF" />
    </g>
    
    <g filter="url(#shadow)">
      <circle cx="100" cy="94" r="9" fill="url(#nodeGrad)" stroke="#1D4ED8" strokeWidth="1.5" />
      <circle cx="100" cy="91.5" r="2.8" fill="#FFFFFF" />
      <path d="M95.5 99.5 C95.5 97.1 97.5 96.3 100 96.3 C102.5 96.3 104.5 97.1 104.5 99.5 Z" fill="#FFFFFF" />
    </g>
  </svg>
);

const renderMembersIllustration = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-28 h-28">
    <defs>
      <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.08" />
      </filter>
    </defs>
    
    {/* Main container board */}
    <g filter="url(#cardShadow)">
      <rect x="22" y="22" width="76" height="76" rx="16" className="fill-white dark:fill-slate-900 stroke-slate-200 dark:stroke-slate-800" strokeWidth="2" />
    </g>
    
    {/* Grid divider lines */}
    <line x1="60" y1="26" x2="60" y2="94" className="stroke-[#F1F5F9] dark:stroke-slate-800/80" strokeWidth="1.5" strokeDasharray="3 3" />
    <line x1="26" y1="60" x2="94" y2="60" className="stroke-[#F1F5F9] dark:stroke-slate-800/80" strokeWidth="1.5" strokeDasharray="3 3" />

    {/* Top-Left Avatar (Grandmother) */}
    <g transform="translate(26, 26)">
      <rect width="31" height="31" rx="8" className="fill-[#F0F7FF] dark:fill-slate-800/60" />
      <circle cx="15.5" cy="13" r="8" className="fill-[#E2E8F0] dark:fill-slate-700" />
      <circle cx="15.5" cy="14" r="6" fill="#FED7AA" />
      <circle cx="13.5" cy="13.5" r="0.8" fill="#1E293B" />
      <circle cx="17.5" cy="13.5" r="0.8" fill="#1E293B" />
      <path d="M14 17 Q15.5 18 17 17" stroke="#1E293B" strokeWidth="1" strokeLinecap="round" />
      <circle cx="13" cy="13.5" r="2.2" fill="none" stroke="#EC4899" strokeWidth="1" />
      <circle cx="18" cy="13.5" r="2.2" fill="none" stroke="#EC4899" strokeWidth="1" />
      <line x1="15.2" y1="13.5" x2="15.8" y2="13.5" stroke="#EC4899" strokeWidth="1" />
      <path d="M10 10 Q15.5 6 21 10" className="stroke-[#E2E8F0] dark:stroke-slate-500" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="11" cy="9" r="2.5" className="fill-[#E2E8F0] dark:fill-slate-500" />
      <circle cx="20" cy="9" r="2.5" className="fill-[#E2E8F0] dark:fill-slate-500" />
      <circle cx="15.5" cy="8" r="3" className="fill-[#E2E8F0] dark:fill-slate-500" />
      <path d="M7 31 C7 26.5 10.5 24 15.5 24 C20.5 24 24 26.5 24 31 Z" fill="#F472B6" />
      <path d="M13 24 L15.5 26 L18 24" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" fill="none" />
    </g>

    {/* Top-Right Avatar (Father with Beard) */}
    <g transform="translate(63, 26)">
      <rect width="31" height="31" rx="8" className="fill-[#F0F7FF] dark:fill-slate-800/60" />
      <path d="M10 10 Q15.5 5 21 10" fill="#1E293B" />
      <circle cx="15.5" cy="14" r="6" fill="#FDBA74" />
      <path d="M10 15 C10 19.5 12 21 15.5 21 C19 21 21 19.5 21 15 C19.5 16.5 18 16 15.5 16 C13 16 11.5 16.5 10 15 Z" fill="#1E293B" />
      <circle cx="13.5" cy="13.5" r="0.8" fill="#FFFFFF" />
      <circle cx="17.5" cy="13.5" r="0.8" fill="#FFFFFF" />
      <path d="M15.5 13.5 V15" stroke="#1E293B" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M7 31 C7 26.5 10.5 24 15.5 24 C20.5 24 24 26.5 24 31 Z" className="fill-orange-500 dark:fill-orange-600" />
      <path d="M13 24 L15.5 26.5 L18 24" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" fill="none" />
    </g>

    {/* Bottom-Left Avatar (Young Boy) */}
    <g transform="translate(26, 63)">
      <rect width="31" height="31" rx="8" className="fill-[#F0F7FF] dark:fill-slate-800/60" />
      <ellipse cx="15.5" cy="9" rx="7.5" ry="3.5" fill="#78350F" />
      <circle cx="11" cy="9" r="2.5" fill="#78350F" />
      <circle cx="20" cy="9" r="2.5" fill="#78350F" />
      <circle cx="14" cy="7.5" r="2.5" fill="#78350F" />
      <circle cx="17" cy="7.5" r="2.5" fill="#78350F" />
      <circle cx="15.5" cy="15.5" r="6" fill="#FDBA74" />
      <circle cx="13.5" cy="15" r="0.8" fill="#1E293B" />
      <circle cx="17.5" cy="15" r="0.8" fill="#1E293B" />
      <path d="M13 17.5 Q15.5 19.5 18 17.5" stroke="#1E293B" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M7 31 C7 27 10.5 25 15.5 25 C20.5 25 24 27 24 31 Z" fill="#10B981" />
    </g>

    {/* Bottom-Right Avatar (Young Woman/Mother) */}
    <g transform="translate(63, 63)">
      <rect width="31" height="31" rx="8" className="fill-[#F0F7FF] dark:fill-slate-800/60" />
      <path d="M9 13 C9 7 22 7 22 13 V25 H9 Z" fill="#1E293B" />
      <circle cx="15.5" cy="14" r="6" fill="#FEE2E2" />
      <circle cx="13.5" cy="13.5" r="0.8" fill="#1E293B" />
      <circle cx="17.5" cy="13.5" r="0.8" fill="#1E293B" />
      <path d="M13.5 17 Q15.5 18.5 17.5 17" stroke="#1E293B" strokeWidth="1" strokeLinecap="round" fill="none" />
      <path d="M9.5 12 C10.5 9 13.5 8 15.5 9.5 C17.5 8 20.5 9 21.5 12" stroke="#1E293B" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M7 31 C7 26.5 10.5 24 15.5 24 C20.5 24 24 26.5 24 31 Z" fill="#3B82F6" />
      <path d="M12.5 24 L15.5 27.5 L18.5 24" stroke="#FFFFFF" strokeWidth="1" fill="none" />
    </g>
  </svg>
);

const renderGalleryIllustration = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-28 h-28">
    <defs>
      <filter id="photoShadow" x="-15%" y="-15%" width="130%" height="130%">
        <feDropShadow dx="1" dy="3" stdDeviation="4" floodOpacity="0.12" />
      </filter>
      <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#87CEEB" />
        <stop offset="100%" stopColor="#E0F2FE" />
      </linearGradient>
      <linearGradient id="sunsetGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FF7E5F" />
        <stop offset="100%" stopColor="#FEB47B" />
      </linearGradient>
    </defs>
    
    {/* Polaroid 1 (Behind, tilted left) */}
    <g transform="translate(38, 52) rotate(-12) translate(-22, -26)" filter="url(#photoShadow)">
      {/* Frame */}
      <rect x="0" y="0" width="42" height="50" rx="3" className="fill-white dark:fill-slate-900 stroke-slate-200 dark:stroke-slate-800" strokeWidth="1.5" />
      {/* Photo Area */}
      <rect x="3" y="3" width="36" height="36" fill="url(#skyGrad)" />
      {/* Mountains */}
      <path d="M3 39 L15 22 L26 33 L34 24 L39 30 V39 H3Z" fill="#10B981" opacity="0.85" />
      <path d="M10 39 L20 28 L28 35 L39 21 V39 H10Z" fill="#047857" opacity="0.9" />
      {/* Sun */}
      <circle cx="30" cy="10" r="3.5" fill="#F59E0B" />
    </g>
    
    {/* Polaroid 2 (Front, tilted right) */}
    <g transform="translate(74, 56) rotate(8) translate(-22, -26)" filter="url(#photoShadow)">
      {/* Frame */}
      <rect x="0" y="0" width="42" height="50" rx="3" className="fill-white dark:fill-slate-900 stroke-slate-200 dark:stroke-slate-800" strokeWidth="1.5" />
      {/* Photo Area */}
      <rect x="3" y="3" width="36" height="36" fill="url(#sunsetGrad)" />
      
      {/* Ground */}
      <path d="M3 35 Q18 33 39 35 V39 H3Z" className="fill-[#1E293B] dark:fill-slate-950" />
      
      {/* Family silhouettes walking */}
      {/* Father */}
      <circle cx="12" cy="18" r="2.2" className="fill-[#1E293B] dark:fill-slate-950" />
      <path d="M9.5 28 C9.5 23 14.5 23 14.5 28 V36 H12.5 V31 H11.5 V36 H9.5 Z" className="fill-[#1E293B] dark:fill-slate-950" />
      
      {/* Child in the middle holding hands */}
      <circle cx="18.5" cy="23" r="1.6" className="fill-[#1E293B] dark:fill-slate-950" />
      <path d="M16.5 30 C16.5 26 20.5 26 20.5 30 V36 H19.5 V33 H17.5 V36 H16.5 Z" className="fill-[#1E293B] dark:fill-slate-950" />
      
      {/* Mother */}
      <circle cx="25" cy="19" r="2.1" className="fill-[#1E293B] dark:fill-slate-950" />
      <path d="M22.5 28 C22.5 23.5 27.5 23.5 27.5 28 V36 H25.5 V31.5 H24.5 V36 H22.5 Z" className="fill-[#1E293B] dark:fill-slate-950" />
      
      {/* Connect arms (holding hands) */}
      <path d="M13 26 L17.5 28 M19.5 28 L23.5 26" className="stroke-[#1E293B] dark:stroke-slate-950" strokeWidth="1" strokeLinecap="round" />
    </g>
  </svg>
);

const renderDefaultIllustration = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-28 h-28">
    <defs>
      <filter id="hubShadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.1" />
      </filter>
      <linearGradient id="hubGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#DBEAFE" />
        <stop offset="100%" stopColor="#EFF6FF" />
      </linearGradient>
      <linearGradient id="hubGradDark" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#1E3A8A" />
        <stop offset="100%" stopColor="#1E293B" />
      </linearGradient>
    </defs>
    
    {/* Big Heart Shape background */}
    <g filter="url(#hubShadow)">
      <path d="M60 92 L53 85.5 C29.5 64 14 50 14 32.5 C14 18.5 25 7.5 39 7.5 C47 7.5 54.5 11 60 17 C65.5 11 73 7.5 81 7.5 C95 7.5 106 18.5 106 32.5 C106 50 90.5 64 67 85.5 Z" className="fill-[url(#hubGrad)] dark:fill-[url(#hubGradDark)] stroke-[#1976D2] dark:stroke-blue-400" strokeWidth="3.5" strokeLinejoin="round" />
    </g>
    
    {/* Home icon combined inside the heart */}
    <path d="M44 54 L60 39 L76 54 V72 H66 V60 H54 V72 H44 Z" className="fill-[#93C5FD] dark:fill-blue-900/50 stroke-[#1565C0] dark:stroke-blue-400" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    
    {/* Chimney */}
    <rect x="68" y="42" width="4" height="8" className="fill-[#93C5FD] dark:fill-blue-900/50 stroke-[#1565C0] dark:stroke-blue-400" strokeWidth="2.5" />
    
    {/* Mini family avatar circles floating above roof */}
    <circle cx="48" cy="32" r="3.5" className="fill-orange-500 stroke-orange-600" strokeWidth="1" />
    <circle cx="60" cy="27" r="3.5" fill="#EF4444" stroke="#B91C1C" strokeWidth="1" />
    <circle cx="72" cy="32" r="3.5" fill="#10B981" stroke="#047857" strokeWidth="1" />
  </svg>
);

const GitBranchIcon = (props) => (
  <svg
    stroke="currentColor"
    fill="none"
    strokeWidth="2.5"
    viewBox="0 0 24 24"
    strokeLinecap="round"
    strokeLinejoin="round"
    height="1em"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <line x1="6" y1="3" x2="6" y2="15"></line>
    <circle cx="18" cy="6" r="3"></circle>
    <circle cx="6" cy="18" r="3"></circle>
    <path d="M18 9a9 9 0 0 1-9 9"></path>
  </svg>
);

const configs = {
  events: {
    title: "Start Creating Memorable Family Events",
    text: "Create a family tree, or join an existing one to start organizing events.",
    footer: "Already have a family code? Join instantly and start creating events.",
    badgeIcon: FiCalendar,
    illustration: renderEventsIllustration,
  },
  tree: {
    title: "Build Your Family Story",
    text: "Create a family tree, or join an existing one to build your family tree.",
    footer: "Start building meaningful family connections today.",
    badgeIcon: GitBranchIcon,
    illustration: renderTreeIllustration,
  },
  members: {
    title: "Manage Your Family Members",
    text: "Create a family tree, or join an existing one to manage members.",
    footer: "Bring everyone together in one secure family space.",
    badgeIcon: FiUsers,
    illustration: renderMembersIllustration,
  },
  gallery: {
    title: "Capture and Celebrate Family Memories",
    text: "Create a family tree, or join an existing one to share memories.",
    footer: "Every family memory deserves a place to be remembered.",
    badgeIcon: FiImage,
    illustration: renderGalleryIllustration,
  },
  default: {
    title: "Welcome to your Family Hub",
    text: "Create a family tree, or join an existing one to get started.",
    footer: "Have a family code? Use it to join instantly.",
    badgeIcon: FiUsers,
    illustration: renderDefaultIllustration,
  }
};

const NoFamilyView = ({ onCreateFamily, onJoinFamily, type }) => {
  const config = configs[type] || configs.default;
  const BadgeIcon = config.badgeIcon;
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [loadingTutorial, setLoadingTutorial] = useState(false);

  const handleWatchTutorial = async () => {
    if (loadingTutorial) return;
    setLoadingTutorial(true);
    try {
      const res = await fetchCreateFamilyTutorial(language);
      if (res && res.id) {
        navigate(`/tutorials/${res.id}?lang=${language}`);
      } else {
        toast.error('Tutorial not available');
      }
    } catch (err) {
      console.error('Failed to load onboarding tutorial:', err);
      toast.error('Tutorial not available');
    } finally {
      setLoadingTutorial(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-transparent p-6 sm:p-8 flex flex-col items-center justify-center gap-6 h-[400px] overflow-hidden animate-fadeIn">
      <div className="flex flex-col items-center text-center gap-5 w-full">
        
        {/* Illustration with badge */}
        <div className="relative">
          <div className="w-32 h-32 rounded-full bg-[#F0F7FF] dark:bg-[#1E293B]/60 flex items-center justify-center relative overflow-visible">
            {config.illustration()}
          </div>
          <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-950">
            <BadgeIcon className="text-white text-lg" />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm sm:text-base text-gray-700 dark:text-slate-200 font-bold max-w-md mx-auto leading-relaxed">
            {config.text}
          </p>
          
        </div>
      </div>

     <div className="flex flex-col items-center gap-4 w-full mt-4">
  <div className="flex flex-col sm:flex-row w-full gap-3 sm:gap-4">
    <button
      onClick={onCreateFamily}
      className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#1976D2] text-white font-bold shadow-sm hover:bg-[#1565C0] hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
    >
      <FiPlus size={20} />
      Create Family Tree
    </button>

    <button
      onClick={onJoinFamily}
      className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-orange-500 text-white font-bold shadow-sm hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
    >
      <FiLink size={20} />
      Join Family Tree
    </button>
  </div>

  {/* Tutorial Button */}
  <button
    onClick={handleWatchTutorial}
    disabled={loadingTutorial}
    className="group flex items-center justify-center mt-5 gap-3 px-5 py-3 w-full rounded-xl border border-[#1976D2]/20 bg-[#F0F7FF] dark:bg-slate-900 dark:border-blue-800 hover:bg-[#E3F2FD] dark:hover:bg-slate-800 transition-all duration-200 disabled:opacity-50"
  >
    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#1976D2] text-white shadow-sm group-hover:scale-110 transition-transform">
      <FiPlayCircle size={20} />
    </div>

    <div className="text-left">
      <p className="font-semibold text-[#1976D2] dark:text-blue-400">
        {loadingTutorial ? 'Loading Tutorial...' : 'Watch Quick Tutorial'}
      </p>
      <p className="text-xs text-gray-500 dark:text-slate-400">
        Learn how to create and join a family tree
      </p>
    </div>
  </button>
</div>
    </div>
  );
};

NoFamilyView.propTypes = {
  onCreateFamily: PropTypes.func.isRequired,
  onJoinFamily: PropTypes.func.isRequired,
  type: PropTypes.string,
};

export default NoFamilyView;