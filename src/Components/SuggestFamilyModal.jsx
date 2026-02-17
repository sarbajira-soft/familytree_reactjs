import React, { useState } from "react";
import { useNavigate } from 'react-router-dom';
import FamilyPreviewModal from "./FamilyPreviewModal";
import {jwtDecode} from 'jwt-decode';
import Swal from 'sweetalert2';

import { getToken } from '../utils/auth';
import { authFetchResponse } from '../utils/authFetch';

// Helper to fetch user's first name from profile
async function fetchUserFirstName(userId, accessToken) {
  const res = await authFetchResponse(`/user/profile/${userId}`, {
    method: 'GET',
    skipThrow: true,
    headers: {
      accept: 'application/json',
    },
  });
  const data = await res.json();
  return data?.data?.userProfile?.firstName || '';
}

const SuggestFamilyModal = ({
  families,
  loading,
  onClose,
  onCreateNew,
  onJoinFamily,
}) => {
  const navigate = useNavigate();
  const [previewFamilyCode, setPreviewFamilyCode] = useState(null);

  // Handler to send join request notification to family admins
  const handleJoinFamily = async (familyCode) => {
    try {
      const accessToken = getToken();
      let userId = null;
      let firstName = '';
      if (accessToken) {
        const decoded = jwtDecode(accessToken);
        userId = decoded?.id || decoded?.userId || decoded?.sub;
        // Fetch the user's first name from their profile
        firstName = await fetchUserFirstName(userId, accessToken);
      }
      if (!userId) throw new Error('User ID not found');
      // 1. Get admin user IDs for the family
      const adminRes = await authFetchResponse(
        `/notifications/${familyCode}/admins`,
        {
          method: 'GET',
          skipThrow: true,
          headers: {
            accept: 'application/json',
          },
        }
      );
      const adminData = await adminRes.json();
      const adminIds = adminData.data || [];
      // 2. Send notification to admins
      await authFetchResponse(`/notifications`, {
        method: 'POST',
        skipThrow: true,
        body: JSON.stringify({
          type: 'FAMILY_JOIN_REQUEST',
          title: 'New Family Join Request',
          message: `${firstName} has requested to join your family using the code ${familyCode}.`,
          familyCode,
          referenceId: userId,
          userIds: adminIds,
        }),
      });
      await Swal.fire({
        icon: 'success',
        title: 'Join Request Sent',
        text: 'Your request was sent to the family admins.',
        confirmButtonColor: '#3f982c'
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Failed to send join request', text: 'Please try again.' });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full shadow-lg relative">
        <button
          className="absolute top-2 right-2 text-gray-400 text-2xl"
          onClick={onClose}
        >
          &times;
        </button>
        <h2 className="text-2xl font-bold mb-4">Suggested Families</h2>
        {loading ? (
          <div>Loading...</div>
        ) : families.length === 0 ? (
          <div>
            <div className="mb-6 text-gray-500">No matching families found.</div>
            <div className="text-center">
              <button
                className="bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold shadow hover:bg-primary-700 transition"
                onClick={onCreateNew}
              >
                Create a New Family
              </button>
              <div className="text-xs text-gray-500 mt-2">
                Didn’t find your family? You can create your own!
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {families.map((fam) => (
              <div
                key={fam.familyCode}
                className="border rounded-lg p-4 flex items-center gap-4"
              >
                <img
                  src={
                    fam.members.find((m) => m.user?.profileImage)?.user
                      ?.profileImage ||
                    "/public/assets/family-default.png"
                  }
                  alt={fam.familyName}
                  className="w-16 h-16 rounded-full object-cover border"
                />
                <div className="flex-1">
                  <div className="font-bold text-lg">{fam.familyName}</div>
                  <div className="text-sm text-gray-500">
                    Code: {fam.familyCode}
                  </div>
                  <div className="text-xs text-gray-400">
                    Members: {fam.members
                      .map((m) => m.user?.userProfile?.firstName)
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    className="bg-primary-500 text-white px-4 py-2 rounded"
                    onClick={() => handleJoinFamily(fam.familyCode)}
                  >
                    Join
                  </button>
                  <button
                    className="bg-gray-200 text-gray-800 px-4 py-2 rounded border border-gray-300 hover:bg-gray-300"
                    onClick={() => setPreviewFamilyCode(fam.familyCode)}
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && families.length > 0 && (
          <div className="mt-8 text-center">
            <button
              className="bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold shadow hover:bg-primary-700 transition"
              onClick={onCreateNew}
            >
              Create a New Family
            </button>
            <div className="text-xs text-gray-500 mt-2">
              Didn’t find your family? You can create your own!
            </div>
          </div>
        )}
        {previewFamilyCode && (
          <FamilyPreviewModal
            familyCode={previewFamilyCode}
            familyName={families.find(f => f.familyCode === previewFamilyCode)?.familyName}
            onClose={() => setPreviewFamilyCode(null)}
          />
        )}
      </div>
    </div>
  );
};

export default SuggestFamilyModal; 