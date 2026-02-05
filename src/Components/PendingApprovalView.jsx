import React from 'react';
import PropTypes from 'prop-types';
import { FiClock, FiUsers, FiAlertCircle } from 'react-icons/fi';

const PendingApprovalView = ({ familyCode, onJoinFamily }) => (
  <div className="w-full max-w-2xl mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-8 sm:px-10">
    <div className="flex flex-col items-center text-center gap-4">
      <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center border border-orange-100">
        <FiClock className="text-orange-600 text-3xl" />
      </div>

      <div>
        <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900">
          Request pending
        </h2>
        <p className="text-sm sm:text-base text-gray-600 mt-2 max-w-md mx-auto">
          Your family request is awaiting admin approval.
        </p>
      </div>

      {familyCode && (
        <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 text-orange-700 border border-orange-100 px-3 py-1 text-xs font-semibold">
          <FiAlertCircle className="text-orange-500" />
          Family code: {familyCode}
        </div>
      )}

      <button
        onClick={onJoinFamily}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-primary-200 text-primary-700 font-semibold hover:bg-primary-50 transition"
      >
        <FiUsers size={18} />
        Use a different family code
      </button>

      <p className="text-xs text-gray-500">
        You can join another family while you wait.
      </p>
    </div>
  </div>
);

PendingApprovalView.propTypes = {
  familyCode: PropTypes.string,
  onJoinFamily: PropTypes.func.isRequired,
};

export default PendingApprovalView;