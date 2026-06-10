import React from "react";
import PropTypes from "prop-types";

const EmptyState = ({
  type = "generic", // 'events' | 'posts' | 'gallery' | 'generic'
  title,
  description,
  action = null,
  className = ""
}) => {
  // Fallback content based on type
  const defaultContent = {
    events: {
      title: "No upcoming events",
      description: "It looks like your family calendar is clear. Schedule an event to gather everyone together!",
    },
    posts: {
      title: "No posts to show",
      description: "Your family feed is quiet. Share a thought, photo, or life update to break the ice!",
    },
    chat: {
      title: "No conversations",
      description: "Select a family member or group to start chatting.",
    },
    gallery: {
      title: "No media in gallery",
      description: "This album is waiting for its first memory. Upload some family photos to get started!",
    },
    generic: {
      title: "No items found",
      description: "We couldn't find anything matching your request. Try adjusting your filters.",
    }
  };

  const activeTitle = title || defaultContent[type]?.title || defaultContent.generic.title;
  const activeDesc = description || defaultContent[type]?.description || defaultContent.generic.description;

  // Embedded CSS for custom premium fluid animations
  const animationStyles = `
    @keyframes float-fluid-1 {
      0%, 100% { transform: translateY(0px) rotate(0deg); }
      50% { transform: translateY(-16px) rotate(3deg); }
    }
    @keyframes float-fluid-2 {
      0%, 100% { transform: translateY(0px) rotate(0deg); }
      50% { transform: translateY(-10px) rotate(-4deg); }
    }
    @keyframes float-fluid-3 {
      0%, 100% { transform: translateY(0px) translateX(0px); }
      50% { transform: translateY(-8px) translateX(4px); }
    }
    @keyframes breathe-glow {
      0%, 100% { opacity: 0.15; transform: scale(0.95); }
      50% { opacity: 0.35; transform: scale(1.08); }
    }
    @keyframes orbit-item {
      0% { transform: rotate(0deg) translateX(36px) rotate(0deg); }
      100% { transform: rotate(360deg) translateX(36px) rotate(-360deg); }
    }
    @keyframes slide-photo {
      0%, 100% { transform: rotate(-8deg) translate(0, 0); }
      50% { transform: rotate(-1deg) translate(3px, -6px); }
    }
    @keyframes pulse-soft {
      0%, 100% { transform: scale(1); opacity: 0.8; }
      50% { transform: scale(1.1); opacity: 1; }
    }
    
    .animate-float-1 { animation: float-fluid-1 6s ease-in-out infinite; }
    .animate-float-2 { animation: float-fluid-2 5s ease-in-out infinite; }
    .animate-float-3 { animation: float-fluid-3 4s ease-in-out infinite; }
    .animate-breathe { animation: breathe-glow 4s ease-in-out infinite; }
    .animate-orbit { animation: orbit-item 12s linear infinite; }

    .animate-float-1 { animation: float-fluid-1 6s ease-in-out infinite; }
    .animate-float-2 { animation: float-fluid-2 5s ease-in-out infinite; }
    .animate-float-3 { animation: float-fluid-3 4s ease-in-out infinite; }
    .animate-breathe { animation: breathe-glow 4s ease-in-out infinite; }
    .animate-orbit { animation: orbit-item 12s linear infinite; }
    .animate-photo-slide { animation: slide-photo 5s ease-in-out infinite; }
    .animate-pulse-soft { animation: pulse-soft 3s ease-in-out infinite; }
    
    .hover-scale-illustration {
      transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .hover-scale-illustration:hover {
      transform: scale(1.06);
    }
  `;

  // Render dynamic animated illustration based on empty state type
  // Signature motion template: Floating Central Item (Blue) + Orbiting Badge (Orange) + Floating Sparkle Star (Orange)
  const renderIllustration = () => {
    switch (type) {
      case "events":
        return (
          <div className="relative flex items-center justify-center w-40 h-40 mb-6 hover-scale-illustration">
            {/* Background glowing aura (Blue dominant) */}
            <div className="absolute w-32 h-32 rounded-full bg-blue-200/40 dark:bg-blue-950/10 blur-xl animate-breathe" />
            
            {/* Main Calendar Body (Dominant Blue) */}
            <div className="relative z-10 animate-float-1">
              <svg
                className="w-24 h-24 text-blue-500 dark:text-blue-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="3" ry="3" className="fill-white dark:fill-slate-900" />
                <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2" />
                <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2" />
                <line x1="3" y1="10" x2="21" y2="10" strokeWidth="1.5" />
                <circle cx="8" cy="14" r="1.5" fill="currentColor" />
                <circle cx="12" cy="14" r="1.5" fill="currentColor" />
                <circle cx="16" cy="14" r="1.5" fill="currentColor" />
                <circle cx="8" cy="18" r="1.5" fill="currentColor" />
                <circle cx="12" cy="18" r="1.5" fill="currentColor" />
              </svg>
            </div>

            {/* Orbiting Clock item (Tiny Orange) */}
            <div className="absolute z-20 text-orange-500 dark:text-orange-400 animate-orbit" style={{ transformOrigin: "center" }}>
              <div className="bg-white dark:bg-slate-800 p-1 rounded-full shadow-md border border-orange-100 dark:border-slate-700 animate-pulse-soft">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
            </div>

            {/* Sparkle lines (Tiny Orange) */}
            <div className="absolute top-3 left-8 text-orange-500 animate-float-1 z-20">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="19" x2="12" y2="19" />
                <line x1="10" y1="10" x2="14" y2="14" />
                <line x1="19" y1="6" x2="19" y2="12" />
              </svg>
            </div>
          </div>
        );

      case "posts":
        return (
          <div className="relative flex items-center justify-center w-40 h-40 mb-6 hover-scale-illustration">
            {/* Background glowing aura (Blue dominant) */}
            <div className="absolute w-32 h-32 rounded-full bg-blue-200/40 dark:bg-blue-950/10 blur-xl animate-breathe" />
            
            {/* Main Post & Comment Layout Icon (Dominant Blue) */}
            <div className="relative z-10 animate-float-1">
              <svg
                className="w-24 h-24 text-blue-500 dark:text-blue-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {/* Main Post Card (Top-Left) */}
                <rect x="3" y="3" width="14" height="12" rx="2" className="fill-white dark:fill-slate-900" />
                {/* Post header lines */}
                <line x1="6" y1="6" x2="10" y2="6" strokeWidth="1.2" />
                <line x1="6" y1="9" x2="14" y2="9" strokeWidth="1.2" />
                
                {/* Overlapping Comment Bubble (Bottom-Right) */}
                <path d="M12 9h6a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-3l-3 3v-3a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3z" className="fill-white dark:fill-slate-900" />
                {/* Comment text lines */}
                <line x1="12" y1="12" x2="18" y2="12" strokeWidth="1.2" />
                <line x1="12" y1="15" x2="16" y2="15" strokeWidth="1.2" />
              </svg>
            </div>

            {/* Orbiting Heart item (Tiny Orange) */}
            <div className="absolute z-20 text-orange-500 dark:text-orange-400 animate-orbit" style={{ transformOrigin: "center" }}>
              <div className="bg-white dark:bg-slate-800 p-1 rounded-full shadow-md border border-orange-100 dark:border-slate-700 animate-pulse-soft">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
              </div>
            </div>
            
            {/* Sparkle lines (Tiny Orange) */}
            <div className="absolute top-3 left-8 text-orange-500 animate-float-1 z-20">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="19" x2="12" y2="19" />
                <line x1="10" y1="10" x2="14" y2="14" />
                <line x1="19" y1="6" x2="19" y2="12" />
              </svg>
            </div>
          </div>
        );

      case "chat":
        return (
          <div className="relative flex items-center justify-center w-40 h-40 mb-6 hover-scale-illustration">
            {/* Background glowing aura (Blue dominant) */}
            <div className="absolute w-32 h-32 rounded-full bg-blue-200/40 dark:bg-blue-950/10 blur-xl animate-breathe" />
            
            {/* Main Chat Speech bubble (Dominant Blue) */}
            <div className="relative z-10 animate-float-1">
              <svg
                className="w-24 h-24 text-blue-500 dark:text-blue-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" className="fill-white dark:fill-slate-900" />
                <line x1="8" y1="7" x2="16" y2="7" strokeWidth="2" strokeLinecap="round" />
                <line x1="8" y1="11" x2="14" y2="11" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>

            {/* Orbiting Heart item (Tiny Orange) */}
            <div className="absolute z-20 text-orange-500 dark:text-orange-400 animate-orbit" style={{ transformOrigin: "center" }}>
              <div className="bg-white dark:bg-slate-800 p-1 rounded-full shadow-md border border-orange-100 dark:border-slate-700 animate-pulse-soft">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
              </div>
            </div>
            
            {/* Sparkle lines (Tiny Orange) */}
            <div className="absolute top-3 left-8 text-orange-500 animate-float-1 z-20">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="19" x2="12" y2="19" />
                <line x1="10" y1="10" x2="14" y2="14" />
                <line x1="19" y1="6" x2="19" y2="12" />
              </svg>
            </div>
          </div>
        );

      case "gallery":
        return (
          <div className="relative flex items-center justify-center w-40 h-40 mb-6 hover-scale-illustration">
            {/* Background glowing aura (Blue dominant) */}
            <div className="absolute w-32 h-32 rounded-full bg-blue-200/40 dark:bg-blue-950/10 blur-xl animate-breathe" />

            {/* Main stacked photos (Dominant Blue) */}
            <div className="relative z-10 animate-float-1">
              <svg
                className="w-24 h-24 text-blue-500 dark:text-blue-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {/* Back photo stack card */}
                <rect x="7" y="3" width="14" height="14" rx="2" className="fill-white dark:fill-slate-900" />
                {/* Front Photo stack card */}
                <rect x="3" y="7" width="14" height="14" rx="2" className="fill-white dark:fill-slate-900" />
                {/* Image mountain vectors */}
                <circle cx="7.5" cy="11.5" r="1.2" fill="currentColor"/>
                <path d="M5 21l4-4 2 2 4-4 2 2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            {/* Orbiting Image Frame item (Tiny Orange) */}
            <div className="absolute z-20 text-orange-500 dark:text-orange-400 animate-orbit" style={{ transformOrigin: "center" }}>
              <div className="bg-white dark:bg-slate-800 p-1 rounded-full shadow-md border border-orange-100 dark:border-slate-700 animate-pulse-soft">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                  <polyline points="21 15 16 10 5 21" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            {/* Sparkle lines (Tiny Orange) */}
            <div className="absolute top-3 left-8 text-orange-500 animate-float-1 z-20">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="19" x2="12" y2="19" />
                <line x1="10" y1="10" x2="14" y2="14" />
                <line x1="19" y1="6" x2="19" y2="12" />
              </svg>
            </div>
          </div>
        );

      case "generic":
      default:
        return (
          <div className="relative flex items-center justify-center w-40 h-40 mb-6 hover-scale-illustration">
            {/* Background glowing aura (Blue dominant) */}
            <div className="absolute w-32 h-32 rounded-full bg-blue-200/40 dark:bg-blue-950/10 blur-xl animate-breathe" />
            
            {/* Main Search illustration (Dominant Blue) */}
            <div className="relative z-10 animate-float-1">
              <svg
                className="w-24 h-24 text-blue-500 dark:text-blue-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" className="fill-white dark:fill-slate-900" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2.5" />
              </svg>
            </div>

            {/* Orbiting Question mark/Info badge (Tiny Orange) */}
            <div className="absolute z-20 text-orange-500 dark:text-orange-400 animate-orbit" style={{ transformOrigin: "center" }}>
              <div className="bg-white dark:bg-slate-800 p-1 rounded-full shadow-md border border-orange-100 dark:border-slate-700 animate-pulse-soft">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            
            {/* Sparkle lines (Tiny Orange) */}
            <div className="absolute top-5 right-8 text-orange-500 animate-float-1 z-20">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="19" x2="12" y2="19" />
                <line x1="10" y1="10" x2="14" y2="14" />
                <line x1="19" y1="6" x2="19" y2="12" />
              </svg>
            </div>
          </div>
        );
    }
  };

  return (
    <div
      className={`mx-auto flex w-full max-w-xl flex-col items-center justify-center px-4 py-8 text-center bg-transparent border-0 shadow-none select-none ${className}`}
    >
      {/* Inline styles for custom animations */}
      <style dangerouslySetInnerHTML={{ __html: animationStyles }} />

      {/* Dynamic Animated Illustration */}
      {renderIllustration()}

      {/* Main Empty State Title */}
      <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200 tracking-tight leading-none">
        {activeTitle}
      </h3>

      {/* Detail description */}
      <p className="mt-3 max-w-md text-base text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
        {activeDesc}
      </p>

      {/* Action Button */}
      {action && (
        <div className="mt-6 transition-all duration-300 hover:scale-103 active:scale-97">
          {action}
        </div>
      )}
    </div>
  );
};

EmptyState.propTypes = {
  type: PropTypes.oneOf(["events", "posts", "gallery", "chat", "generic"]),
  title: PropTypes.string,
  description: PropTypes.string,
  action: PropTypes.node,
  className: PropTypes.string
};

export default EmptyState;
