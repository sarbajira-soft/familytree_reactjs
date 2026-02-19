import React from 'react';
import PropTypes from 'prop-types';
import { BLOCK_MESSAGES } from '../../constants/block.constants';

/** BLOCK OVERRIDE: Dedicated blocked profile screen for users blocked by profile owner. */
export const BlockedProfileView = ({ onBack }) => (
  <main className="mx-auto max-w-xl p-6" role="main" aria-label="Blocked profile">
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <h1 className="text-xl font-bold text-red-700">{`🚫 ${BLOCK_MESSAGES.blockedProfileTitle}`}</h1>
      <p className="mt-3 text-sm text-red-800">{BLOCK_MESSAGES.blockedProfileDescription}</p>
      <button
        type="button"
        aria-label="Go back"
        className="mt-5 rounded-lg bg-gray-800 px-4 py-2 text-sm text-white"
        onClick={onBack}
      >
        Back
      </button>
    </div>
  </main>
);

BlockedProfileView.propTypes = {
  onBack: PropTypes.func.isRequired,
};
