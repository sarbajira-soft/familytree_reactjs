import React, { useState, useEffect } from 'react';
import FamilyView from '../Components/FamilyView';
import NoFamilyView from '../Components/NoFamilyView';
import PendingApprovalView from '../Components/PendingApprovalView';
import JoinFamilyModal from '../Components/JoinFamilyModal';
import { useNavigate } from 'react-router-dom';
import CreateFamilyModal from '../Components/CreateFamilyModal';
import { useUser } from '../Contexts/UserContext';
import FamilyOverView from '../Components/FamilyOverView';
import { FiLoader, FiArrowLeft } from 'react-icons/fi';
import SuggestFamilyModal from '../Components/SuggestFamilyModal';
import {jwtDecode} from 'jwt-decode';
import Swal from 'sweetalert2';

const FamilyHubPage = () => {
  const navigate = useNavigate();
  const [token, setToken] = useState(null);
  const { userInfo, userLoading } = useUser();
  const [familyData, setFamilyData] = useState(null);
  const [isCreateFamilyModalOpen, setIsCreateFamilyModalOpen] = useState(false);
  const [isJoinFamilyModalOpen, setIsJoinFamilyModalOpen] = useState(false);
  const [totalMembers, setTotalMembers] = useState(0);
  const [males, setMales] = useState(0);
  const [females, setFemales] = useState(0);
  const [averageAge, setAverageAge] = useState(0);
  const [error, setError] = useState(null);
  const [showCopyMessage, setShowCopyMessage] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [suggestedFamilies, setSuggestedFamilies] = useState([]);
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
      const storedToken = localStorage.getItem('access_token');
      if (storedToken) {
          setToken(storedToken);
      }
  }, []);

  useEffect(() => {
    let ignore = false; // prevent race condition

    const fetchFamilyData = async () => {
      // Only fetch family data if user has family code and is approved
      if (!userInfo?.familyCode || userInfo?.approveStatus !== 'approved' || userLoading) {
        return;
      }

      setError(null);

      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/family/code/${userInfo.familyCode}`,
          {
            headers: { accept: 'application/json' },
          }
        );

        if (!response.ok) throw new Error('Failed to fetch family data');
        const data = await response.json();

        if (!ignore) {
          setFamilyData(data);
          setTotalMembers(data.totalMembers ?? 12);
          setMales(data.males ?? 5);
          setFemales(data.females ?? 7);
          setAverageAge(data.averageAge ?? 28.3);
        }
      } catch (err) {
        console.error(err);
        if (!ignore) {
          setError('Failed to load family data.');
          setFamilyData(null);
        }
      }
    };

    fetchFamilyData();

    return () => {
      ignore = true;
    };
  }, [userInfo?.familyCode, userInfo?.approveStatus, userLoading]);

  const handleCreateFamily = async () => {
    setLoadingSuggestions(true);
    setShowSuggestModal(true);
    try {
      let userId = userInfo?.userId;
      if (!userId) {
        const accessToken = localStorage.getItem('access_token');
        if (accessToken) {
          const decoded = jwtDecode(accessToken);
          userId = decoded?.id || decoded?.userId || decoded?.sub;
        }
      }
      if (!userId) throw new Error('User ID not found');
      const accessToken = localStorage.getItem('access_token');
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/family/member/suggest-family/${userId}`, {
        headers: {
          'accept': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
        }
      });
      const data = await response.json();
      setSuggestedFamilies(data.data || []);
    } catch (err) {
      setSuggestedFamilies([]);
      console.error('Failed to load suggested families', err);
      Swal.fire({
        icon: 'error',
        title: 'Unable to load suggestions',
        text: 'Please try again in a moment.',
      });
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleCreateNewFamily = () => {
    setShowSuggestModal(false);
    setIsCreateFamilyModalOpen(true);
  };

  const handleJoinFamily = (familyCode = null) => {
    if (familyCode) {
      console.log('Joining family with code:', familyCode);
      setIsJoinFamilyModalOpen(true);
      return;
    }
    setIsJoinFamilyModalOpen(true);
  };

  const handleFamilyJoined = (familyData) => {
    // Refresh user info to get updated family code and approval status
    setIsJoinFamilyModalOpen(false);
    // Reload the page to reflect the changes
    globalThis.location.reload();
  };

  const handleManageMembers = () => {
    navigate('/my-family-member');
  };

  const handleManageEvent = () => {
    navigate('/events');
  };

  const handleManageGifts = () => {
    navigate('/gifts-memories');
  };

  const handleEditFamily = () => {
    setIsEditModalOpen(true);
  };
  
  const handleShareFamilyCode = () => {
    if (familyData?.familyCode) {
      navigator.clipboard.writeText(familyData.familyCode)
        .then(() => {
          setShowCopyMessage(true);
          setTimeout(() => setShowCopyMessage(false), 2000);
        })
        .catch(() => {
          Swal.fire({ icon: 'error', title: 'Copy failed', text: 'Unable to copy to clipboard. Please try manually.' });
        });
    }
  };

  const handleFamilyCreated = (newFamilyDetails) => {
    // Refresh user info to get updated family code and approval status
    
    // Update local family data if available
    if (newFamilyDetails) {
      const updatedFamily = {
        ...familyData,
        ...newFamilyDetails,
        familyPhotoUrl: newFamilyDetails.familyPhoto
          ? familyData?.familyPhotoUrl
          : familyData?.familyPhotoUrl || null,
        updatedAt: new Date().toISOString(),
      };
      setFamilyData(updatedFamily);
    }
    
    setIsCreateFamilyModalOpen(false);
    setIsEditModalOpen(false);
  };


  if (userLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 md:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center py-20">
          <FiLoader className="text-6xl text-primary-600 animate-spin mb-4" />
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">Loading User Data...</h2>
          <p className="text-gray-500">Please wait while we fetch your information.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600">
        {error}
      </div>
    );
  }

  const hasFamily = Boolean(userInfo?.familyCode);
  const isApproved = userInfo?.approveStatus === 'approved';
  let accessView = null;

  if (hasFamily === false) {
    accessView = (
      <NoFamilyView onCreateFamily={handleCreateFamily} onJoinFamily={handleJoinFamily} />
    );
  } else if (isApproved === false) {
    accessView = (
      <PendingApprovalView
        familyCode={userInfo.familyCode}
        onJoinFamily={handleJoinFamily}
      />
    );
  }

  return (
    <>
      {accessView ? (
        <div className="min-h-[calc(100vh-6rem)] bg-gray-50 flex items-center justify-center px-4 py-6">
          {accessView}
        </div>
      ) : (
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
            <button
              type="button"
              onClick={() => navigate('/family-management')}
              className="mb-4 inline-flex items-center text-sm text-primary-600 hover:text-primary-700"
            >
              <FiArrowLeft className="mr-1.5" />
              <span>Back to Family Management</span>
            </button>

            {familyData ? (
              <div className="space-y-6">
                <FamilyView
                  familyData={familyData}
                  totalMembers={totalMembers}
                  males={males}
                  females={females}
                  averageAge={averageAge}
                  onManageMembers={handleManageMembers}
                  onManageEvents={handleManageEvent}
                  onManageGifts={handleManageGifts}
                  onEditFamily={handleEditFamily}
                  onShareFamilyCode={handleShareFamilyCode}
                />

                <FamilyOverView
                  familyCode={userInfo?.familyCode}
                  token={token}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20">
                <FiLoader className="text-6xl text-primary-600 animate-spin mb-4" />
                <h2 className="text-2xl font-semibold text-gray-700 dark:text-slate-200 mb-2">Loading Family Data...</h2>
                <p className="text-gray-500 dark:text-slate-400">Please wait while we fetch your family information.</p>
              </div>
            )}
          </div>
        </div>
      )}

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

      {isEditModalOpen && (
        <CreateFamilyModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onFamilyCreated={handleFamilyCreated}
          token={token}
          mode="edit"
          initialData={familyData}
        />
      )}

      {showCopyMessage && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: "#1976D2",
          color: 'white',
          padding: '10px 20px',
          borderRadius: '8px',
          boxShadow: '0px 4px 12px rgba(0,0,0,0.1)',
          zIndex: 1000
        }}>
          Copied to clipboard!
        </div>
      )}

      {showSuggestModal && (
        <SuggestFamilyModal
          families={suggestedFamilies}
          loading={loadingSuggestions}
          onClose={() => setShowSuggestModal(false)}
          onCreateNew={handleCreateNewFamily}
          onJoinFamily={() => {}} // No join logic for now
        />
      )}
    </>
  );
};

export default FamilyHubPage;
