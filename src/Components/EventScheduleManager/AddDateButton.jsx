import React from "react";
import PropTypes from "prop-types";
import { FiPlusCircle } from "react-icons/fi";

const AddDateButton = ({ disabled, onClick, remainingCount, title }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary-300 px-4 py-3 text-sm font-semibold text-primary-700 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-transparent dark:border-primary-400/50 dark:text-primary-200 dark:hover:bg-primary-500/10 dark:disabled:border-slate-700 dark:disabled:text-slate-500"
  >
    <FiPlusCircle size={16} />
    <span>Add Date</span>
    <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-bold text-primary-700 dark:bg-primary-500/15 dark:text-primary-200">
      {remainingCount}
    </span>
  </button>
);

AddDateButton.propTypes = {
  disabled: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
  remainingCount: PropTypes.number.isRequired,
  title: PropTypes.string,
};

AddDateButton.defaultProps = {
  disabled: false,
  title: "",
};

export default AddDateButton;
