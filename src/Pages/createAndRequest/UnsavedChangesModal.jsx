import React from "react";

const UnsavedChangesModal = ({ isOpen, onSave, onDiscard, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="custom-confirm-modal-container fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-[0_24px_50px_rgba(15,23,42,0.18)] max-w-md sm:max-w-lg w-full border border-gray-100 dark:border-slate-800 p-6 flex flex-col items-center text-center animate-scaleIn duration-150">
        <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/20 rounded-full flex items-center justify-center border border-amber-200 dark:border-amber-900/50 mb-4 animate-pulse">
          <svg
            className="w-8 h-8 text-amber-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h3 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">
          Unsaved Changes
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 px-2">
          You have unsaved changes in this tree draft. Do you want to save before leaving?
        </p>

        {/* Buttons in Row on Web (sm:flex-row), Column on Mobile (flex-col) */}
        <div className="flex flex-col sm:flex-row w-full gap-2 sm:justify-center">
          <button
            onClick={onSave}
            className="w-full sm:w-auto sm:flex-1 py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all active:scale-[0.98]"
          >
            Save & Exit
          </button>
          
          <button
            onClick={onDiscard}
            className="w-full sm:w-auto sm:flex-1 py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 dark:text-rose-400 text-xs font-bold rounded-xl transition-all active:scale-[0.98]"
          >
            Discard & Exit
          </button>

          <button
            onClick={onCancel}
            className="w-full sm:w-auto sm:flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all active:scale-[0.98]"
          >
            Keep Editing
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnsavedChangesModal;
