import React from 'react';
import { FiEdit, FiShare2 } from 'react-icons/fi';

const FamilyView = ({ familyData, totalMembers, males, females, averageAge, onManageMembers, onManageEvents, onManageGifts, onEditFamily, onShareFamilyCode }) => {

  const defaultFamilyPhoto = "/assets/family-default.png";

  return (
    <div className="space-y-8">
      {/* Family Header */}
      <div className="relative rounded-3xl overflow-hidden shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-800 to-primary-600 opacity-90"></div>
        <div className="relative z-10 p-6 sm:p-10 flex flex-col md:flex-row items-center gap-6 sm:gap-8">
          <div className="flex-shrink-0 w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden border-4 border-white shadow-lg">

            <img
              src={familyData.familyPhotoUrl ? `${familyData.familyPhotoUrl}` : defaultFamilyPhoto}
              alt={familyData.familyName}
              className="w-full h-full object-cover"
              onError={(e) => e.target.src = defaultFamilyPhoto}
            />
          </div>
          
          <div className="text-center md:text-left text-white">
            <h1 className="text-xl sm:text-4xl font-bold mb-2">{familyData.familyName}</h1>
            <p className="text-xs sm:text-lg opacity-90 mb-4">{familyData.familyBio}</p>
            
            <div className="flex flex-wrap justify-center md:justify-start gap-3">
              <button
                type="button"
                onClick={onShareFamilyCode}
                className="flex items-center bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm px-3 py-1.5 text-xs sm:text-sm rounded-full transition-all"
              >
                <FiShare2 className="mr-2" />
                Share Family Code: <span className="font-mono ml-1 ">{familyData.familyCode}</span>
              </button>
              <button
                type="button"
                onClick={onEditFamily}
                className="flex items-center bg-white/90 text-primary-700 hover:bg-white rounded-full px-3 py-1.5 text-xs sm:text-sm shadow-sm transition-all"
              >
                <FiEdit className="mr-2" />
                Edit family
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default FamilyView;