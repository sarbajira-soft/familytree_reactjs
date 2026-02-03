import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
  FaUndoAlt,
} from "react-icons/fa";
import {
  FiEdit3,
  FiTrash2,
} from "react-icons/fi";
import { AnimatePresence, motion } from "framer-motion";
const EventViewerModal = ({
  isOpen,
  onClose,
  event,
  isMyEvent = false,
  onEdit,
  onDelete,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);

  // full screen
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [rotation, setRotation] = useState(0);

  const carouselRef = useRef(null);
  const fsCarouselRef = useRef(null);
  
  // keyboard handling for full screen
  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        if (isFullScreen) setIsFullScreen(false);
        else onClose();
      }
      if (isFullScreen) {
        if (e.key === "ArrowLeft") goToPrevFS();
        if (e.key === "ArrowRight") goToNextFS();
      } else {
        if (e.key === "ArrowLeft") handlePrev();
        if (e.key === "ArrowRight") handleNext();
      }
    },
    [isOpen, isFullScreen /* deps below */]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "unset";
      };
    }
  }, [isOpen, handleKeyDown]);
  // API placeholders - swap with your endpoints
  // carousel controls (non-fullscreen)
  const handlePrev = () => {
    if (!carouselRef.current) return;
    const container = carouselRef.current;
    const width = container.clientWidth;
    container.scrollBy({ left: -width, behavior: "smooth" });
  };
  const handleNext = () => {
    if (!carouselRef.current) return;
    const container = carouselRef.current;
    const width = container.clientWidth;
    container.scrollBy({ left: width, behavior: "smooth" });
  };

  // full screen controls
  const goToIndexFS = (i) => {
    if (!fsCarouselRef.current) return;
    fsCarouselRef.current.scrollTo({
      left: i * fsCarouselRef.current.clientWidth,
      behavior: "smooth",
    });
    setActiveIndex(i);
  };
  const goToPrevFS = () => {
    if (!event || !event.eventImages?.length) return;
    const i =
      (activeIndex - 1 + event.eventImages.length) % event.eventImages.length;
    goToIndexFS(i);
  };
  const goToNextFS = () => {
    if (!event || !event.eventImages?.length) return;
    const i = (activeIndex + 1) % event.eventImages.length;
    goToIndexFS(i);
  };

  // sync active index on scroll (non-fullscreen)
  const handleScroll = () => {
    if (!carouselRef.current) return;
    const idx = Math.round(
      carouselRef.current.scrollLeft / carouselRef.current.clientWidth
    );
    setActiveIndex(idx);
  };

  if (!isOpen || !event) return null;

  const images = event.eventImages || [];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-90 backdrop-blur px-2 sm:px-4 pt-10 pb-24 sm:pt-8 sm:pb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="relative bg-white rounded-2xl m-3 shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden"
          style={{ maxHeight: "calc(100vh - 160px)" }}
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.98, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* close & action buttons */}
          <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
            {isMyEvent && (
              <>
                <button
                  onClick={onEdit}
                  className="p-3 bg-white/90 text-gray-600 rounded-full hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  title="Edit Event"
                >
                  {" "}
                  <FiEdit3 size={20} />{" "}
                </button>
                <button
                  onClick={onDelete}
                  className="p-3 bg-white/90 text-gray-600 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"
                  title="Delete Event"
                >
                  {" "}
                  <FiTrash2 size={20} />{" "}
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-3 bg-white/90 rounded-full hover:bg-gray-100 shadow"
              title="Close"
            >
              <FaTimes />
            </button>
          </div>

          <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            {/* IMAGE / CAROUSEL (on mobile full width above details; on desktop left column) */}
            <div className="md:w-1/2 bg-black relative flex items-center justify-center">
              <div
                ref={carouselRef}
                onScroll={handleScroll}
                className="w-full h-[38vh] md:h-full overflow-x-auto snap-x snap-mandatory no-scrollbar flex"
              >
                {images.length > 0 ? (
                  images.map((src, i) => (
                    <div
                      key={i}
                      className="w-full h-full flex-shrink-0 snap-center flex items-center justify-center p-4"
                    >
                      <img
                        src={src}
                        alt={`Event ${i + 1}`}
                        className="max-w-full max-h-full object-contain mx-auto my-auto rounded-xl"
                        onClick={() => setIsFullScreen(true)}
                        onError={(e) => (e.target.src = "/fallback-image.png")}
                      />
                    </div>
                  ))
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-6 text-center">
                    <div className="text-gray-400">No images available</div>
                  </div>
                )}
              </div>

              {/* prev/next buttons */}
              {images.length > 1 && (
                <>
                  {/* Prev Button — show only if NOT first image */}
                  {activeIndex > 0 && (
                    <button
                      onClick={handlePrev}
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 p-3 rounded-full text-white shadow-lg z-20"
                    >
                      <FaChevronLeft size={24} />
                    </button>
                  )}

                  {/* Next Button — show only if NOT last image */}
                  {activeIndex < images.length - 1 && (
                    <button
                      onClick={handleNext}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 p-3 rounded-full text-white shadow-lg z-20"
                    >
                      <FaChevronRight size={24} />
                    </button>
                  )}
                </>
              )}

              {/* title overlay */}
              <div className="absolute top-0 left-0 right-0 p-4 text-white bg-gradient-to-b from-black/60 to-transparent z-10">
                <h3 className="text-lg font-semibold">{event.title}</h3>
                <p className="text-sm opacity-80">by {event.author}</p>
              </div>
            </div>

            {/* RIGHT PANEL - details + comments */}
            <div className="flex-1 flex flex-col h-full bg-gray-50 border-t md:border-t-0 md:border-l border-gray-200 min-h-0">
              {/* meta / actions */}
              <div className="p-4 border-b flex-shrink-0">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-gray-900">
                      {event.title}
                    </div>
                    <div className="text-xs text-gray-500">
                      {event.date} • {event.time}
                    </div>
                    {event.location && (
                      <div className="text-xs text-gray-500 mt-1">
                        {event.location}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* details + comments scroll area */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="p-4 space-y-4">
                  {/* description */}
                  {event.description && (
                    <div className="bg-white rounded-xl p-3 border border-gray-100">
                      <h4 className="font-semibold text-sm text-gray-800 mb-2">
                        About this event
                      </h4>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {event.description}
                      </p>
                    </div>
                  )}

                  {/* info cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-white p-3 rounded-xl border border-gray-100">
                      <div className="text-xs text-gray-500">Date</div>
                      <div className="font-medium text-gray-800">
                        {event.date}
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-gray-100">
                      <div className="text-xs text-gray-500">Time</div>
                      <div className="font-medium text-gray-800">
                        {event.time}
                      </div>
                    </div>
                    {event.location && (
                      <div className="bg-white p-3 rounded-xl border border-gray-100 col-span-1 sm:col-span-2">
                        <div className="text-xs text-gray-500">Location</div>
                        <div className="font-medium text-gray-800">
                          {event.location}
                        </div>
                      </div>
                    )}
                    {event.attendeesCount != null && (
                      <div className="bg-white p-3 rounded-xl border border-gray-100">
                        <div className="text-xs text-gray-500">Attendees</div>
                        <div className="font-medium text-gray-800">
                          {event.attendeesCount} people
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* footer: pagination */}
              <div className="p-2 text-center text-xs text-gray-500">
                {images.length > 0 && `${activeIndex + 1} / ${images.length}`}
              </div>
            </div>
          </div>
        </motion.div>

        {/* FULL SCREEN VIEWER */}
        <AnimatePresence>
          {isFullScreen && (
            <motion.div
              className="fixed inset-0 z-[60] flex items-start justify-center bg-black bg-opacity-95 pt-10 pb-24"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFullScreen(false)}
            >
              <div
                className="relative w-full h-full flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                {/* header actions */}
                <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
                  <button
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    className="bg-white/80 hover:bg-white rounded-full p-2 shadow"
                    title="Rotate"
                  >
                    <FaUndoAlt />
                  </button>
                  <button
                    onClick={() => setIsFullScreen(false)}
                    className="bg-white/80 hover:bg-white rounded-full p-2 shadow"
                    title="Close"
                  >
                    <FaTimes />
                  </button>
                </div>

                <div
                  ref={fsCarouselRef}
                  className="w-full h-full flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
                  onScroll={() => {
                    if (!fsCarouselRef.current) return;
                    const idx = Math.round(
                      fsCarouselRef.current.scrollLeft /
                        fsCarouselRef.current.clientWidth
                    );
                    setActiveIndex(idx);
                  }}
                >
                  {images.map((src, i) => (
                    <div
                      key={i}
                      className="w-full h-full flex-shrink-0 snap-center flex items-center justify-center p-6"
                    >
                      <img
                        src={src}
                        alt={`Full ${i + 1}`}
                        className="max-w-full max-h-full object-contain"
                        style={{
                          transform: `rotate(${rotation}deg)`,
                          transition: "transform 0.25s",
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* prev/next */}
                {images.length > 1 && (
                  <>
                    {activeIndex > 0 && (
                      <button
                        onClick={goToPrevFS}
                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 p-3 rounded-full text-white shadow"
                      >
                        <FaChevronLeft size={28} />
                      </button>
                    )}

                    {activeIndex < images.length - 1 && (
                      <button
                        onClick={goToNextFS}
                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 p-3 rounded-full text-white shadow"
                      >
                        <FaChevronRight size={28} />
                      </button>
                    )}
                  </>
                )}

                {/* pagination dots */}
                <div className="absolute bottom-8 w-full flex justify-center gap-2">
                  {images.map((_, idx) => (
                    <span
                      key={idx}
                      className={`w-2 h-2 rounded-full ${
                        idx === activeIndex ? "bg-white" : "bg-gray-500/40"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default EventViewerModal;
