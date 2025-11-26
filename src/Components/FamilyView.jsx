import React from 'react';
import { FiUsers, FiEdit, FiShare2, FiPlus, FiChevronRight, FiCalendar, FiGift } from 'react-icons/fi';
import { FaMale, FaFemale, FaBirthdayCake, FaUserFriends } from 'react-icons/fa';

const FamilyView = ({ familyData, totalMembers, males, females, averageAge, onManageMembers, onManageEvents, onManageGifts, onEditFamily, onShareFamilyCode }) => {
  const defaultFamilyPhoto = "/assets/family-default.png";

  return (
    <div className="space-y-8">
      {/* Family Header */}
      <div className="relative rounded-3xl overflow-hidden shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-800 to-primary-600 opacity-90"></div>
        <div className="relative z-10 p-8 sm:p-12 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-shrink-0 w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden border-4 border-white shadow-lg">
            <img
              src={familyData.familyPhotoUrl ? `${familyData.familyPhotoUrl}` : defaultFamilyPhoto}
              alt={familyData.familyName}
              className="w-full h-full object-cover"
              onError={(e) => e.target.src = defaultFamilyPhoto}
            />
          </div>
          
          <div className="text-center md:text-left text-white">
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">{familyData.familyName}</h1>
            <p className="text-lg opacity-90 mb-4">{familyData.familyBio}</p>
            
            <div className="flex flex-wrap justify-center md:justify-start gap-3">
              <button 
                onClick={onShareFamilyCode}
                className="flex items-center bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm px-4 py-2 rounded-full transition-all"
              >
                <FiShare2 className="mr-2" />
                Share Family Code: <span className="font-mono ml-1 ">{familyData.familyCode}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button 
          onClick={onManageMembers}
          className="bg-white p-5 rounded-xl shadow-sm hover:shadow-md border border-gray-100 hover:border-blue-200 transition-all text-left group"
        >
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
              <FiUsers className="text-blue-600 group-hover:text-blue-700" />
            </div>
            <h3 className="font-semibold text-gray-800">Manage Members</h3>
          </div>
          <p className="text-sm text-gray-600">View and edit all family members</p>
        </button>
        
        <button 
          onClick={onEditFamily}
          className="bg-white p-5 rounded-xl shadow-sm hover:shadow-md border border-gray-100 hover:border-purple-200 transition-all text-left group"
        >
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mr-3">
              <FiEdit className="text-purple-600 group-hover:text-purple-700" />
            </div>
            <h3 className="font-semibold text-gray-800">Edit Family</h3>
          </div>
          <p className="text-sm text-gray-600">Update family name, photo, or bio</p>
        </button>
        
        <button 
          onClick={onManageEvents}
          className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 text-left">
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mr-3">
              <FiCalendar className="text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-800">Family Calendar</h3>
          </div>
          <p className="text-sm text-gray-600">View upcoming family events</p>
        </button>
        
        <button 
          onClick={onManageGifts}
          className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 text-left">
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center mr-3">
              <FiGift className="text-orange-600" />
            </div>
            <h3 className="font-semibold text-gray-800">Gift Ideas</h3>
          </div>
          <p className="text-sm text-gray-600">See upcoming gift occasions</p>
        </button>
      </div>

      
    </div>
  );
};

export default FamilyView;