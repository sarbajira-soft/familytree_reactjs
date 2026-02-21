import React, { useEffect, useState } from 'react';
import {
  FaMale,
  FaFemale,
  FaBirthdayCake,
  FaUserFriends,
} from 'react-icons/fa';

const FamilyOverView = ({ familyCode, token }) => {
  const [totalMembers, setTotalMembers] = useState(0);
  const [males, setMales] = useState(0);
  const [females, setFemales] = useState(0);
  const [averageAge, setAverageAge] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!familyCode || !token) return;

    const fetchStats = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/family/member/${familyCode}/stats`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: '*/*',
            },
          }
        );
        if (!res.ok) throw new Error('Failed to fetch stats');
        const json = await res.json();
        const stats = json.data;
        setTotalMembers(stats.totalMembers);
        setMales(stats.males);
        setFemales(stats.females);
        setAverageAge(stats.averageAge);
        setError(null);
      } catch (err) {
        console.error(err);
        setError('Failed to load family stats');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [familyCode, token]);

  if (loading)
    return (
      <div className="mt-4 mb-8 shimmer">
        <div className="bg-white/80 dark:bg-slate-900/80 rounded-[2rem] p-6 sm:p-8 border border-white dark:border-slate-800">
          <div className="w-48 h-8 bg-gray-200 dark:bg-slate-800 rounded mb-2 overflow-hidden relative"><div className="shimmer-glow"></div></div>
          <div className="w-64 h-4 bg-gray-200 dark:bg-slate-800 rounded mb-8 overflow-hidden relative"><div className="shimmer-glow"></div></div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="col-span-2 sm:col-span-1 h-32 bg-gray-100 dark:bg-slate-800 rounded-[1.5rem] overflow-hidden relative"><div className="shimmer-glow"></div></div>
            <div className="h-32 bg-gray-100 dark:bg-slate-800 rounded-[1.5rem] overflow-hidden relative"><div className="shimmer-glow"></div></div>
            <div className="h-32 bg-gray-100 dark:bg-slate-800 rounded-[1.5rem] col-span-1 sm:col-span-1 overflow-hidden relative"><div className="shimmer-glow"></div></div>
          </div>
        </div>
      </div>
    );

  if (error)
    return <div className="text-center py-4 px-6 bg-red-50 text-red-500 font-bold rounded-2xl shadow-sm border border-red-100 animate-shake">{error}</div>;

  return (
    <div className="mt-4 mb-8">
      <div className="relative overflow-visible bg-white/80 dark:bg-slate-900/80 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] p-6 sm:p-8 border border-white dark:border-slate-800 backdrop-blur-xl">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary-500"></span>
              </span>
              Family Stats
            </h2>
            <p className="mt-1 text-sm font-medium text-gray-500 dark:text-slate-400">
              A quick look at your growing family
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 relative z-10">

          {/* Total Members Card */}
          <div className="group relative bg-indigo-50/50 dark:bg-indigo-900/20 rounded-[1.5rem] p-5 sm:p-6 col-span-2 sm:col-span-1 border border-indigo-100/50 dark:border-indigo-800/30 overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_15px_30px_-5px_rgba(99,102,241,0.2)]">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-gradient-to-br from-indigo-100 to-indigo-50 dark:from-indigo-800/40 dark:to-indigo-900/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>

            <div className="relative z-10 flex flex-col h-full justify-between">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white group-hover:rotate-12 transition-all duration-300">
                  <FaUserFriends className="text-xl" />
                </div>
                <p className="text-xs sm:text-sm font-bold text-gray-600 dark:text-slate-300 uppercase tracking-widest">
                  Total
                </p>
              </div>
              <p className="text-4xl sm:text-5xl font-black text-indigo-950 dark:text-indigo-100 tracking-tight flex items-baseline gap-1 group-hover:scale-110 origin-left transition-transform duration-300">
                {totalMembers}
                <span className="text-sm font-bold text-indigo-400">members</span>
              </p>
            </div>
          </div>

          {/* Males Card */}
          <div className="group relative bg-sky-50/50 dark:bg-sky-900/20 rounded-[1.5rem] p-5 sm:p-6 border border-sky-100/50 dark:border-sky-800/30 overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_15px_30px_-5px_rgba(14,165,233,0.2)]">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-gradient-to-br from-sky-100 to-sky-50 dark:from-sky-800/40 dark:to-sky-900/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>

            <div className="relative z-10 flex flex-col h-full justify-between">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-sky-500 group-hover:bg-sky-500 group-hover:text-white group-hover:-rotate-12 transition-all duration-300">
                  <FaMale className="text-xl" />
                </div>
                <p className="text-xs sm:text-sm font-bold text-gray-600 dark:text-slate-300 uppercase tracking-widest">
                  Males
                </p>
              </div>
              <p className="text-4xl sm:text-5xl font-black text-sky-950 dark:text-sky-100 tracking-tight group-hover:scale-110 origin-left transition-transform duration-300">
                {males}
              </p>
            </div>
          </div>

          {/* Females Card */}
          <div className="group relative bg-pink-50/50 dark:bg-pink-900/20 rounded-[1.5rem] p-5 sm:p-6 col-span-1 sm:col-span-1 border border-pink-100/50 dark:border-pink-800/30 overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_15px_30px_-5px_rgba(236,72,153,0.2)]">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-gradient-to-br from-pink-100 to-pink-50 dark:from-pink-800/40 dark:to-pink-900/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>

            <div className="relative z-10 flex flex-col h-full justify-between">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-pink-500 group-hover:bg-pink-500 group-hover:text-white group-hover:rotate-12 transition-all duration-300">
                  <FaFemale className="text-xl" />
                </div>
                <p className="text-xs sm:text-sm font-bold text-gray-600 dark:text-slate-300 uppercase tracking-widest">
                  Females
                </p>
              </div>
              <p className="text-4xl sm:text-5xl font-black text-pink-950 dark:text-pink-100 tracking-tight group-hover:scale-110 origin-left transition-transform duration-300">
                {females}
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default FamilyOverView;
