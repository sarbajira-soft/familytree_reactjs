import React from "react";

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = "Delete",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[999]">
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 w-[90%] max-w-sm shadow-xl animate-fadeIn border border-transparent dark:border-slate-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{title}</h3>

        {message && <p className="text-sm text-gray-600 dark:text-slate-300 mt-2">{message}</p>}

        <div className="flex justify-end gap-3 mt-5">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-100 hover:bg-gray-300 dark:hover:bg-slate-600"
          >
            {cancelText}
          </button>

          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
