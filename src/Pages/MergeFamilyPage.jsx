import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useMergeRequests } from '../hooks/useApi';
import {
  searchMergeFamilies,
  createMergeRequest,
  acceptMergeRequest,
  rejectMergeRequest,
  getFamilyPreviewForAnchor,
} from '../utils/familyMergeApi';
import { useUser } from '../Contexts/UserContext';

const MergeFamilyPage = () => {
  const navigate = useNavigate();
  const { userInfo } = useUser();

  const [familyCode, setFamilyCode] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const [anchorModalOpen, setAnchorModalOpen] = useState(false);
  const [anchorLoading, setAnchorLoading] = useState(false);
  const [anchorPrimaryFamilyCode, setAnchorPrimaryFamilyCode] = useState('');
  const [anchorPrimaryMembers, setAnchorPrimaryMembers] = useState([]);
  const [anchorSelectedPrimaryId, setAnchorSelectedPrimaryId] = useState('');
  const [anchorRelation, setAnchorRelation] = useState('');

  const [statusFilter, setStatusFilter] = useState(''); // '', 'open', 'accepted', 'rejected', 'merged'

  const {
    data: requestsResponse,
    isLoading: requestsLoading,
    refetch: refetchRequests,
  } = useMergeRequests(statusFilter || undefined, true);

  const requests = Array.isArray(requestsResponse?.data)
    ? requestsResponse.data
    : [];

  const handleSearch = async (e) => {
    e.preventDefault();
    setSearchError('');
    setSearchLoading(true);
    try {
      const res = await searchMergeFamilies({ familyCode: familyCode.trim(), adminPhone: adminPhone.trim() });
      const data = Array.isArray(res?.data) ? res.data : [];
      setSearchResults(data);
    } catch (err) {
      console.error(err);
      setSearchError(err.message || 'Failed to search families');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const openAnchorModal = async (targetFamilyCode) => {
    if (!userInfo?.familyCode) {
      await Swal.fire({
        icon: 'error',
        title: 'Missing Family Code',
        text: 'Your family code is missing; cannot determine your current family.',
      });
      return;
    }
    if (targetFamilyCode === userInfo.familyCode) {
      await Swal.fire({
        icon: 'warning',
        title: 'Invalid Merge',
        text: 'You cannot create a merge request with the same family as both primary and secondary.',
      });
      return;
    }
    setAnchorPrimaryFamilyCode(targetFamilyCode);
    setAnchorSelectedPrimaryId('');
    setAnchorRelation('');
    setAnchorLoading(true);
    try {
      const res = await getFamilyPreviewForAnchor(targetFamilyCode);
      const data = Array.isArray(res?.data) ? res.data : [];
      setAnchorPrimaryMembers(data);
      setAnchorModalOpen(true);
    } catch (err) {
      console.error(err);
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Load Family Members',
        text: err?.message || 'Failed to load primary family members for anchor',
      });
    } finally {
      setAnchorLoading(false);
    }
  };

  const handleCreateRequest = async () => {
    if (!userInfo?.familyCode || !anchorPrimaryFamilyCode) return;
    const anchorConfig =
      anchorSelectedPrimaryId && anchorRelation
        ? {
            primaryPersonId: Number(anchorSelectedPrimaryId),
            relationToSecondaryAdmin: anchorRelation,
          }
        : null;
    try {
      await createMergeRequest(anchorPrimaryFamilyCode, userInfo.familyCode, anchorConfig);
      await Swal.fire({
        icon: 'success',
        title: 'Merge Request Sent',
        text: `Merge request sent to primary family ${anchorPrimaryFamilyCode}`,
      });
      setAnchorModalOpen(false);
      refetchRequests();
    } catch (err) {
      console.error(err);
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Create Request',
        text: err?.message || 'Failed to create merge request',
      });
    }
  };

  const handleAccept = async (requestId) => {
    try {
      await acceptMergeRequest(requestId);
      refetchRequests();
    } catch (err) {
      console.error(err);
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Accept Request',
        text: err?.message || 'Failed to accept merge request',
      });
    }
  };

  const handleReject = async (requestId) => {
    try {
      await rejectMergeRequest(requestId);
      refetchRequests();
    } catch (err) {
      console.error(err);
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Reject Request',
        text: err?.message || 'Failed to reject merge request',
      });
    }
  };

  const statusClasses = (status) => {
    switch (status) {
      case 'open':
        return 'bg-yellow-100 text-yellow-800';
      case 'accepted':
        return 'bg-blue-100 text-blue-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'merged':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Merge Family Tree</h1>
          <p className="text-sm text-gray-500">
            Your current family (will be secondary/requestor in merge):{' '}
            <span className="font-semibold">{userInfo?.familyCode || 'Unknown'}</span>
          </p>
        </div>
        <button
          className="px-3  py-2 bg-primary-600 text-sm border rounded-md text-white hover:bg-primary-700"
          onClick={() => navigate('/family-tree')}
        >
          Back to Family Tree
        </button>
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-lg shadow mb-8 p-4 md:p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">Search Families to Merge</h2>
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Family Code</label>
            <input
              type="text"
              value={familyCode}
              onChange={(e) => setFamilyCode(e.target.value)}
              placeholder="Search by family code"
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admin Phone</label>
            <input
              type="text"
              value={adminPhone}
              onChange={(e) => setAdminPhone(e.target.value)}
              placeholder="Search by admin phone"
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={searchLoading}
              className="px-4 py-2 bg-primary-500 text-white text-sm rounded-md hover:bg-primary-700 disabled:opacity-60"
            >
              {searchLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>
        {searchError && (
          <p className="mt-2 text-sm text-red-600">{searchError}</p>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-6 overflow-x-auto">
            <h3 className="text-sm font-semibold mb-2 text-gray-700">Search Results</h3>
            <table className="min-w-full text-xs md:text-sm border">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left border">Family Code</th>
                  <th className="px-3 py-2 text-left border">Family Name</th>
                  <th className="px-3 py-2 text-left border">Admins</th>
                  <th className="px-3 py-2 text-center border">Action</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((fam) => {
                  const isCurrentFamily = userInfo?.familyCode && fam.familyCode === userInfo.familyCode;
                  return (
                  <tr key={fam.familyCode} className="hover:bg-gray-50">
                    <td className="px-3 py-2 border font-mono text-xs md:text-sm">{fam.familyCode}</td>
                    <td className="px-3 py-2 border">{fam.familyName || '-'}</td>
                    <td className="px-3 py-2 border">
                      {Array.isArray(fam.admins) && fam.admins.length > 0 ? (
                        <div className="space-y-1">
                          {fam.admins.map((adm) => (
                            <div key={adm.userId} className="text-xs">
                              <span className="font-semibold">{adm.fullName || 'Admin'}</span>
                              {adm.mobile && <span className="text-gray-500 ml-1">({adm.mobile})</span>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">No admins data</span>
                      )}
                    </td>
                    <td className="px-3 py-2 border text-center">
                      <button
                        className="px-3 py-1 text-xs md:text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-60"
                        disabled={isCurrentFamily}
                        onClick={() => !isCurrentFamily && openAnchorModal(fam.familyCode)}
                      >
                        {isCurrentFamily ? 'Current Family' : 'Send Merge Request'}
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Merge Requests List */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Merge Requests</h2>
          <div className="flex items-center gap-2 text-xs md:text-sm">
            <span className="text-gray-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded-md px-2 py-1 text-xs md:text-sm"
            >
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="merged">Merged</option>
            </select>
          </div>
        </div>

        {requestsLoading ? (
          <p className="text-sm text-gray-500">Loading merge requests...</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-gray-400">No merge requests found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs md:text-sm border">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left border">ID</th>
                  <th className="px-3 py-2 text-left border">Primary Family</th>
                  <th className="px-3 py-2 text-left border">Secondary Family</th>
                  <th className="px-3 py-2 text-left border">Status</th>
                  <th className="px-3 py-2 text-left border">Created At</th>
                  <th className="px-3 py-2 text-center border">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => {
                  const primaryStatus = req.primaryStatus || req.status || '';
                  const isPrimarySide = userInfo?.familyCode && req.primaryFamilyCode === userInfo.familyCode;
                  // Primary admin can always view. Secondary admin can only view once request is accepted/merged.
                  const canView =
                    isPrimarySide || primaryStatus === 'accepted' || primaryStatus === 'merged';
                  return (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 border">{req.id}</td>
                    <td className="px-3 py-2 border font-mono text-xs md:text-sm">{req.primaryFamilyCode}</td>
                    <td className="px-3 py-2 border font-mono text-xs md:text-sm">{req.secondaryFamilyCode}</td>
                    <td className="px-3 py-2 border">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${statusClasses(primaryStatus)}`}>
                        {primaryStatus || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2 border text-xs">
                      {req.createdAt ? new Date(req.createdAt).toLocaleString() : '-'}
                    </td>
                    <td className="px-3 py-2 border text-center">
                      <div className="flex items-center justify-center gap-1 md:gap-2">
                        {primaryStatus === 'open' && isPrimarySide && (
                          <>
                            <button
                              className="px-2 py-1 text-[11px] md:text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700"
                              onClick={() => handleAccept(req.id)}
                            >
                              Accept
                            </button>
                            <button
                              className="px-2 py-1 text-[11px] md:text-xs bg-red-600 text-white rounded-md hover:bg-red-700"
                              onClick={() => handleReject(req.id)}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        <button
                          className="px-2 py-1 text-[11px] md:text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-60"
                          disabled={!canView}
                          onClick={() => {
                            if (canView) navigate(`/merge-family/${req.id}`);
                          }}
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {anchorModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg mx-4 p-4 md:p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Confirm Relationship Anchor</h2>
            <p className="text-xs md:text-sm text-gray-600 mb-3">
              You are requesting to merge your family ({userInfo?.familyCode}) into primary family{' '}
              <span className="font-semibold">{anchorPrimaryFamilyCode}</span>. Optionally choose a
              specific person in the primary family and how they relate to you. This will help connect the
              trees more accurately. You can also skip this step.
            </p>

            {anchorLoading ? (
              <p className="text-xs text-gray-500 mb-2">Loading primary family members...</p>
            ) : (
              <>
                <div className="mb-3">
                  <label className="block text-[11px] md:text-xs font-semibold text-gray-700 mb-1">
                    Primary family member
                  </label>
                  <select
                    className="w-full border rounded-md px-2 py-1 text-[11px] md:text-xs"
                    value={anchorSelectedPrimaryId}
                    onChange={(e) => setAnchorSelectedPrimaryId(e.target.value)}
                  >
                    <option value="">(None selected)</option>
                    {anchorPrimaryMembers
                      .filter((p) => p && p.personId != null)
                      .map((p) => (
                        <option key={p.personId} value={p.personId}>
                          {p.name || `Person ${p.personId}`} (Gen: {p.generation ?? '-'})
                        </option>
                      ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="block text-[11px] md:text-xs font-semibold text-gray-700 mb-1">
                    Relationship of this primary member to you (secondary admin)
                  </label>
                  <select
                    className="w-full border rounded-md px-2 py-1 text-[11px] md:text-xs"
                    value={anchorRelation}
                    onChange={(e) => setAnchorRelation(e.target.value)}
                  >
                    <option value="">(No anchor / unsure)</option>
                    <option value="PARENT">This person is my parent</option>
                    <option value="CHILD">This person is my child</option>
                    <option value="SAME_GEN">Same generation as me (sibling/cousin)</option>
                  </select>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                className="px-3 py-1.5 text-xs md:text-sm border rounded-md text-gray-600 hover:bg-gray-50"
                onClick={() => setAnchorModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-xs md:text-sm bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                disabled={anchorLoading}
                onClick={async () => {
                  // Skip anchor, just send merge request
                  if (!userInfo?.familyCode || !anchorPrimaryFamilyCode) return;
                  try {
                    await createMergeRequest(anchorPrimaryFamilyCode, userInfo.familyCode, null);
                    await Swal.fire({
                      icon: 'success',
                      title: 'Merge Request Sent',
                      text: `Merge request sent to primary family ${anchorPrimaryFamilyCode}`,
                    });
                    setAnchorModalOpen(false);
                    refetchRequests();
                  } catch (err) {
                    console.error(err);
                    await Swal.fire({
                      icon: 'error',
                      title: 'Failed to Create Request',
                      text: err?.message || 'Failed to create merge request',
                    });
                  }
                }}
              >
                Skip Anchor & Send
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-xs md:text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-60"
                disabled={anchorLoading}
                onClick={handleCreateRequest}
              >
                Confirm Anchor & Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MergeFamilyPage;
