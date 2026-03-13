import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FiClock, FiUsers, FiAlertCircle, FiXCircle } from 'react-icons/fi';

import Swal from 'sweetalert2';
import { authFetchResponse } from '../utils/authFetch';

const PendingApprovalView = ({ familyCode, onJoinFamily }) => {
  const [cancelling, setCancelling] = useState(false);

  const handleCancelRequest = async () => {
    if (!familyCode || cancelling) return;

    const confirm = await Swal.fire({
      icon: 'warning',
      title: 'Cancel pending request?',
      text: `Your pending request for ${familyCode} will be cancelled.`,
      showCancelButton: true,
      confirmButtonText: 'Cancel request',
      cancelButtonText: 'Keep waiting',
      confirmButtonColor: '#dc2626',
    });

    if (!confirm.isConfirmed) return;

    setCancelling(true);
    try {
      const response = await authFetchResponse(`/family/member/request-join/${encodeURIComponent(familyCode)}`, {
        method: 'DELETE',
        skipThrow: true,
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.message || 'Unable to cancel the pending request.');
      }

      await Swal.fire({
        icon: 'success',
        title: 'Request cancelled',
        text: json?.message || 'Your pending family request was cancelled.',
      });
      window.location.reload();
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Cancel failed',
        text: error?.message || 'Unable to cancel the pending request.',
      });
    } finally {
      setCancelling(false);
    }
  };

  return (
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

      <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={onJoinFamily}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-primary-200 text-primary-700 font-semibold hover:bg-primary-50 transition"
        >
          <FiUsers size={18} />
          Use a different family code
        </button>
        <button
          onClick={handleCancelRequest}
          disabled={cancelling}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-red-200 text-red-700 font-semibold hover:bg-red-50 transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <FiXCircle size={18} />
          {cancelling ? 'Cancelling...' : 'Cancel request'}
        </button>
      </div>

      <p className="text-xs text-gray-500">
        Switching family codes replaces the current pending request.
      </p>
    </div>
  </div>
  );
};

PendingApprovalView.propTypes = {
  familyCode: PropTypes.string,
  onJoinFamily: PropTypes.func.isRequired,
};

export default PendingApprovalView;