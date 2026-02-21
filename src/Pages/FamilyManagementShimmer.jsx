import React from "react";

const FamilyManagementShimmer = () => {
    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50/50 to-white dark:from-slate-950 dark:to-slate-900 pt-4 pb-24">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
                {/* Header Shimmer */}
                <div className="md:hidden flex items-center justify-between mb-6 animate-pulse">
                    <div className="w-8 h-8 bg-gray-200 dark:bg-slate-800 rounded-lg"></div>
                    <div className="w-32 h-6 bg-gray-200 dark:bg-slate-800 rounded"></div>
                    <div className="w-8 h-8 bg-gray-200 dark:bg-slate-800 rounded-lg"></div>
                </div>

                {/* Dashboard Grid Layout Shimmer */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 shimmer pt-4">

                    {/* Left Column */}
                    <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">

                        {/* Family Stats Shimmer */}
                        <div className="bg-white/80 dark:bg-slate-900/80 rounded-[2rem] p-6 sm:p-8 border border-white dark:border-slate-800">
                            <div className="w-48 h-8 bg-gray-200 dark:bg-slate-800 rounded mb-2 overflow-hidden relative"><div className="shimmer-glow"></div></div>
                            <div className="w-64 h-4 bg-gray-200 dark:bg-slate-800 rounded mb-8 overflow-hidden relative"><div className="shimmer-glow"></div></div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
                                <div className="col-span-2 sm:col-span-1 h-32 bg-gray-100 dark:bg-slate-800 rounded-[1.5rem] overflow-hidden relative"><div className="shimmer-glow"></div></div>
                                <div className="h-32 bg-gray-100 dark:bg-slate-800 rounded-[1.5rem] overflow-hidden relative"><div className="shimmer-glow"></div></div>
                                <div className="h-32 bg-gray-100 dark:bg-slate-800 rounded-[1.5rem] col-span-1 sm:col-span-1 overflow-hidden relative"><div className="shimmer-glow"></div></div>
                            </div>
                        </div>

                        {/* Directory Shimmer */}
                        <div className="bg-white/80 dark:bg-slate-900/80 rounded-[2rem] p-6 sm:p-8 border border-white dark:border-slate-800 mt-2 lg:-mt-2">
                            <div className="flex justify-between mb-2">
                                <div className="w-32 h-8 bg-gray-200 dark:bg-slate-800 rounded overflow-hidden relative"><div className="shimmer-glow"></div></div>
                                <div className="w-24 h-8 bg-gray-200 dark:bg-slate-800 rounded-xl overflow-hidden relative"><div className="shimmer-glow"></div></div>
                            </div>
                            <div className="w-48 h-4 bg-gray-200 dark:bg-slate-800 rounded mb-6 overflow-hidden relative"><div className="shimmer-glow"></div></div>

                            <div className="flex -space-x-4 mb-6">
                                {[1, 2, 3].map(i => <div key={i} className="w-14 h-14 rounded-full bg-gray-200 dark:bg-slate-800 border-4 border-white overflow-hidden relative"><div className="shimmer-glow"></div></div>)}
                            </div>

                            <div className="space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-16 bg-gray-100 dark:bg-slate-800 rounded-2xl overflow-hidden relative"><div className="shimmer-glow"></div></div>
                                ))}
                            </div>
                        </div>

                    </div>

                    {/* Right Column */}
                    <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6 lg:mt-6 mt-0">

                        {/* Invite Links Shimmer */}
                        <div className="bg-gray-100 dark:bg-slate-800 rounded-[2rem] p-6 sm:p-8 h-80 overflow-hidden relative"><div className="shimmer-glow"></div></div>

                        {/* Pending Requests Shimmer */}
                        <div className="bg-white/80 dark:bg-slate-900/80 rounded-[2rem] p-6 sm:p-8 border border-white dark:border-slate-800 mt-2">
                            <div className="w-48 h-8 bg-gray-200 dark:bg-slate-800 rounded mb-2 overflow-hidden relative"><div className="shimmer-glow"></div></div>
                            <div className="w-32 h-4 bg-gray-200 dark:bg-slate-800 rounded mb-6 overflow-hidden relative"><div className="shimmer-glow"></div></div>

                            <div className="space-y-3 mb-4">
                                <div className="h-16 bg-gray-100 dark:bg-slate-800 rounded-2xl overflow-hidden relative"><div className="shimmer-glow"></div></div>
                            </div>

                            <div className="h-10 w-full bg-gray-200 dark:bg-slate-800 rounded-xl overflow-hidden relative"><div className="shimmer-glow"></div></div>
                        </div>

                    </div>

                </div>
            </div>
        </div>
    );
};

export default FamilyManagementShimmer;
