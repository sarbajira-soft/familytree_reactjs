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

  if (loading) return <div className="flex justify-center items-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-t-4 border-primary-600 border-solid"></div></div>;
  if (error) return <div className="text-center text-red-500">{error}</div>;

  return (
    <div className="space-y-8 mt-10 mb-10">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-slate-800">
        <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-6">Family Overview</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 dark:bg-slate-800 p-4 rounded-lg text-center border border-transparent dark:border-slate-700">
            <FaUserFriends className="mx-auto text-blue-500 text-3xl mb-2" />
            <p className="text-sm text-gray-600 dark:text-slate-300">Total Members</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{totalMembers}</p>
          </div>

          <div className="bg-blue-50 dark:bg-slate-800 p-4 rounded-lg text-center border border-transparent dark:border-slate-700">
            <FaMale className="mx-auto text-blue-500 text-3xl mb-2" />
            <p className="text-sm text-gray-600 dark:text-slate-300">Male Members</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{males}</p>
          </div>

          <div className="bg-pink-50 dark:bg-slate-800 p-4 rounded-lg text-center border border-transparent dark:border-slate-700">
            <FaFemale className="mx-auto text-pink-500 text-3xl mb-2" />
            <p className="text-sm text-gray-600 dark:text-slate-300">Female Members</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{females}</p>
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
