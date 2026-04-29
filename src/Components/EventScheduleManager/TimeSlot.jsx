import React from "react";
import PropTypes from "prop-types";
import { FiClock, FiTrash2 } from "react-icons/fi";

const TimeSlot = ({
  slot,
  errors = null,
  onChange,
  onRemove,
  isDark = false,
  disabled = false,
}) => (
  <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
          Start time
        </label>
        <div className="relative">
          <input
            type="time"
            value={slot.startTime}
            onChange={(event) => onChange(slot.id, "startTime", event.target.value)}
            disabled={disabled}
            style={{ colorScheme: isDark ? "dark" : "light" }}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 pr-10 text-sm text-gray-900 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-500/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400 dark:text-slate-500">
            <FiClock size={14} />
          </div>
        </div>
        {errors?.startTime ? (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.startTime}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
          End time
        </label>
        <div className="relative">
          <input
            type="time"
            value={slot.endTime}
            onChange={(event) => onChange(slot.id, "endTime", event.target.value)}
            disabled={disabled}
            style={{ colorScheme: isDark ? "dark" : "light" }}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 pr-10 text-sm text-gray-900 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-500/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400 dark:text-slate-500">
            <FiClock size={14} />
          </div>
        </div>
        {errors?.endTime ? (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.endTime}</p>
        ) : null}
      </div>

      <div className="flex sm:justify-end">
        <button
          type="button"
          onClick={() => onRemove(slot.id)}
          disabled={disabled}
          className="inline-flex items-center justify-center rounded-lg border border-transparent p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
          title="Remove time slot"
        >
          <FiTrash2 size={16} />
        </button>
      </div>
    </div>
  </div>
);

TimeSlot.propTypes = {
  slot: PropTypes.shape({
    id: PropTypes.string.isRequired,
    startTime: PropTypes.string,
    endTime: PropTypes.string,
  }).isRequired,
  errors: PropTypes.shape({
    startTime: PropTypes.string,
    endTime: PropTypes.string,
  }),
  onChange: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  isDark: PropTypes.bool,
  disabled: PropTypes.bool,
};

export default TimeSlot;
