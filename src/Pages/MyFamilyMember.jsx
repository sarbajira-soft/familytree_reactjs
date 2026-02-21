import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../Contexts/UserContext';
import FamilyOverView from '../Components/FamilyOverView';
import ProfileFormModal from '../Components/ProfileFormModal';
import FamilyMemberCard from '../Components/FamilyMemberCard';
import ViewFamilyMemberModal from '../Components/ViewMemberModal';
import NoFamilyView from '../Components/NoFamilyView';
import PendingApprovalView from '../Components/PendingApprovalView';
import CreateFamilyModal from '../Components/CreateFamilyModal';
import JoinFamilyModal from '../Components/JoinFamilyModal';
import { FiPlus, FiLoader, FiArrowLeft } from 'react-icons/fi';
import {jwtDecode} from 'jwt-decode';
import Swal from 'sweetalert2';

import { authFetch, authFetchResponse } from '../utils/authFetch';
import { getToken } from '../utils/auth';
import { logger } from '../utils/logger';

const FamilyMemberListing = () => {
  const { userInfo, userLoading } = useUser();
  const navigate = useNavigate();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editMemberData, setEditMemberData] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateFamilyModalOpen, setIsCreateFamilyModalOpen] = useState(false);
  const [isJoinFamilyModalOpen, setIsJoinFamilyModalOpen] = useState(false);
  const [token, setToken] = useState(null);
  const [viewMember, setViewMember] = useState(null);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  
  useEffect(() => {
    const storedToken = getToken();
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  useEffect(() => {
    // Get userId from token
    const token = getToken();
    if (!token) return;
    let userId;
    try {
      const decoded = jwtDecode(token);
      userId = decoded.id || decoded.userId || decoded.sub;
    } catch {
      return;
    }

    authFetch(`/user/profile/${userId}`, { method: 'GET', skipThrow: true })
      .then((data) => {
        const user = data?.data;
        if (!user) return;
        setCurrentUser({
          ...user,
          userId: user.id, // Ensures userId is always present
        });
      })
      .catch(() => {});
  }, []);

  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);

  const handleCreateFamily = () => {
    setIsCreateFamilyModalOpen(true);
  };

  const handleJoinFamily = (familyCode = null) => {
    if (familyCode) {
      // Handle joining with specific family code
      logger.debug('BLOCK OVERRIDE: Joining family with code', familyCode);
      // TODO: Implement API call to join family with new code
      // For now, just show the modal
      setIsJoinFamilyModalOpen(true);
    } else {
      setIsJoinFamilyModalOpen(true);
    }
  };

  const handleFamilyJoined = (familyData) => {
    // Refresh user info to get updated family code and approval status
    setIsJoinFamilyModalOpen(false);
    // Reload the page to reflect the changes
    window.location.reload();
  };

  const handleFamilyCreated = (newFamilyDetails) => {
    // Refresh user info to get updated family code and approval status
    setIsCreateFamilyModalOpen(false);
  };

  const handleEditMember = async (memberUserId) => {
    if (!memberUserId) return;

    const fullDetails = await fetchMemberDetails(memberUserId);
    if (fullDetails) {
      setEditMemberData(fullDetails);
      setIsEditModalOpen(true);
    }
  };

  const handleCloseEditModal = () => {
    setEditMemberData(null);
    setIsEditModalOpen(false);
  };

   const handleViewMember = async (memberId) => {
    if (!memberId) return;
    
    setViewLoading(true);
    try {
      const fullDetails = await fetchMemberDetails(memberId);
      if (fullDetails) {
        setViewMember(fullDetails);
      }
    } catch (error) {
      logger.error('BLOCK OVERRIDE: Error viewing member', error);
    } finally {
      setViewLoading(false);
    }
  };

  const fetchMemberDetails = async (userId) => {
    try {
      const response = await authFetchResponse(`/user/profile/${userId}`, {
        method: 'GET',
        skipThrow: true,
      });
      const resJson = await response.json().catch(() => null);
      if (!response?.ok || !resJson?.data) {
        throw new Error(resJson?.message || 'Failed to fetch member details');
      }

      const user = resJson.data;
      const blockStatus = user?.blockStatus || {};
      if (blockStatus?.isBlockedByThem) {
        await Swal.fire({
          icon: 'warning',
          title: 'Access Restricted',
          text: 'You cannot view this member profile because of block restrictions.',
        });
        return null;
      }

      const profile = user.userProfile || {};

      if (!user?.id && !profile?.userId) {
        throw new Error('No user profile returned');
      }

      // Parse children names
      let childrenArray = [];
      if (profile.childrenNames) {
        try {
          childrenArray = JSON.parse(profile.childrenNames);
          if (!Array.isArray(childrenArray)) {
            childrenArray = profile.childrenNames.split(',').map(c => c.trim());
          }
        } catch (err) {
          childrenArray = profile.childrenNames.split(',').map(c => c.trim());
        }
      }

      const childFields = {};
      childrenArray.forEach((name, index) => {
        childFields[`childName${index}`] = name;
      });

      const userInfo = {
        userId: profile.userId || user.id,
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        dob: profile.dob?.split('T')[0] || '',
        age: calculateAge(profile.dob),
        gender: profile.gender || '',
        email: user.email || '',
        maritalStatus: profile.maritalStatus || '',
        marriageDate: profile.marriageDate?.split('T')[0] || '',
        spouseName: profile.spouseName || '',
        region: profile.region || '',
        childrenCount: childrenArray.length || 0,
        ...childFields,

        fatherName: profile.fatherName || '',
        motherName: profile.motherName || '',
        motherTongue: parseInt(profile.languageId) || 0,
        languageId: parseInt(profile.languageId) || 0, // Add this for consistency
        religionId: parseInt(profile.religionId) || 0,
        caste: profile.caste || '',
        gothram: parseInt(profile.gothramId) || 0,
        gothramId: parseInt(profile.gothramId) || 0, // Add this for consistency
        kuladevata: profile.kuladevata || '',
        hobbies: profile.hobbies || '',
        likes: profile.likes || '',
        dislikes: profile.dislikes || '',
        favoriteFoods: profile.favoriteFoods || '',
        address: profile.address || '',
        contactNumber: profile.contactNumber || '',
        bio: profile.bio || '',
        profileUrl: profile.profile || '',
        familyCode: profile.familyMember?.familyCode || profile.familyCode || '',
        name: `${profile.firstName || ''} ${profile.lastName || ''}`.trim(),
        blockStatus,

        // From main user
        countryCode: user.countryCode || '',
        mobile: user.mobile || '',
        status: user.status || 0,
        role: user.role || 0,

        // Include nested objects for proper display
        religion: profile.religion || null,
        language: profile.language || null,

        raw: user, // full object including both user + userProfile
      };

      return userInfo;

    } catch (error) {
      logger.error('BLOCK OVERRIDE: Error fetching member details', error);
      return null;
    }
  };

  const calculateAge = (dob) => {
    if (!dob) return 0;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Show loading state while checking user info
  if (userLoading || !userInfo) {
    return (
      <>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <button
            type="button"
            onClick={() => navigate('/family-management')}
            className="mb-4 inline-flex items-center text-sm text-primary-600 hover:text-primary-700"
          >
            <FiArrowLeft className="mr-1.5" />
            <span>Back to Family Management</span>
          </button>
          <div className="flex flex-col items-center justify-center py-20">
            <FiLoader className="text-6xl text-primary-600 animate-spin mb-4" />
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">Loading Family Members...</h2>
            <p className="text-gray-500">Please wait while we fetch your family information.</p>
          </div>
        </div>
      </>
    );
  }

  // Bug 54: Don't early-return on "no family" / "pending approval" views,
  // otherwise Create/Join modals never mount and buttons appear unresponsive.
  const accessView = !userInfo.familyCode ? (
    <NoFamilyView
      onCreateFamily={handleCreateFamily}
      onJoinFamily={handleJoinFamily}
    />
  ) : userInfo.approveStatus !== 'approved' ? (
    <PendingApprovalView
      familyCode={userInfo.familyCode}
      onJoinFamily={handleJoinFamily}
    />
  ) : null;

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          type="button"
          onClick={() => navigate('/family-management')}
          className="mb-4 inline-flex items-center text-sm text-primary-600 hover:text-primary-700"
        >
          <FiArrowLeft className="mr-1.5" />
          <span>Back to Family Management</span>
        </button>

        {accessView ? (
          <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center">
            {accessView}
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-extrabold mb-4">My Family Tree</h1>

            <FamilyOverView familyCode={userInfo?.familyCode} token={token} />

            <FamilyMemberCard 
              familyCode={userInfo?.familyCode} 
              token={token} 
              onEditMember={handleEditMember}
              onViewMember={handleViewMember}
              currentUser={currentUser}
            />

            <ProfileFormModal
              isOpen={isModalOpen}
              onClose={handleCloseModal}
              onAddMember={(newMember) => {
                handleCloseModal();
              }}
              mode="add"
            />
            {/* Edit Member Modal */}
            <ProfileFormModal
              isOpen={isEditModalOpen}
              onClose={handleCloseEditModal}
              mode="edit-member"
              memberData={editMemberData}
            />

            {viewMember && (
              <ViewFamilyMemberModal
                isOpen={!!viewMember}
                onClose={() => setViewMember(null)}
                member={viewMember}
                isLoading={viewLoading}
              />
            )}
          </>
        )}
      </div>

      <CreateFamilyModal
        isOpen={isCreateFamilyModalOpen}
        onClose={() => setIsCreateFamilyModalOpen(false)}
        onFamilyCreated={handleFamilyCreated}
        token={token}
      />

      <JoinFamilyModal
        isOpen={isJoinFamilyModalOpen}
        onClose={() => setIsJoinFamilyModalOpen(false)}
        onFamilyJoined={handleFamilyJoined}
        token={token}
      />
    </>
  );
};

export default FamilyMemberListing;

