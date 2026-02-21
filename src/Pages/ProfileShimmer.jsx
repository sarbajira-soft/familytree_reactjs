import React from "react";

const ProfileShimmer = () => {
    return (
        <div className="mx-auto px-4 pt-4 pb-24 md:px-6 lg:px-8 space-y-8 font-inter shimmer">
            {/* Profile Header Block */}
            <div className="bg-gradient-to-r from-gray-200/50 via-gray-100/50 to-gray-50/50 dark:from-slate-800/50 dark:to-slate-900/50 rounded-2xl shadow-xl p-[1px]">
                <div className="relative rounded-2xl bg-white dark:bg-slate-900 overflow-hidden">
                    {/* Header Banner */}
                    <div className="h-20 md:h-24 bg-gray-200 dark:bg-slate-800 relative overflow-hidden"><div className="shimmer-glow"></div></div>

                    <div className="px-4 pb-4 md:px-8 md:pb-6">
                        <div className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-6 -mt-10 md:-mt-12">
                            {/* Profile Image Avatar */}
                            <div className="flex-shrink-0 z-10">
                                <div className="w-24 h-24 md:w-28 md:h-28 rounded-full border-4 border-white dark:border-slate-900 bg-gray-200 dark:bg-slate-800 shadow-xl relative overflow-hidden">
                                    <div className="shimmer-glow"></div>
                                </div>
                            </div>

                            {/* Profile Details */}
                            <div className="flex-grow w-full md:grid md:grid-cols-[minmax(0,1.7fr)_minmax(0,1.3fr)] md:gap-6 items-start mt-2 md:mt-14">
                                <div className="text-center md:text-left space-y-3 w-full flex flex-col items-center md:items-start">
                                    <div className="w-48 h-8 bg-gray-200 dark:bg-slate-800 rounded relative overflow-hidden"><div className="shimmer-glow"></div></div>
                                    <div className="w-32 h-5 bg-gray-200 dark:bg-slate-800 rounded-full relative overflow-hidden"><div className="shimmer-glow"></div></div>

                                    <div className="w-full max-w-sm space-y-2 mt-2">
                                        <div className="w-full h-3 bg-gray-200 dark:bg-slate-800 rounded relative overflow-hidden"><div className="shimmer-glow"></div></div>
                                        <div className="w-5/6 h-3 bg-gray-200 dark:bg-slate-800 rounded relative overflow-hidden"><div className="shimmer-glow"></div></div>
                                    </div>

                                    <div className="flex gap-4 mt-2">
                                        <div className="w-24 h-4 bg-gray-200 dark:bg-slate-800 rounded relative overflow-hidden"><div className="shimmer-glow"></div></div>
                                        <div className="w-32 h-4 bg-gray-200 dark:bg-slate-800 rounded relative overflow-hidden"><div className="shimmer-glow"></div></div>
                                    </div>
                                </div>

                                {/* Right Side Toggles/Actions */}
                                <div className="mt-4 md:mt-0 flex flex-col items-center md:items-end gap-3 w-full">
                                    <div className="w-32 h-8 bg-gray-200 dark:bg-slate-800 rounded-full relative overflow-hidden"><div className="shimmer-glow"></div></div>
                                    <div className="w-40 h-10 bg-gray-200 dark:bg-slate-800 rounded-xl relative overflow-hidden mt-2"><div className="shimmer-glow"></div></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex justify-center border-b border-gray-200 dark:border-slate-800 mb-6">
                <div className="flex space-x-8">
                    <div className="w-24 h-10 bg-gray-200 dark:bg-slate-800 rounded-t-lg relative overflow-hidden"><div className="shimmer-glow"></div></div>
                    <div className="w-24 h-10 bg-gray-200 dark:bg-slate-800 rounded-t-lg relative overflow-hidden"><div className="shimmer-glow"></div></div>
                </div>
            </div>

            {/* Posts/Gallery Content Block */}
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="w-full h-96 bg-gray-200 dark:bg-slate-800 rounded-2xl relative overflow-hidden"><div className="shimmer-glow"></div></div>
                <div className="w-full h-96 bg-gray-200 dark:bg-slate-800 rounded-2xl relative overflow-hidden"><div className="shimmer-glow"></div></div>
            </div>
        </div>
    );
};

export default ProfileShimmer;
