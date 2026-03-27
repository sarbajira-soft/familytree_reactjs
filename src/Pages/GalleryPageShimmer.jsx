// DashboardCardShimmer.jsx
import React from "react";
const shimmerCards = Array(4).fill(null);

const GalleryPageShimmer = () => (
    
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-7">
    {shimmerCards.map((_, i) => (
      <div
        key={i}
        className="bg-gray-100 rounded-2xl shadow p-0 flex flex-col overflow-hidden relative min-h-[340px] w-full"
      >
        {/* Image shimmer */}
        <div className="w-full h-48 bg-gray-300 relative overflow-hidden">
          <div className="shimmer-glow"></div>
        </div>
        <div className="p-5 flex flex-col gap-3">
          {/* Title shimmer */}
          <div className="h-6 w-1/2 bg-gray-300 rounded mb-2 relative overflow-hidden">
            <div className="shimmer-glow"></div>
          </div>
          {/* Subtitle shimmer */}
          <div className="h-4 w-1/4 bg-gray-300 rounded mb-1 relative overflow-hidden">
            <div className="shimmer-glow"></div>
          </div>
          {/* Status shimmer */}
          <div className="h-4 w-20 bg-gray-300 rounded mb-1 relative overflow-hidden">
            <div className="shimmer-glow"></div>
          </div>
        </div>
        {/* Bottom glow for action button */}
        <div className="h-5 w-16 bg-gray-300 rounded-full mx-5 mb-4 relative overflow-hidden">
          <div className="shimmer-glow"></div>
        </div>
      </div>
    ))}
  </div>
);
export default GalleryPageShimmer;
