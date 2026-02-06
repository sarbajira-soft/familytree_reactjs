import React from 'react';
import PropTypes from 'prop-types';
import { FiUsers, FiPlus, FiLink } from 'react-icons/fi';

const NoFamilyView = ({ onCreateFamily, onJoinFamily }) => {
  return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-8 sm:px-10">
      <div className="flex flex-col items-center text-center gap-4">
        <div className="w-20 h-20 rounded-full bg-primary-50 flex items-center justify-center border border-primary-100">
          <FiUsers className="text-primary-600 text-3xl" />
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            Welcome to your Family Hub
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-2 max-w-md mx-auto">
            Create or join a family to unlock Events, Family Tree, and Family.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row w-full gap-3 sm:gap-4 mt-2">
          <button
            onClick={onCreateFamily}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary-600 text-white font-semibold shadow-sm hover:bg-primary-700 transition"
          >
            <FiPlus size={20} />
            Create New Family
          </button>

          <button
            onClick={onJoinFamily}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-primary-200 text-primary-700 font-semibold hover:bg-primary-50 transition"
          >
            <FiLink size={20} />
            Join Family
          </button>
        </div>

        <p className="text-xs text-gray-500">
          Have a family code? Use it to join instantly.
        </p>
      </div>
    </div>
  );
};

NoFamilyView.propTypes = {
  onCreateFamily: PropTypes.func.isRequired,
  onJoinFamily: PropTypes.func.isRequired,
};

export default NoFamilyView;