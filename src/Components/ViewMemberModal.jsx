import React, { useEffect, useMemo } from 'react';
import { FiX, FiMail, FiPhone, FiUser, FiCalendar, FiGlobe, FiMapPin, FiHeart, FiBookOpen, FiSmile, FiThumbsUp, FiThumbsDown, FiHome, FiUsers, FiUserCheck, FiUserPlus, FiClock, FiMapPin as FiLocation } from 'react-icons/fi';
import { FaMale, FaFemale } from 'react-icons/fa';

const ViewFamilyMemberModal = ({ isOpen, onClose, member, isLoading = false }) => {
  if (!isOpen) return null;

  useEffect(() => {
    if (!isOpen) return;
    if (typeof onClose !== 'function') return;
    if (!window.__appModalBackStack) window.__appModalBackStack = [];

    const handler = () => {
      onClose();
    };

    window.__appModalBackStack.push(handler);

    return () => {
      const stack = window.__appModalBackStack;
      if (!Array.isArray(stack)) return;
      const idx = stack.lastIndexOf(handler);
      if (idx >= 0) stack.splice(idx, 1);
    };
  }, [isOpen, onClose]);

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  const normalized = useMemo(() => {
    const profile = member?.raw?.userProfile || member || {};
    const roleMap = { 1: 'Member', 2: 'Admin', 3: 'Superadmin' };

    // Handle childrenNames parsing
    let parsedChildren = [];
    const childrenRaw = profile.childrenNames;

    if (typeof childrenRaw === 'string') {
      try {
        parsedChildren = JSON.parse(childrenRaw);
      } catch {
        parsedChildren = childrenRaw.split(',').map((c) => c.trim());
      }
    } else if (Array.isArray(childrenRaw)) {
      parsedChildren = childrenRaw;
    }

    // Helper function to get nested object name
    const getNestedName = (obj, fallback) => {
      if (obj && typeof obj === 'object' && obj.name) {
        return obj.name;
      }
      return fallback || 'N/A';
    };

    return {
      fullName: `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'N/A',
      email: member?.email || profile.email || 'N/A',
      countryCode: member?.countryCode || '',
      mobile: member?.mobile || profile.contactNumber || 'N/A',
      profileImage: profile.profile || member?.profileUrl || 'https://placehold.co/96x96/e2e8f0/64748b?text=👤',
      gender: profile.gender || 'N/A',
      dob: profile.dob || null,
      maritalStatus: profile.maritalStatus || 'N/A',
      marriageDate: profile.marriageDate || null,
      spouseName: profile.spouseName || 'N/A',
      childrenNames: parsedChildren,
      childrenCount: parsedChildren.length,
      fatherName: profile.fatherName || 'N/A',
      motherName: profile.motherName || 'N/A',
      religion: getNestedName(profile.religion, profile.religionId),
      language: getNestedName(profile.language, profile.languageId),
      caste: profile.caste || 'N/A',
      gothram: getNestedName(profile.gothram, profile.gothramId),
      kuladevata: profile.kuladevata || 'N/A',
      region: profile.region || 'N/A',
      hobbies: profile.hobbies || 'N/A',
      likes: profile.likes || 'N/A',
      dislikes: profile.dislikes || 'N/A',
      favoriteFoods: profile.favoriteFoods || 'N/A',
      address: profile.address || 'N/A',
      bio: profile.bio || 'N/A',
      updatedAt: profile.updatedAt || member?.updatedAt || null,
      roleName: roleMap[member?.role] || 'Member',
    };
  }, [member]);

  const getRoleColor = (role) => {
    switch (role) {
      case 'Admin': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Superadmin': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getGenderIcon = (gender) => {
    return gender === 'Male' ? <FaMale className="text-blue-500" /> : <FaFemale className="text-pink-500" />;
  };

  const formatApprovalStatus = (status) => {
    if (!status) return 'N/A';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved': return 'text-green-600';
      case 'pending': return 'text-yellow-600';
      case 'rejected': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm modal-backdrop"
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden relative transform transition-all duration-300 ease-out modal-content-animate"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
              <p className="text-gray-600 font-medium">Loading member details...</p>
            </div>
          </div>
        )}

        {/* Header Section */}
        <div className="relative bg-gradient-to-br from-primary-600 via-primary-500 to-primary-400 p-6 text-white modal-header-gradient">
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-all duration-200 backdrop-blur-sm glass-effect"
          >
            <FiX size={20} />
          </button>

          {/* Profile Image and Basic Info */}
          <div className="flex items-center space-x-4">
            <div className="relative">
              <img
                src={normalized.profileImage}
                alt={normalized.fullName}
                className="w-20 h-20 rounded-full object-cover border-3 border-white/30 shadow-lg transition-smooth"
                onError={(e) => {
                  e.target.src = 'https://placehold.co/80x80/e2e8f0/64748b?text=👤';
                }}
              />
              <div className="absolute -bottom-1 -right-1 p-1.5 bg-white rounded-full shadow-md">
                {getGenderIcon(normalized.gender)}
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold mb-1 truncate">{normalized.fullName}</h1>
              <div className="flex items-center space-x-2 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border transition-smooth ${getRoleColor(normalized.roleName)}`}>
                  {normalized.roleName}
                </span>
                <span className="px-2 py-1 bg-white/20 rounded-full text-xs font-medium backdrop-blur-sm glass-effect">
                  {calculateAge(normalized.dob)} years old
                </span>
                <span className="px-2 py-1 bg-white/15 rounded-full text-xs font-medium backdrop-blur-sm glass-effect">
                  {normalized.gender}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6 overflow-y-auto max-h-[65vh]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Contact Information */}
            <div className="space-y-3">
              <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center">
                <FiUser className="mr-2 text-primary-600" />
                Contact Information
              </h3>
              <DetailCard icon={<FiMail />} label="Email" value={normalized.email} />
              <DetailCard icon={<FiPhone />} label="Contact Number" value={`${normalized.countryCode} ${normalized.mobile}`} />
            </div>

            {/* Personal Information */}
            <div className="space-y-3">
              <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center">
                <FiUser className="mr-2 text-primary-600" />
                Personal Information
              </h3>
              <DetailCard icon={<FiCalendar />} label="Date of Birth" value={formatDate(normalized.dob)} />
              <DetailCard icon={<FiGlobe />} label="Religion" value={normalized.religion} />
              <DetailCard icon={<FiBookOpen />} label="Language" value={normalized.language} />
              <DetailCard icon={<FiMapPin />} label="Region" value={normalized.region} />
            </div>

            {/* Family Information */}
            <div className="space-y-3">
              <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center">
                <FiUsers className="mr-2 text-primary-600" />
                Family Information
              </h3>
              <DetailCard icon={<FiUser />} label="Father's Name" value={normalized.fatherName} />
              <DetailCard icon={<FiUser />} label="Mother's Name" value={normalized.motherName} />
              <DetailCard icon={<FiHeart />} label="Marital Status" value={normalized.maritalStatus} />
              
              {normalized.maritalStatus === 'Married' && (
                <>
                  <DetailCard icon={<FiCalendar />} label="Marriage Date" value={formatDate(normalized.marriageDate)} />
                  <DetailCard icon={<FiUserCheck />} label="Spouse Name" value={normalized.spouseName} />
                  <DetailCard icon={<FiUsers />} label="Children Count" value={normalized.childrenCount} />
                  {normalized.childrenNames.length > 0 && (
                    <DetailCard 
                      icon={<FiUserPlus />} 
                      label="Children Names" 
                      value={normalized.childrenNames.join(', ')} 
                    />
                  )}
                </>
              )}
            </div>

            {/* Family Details */}
            <div className="space-y-3">
              <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center">
                <FiHome className="mr-2 text-primary-600" />
                Family Details
              </h3>
              <DetailCard 
                icon={<FiUsers />} 
                label="Family Code" 
                value={member?.raw?.userProfile?.familyCode || member?.familyCode || 'N/A'} 
              />
              <DetailCard 
                icon={<FiUserCheck />} 
                label="Approval Status" 
                value={formatApprovalStatus(member?.raw?.userProfile?.familyMember?.approveStatus)} 
                customValueClass={getStatusColor(member?.raw?.userProfile?.familyMember?.approveStatus)}
              />
              <DetailCard icon={<FiMapPin />} label="Region" value={normalized.region} />
              <DetailCard icon={<FiLocation />} label="Address" value={normalized.address} />
            </div>

            {/* Cultural Information */}
            <div className="space-y-3">
              <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center">
                <FiBookOpen className="mr-2 text-primary-600" />
                Cultural Information
              </h3>
              <DetailCard icon={<FiBookOpen />} label="Caste" value={normalized.caste} />
              <DetailCard icon={<FiBookOpen />} label="Gothram" value={normalized.gothram} />
              <DetailCard icon={<FiBookOpen />} label="Kuladevata" value={normalized.kuladevata} />
            </div>

            {/* Preferences & Interests */}
            <div className="space-y-3 lg:col-span-2">
              <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center">
                <FiSmile className="mr-2 text-primary-600" />
                Preferences & Interests
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DetailCard icon={<FiSmile />} label="Hobbies" value={normalized.hobbies} />
                <DetailCard icon={<FiThumbsUp />} label="Likes" value={normalized.likes} />
                <DetailCard icon={<FiThumbsDown />} label="Dislikes" value={normalized.dislikes} />
                <DetailCard icon={<FiBookOpen />} label="Favorite Foods" value={normalized.favoriteFoods} />
              </div>
            </div>

            {/* Bio */}
            {normalized.bio && normalized.bio !== 'N/A' && (
              <div className="lg:col-span-2 space-y-3">
                <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center">
                  <FiBookOpen className="mr-2 text-primary-600" />
                  Bio
                </h3>
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 detail-card-hover">
                  <p className="text-gray-700 leading-relaxed">{normalized.bio}</p>
                </div>
              </div>
            )}

            {/* Last Updated */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-center text-xs text-gray-500 bg-gray-50 rounded-lg p-2 transition-smooth">
                <FiClock className="mr-2" />
                Last updated: {formatDate(normalized.updatedAt)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DetailCard = ({ icon, label, value, customValueClass }) => (
  <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 detail-card-hover">
    <div className="flex items-start space-x-3">
      <div className="flex-shrink-0 p-1.5 bg-primary-100 rounded-md transition-smooth">
        <span className="text-primary-600 text-base">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
        <p className={`text-gray-900 font-semibold break-words text-sm ${customValueClass}`}>{value || 'N/A'}</p>
      </div>
    </div>
  </div>
);

const calculateAge = (dob) => {
  if (!dob) return 'N/A';
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
};

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export default ViewFamilyMemberModal;
