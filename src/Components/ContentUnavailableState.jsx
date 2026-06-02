import React from 'react';
import PropTypes from 'prop-types';

const ContentUnavailableState = ({
  title = 'This content is unavailable',
  description = 'The post may have been removed or is no longer public.',
  action = null
}) => {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#eff6ff,white_55%)] px-4 py-10">
      <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center rounded-[32px] border border-gray-200 bg-white/95 px-6 py-10 text-center shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="mb-5 h-16 w-16 rounded-full bg-gray-100" />
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-gray-500">{description}</p>
        {action || null}
      </div>
    </div>
  );
};

ContentUnavailableState.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  action: PropTypes.node,
};

export default ContentUnavailableState;
