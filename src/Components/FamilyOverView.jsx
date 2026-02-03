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
      <div className="flex justify-center items-center py-6">
        <div className="animate-spin rounded-full h-8 w-8 border-t-4 border-primary-600 border-solid" />
      </div>
    );

  if (error)
    return <div className="text-center text-xs text-red-500 py-2">{error}</div>;

  return (
    <div className="mt-4 mb-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-4 sm:p-6 border border-gray-100 dark:border-slate-800">
        <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-slate-100 mb-4 sm:mb-6">
          Family Overview
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-blue-50 dark:bg-slate-800 px-3 py-3 rounded-xl text-center border border-transparent dark:border-slate-700">
            <FaUserFriends className="mx-auto text-blue-500 text-2xl mb-1.5" />
            <p className="text-[11px] sm:text-xs text-gray-600 dark:text-slate-300">
              Total Members
            </p>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-slate-100">
              {totalMembers}
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-slate-800 px-3 py-3 rounded-xl text-center border border-transparent dark:border-slate-700">
            <FaMale className="mx-auto text-blue-500 text-2xl mb-1.5" />
            <p className="text-[11px] sm:text-xs text-gray-600 dark:text-slate-300">
              Male Members
            </p>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-slate-100">
              {males}
            </p>
          </div>

          <div className="bg-pink-50 dark:bg-slate-800 px-3 py-3 rounded-xl text-center border border-transparent dark:border-slate-700 col-span-2 sm:col-span-1">
            <FaFemale className="mx-auto text-pink-500 text-2xl mb-1.5" />
            <p className="text-[11px] sm:text-xs text-gray-600 dark:text-slate-300">
              Female Members
            </p>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-slate-100">
              {females}
            </p>
          </div>

          {/* <div className="bg-purple-50 p-4 rounded-lg text-center">
            <FaBirthdayCake className="mx-auto text-purple-500 text-3xl mb-2" />
            <p className="text-sm text-gray-600">Average Age</p>
            <p className="text-2xl font-bold text-gray-900">{averageAge}</p>
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default FamilyOverView;
