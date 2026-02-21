import React from 'react';
import PropTypes from 'prop-types';

const LoadingSpinner = ({
  type = 'generic', // 'generic', 'card', 'list', 'text'
  text = 'Loading...',
  fullScreen = false,
  className = ''
}) => {

  const renderShimmer = () => {
    switch (type) {
      case 'card':
        return (
          <div className="w-full bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4 shimmer">
            <div className="w-full h-32 bg-gray-200 dark:bg-slate-800 rounded-lg relative overflow-hidden mb-4"><div className="shimmer-glow"></div></div>
            <div className="w-3/4 h-4 bg-gray-200 dark:bg-slate-800 rounded relative overflow-hidden mb-2"><div className="shimmer-glow"></div></div>
            <div className="w-1/2 h-3 bg-gray-200 dark:bg-slate-800 rounded relative overflow-hidden"><div className="shimmer-glow"></div></div>
          </div>
        );
      case 'list':
        return (
          <div className="w-full flex items-center gap-4 shimmer p-2">
            <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-slate-800 relative overflow-hidden flex-shrink-0"><div className="shimmer-glow"></div></div>
            <div className="flex-1">
              <div className="w-2/3 h-4 bg-gray-200 dark:bg-slate-800 rounded relative overflow-hidden mb-2"><div className="shimmer-glow"></div></div>
              <div className="w-1/3 h-3 bg-gray-200 dark:bg-slate-800 rounded relative overflow-hidden"><div className="shimmer-glow"></div></div>
            </div>
          </div>
        );
      case 'text':
        return (
          <div className="w-full space-y-2 shimmer">
            <div className="w-full h-3 bg-gray-200 dark:bg-slate-800 rounded relative overflow-hidden"><div className="shimmer-glow"></div></div>
            <div className="w-5/6 h-3 bg-gray-200 dark:bg-slate-800 rounded relative overflow-hidden"><div className="shimmer-glow"></div></div>
            <div className="w-4/6 h-3 bg-gray-200 dark:bg-slate-800 rounded relative overflow-hidden"><div className="shimmer-glow"></div></div>
          </div>
        );
      case 'generic':
      default:
        return (
          <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-slate-800 relative overflow-hidden shimmer mx-auto mb-4">
            <div className="shimmer-glow"></div>
          </div>
        );
    }
  };

  const content = (
    <div className={`flex flex-col items-center justify-center w-full ${className}`}>
      {renderShimmer()}
      {text && type === 'generic' && (
        <p className="text-gray-500 font-medium animate-pulse">{text}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {content}
        </div>
      </div>
    );
  }

  return content;
};

LoadingSpinner.propTypes = {
  type: PropTypes.oneOf(['generic', 'card', 'list', 'text']),
  text: PropTypes.string,
  fullScreen: PropTypes.bool,
  className: PropTypes.string,
};

export default LoadingSpinner; 