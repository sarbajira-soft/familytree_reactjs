import React, { useState, useEffect } from 'react';
import { FaUserPlus, FaSearch, FaWhatsapp } from 'react-icons/fa';
import { FiLoader, FiX } from 'react-icons/fi';
import JoinFamilyModal from '../Components/JoinFamilyModal';
import { useUser } from '../Contexts/UserContext';


// ✅ WhatsApp Share Modal
const WhatsAppShareModal = ({ onClose, familyCode, member }) => {
  const rawBaseUrl = import.meta.env.VITE_BASE_URL || window.location.origin;
  const baseUrl = /^https?:\/\//i.test(rawBaseUrl)
    ? rawBaseUrl
    : `https://${rawBaseUrl}`;
  const inviteLink = `${baseUrl.replace(/\/$/, '')}/edit-profile?familyCode=${familyCode}&memberId=${member?.memberId}`;

  const handleWhatsAppShare = () => {
    const message = `Hi ${member?.name}, join our family tree! Use this link: ${inviteLink}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative">
        <button
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl"
          onClick={onClose}
        >
          <FiX />
        </button>

        <h2 className="text-2xl font-bold mb-6 text-blue-700 flex items-center">
          <FaWhatsapp className="mr-3 text-green-500" />
          Share Family Invite
        </h2>

        {/* Invite Link */}
        <div className="mb-8 flex flex-col items-center">
          <label className="block text-gray-700 font-semibold mb-2 text-center w-full">
            Invitation Link
          </label>
          <a
            href={inviteLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full block px-4 py-3 border border-blue-200 rounded-lg bg-blue-50 text-blue-800 text-center font-semibold text-base cursor-pointer select-all shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all mb-4 hover:bg-blue-100 hover:text-blue-900 hover:underline"
          >
            {inviteLink}
          </a>
        </div>

        {/* WhatsApp Share Button */}
        <div className="mb-2">
          <label className="block text-gray-700 font-semibold mb-2">Share via WhatsApp</label>
          <button
            onClick={handleWhatsAppShare}
            className="w-full px-4 py-3 bg-green-500 text-white rounded-lg font-bold text-lg flex items-center justify-center gap-2 hover:bg-green-600 transition-all shadow-md"
          >
            <FaWhatsapp className="text-xl" />
            Share on WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
};


// ✅ Family Member Card
const FamilyMemberCard = ({ member, onWhatsAppClick }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all duration-200 p-5 mb-4">
      <div className="flex flex-col md:flex-row md:items-center gap-5">
        {/* Profile Picture */}
        <div className="flex-shrink-0">
          <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-gray-100 shadow-xs">
            <img
              src={member.profilePic || "https://placehold.co/80x80/f5f5f5/e0e0e0?text=👤"}
              alt={member.name}
              className="w-full h-full object-cover"
              onError={(e) => e.target.src = "https://placehold.co/80x80/f5f5f5/e0e0e0?text=👤"}
            />
          </div>
        </div>

        {/* Member Info */}
        <div className="flex-grow">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">
            <div>
              <h3 className="text-lg md:text-xl font-semibold text-gray-800">{member.name}</h3>
              <p className="text-gray-600 text-sm">{member.email}</p>

              {/* ✅ Contact field removed */}

              <span className={`inline-block mt-1 px-2 py-1 text-xs font-medium rounded-full ${
                member.status === 'approved' 
                  ? 'bg-green-100 text-green-800' 
                  : member.status === 'pending'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {member.status}
              </span>
            </div>
          </div>

          <div className="text-gray-500 text-xs">
            <span>Member since: {member.requestedDate}</span>
          </div>
        </div>

        {/* WhatsApp Button */}
        <div className="flex-shrink-0">
          <button
            onClick={() => onWhatsAppClick(member)}
            className="flex items-center justify-center p-3 bg-green-500 hover:bg-green-600 text-white rounded-full transition-colors"
            title={`Share invite with ${member.name}`}
          >
            <FaWhatsapp className="text-lg" />
          </button>
        </div>
      </div>
    </div>
  );
};


// ✅ Family Member Listing
const FamilyMemberListing = () => {
  const [members, setMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showWhatsAppShareModal, setShowWhatsAppShareModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { userInfo, userLoading, refetchUser } = useUser();

  const fetchMembers = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('access_token');
      const baseUrl = import.meta.env.VITE_API_BASE_URL;
      const familyCode = userInfo?.familyCode;

      if (!familyCode) throw new Error('No family code available');

      const response = await fetch(`${baseUrl}/family/member/${familyCode}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch family members');

      const result = await response.json();
      const data = result.data || [];

      const formatted = data.map((item) => ({
        id: item.id,
        memberId: item.memberId,
        familyCode: item.familyCode,
        name: (item.user.fullName && !/\bnull\b|\bundefined\b/i.test(item.user.fullName))
          ? item.user.fullName.replace(/\bnull\b|\bundefined\b/gi, '').replace(/\s+/g, ' ').trim()
          : (
              [item.user.userProfile?.firstName, item.user.userProfile?.lastName]
                .filter(val => val && val !== 'null' && val !== 'undefined')
                .join(' ') || 'Unknown Name'
            ),
        email: item.user?.email || '',
        requestedDate: new Date(item.createdAt).toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        profilePic: item.user?.profileImage,
        status: item.approveStatus,
      }));

      setMembers(formatted);
    } catch (error) {
      console.error('Failed to load family members:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userInfo?.familyCode) fetchMembers();
  }, [userInfo?.familyCode]);

  const filteredMembers = members.filter(member =>
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const hasValidFamilyAccess = userInfo?.familyCode && userInfo?.approveStatus === 'approved';

  if (userLoading) {
    return (
      <>
        <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col items-center justify-center py-20">
          <FiLoader className="text-6xl text-blue-600 animate-spin mb-4" />
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">Loading...</h2>
          <p className="text-gray-500">Please wait while we verify your access.</p>
        </div>
      </>
    );
  }

  if (!hasValidFamilyAccess) {
    return (
      <>
        <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col items-center justify-center py-20">
          <div className="text-center">
            <FaUserPlus className="text-6xl text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">Join a Family First</h2>
            <p className="text-gray-500 mb-6">
              You need to join a family and get approved before you can view family members.
            </p>
            <button
              onClick={() => setShowJoinModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Join Family
            </button>
          </div>
        </div>
        {showJoinModal && (
          <JoinFamilyModal
            isOpen={showJoinModal}
            onClose={() => setShowJoinModal(false)}
            token={localStorage.getItem('access_token')}
            onFamilyJoined={() => {
              refetchUser();
              setShowJoinModal(false);
            }}
            refetchUserInfo={refetchUser}
          />
        )}
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col items-center justify-center py-20">
          <FiLoader className="text-6xl text-blue-600 animate-spin mb-4" />
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">Loading Members...</h2>
          <p className="text-gray-500">Please wait while we fetch family members.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2 flex items-center">
            <FaUserPlus className="mr-3 text-blue-600" />
            Family Members
          </h1>
          <p className="text-gray-600">Connect with your family members via WhatsApp.</p>
        </div>

        {/* Search Box */}
        <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-grow relative">
            <FaSearch className="absolute left-3 top-3 text-gray-400" />
            <input
              className="pl-10 pr-3 py-2 border border-gray-300 rounded-lg w-full"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Members */}
        {filteredMembers.length > 0 ? (
          <div>
            {filteredMembers.map((member) => (
              <FamilyMemberCard
                key={member.id}
                member={member}
                onWhatsAppClick={(m) => {
                  setSelectedMember(m);
                  setShowWhatsAppShareModal(true);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500">
            No family members found.
          </div>
        )}
      </div>

      {/* WhatsApp Share Modal */}
      {showWhatsAppShareModal && selectedMember && (
        <WhatsAppShareModal
          onClose={() => {
            setShowWhatsAppShareModal(false);
            setSelectedMember(null);
          }}
          familyCode={userInfo?.familyCode}
          member={selectedMember}
        />
      )}
    </>
  );
};

export default FamilyMemberListing;
