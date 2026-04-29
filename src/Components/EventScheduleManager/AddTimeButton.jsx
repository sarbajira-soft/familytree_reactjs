import React from "react";
import PropTypes from "prop-types";
import { FiPlus } from "react-icons/fi";

const AddTimeButton = ({ disabled = false, onClick, title = "" }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-primary-700 transition hover:border-primary-300 hover:bg-primary-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 dark:border-slate-700 dark:bg-slate-900 dark:text-primary-200 dark:hover:border-primary-400/50 dark:hover:bg-primary-500/10 dark:disabled:text-slate-500"
  >
    <FiPlus size={14} />
    <span>Add Time</span>
  </button>
);

AddTimeButton.propTypes = {
  disabled: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
  title: PropTypes.string,
};

export default AddTimeButton;
