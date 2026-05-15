import React, { useEffect, useRef, useState } from 'react';
import { FiEdit, FiMoreVertical, FiShare2, FiLogOut } from 'react-icons/fi';

const FamilyView = ({
  familyData,
  totalMembers,
  males,
  females,
  averageAge,
  onManageMembers,
  onManageEvents,
  onManageGifts,
  onEditFamily,
  canEditFamily = false,
  onShareFamilyCode,
  onLeaveFamily,
  leavingFamily = false,
  canLeaveFamily = true,
}) => {
  const defaultFamilyPhoto = "/assets/family-default.png";
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div className="space-y-8 mb-6 animate-fade-in-up">
      <div className="relative rounded-[2.5rem] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-primary-500/20 group hover:shadow-[0_20px_40px_rgba(var(--color-primary-500),0.15)] transition-all duration-500">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-500 to-primary-700"></div>
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none group-hover:scale-125 group-hover:-translate-x-10 group-hover:translate-y-10 transition-all duration-1000 ease-in-out"></div>
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-primary-300/20 rounded-full blur-3xl pointer-events-none group-hover:scale-125 group-hover:translate-x-10 group-hover:-translate-y-10 transition-all duration-1000 ease-in-out"></div>

        {canLeaveFamily && (
          <div className="absolute top-5 right-5 z-20" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="inline-flex items-center justify-center w-12 h-12 rounded-2xl border border-white/25 bg-white/10 text-white backdrop-blur-md hover:bg-white/20 transition-all duration-200"
              aria-label="Open family actions"
              aria-expanded={isMenuOpen}
            >
              <FiMoreVertical className="text-xl" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 mt-3 w-52 rounded-2xl border border-white/20 bg-white shadow-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onLeaveFamily?.();
                  }}
                  disabled={leavingFamily}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <FiLogOut className="text-base" />
                  {leavingFamily ? 'Leaving...' : 'Leave Family'}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="relative z-10 p-5 sm:p-8 lg:p-12 flex flex-col lg:flex-row items-center lg:items-center gap-6 lg:gap-12 backdrop-blur-sm">
          <div className="relative group/avatar cursor-pointer">
            <div className="absolute inset-0 bg-white/30 rounded-full blur-xl transform scale-110 opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-300"></div>
            <div className="absolute inset-0 bg-gradient-to-tr from-primary-400 to-white rounded-full animate-spin-slow opacity-20 group-hover/avatar:opacity-40"></div>
            <div className="relative flex-shrink-0 w-36 h-36 sm:w-48 sm:h-48 rounded-full overflow-hidden border-[6px] border-white/90 shadow-2xl group-hover/avatar:border-white transition-all duration-300 group-hover/avatar:scale-105 active:scale-95">
              <img
                src={familyData.familyPhotoUrl ? `${familyData.familyPhotoUrl}` : defaultFamilyPhoto}
                alt={familyData.familyName}
                className="w-full h-full object-cover group-hover/avatar:scale-110 transition-transform duration-700 ease-out"
                onError={(e) => e.target.src = defaultFamilyPhoto}
              />
            </div>
            <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 bg-white text-primary-600 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-xl sm:text-2xl shadow-lg transform translate-y-4 opacity-0 group-hover/avatar:translate-y-0 group-hover/avatar:opacity-100 transition-all duration-300 bounce">
              👋
            </div>
          </div>

          <div className="text-center lg:text-left text-white flex-1 relative w-full min-w-0">
            <h1 className="text-4xl sm:text-6xl font-black mb-3 tracking-tight drop-shadow-md bg-clip-text text-transparent bg-gradient-to-b from-white to-primary-100">
              {familyData.familyName}
            </h1>
            <p className="text-base sm:text-xl text-primary-50 mb-8 font-medium max-w-2xl leading-relaxed opacity-90">
              {familyData.familyBio}
            </p>

            <div className="
  flex
  flex-col
  sm:flex-row
  lg:flex-row
  items-stretch
  sm:items-center
  justify-center
  lg:justify-start
  gap-3
  sm:gap-4
  w-full
  max-w-full
  flex-wrap
">
              <button
                type="button"
                onClick={onShareFamilyCode}
                className="
    group/btn
    relative
    overflow-hidden
    flex
    items-center
    justify-center
    w-full
    sm:w-auto
    min-w-0
    bg-white/10
    hover:bg-white/20
    border
    border-white/30
    backdrop-blur-md
    px-4
    sm:px-6
    py-3
    text-sm
    sm:text-base
    font-bold
    rounded-2xl
    transition-all
    duration-300
    hover:shadow-[0_8px_20px_rgba(255,255,255,0.2)]
    hover:-translate-y-1
    active:scale-95
    active:translate-y-0
  "
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:animate-[shimmer_1.5s_infinite]"></div>
                <FiShare2 className="mr-3 text-xl group-hover/btn:rotate-12 transition-transform duration-300" />
                <span className="flex items-center gap-2 flex-wrap justify-center">
                  Code:
                  <span className="font-mono bg-black/20 px-3 py-1.5 rounded-xl tracking-widest border border-white/10 group-hover/btn:bg-black/30 transition-colors break-all">
                    {familyData.familyCode}
                  </span>
                </span>
              </button>

              {canEditFamily && (
                <button
                  type="button"
                  onClick={onEditFamily}
                  className="
    group/btn
    flex
    items-center
    justify-center
    w-full
    sm:w-auto
    bg-white
    text-primary-700
    hover:text-primary-800
    rounded-2xl
    px-4
    sm:px-6
    py-3
    text-sm
    sm:text-base
    font-black
    shadow-[0_8px_20px_rgba(0,0,0,0.1)]
    hover:shadow-[0_12px_25px_rgba(255,255,255,0.3)]
    transition-all
    duration-300
    hover:-translate-y-1
    active:scale-95
    active:translate-y-0
  "
                >
                  <FiEdit className="mr-3 text-xl group-hover/btn:rotate-12 transition-transform duration-300" />
                  Customize
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FamilyView;
