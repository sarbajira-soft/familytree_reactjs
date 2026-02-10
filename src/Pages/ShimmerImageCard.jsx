import React from "react";

const ShimmerImageCard = ({ width = 340, height = 190 }) => (
  <div
    className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden"
    style={{ width }}
  >
    <div
      className="w-full bg-gray-200 relative overflow-hidden"
      style={{ height }}
    >
      <div className="shimmer-glow"></div>
    </div>
    <div className="p-4 space-y-2">
      <div className="h-3 w-3/4 bg-gray-200 rounded relative overflow-hidden">
        <div className="shimmer-glow"></div>
      </div>
      <div className="h-3 w-1/2 bg-gray-200 rounded relative overflow-hidden">
        <div className="shimmer-glow"></div>
      </div>
    </div>
  </div>
);


export default ShimmerImageCard;
