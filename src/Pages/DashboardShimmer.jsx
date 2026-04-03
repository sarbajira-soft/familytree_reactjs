import React from "react";

const DashboardShimmer = () => {
  const shimmerCard = Array(4).fill(null);
  const shimmerButtons = Array(3).fill(null);




  
  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-5 py-6 pt-3 space-y-7 shimmer">
      {/* Cards Section */}
      <div className="hidden lg:grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
        {shimmerCard.map((_, i) => (
          <div
            key={i}
            className="bg-gray-100 rounded-xl p-3 sm:p-5 flex items-center gap-3 overflow-hidden relative"
          >
            <div className="w-12 h-12 bg-gray-300 rounded-lg relative overflow-hidden">
              <div className="shimmer-glow"></div>
            </div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-300 rounded w-3/4 relative overflow-hidden">
                <div className="shimmer-glow"></div>
              </div>
              <div className="h-3 bg-gray-300 rounded w-1/2 relative overflow-hidden">
                <div className="shimmer-glow"></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions Section */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {shimmerButtons.map((_, i) => (
          <div
            key={i}
            className="h-10 sm:h-12 bg-gray-200 rounded-md sm:rounded-lg relative overflow-hidden"
          >
            <div className="shimmer-glow"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardShimmer;
