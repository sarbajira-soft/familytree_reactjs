import React from 'react';
const ActionButtons = ({ onSave, onBack }) => {
  return (
    <div className="flex justify-end mb-8">
      
      <div className="flex space-x-3">
        <button
          onClick={onBack}
          className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onSave}
          className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          Save changes
        </button>
      </div>
    </div>
  );
};

export default ActionButtons;
