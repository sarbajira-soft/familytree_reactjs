import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FiTrash2, FiEye, FiLoader, FiShare2 } from 'react-icons/fi';
import { FaBirthdayCake, FaPhone, FaHome, FaMale, FaFemale } from 'react-icons/fa';
import Swal from 'sweetalert2';
import { BlockButton } from './block/BlockButton';
import { BlockedBadge } from './block/BlockedBadge';
import { logger } from '../utils/logger';

const roleMapping = {
  1: 'Member',
  2: 'Admin',
  3: 'Superadmin',
};

const relationColors = {
  Member: 'bg-blue-100 text-blue-800',
  Admin: 'bg-purple-100 text-purple-800',
  Superadmin: 'bg-green-100 text-green-800',
};

const FamilyMemberCard = ({ familyCode, token, onViewMember, currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [familyMembers, setFamilyMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewLoadingStates, setViewLoadingStates] = useState({});
  const [deletedMemberIds, setDeletedMemberIds] = useState(() => new Set());

  const BASE_URL = import.meta.env.VITE_API_BASE_URL;
  const normalizeFamilyCode = (code) => String(code || '').trim().toUpperCase();
  const currentUserFamilyCode = currentUser?.userProfile?.familyCode || currentUser?.familyCode;
  const currentUserIsFamilyAdmin =
    (currentUser?.role === 2 || currentUser?.role === 3) &&
    normalizeFamilyCode(currentUserFamilyCode) === normalizeFamilyCode(familyCode);

  const fetchMembers = async () => {
    try {
      const res = await fetch(`${BASE_URL}/family/member/${familyCode}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch members');
      const json = await res.json();
      const members = json.data.map((item) => ({
        id: item.id,
        memberId: item.memberId,
        userId: item.user.id,
        membershipType: item.membershipType || 'member',
        name: (item.user.fullName && !/\bnull\b|\bundefined\b/i.test(item.user.fullName))
          ? item.user.fullName
              .replaceAll(/\bnull\b|\bundefined\b/gi, '')
              .replaceAll(/\s+/g, ' ')
              .trim()
          : (
              [item.user.userProfile?.firstName, item.user.userProfile?.lastName]
                .filter(val => val && val !== 'null' && val !== 'undefined')
                .join(' ') || 'Unknown Name'
            ),
        gender: item.user.userProfile?.gender || 'N/A',
        role: item.familyRole || roleMapping[item.user.role] || 'Member',
        contact: item.user.userProfile?.contactNumber,
        address: item.user.userProfile?.address || '',
        dob: item.user.userProfile?.dob || '',
        age: item.user.userProfile?.age || '',
        profilePic: item.user.profileImage,
        isAdmin: item.isFamilyAdmin ?? item.user.role > 1,
        // BLOCK OVERRIDE: Use new bidirectional block status payload.
        blockStatus: item.blockStatus || {
          isBlockedByMe: false,
          isBlockedByThem: false,
        },
        lastUpdated: new Date(item.updatedAt).toLocaleDateString('en-IN'),
      }));
      setFamilyMembers(members);
    } catch (err) {
      logger.error('BLOCK OVERRIDE: Failed to load family members', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (familyCode && token) {
      setLoading(true);
      fetchMembers();
    }
  }, [familyCode, token]);

  const calculateAge = (dob) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const handleViewMember = async (userId, e) => {
    e.stopPropagation();
    
    // Set loading state for this specific member
    setViewLoadingStates(prev => ({ ...prev, [userId]: true }));
    
    try {
      await onViewMember(userId);
    } finally {
      // Clear loading state after a short delay to ensure smooth transition
      setTimeout(() => {
        setViewLoadingStates(prev => ({ ...prev, [userId]: false }));
      }, 500);
    }
  };

  const handleDeleteMember = async (memberId, familyCode, e) => {
    if (e?.stopPropagation) e.stopPropagation();

    const confirm = await Swal.fire({
      icon: 'warning',
      title: 'Delete Member?',
      text: 'This will remove the member from this family.',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#e53e3e',
    });

    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(
        `${BASE_URL}/family/member/delete/${memberId}/${familyCode}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = json?.message || 'Failed to delete member';
        throw new Error(msg);
      }

      await Swal.fire({
        icon: 'success',
        title: 'Member Deleted',
        text: json?.message || 'Family member removed successfully.',
      });

      setDeletedMemberIds((prev) => {
        const next = new Set(prev);
        next.add(memberId);
        return next;
      });

      setTimeout(() => {
        setFamilyMembers((prev) => prev.filter((m) => m.memberId !== memberId));
        setDeletedMemberIds((prev) => {
          const next = new Set(prev);
          next.delete(memberId);
          return next;
        });
      }, 600);
    } catch (err) {
      logger.error('BLOCK OVERRIDE: Failed to delete member', err);
      await Swal.fire({
        icon: 'error',
        title: 'Delete Failed',
        text: err?.message || 'Unable to delete this member. Please try again.',
      });
    }
  };

  const handleShareInvite = async (member, e) => {
    e.stopPropagation();

    const inviteUrl = `${window.location.origin}/edit-profile?familyCode=${familyCode}&memberId=${member.memberId}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Family Tree Invitation',
          text: 'Update your family tree profile using this secure link.',
          url: inviteUrl,
        });
      } else {
        await navigator.clipboard.writeText(inviteUrl);
        await Swal.fire({
          icon: 'success',
          title: 'Invite Link Copied',
          text: 'The profile invite link has been copied to your clipboard. You can share it via WhatsApp or any app.',
        });
      }
    } catch (err) {
      logger.error('BLOCK OVERRIDE: Failed to share invite link', err);
      await Swal.fire({
        icon: 'error',
        title: 'Share Failed',
        text: 'Unable to share the invite link. Please try again.',
      });
    }
  };

  const handleMemberBlockStatusChange = (memberUserId, nextStatus) => {
    // BLOCK OVERRIDE: Apply local optimistic block status updates using new block contract.
    setFamilyMembers((prevMembers) =>
      prevMembers.map((member) =>
        Number(member.userId) === Number(memberUserId)
          ? { ...member, blockStatus: nextStatus }
          : member,
      ),
    );
  };

  const filteredMembers = familyMembers.filter((member) =>
    member.name && member.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  // BLOCK OVERRIDE: Keep blocked users out of active grid and move them to blocked section only.
  const activeMembers = filteredMembers.filter(
    (member) => !member?.blockStatus?.isBlockedByMe,
  );
  const blockedMembers = filteredMembers.filter(
    (member) => member?.blockStatus?.isBlockedByMe,
  );

  const SingleMemberCard = ({ member }) => (
    <div
      onClick={() => {
        // Only allow viewing if user has Admin (role 2) or Superadmin (role 3) role
        if (
          !deletedMemberIds.has(member.memberId) &&
          currentUserIsFamilyAdmin &&
          !member?.blockStatus?.isBlockedByMe
        ) {
          handleViewMember(member.userId, { stopPropagation: () => {} });
        }
      }}
      className={`relative bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-md transition-all duration-300 ease-in-out group transform hover:-translate-y-1 ${
        currentUserIsFamilyAdmin 
          ? 'hover:shadow-lg cursor-pointer' 
          : 'cursor-default'
      } ${deletedMemberIds.has(member.memberId) ? 'opacity-20 grayscale pointer-events-none' : ''}`}
    >
      <div className="flex items-start p-5 pb-0">
        <div className="relative flex-shrink-0 w-24 h-24 rounded-full overflow-hidden border-3 border-primary-200 shadow-lg">
          <img
            src={member.profilePic || 'https://placehold.co/96x96/e2e8f0/64748b?text=👤'}
            alt={member.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.src = 'https://placehold.co/96x96/e2e8f0/64748b?text=👤';
            }}
          />
          {/* {member.isAdmin && (
            <span className="absolute bottom-0 right-0 -mr-1 -mb-1 px-2 py-0.5 bg-primary-DEFAULT text-white text-xs font-bold rounded-full border-2 border-white shadow">
              Admin
            </span>
          )} */}
        </div>

        <div className="ml-4 flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h3 className="text-xl font-extrabold text-gray-900 truncate pr-2">{member.name}</h3>
            {currentUserIsFamilyAdmin && member?.blockStatus?.isBlockedByMe && (
              <BlockedBadge />
            )}
            {member.membershipType !== 'member' && (
              <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                Linked
              </span>
            )}
          </div>
          <span
            className={`mt-1 inline-block text-sm font-semibold px-3 py-1 rounded-full ${
              relationColors[member.role] || 'bg-gray-100 text-gray-800'
            }`}
          >
            {member.role}
          </span>
          <div className="mt-2 flex items-center text-sm text-gray-600">
            <FaBirthdayCake className="mr-2 text-primary-500" size={16} />
            <span className="font-medium">{  member.age ||calculateAge(member.dob)} years old</span>
          </div>
          <div className="mt-1 flex items-center text-sm text-gray-600">
            {member.gender === 'male' ? (
              <FaMale className="mr-2 text-blue-500" size={16} />
            ) : (
              <FaFemale className="mr-2 text-pink-500" size={16} />
            )}
            <span className="font-medium">{member.gender}</span>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 mt-4 bg-gray-50 border-t border-b border-gray-100 mx-5 rounded-lg">
        {member.contact && (
          <div className="flex items-center text-sm text-gray-700 mb-2">
            <FaPhone className="mr-3 text-primary-500" size={16} />
            <span className="font-medium">{member.contact}</span>
          </div>
        )}
        {member.address && (
          <div className="flex items-start text-sm text-gray-700">
            <FaHome className="mr-3 text-primary-500 mt-1" size={16} />
            <span className="line-clamp-2">{member.address}</span>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center px-5 py-4">
        <span className="text-xs text-gray-500">Last updated: {member.lastUpdated}</span>
        <div className="flex space-x-2">
          {/* Show view, edit, delete buttons only for Admin (role 2) and Superadmin (role 3) */}
          {currentUserIsFamilyAdmin && (
            <>
              {/* Share profile invite link */}
              {member.membershipType === 'member' && (
                <button
                  onClick={(e) => handleShareInvite(member, e)}
                  disabled={deletedMemberIds.has(member.memberId)}
                  className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-700 transition-colors tooltip"
                  title="Share profile invite link"
                >
                  <FiShare2 size={18} />
                </button>
              )}

              {/* BLOCK OVERRIDE: Legacy family-member block buttons replaced by user-level BlockButton. */}
              {member.membershipType === 'member' && currentUser?.userId !== member.userId && (
                <BlockButton
                  userId={member.userId}
                  isBlockedByMe={Boolean(member?.blockStatus?.isBlockedByMe)}
                  location="membersList"
                  userName={member.name}
                  onStatusChange={(nextStatus) => handleMemberBlockStatusChange(member.userId, nextStatus)}
                />
              )}

              {member.membershipType === 'member' && currentUser?.userId !== member.userId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteMember(member.memberId, familyCode, e);
                  }}
                  disabled={deletedMemberIds.has(member.memberId)}
                  className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-700 transition-colors tooltip"
                  title="Delete Member"
                >
                  <FiTrash2 size={18} />
                </button>
              )}
              {/* View button with loading state */}
              <button
                onClick={(e) => handleViewMember(member.userId, e)}
                disabled={deletedMemberIds.has(member.memberId) || viewLoadingStates[member.userId]}
                className={`p-2 rounded-full transition-all duration-200 tooltip ${
                  viewLoadingStates[member.userId]
                    ? 'bg-primary-100 text-primary-700 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-600 hover:bg-primary-100 hover:text-primary-700'
                }`}
                title="View Member"
              >
                {viewLoadingStates[member.userId] ? (
                  <FiLoader size={18} className="animate-spin" />
                ) : (
                  <FiEye size={18} />
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <input
        type="text"
        placeholder="Search family members..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
      />

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-primary-600 border-solid">
          </div>
        </div>
      ) : (
        <>
          {!filteredMembers.length && (
            <p className="text-center text-gray-500 col-span-full">No family members found.</p>
          )}

          {activeMembers.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {activeMembers.map((member) => (
                <SingleMemberCard key={member.id} member={member} />
              ))}
            </div>
          )}

          {currentUserIsFamilyAdmin && (
            <section className="rounded-xl border border-red-200 bg-red-50/50 p-4">
              <h2 className="text-lg font-semibold text-red-700">Blocked Members</h2>
              {blockedMembers.length > 0 ? (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {blockedMembers.map((member) => (
                    <div
                      key={`blocked-member-${member.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-white p-3 shadow-sm"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <img
                          src={member.profilePic || 'https://placehold.co/48x48/e2e8f0/64748b?text=👤'}
                          alt={member.name}
                          className="h-12 w-12 flex-shrink-0 rounded-full object-cover ring-2 ring-red-100"
                        />

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-gray-900">{member.name}</span>
                            <BlockedBadge />
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                relationColors[member.role] || 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {member.role}
                            </span>
                            {member.membershipType !== 'member' && (
                              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                                Linked
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-shrink-0 items-center">
                        <BlockButton
                          userId={member.userId}
                          isBlockedByMe
                          location="profile"
                          userName={member.name}
                          onStatusChange={(nextStatus) =>
                            handleMemberBlockStatusChange(member.userId, nextStatus)
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-600">No blocked members.</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
};

FamilyMemberCard.propTypes = {
  familyCode: PropTypes.string,
  token: PropTypes.string,
  onViewMember: PropTypes.func,
  currentUser: PropTypes.shape({
    userId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    role: PropTypes.number,
    familyCode: PropTypes.string,
    userProfile: PropTypes.shape({
      familyCode: PropTypes.string,
    }),
  }),
};

// PHASE 3 OPTIMIZATION: Memoize FamilyMemberCard to prevent unnecessary re-renders
export default React.memo(FamilyMemberCard);
