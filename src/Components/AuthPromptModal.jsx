import React from 'react';
import PropTypes from 'prop-types';

const AuthPromptModal = ({ isOpen, onClose, onLogin, onRegister, contentLabel }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 px-4"
      onClick={() => onClose?.()}
    >
      <div
        className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-xl font-semibold text-gray-900">Sign in to continue</h3>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          You can view this public {contentLabel} without an account, but liking and commenting require login.
        </p>
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => onLogin?.()}
            className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => onRegister?.()}
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="w-full rounded-2xl px-4 py-3 text-sm font-medium text-gray-500 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

AuthPromptModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  onLogin: PropTypes.func,
  onRegister: PropTypes.func,
  contentLabel: PropTypes.string,
};

AuthPromptModal.defaultProps = {
  isOpen: false,
  onClose: undefined,
  onLogin: undefined,
  onRegister: undefined,
  contentLabel: 'post',
};

export default AuthPromptModal;
