import React from "react";

const EventsShimmer = () => {
    const shimmerCards = Array(8).fill(null);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-16 shimmer">
            <div className="max-w-7xl mx-auto px-4 py-8 md:px-6 lg:px-8 space-y-5 pt-4">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div className="hidden sm:flex sm:flex-col w-full sm:w-auto">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 dark:bg-slate-800 rounded-lg relative overflow-hidden"><div className="shimmer-glow"></div></div>
                            <div className="w-48 h-10 bg-gray-200 dark:bg-slate-800 rounded relative overflow-hidden"><div className="shimmer-glow"></div></div>
                        </div>
                        <div className="w-64 h-5 bg-gray-200 dark:bg-slate-800 rounded relative overflow-hidden"><div className="shimmer-glow"></div></div>
                    </div>

                    <div className="w-full sm:w-48 h-12 sm:h-14 bg-gray-200 dark:bg-slate-800 rounded-xl relative overflow-hidden"><div className="shimmer-glow"></div></div>
                </div>

                {/* Filter Tabs */}
                <div className="flex justify-center w-full mt-1">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-md p-2 border border-gray-100 dark:border-slate-800 w-full h-16 sm:h-20 relative overflow-hidden">
                        <div className="shimmer-glow"></div>
                    </div>
                </div>

                {/* Events Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-4">
                    {shimmerCards.map((_, idx) => (
                        <div
                            key={idx}
                            className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-800 overflow-hidden"
                        >
                            <div className="h-40 bg-gray-200 dark:bg-slate-800 relative overflow-hidden"><div className="shimmer-glow"></div></div>
                            <div className="p-3 flex-1 flex flex-col space-y-3">
                                <div className="h-5 bg-gray-200 dark:bg-slate-800 rounded w-3/4 relative overflow-hidden"><div className="shimmer-glow"></div></div>

                                <div className="space-y-2 min-h-[64px] pt-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 bg-gray-200 dark:bg-slate-800 rounded flex-shrink-0 relative overflow-hidden"><div className="shimmer-glow"></div></div>
                                        <div className="h-4 bg-gray-100 dark:bg-slate-800 rounded w-1/2 relative overflow-hidden"><div className="shimmer-glow"></div></div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 bg-gray-200 dark:bg-slate-800 rounded flex-shrink-0 relative overflow-hidden"><div className="shimmer-glow"></div></div>
                                        <div className="h-4 bg-gray-100 dark:bg-slate-800 rounded w-2/3 relative overflow-hidden"><div className="shimmer-glow"></div></div>
                                    </div>
                                </div>

                                <div className="pt-2 mt-auto border-t border-gray-100 dark:border-slate-800 flex justify-between items-center">
                                    <div className="w-8 h-4 bg-gray-200 dark:bg-slate-800 rounded relative overflow-hidden"><div className="shimmer-glow"></div></div>
                                    <div className="w-12 h-4 bg-gray-200 dark:bg-slate-800 rounded relative overflow-hidden"><div className="shimmer-glow"></div></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default EventsShimmer;
