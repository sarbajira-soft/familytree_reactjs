import React from 'react';
import PropTypes from 'prop-types';
import { BlockButton } from './BlockButton';
import { BLOCK_MESSAGES } from '../../constants/block.constants';

/** BLOCK OVERRIDE: Limited profile view for blocker-side access while target remains blocked. */
export const BlockerProfileView = ({
  userId,
  userName,
  profilePhoto = null,
  isBlockedByMe = false,
  onStatusChange = null,
}) => {
  return (
    <section className="mx-auto max-w-xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <img
          src={profilePhoto || '/assets/user.png'}
          alt={`${userName} profile`}
          className="h-16 w-16 rounded-full object-cover"
        />
        <h1 className="text-lg font-semibold text-gray-900">{userName}</h1>
      </div>

      <p className="mt-4 text-sm text-gray-600">{BLOCK_MESSAGES.blockerViewDescription}</p>

      <div className="mt-4">
        <BlockButton
          userId={userId}
          isBlockedByMe={isBlockedByMe}
          location="profile"
          userName={userName}
          onStatusChange={onStatusChange}
        />
      </div>
    </section>
  );
};

BlockerProfileView.propTypes = {
  userId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  userName: PropTypes.string.isRequired,
  profilePhoto: PropTypes.string,
  isBlockedByMe: PropTypes.bool,
  onStatusChange: PropTypes.func,
};
