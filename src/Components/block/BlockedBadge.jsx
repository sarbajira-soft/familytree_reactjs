import React from 'react';
import PropTypes from 'prop-types';
import { BLOCK_BADGE_STYLES } from '../../constants/block.constants';

/** BLOCK OVERRIDE: Dedicated blocked badge with mandatory red pill style. */
export const BlockedBadge = ({ className = '' }) => (
  <span
    aria-label="Blocked user"
    className={className}
    style={BLOCK_BADGE_STYLES}
  >
    Blocked
  </span>
);

BlockedBadge.propTypes = {
  className: PropTypes.string,
};
