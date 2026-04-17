import React from 'react';
import { FiWifiOff, FiRefreshCw } from 'react-icons/fi';
import { useTheme } from '../Contexts/ThemeContext';

const OfflineUI = ({ onRetry }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const handleRetry = () => {
    if (typeof onRetry === 'function') {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6 ${
        isDark ? 'bg-slate-900' : 'bg-gray-50'
      }`}
    >
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div
          className={`mx-auto w-24 h-24 rounded-full flex items-center justify-center mb-6 ${
            isDark ? 'bg-slate-800' : 'bg-gray-200'
          }`}
        >
          <FiWifiOff
            size={48}
            className={isDark ? 'text-slate-400' : 'text-gray-500'}
          />
        </div>

        {/* Title */}
        <h1
          className={`text-2xl font-bold mb-3 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}
        >
          No Internet Connection
        </h1>

        {/* Description */}
        <p
          className={`text-base mb-8 ${
            isDark ? 'text-slate-400' : 'text-gray-600'
          }`}
        >
          It looks like you're offline. Please check your internet connection and try again.
        </p>

        {/* Retry Button */}
        <button
          onClick={handleRetry}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-all duration-200 active:scale-95"
        >
          <FiRefreshCw size={20} />
          <span>Retry</span>
        </button>

        {/* Additional Info */}
        <p
          className={`text-sm mt-6 ${
            isDark ? 'text-slate-500' : 'text-gray-500'
          }`}
        >
          Some features may not be available without an internet connection.
        </p>
      </div>
    </div>
  );
};

export default OfflineUI;
