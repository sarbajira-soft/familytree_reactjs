import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiClock, FiArrowLeft } from 'react-icons/fi';
import { useUser } from '../Contexts/UserContext';
import RelationshipCalculator from '../utils/relationshipCalculator';

const Modal = ({ children, onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-40 z-50 p-4 overflow-y-auto">
    <div className="min-h-full flex items-start justify-center">
      <div className="bg-white rounded-2xl p-8 max-w-3xl w-full shadow-2xl relative max-h-[calc(100vh-2rem)] overflow-y-auto flex flex-col">
        <button className="absolute top-2 right-2 text-gray-400 text-2xl z-10" onClick={onClose}>&times;</button>
        {children}
      </div>
    </div>
  </div>
);

const SuggestionApproving = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [familyCode, setFamilyCode] = useState(null);
  const { userInfo: ctxUserInfo } = useUser();
  const accessToken = localStorage.getItem('access_token');
  const navigate = useNavigate();

  const DEFAULT_AVATAR = '/assets/user.png';

  const normalizeImageUrl = (value) => {
    const v = (value || '').toString().trim();
    if (!v) return DEFAULT_AVATAR;
    if (/^(https?:)?\/\//i.test(v) || v.startsWith('data:') || v.startsWith('/')) return v;
    const base = (import.meta.env.VITE_API_BASE_URL || '').toString().replace(/\/$/, '');
    if (!base) return DEFAULT_AVATAR;
    return `${base}/${v.replace(/^\//, '')}`;
  };

  const RELATION_LABELS = {
    SELF: { en: 'Self', ta: 'தான்' },
    F: { en: 'Father', ta: 'தந்தை' },
    M: { en: 'Mother', ta: 'தாய்' },
    S: { en: 'Son', ta: 'மகன்' },
    D: { en: 'Daughter', ta: 'மகள்' },
    H: { en: 'Husband', ta: 'கணவர்' },
    W: { en: 'Wife', ta: 'மனைவி' },
    B: { en: 'Brother', ta: 'சகோதரன்' },
    Z: { en: 'Sister', ta: 'சகோதரி' },
    UNKNOWN: { en: 'Unknown', ta: 'தெரியவில்லை' },
    UNRELATED: { en: 'Unrelated', ta: 'உறவில்லை' },
  };

  const [replaceModal, setReplaceModal] = useState({ open: false, request: null });
  const [familyMembers, setFamilyMembers] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [replaceLoading, setReplaceLoading] = useState(false);
  const [addNewMemberLoading, setAddNewMemberLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [viewMember, setViewMember] = useState(null); // for member details in replace modal
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [requestToReject, setRequestToReject] = useState(null);
  const [familyTreePeople, setFamilyTreePeople] = useState(null);
  const [relationToAdmin, setRelationToAdmin] = useState(null);
  const [relationLoading, setRelationLoading] = useState(false);

  const safeParseUserInfo = () => {
    try {
      return JSON.parse(localStorage.getItem('userInfo'));
    } catch (_) {
      return null;
    }
  };

  const effectiveUserInfo = ctxUserInfo || safeParseUserInfo();
  const effectiveUserId = effectiveUserInfo?.id || effectiveUserInfo?.userId || null;

  const computeAge = (dobValue, fallbackAge) => {
    if (fallbackAge !== null && fallbackAge !== undefined && fallbackAge !== '') {
      const n = Number(fallbackAge);
      return Number.isFinite(n) ? n : null;
    }
    if (!dobValue) return null;
    const dob = new Date(dobValue);
    if (Number.isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  };

  const getDisplayName = (user, profile) => {
    const fullName = (user?.fullName || '').toString().trim();
    if (fullName && !/\bnull\b|\bundefined\b/i.test(fullName)) {
      return fullName.replace(/\bnull\b|\bundefined\b/gi, '').replace(/\s+/g, ' ').trim();
    }
    const first = (profile?.firstName || '').toString().trim();
    const last = (profile?.lastName || '').toString().trim();
    const n = `${first} ${last}`.trim();
    return n || 'Member';
  };

  const getRelationEnTa = (rel) => {
    if (!rel) return null;
    const code = (rel.relationshipCode || '').toString().trim();
    const desc = (rel.description || '').toString().trim();

    const byCode = code && RELATION_LABELS[code] ? RELATION_LABELS[code] : null;
    if (byCode) return { code, ...byCode };

    const key = desc.toLowerCase();
    const descMap = {
      self: 'SELF',
      father: 'F',
      mother: 'M',
      son: 'S',
      daughter: 'D',
      husband: 'H',
      wife: 'W',
      brother: 'B',
      sister: 'Z',
      unknown: 'UNKNOWN',
      unrelated: 'UNRELATED',
      'no connection found': 'UNRELATED',
    };

    const mappedCode = descMap[key];
    if (mappedCode && RELATION_LABELS[mappedCode]) {
      return { code: mappedCode, ...RELATION_LABELS[mappedCode] };
    }

    return {
      code: code || 'UNKNOWN',
      en: desc || code || RELATION_LABELS.UNKNOWN.en,
      ta: RELATION_LABELS.UNKNOWN.ta,
    };
  };

  useEffect(() => {
    if (!replaceModal.open || !familyCode || !accessToken) {
      setFamilyTreePeople(null);
      setRelationToAdmin(null);
      return;
    }

    let cancelled = false;
    const loadTree = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/family/tree/${familyCode}`, {
          headers: {
            accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.message || 'Failed to load family tree');
        }
        const people = json?.people || json?.data?.people || json?.data || [];
        if (!cancelled) {
          setFamilyTreePeople(Array.isArray(people) ? people : []);
        }
      } catch (err) {
        console.error('Failed to load family tree for relationship:', err);
        if (!cancelled) {
          setFamilyTreePeople(null);
        }
      }
    };

    loadTree();
    return () => {
      cancelled = true;
    };
  }, [replaceModal.open, familyCode, accessToken]);

  useEffect(() => {
    const computeRelationToAdmin = async () => {
      if (!replaceModal.open || !selectedMemberId || !effectiveUserId) {
        setRelationToAdmin(null);
        return;
      }
      if (!Array.isArray(familyTreePeople) || familyTreePeople.length === 0) {
        setRelationToAdmin(null);
        return;
      }

      const adminPerson = familyTreePeople.find((p) => Number(p?.memberId) === Number(effectiveUserId));
      const selectedPerson = familyTreePeople.find((p) => Number(p?.memberId) === Number(selectedMemberId));

      if (!adminPerson?.id || !selectedPerson?.id) {
        setRelationToAdmin(null);
        return;
      }

      try {
        setRelationLoading(true);

        const peopleMap = new Map();
        for (const p of familyTreePeople) {
          const pid = p?.id;
          if (pid === null || pid === undefined) continue;
          const idStr = String(pid);
          peopleMap.set(idStr, {
            ...p,
            id: idStr,
            parents: Array.isArray(p.parents) ? p.parents.map((x) => String(x)) : [],
            children: Array.isArray(p.children) ? p.children.map((x) => String(x)) : [],
            spouses: Array.isArray(p.spouses) ? p.spouses.map((x) => String(x)) : [],
            siblings: Array.isArray(p.siblings) ? p.siblings.map((x) => String(x)) : [],
            gender: (p.gender || 'unknown').toString().toLowerCase(),
          });
        }

        const tree = { people: peopleMap };
        const calculator = new RelationshipCalculator(tree);
        const rel = calculator.calculateRelationship(String(adminPerson.id), String(selectedPerson.id));

        setRelationToAdmin(getRelationEnTa(rel));
      } catch (err) {
        console.error('Failed to compute relationship:', err);
        setRelationToAdmin(null);
      } finally {
        setRelationLoading(false);
      }
    };

    computeRelationToAdmin();
  }, [replaceModal.open, selectedMemberId, effectiveUserId, familyTreePeople]);

  const markNotificationAsRead = async (notificationId, status = null) => {
    try {
      const url = new URL(`${import.meta.env.VITE_API_BASE_URL}/notifications/${notificationId}/read`);
      if (status) {
        url.searchParams.append('status', status);
      }

      await fetch(url.toString(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  useEffect(() => {
    if (!effectiveUserId || !accessToken) {
      setRequests([]);
      setFamilyCode(null);
      setLoading(false);
      return;
    }
    const fetchFamilyCodeAndRequests = async () => {
      setLoading(true);
      try {
        const userRes = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/user/profile/${effectiveUserId}`,
          {
            headers: {
              accept: 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const userData = await userRes.json().catch(() => ({}));
        if (!userRes.ok) {
          throw new Error(userData?.message || 'Failed to load your profile');
        }

        const code = userData.data?.userProfile?.familyCode;
        setFamilyCode(code || null);

        if (!code) {
          setRequests([]);
          return;
        }

        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/notifications/${code}/join-requests`,
          {
            headers: {
              accept: 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.message || 'Failed to load join requests');
        }

        const pendingRequests = (data.data || []).filter((req) => req.status === 'pending');

        const requestsWithUser = await Promise.all(
          pendingRequests.map(async (req) => {
            let user = null;
            if (req.triggeredBy) {
              try {
                const requesterRes = await fetch(
                  `${import.meta.env.VITE_API_BASE_URL}/user/profile/${req.triggeredBy}`,
                  {
                    headers: {
                      accept: 'application/json',
                      Authorization: `Bearer ${accessToken}`,
                    },
                  }
                );
                const requesterData = await requesterRes.json().catch(() => ({}));
                user = requesterRes.ok ? requesterData.data?.userProfile || null : null;
              } catch (_) {
                user = null;
              }
            }
            return { ...req, user };
          })
        );

        setRequests(requestsWithUser);
      } catch (err) {
        console.error('Failed to load join requests:', err);
        setRequests([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFamilyCodeAndRequests();
  }, [effectiveUserId, accessToken]);

  const handleApproveReplace = async () => {
    if (!familyCode || !replaceModal.request || !selectedMemberId) return;
    setReplaceLoading(true);
    await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/family/${familyCode}/approve-replace`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          joinUserId: replaceModal.request.triggeredBy,
          replaceMemberId: selectedMemberId,
        }),
      }
    );
    setReplaceLoading(false);
    setReplaceModal({ open: false, request: null });
    setSelectedMemberId(null);
    // Refresh requests
    window.location.reload();
  };

  const handleAddAsNewMember = async () => {
    if (!familyCode || !replaceModal.request) return;
    setAddNewMemberLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/family/member/add-user-to-family`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            userId: replaceModal.request.triggeredBy,
            familyCode: familyCode,
          }),
        }
      );

      if (response.ok) {
        // Mark the notification as read with accepted status
        await markNotificationAsRead(replaceModal.request.id, 'accepted');
        setAddNewMemberLoading(false);
        setReplaceModal({ open: false, request: null });
        setSelectedMemberId(null);
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          window.location.reload();
        }, 2000);
      } else {
        console.error('Failed to add user to family');
        setAddNewMemberLoading(false);
      }
    } catch (error) {
      console.error('Error adding user to family:', error);
      setAddNewMemberLoading(false);
    }
  };

  const openReplaceModal = async (request) => {
    if (!familyCode) return;
    setReplaceModal({ open: true, request });
    setSelectedMemberId(null);
    setViewMember(null);
    // Fetch family members (approved only)
    const res = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/family/member/${familyCode}`,
      {
        headers: {
          accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    const data = await res.json();
    setFamilyMembers(data.data || []);
  };

  const filteredMembers = familyMembers.filter((member) => {
    const user = member.user || {};
    const profile = user.userProfile || {};
    const memberUserId = user.id;
    const requesterUserId = replaceModal?.request?.triggeredBy;

    const isNonAppUser =
      typeof user.isAppUser === 'boolean'
        ? user.isAppUser === false
        : (!user.email && !user.mobile);

    if (!isNonAppUser) {
      return false;
    }

    if (memberUserId && effectiveUserId && Number(memberUserId) === Number(effectiveUserId)) {
      return false;
    }
    if (memberUserId && requesterUserId && Number(memberUserId) === Number(requesterUserId)) {
      return false;
    }

    return (profile.firstName + ' ' + (profile.lastName || '')).toLowerCase().includes(search.toLowerCase());
  });

  return (
    <>
      <div className="flex-1 max-w-7xl mx-auto px-4 py-8 md:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate('/family-management')}
          className="mb-4 inline-flex items-center text-sm text-primary-600 hover:text-primary-700"
        >
          <FiArrowLeft className="mr-1.5" />
          <span>Back to Family Management</span>
        </button>

        <div className="flex items-center  mb-6">
          <FiClock className="text-primary-600 text-3xl mr-3" />
          <h1 className="text-3xl font-bold text-gray-800">Pending Requests</h1>
        </div>
        <p className="hidden md:block text-gray-500 mb-6">Review and manage pending join requests for your family.</p>
        {loading ? (
          <div>Loading...</div>
        ) : requests.length === 0 ? (
          <div className="text-gray-400 text-lg mt-12 text-center">No pending join requests found.</div>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => (
              <div key={req.id} className="flex items-center bg-white rounded-lg shadow p-4">
                <img
                  src={normalizeImageUrl(req.user?.profile)}
                  alt={req.user?.firstName || 'User'}
                  className="w-12 h-12 rounded-full object-cover border mr-4"
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_AVATAR;
                  }}
                />
                <div className="flex-1">
                  <div className="font-semibold text-lg">
                    {req.user?.firstName} {req.user?.lastName}
                  </div>
                  <div className="text-sm text-gray-500">{req.message}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(req.createdAt).toLocaleString()}
                  </div>
                </div>
                <button
                  className="ml-auto bg-blue-500 text-white px-4 py-2 rounded mr-2"
                  onClick={async () => {
                    const userId = req?.triggeredBy;
                    if (!userId) {
                      window.alert('User id not found for this request.');
                      return;
                    }
                    navigate(`/user/${userId}`);
                  }}
                >
                  View Profile
                </button>
                <button
                  className="bg-red-500 text-white px-4 py-2 rounded mr-2"
                  onClick={() => {
                    setRequestToReject(req);
                    setShowRejectConfirm(true);
                  }}
                >
                  Reject
                </button>
                <button
                  className="bg-green-500 text-white px-4 py-2 rounded"
                  disabled={Number(req?.triggeredBy) === Number(effectiveUserId)}
                  onClick={() => {
                    if (Number(req?.triggeredBy) === Number(effectiveUserId)) {
                      window.alert('This join request is from your own account. You cannot replace your own account holder profile.');
                      return;
                    }
                    openReplaceModal(req);
                  }}
                >
                  Accept & Replace
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Approve & Replace Modal */}
      {replaceModal.open && (
        <Modal onClose={() => { setReplaceModal({ open: false, request: null }); setViewMember(null); }}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Replace a non-app member</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Choose a non-app member to replace, or add the requester as a new member.
                  {selectedMemberId && ' Click the selected member again to deselect.'}
                </p>
              </div>
              <div className="w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Search by name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setViewMember(null);
                    setSelectedMemberId(null);
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 min-h-0">
              <div className="flex-1 min-h-0">
                <div className="border border-gray-200 rounded-xl p-3 bg-white">
                  <div className="text-sm font-medium text-gray-700 mb-3">Select member</div>

                  {filteredMembers.length === 0 ? (
                    <div className="text-sm text-gray-500 py-10 text-center">
                      No non-app members found.
                    </div>
                  ) : (
                    <div className="max-h-[45vh] overflow-y-auto pr-1">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {filteredMembers.map((member) => {
                          const user = member.user || {};
                          const profile = user.userProfile || {};
                          const isSelected = Number(selectedMemberId) === Number(user.id);
                          const displayName = getDisplayName(user, profile);

                          return (
                            <button
                              type="button"
                              key={member.id}
                              className={`group text-left p-3 rounded-xl border transition-all ${
                                isSelected
                                  ? 'border-primary-500 bg-primary-50'
                                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                              }`}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedMemberId(null);
                                  setViewMember(null);
                                } else {
                                  setSelectedMemberId(user.id);
                                  setViewMember({ user, profile });
                                }
                              }}
                            >
                              <div className="flex flex-col items-center gap-2">
                                <img
                                  src={normalizeImageUrl(user.profileImage)}
                                  alt={profile.firstName || 'Member'}
                                  className="w-14 h-14 rounded-full object-cover border"
                                  onError={(e) => {
                                    e.currentTarget.src = DEFAULT_AVATAR;
                                  }}
                                />
                                <div className="w-full text-center">
                                  <div className="font-medium text-sm text-gray-900 truncate">{displayName}</div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full md:w-80 flex-shrink-0">
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 h-full flex flex-col">
                  <div className="text-sm font-medium text-gray-700">Selected member</div>

                  {viewMember && selectedMemberId === viewMember.user.id ? (
                    <div className="mt-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={normalizeImageUrl(viewMember.user.profileImage)}
                          alt={viewMember.profile.firstName || 'Member'}
                          className="w-12 h-12 rounded-full object-cover border"
                          onError={(e) => {
                            e.currentTarget.src = DEFAULT_AVATAR;
                          }}
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 truncate">
                            {getDisplayName(viewMember.user, viewMember.profile)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2 text-sm text-gray-700">
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500">Name</span>
                          <span className="text-right">
                            {getDisplayName(viewMember.user, viewMember.profile)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500">Age</span>
                          <span className="text-right">
                            {(() => {
                              const a = computeAge(viewMember.profile.dob, viewMember.profile.age);
                              return a === null ? '—' : a;
                            })()}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500">Gender</span>
                          <span className="text-right">{viewMember.profile.gender || '—'}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500">Relation to you</span>
                          <span className="text-right">
                            {relationLoading
                              ? 'Loading…'
                              : relationToAdmin
                                ? `${relationToAdmin.en} / ${relationToAdmin.ta}`
                                : '—'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="mt-4 text-sm text-primary-700 hover:text-primary-800 underline bg-white"
                        onClick={() => {
                          setSelectedMemberId(null);
                          setViewMember(null);
                        }}
                      >
                        Clear selection
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-gray-500">
                      Select a member from the list to view details.
                    </div>
                  )}

                  <div className="mt-auto pt-4">
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg disabled:opacity-50"
                        disabled={selectedMemberId || addNewMemberLoading}
                        onClick={handleAddAsNewMember}
                      >
                        {addNewMemberLoading ? 'Adding...' : 'Add as New Member'}
                      </button>
                      <button
                        type="button"
                        className="w-full bg-green-600 text-white px-4 py-2.5 rounded-lg disabled:opacity-50"
                        disabled={!selectedMemberId || replaceLoading}
                        onClick={() => setShowConfirm(true)}
                      >
                        {replaceLoading ? 'Approving...' : 'Approve & Replace'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {showConfirm && (
            <Modal onClose={() => setShowConfirm(false)}>
              <div className="overflow-y-auto max-h-full">
                <div className="text-lg font-semibold mb-4">
                  Are you sure you want to <span className="text-primary-600">approve</span> this request and replace <span className="text-primary-600">{viewMember?.profile.firstName} {viewMember?.profile.lastName}</span> with <span className="text-primary-600">{replaceModal.request?.user?.firstName} {replaceModal.request?.user?.lastName}</span>?<br/>
                  <span className="text-sm text-gray-500">This action cannot be undone.</span>
                </div>
                <button
                  className="bg-green-600 text-white px-6 py-2 rounded mr-2"
                  onClick={async () => {
                    if (
                      (selectedMemberId && effectiveUserId && Number(selectedMemberId) === Number(effectiveUserId)) ||
                      (selectedMemberId && replaceModal?.request?.triggeredBy && Number(selectedMemberId) === Number(replaceModal.request.triggeredBy))
                    ) {
                      window.alert('Invalid replacement target selected. Please choose another member.');
                      return;
                    }
                    setReplaceLoading(true);
                    await fetch(
                      `${import.meta.env.VITE_API_BASE_URL}/user/merge`,
                      {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${accessToken}`,
                        },
                        body: JSON.stringify({
                          existingId: selectedMemberId,
                          currentId: replaceModal.request.triggeredBy,
                          notificationId: replaceModal.request.id,
                        }),
                      }
                    );
                    // Mark the notification as read with accepted status after successful merge
                    await markNotificationAsRead(replaceModal.request.id, 'accepted');
                    setReplaceLoading(false);
                    setShowConfirm(false);
                    setReplaceModal({ open: false, request: null });
                    setSelectedMemberId(null);
                    setShowSuccess(true);
                    setTimeout(() => {
                      setShowSuccess(false);
                      window.location.reload();
                    }, 2000);
                  }}
                >
                  Yes, Replace
                </button>
                <button className="bg-gray-300 px-6 py-2 rounded" onClick={() => setShowConfirm(false)}>Cancel</button>
              </div>
            </Modal>
          )}
        </Modal>
      )}
      {showSuccess && (
        <Modal onClose={() => setShowSuccess(false)}>
          <div className="text-center py-8">
            <div className="text-3xl mb-4 text-green-600">✔️</div>
            <div className="text-xl font-bold mb-2">Member replaced successfully!</div>
            <div className="text-gray-500">The selected member has been replaced with the new joiner.</div>
          </div>
        </Modal>
      )}
      {/* Reject Confirmation Modal */}
      {showRejectConfirm && requestToReject && (
        <Modal onClose={() => setShowRejectConfirm(false)}>
          <div className="text-center py-6">
            <div className="text-2xl mb-4 text-red-600">⚠️</div>
            <div className="text-xl font-bold mb-4">Confirm Rejection</div>
            <div className="text-gray-600 mb-6">
              Are you sure you want to reject the join request from <span className="font-semibold">{requestToReject.user?.firstName} {requestToReject.user?.lastName}</span>?
            </div>
            <div className="flex justify-center gap-4">
              <button
                className="bg-gray-300 text-gray-700 px-6 py-2 rounded"
                onClick={() => {
                  setShowRejectConfirm(false);
                  setRequestToReject(null);
                }}
              >
                Cancel
              </button>
              <button
                className="bg-red-500 text-white px-6 py-2 rounded"
                onClick={async () => {
                  // Mark notification as rejected
                  await markNotificationAsRead(requestToReject.id, 'rejected');
                  // Remove the request from the list
                  setRequests(prev => prev.filter(r => r.id !== requestToReject.id));
                  setShowRejectConfirm(false);
                  setRequestToReject(null);
                }}
              >
                Yes, Reject
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default SuggestionApproving;