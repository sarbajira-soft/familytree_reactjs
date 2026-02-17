import React, { useEffect, useState } from "react";

import { getToken } from "../utils/auth";
import { authFetchResponse } from "../utils/authFetch";

const FamilyPreviewModal = ({ familyCode, familyName, onClose }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFamily = async () => {
      setLoading(true);
      try {
        const token = getToken();
        const res = await authFetchResponse(`/family/member/${familyCode}`, {
          method: "GET",
          skipThrow: true,
          headers: {
            accept: "application/json",
          },
        });
        const data = await res.json();
        setMembers(data.data || []);
      } catch {
        setMembers([]);
      }

      setLoading(false);
    };
    if (familyCode) fetchFamily();
  }, [familyCode]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full shadow-lg relative max-h-[90vh] flex flex-col">
        <button
          className="absolute top-2 right-2 text-gray-400 text-2xl z-10"
          onClick={onClose}
        >
          &times;
        </button>
        
        <div className="flex-shrink-0">
          <h2 className="text-2xl font-bold mb-2 text-center">{familyName || 'Family'}</h2>
          <div className="text-gray-500 text-center mb-4">Family Members</div>
        </div>
        
        {loading ? (
          <div className="text-center py-8 flex-1">Loading...</div>
        ) : (
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: '400px' }}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 p-2">
              {members.map((m) => {
                const user = m.user || {};
                const profile = user.userProfile || {};
                // Calculate age from dob if available
                let age = '';
                if (profile.dob) {
                  const dobDate = new Date(profile.dob);
                  const now = new Date();
                  age = now.getFullYear() - dobDate.getFullYear();
                  const mDiff = now.getMonth() - dobDate.getMonth();
                  if (mDiff < 0 || (mDiff === 0 && now.getDate() < dobDate.getDate())) {
                    age--;
                  }
                }
                return (
                  <div key={m.id} className="flex flex-col items-center min-w-[100px]">
                    <img
                      src={user.profileImage || '/public/assets/user.png'}
                      alt={profile.firstName}
                      className="w-20 h-20 rounded-full object-cover border mb-2"
                    />
                    <div className="text-sm font-semibold text-gray-700 text-center">
                      {profile.firstName}
                    </div>
                    {profile.gender && (
                      <div className="text-xs text-gray-500 capitalize">{profile.gender}</div>
                    )}
                    {age && (
                      <div className="text-xs text-gray-500">Age: {age}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        <div className="mt-6 text-center flex-shrink-0">
          <button
            className="bg-primary-500 text-white px-6 py-2 rounded mr-4"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default FamilyPreviewModal;