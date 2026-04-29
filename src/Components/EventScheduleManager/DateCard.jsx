import React from "react";
import PropTypes from "prop-types";
import {
  FiAlertCircle,
  FiArrowDown,
  FiArrowUp,
  FiCalendar,
  FiTrash2,
} from "react-icons/fi";
import TimeSlot from "./TimeSlot";
import AddTimeButton from "./AddTimeButton";
import { MAX_TIME_SLOTS_PER_DATE } from "../../utils/eventValidation";

const DateCard = ({
  schedule,
  index,
  totalSchedules,
  errors,
  warnings,
  onDateChange,
  onToggleAllDay,
  onMove,
  onRemoveDate,
  onAddTime,
  onTimeChange,
  onRemoveTime,
  isDark,
  disabled,
}) => {
  const timeCount = Array.isArray(schedule.times) ? schedule.times.length : 0;
  const addTimeDisabled = disabled || schedule.isAllDay || timeCount >= MAX_TIME_SLOTS_PER_DATE;
  const addTimeTitle = schedule.isAllDay
    ? "Turn off all-day to add time slots."
    : timeCount >= MAX_TIME_SLOTS_PER_DATE
      ? `You can add up to ${MAX_TIME_SLOTS_PER_DATE} time slots for one date.`
      : "Add another time slot";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950/90">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-200">
            Date {index + 1}
          </p>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {schedule.isAllDay ? "All-day event" : `${timeCount} time slot${timeCount === 1 ? "" : "s"}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onMove(schedule.id, -1)}
            disabled={disabled || index === 0}
            className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:border-primary-300 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-primary-400/50 dark:hover:text-primary-200"
            title="Move date up"
          >
            <FiArrowUp size={15} />
          </button>
          <button
            type="button"
            onClick={() => onMove(schedule.id, 1)}
            disabled={disabled || index === totalSchedules - 1}
            className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:border-primary-300 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-primary-400/50 dark:hover:text-primary-200"
            title="Move date down"
          >
            <FiArrowDown size={15} />
          </button>
          <button
            type="button"
            onClick={() => onRemoveDate(schedule.id)}
            disabled={disabled}
            className="rounded-lg border border-transparent p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-red-500/10 dark:hover:text-red-300"
            title="Remove date"
          >
            <FiTrash2 size={15} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-slate-200">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-200">
              <FiCalendar size={12} />
            </span>
            Event date
          </label>
          <input
            type="date"
            value={schedule.scheduleDate}
            onChange={(event) => onDateChange(schedule.id, event.target.value)}
            disabled={disabled}
            min="1900-01-01"
            max="2100-12-31"
            style={{ colorScheme: isDark ? "dark" : "light" }}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-500/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          {errors?.scheduleDate ? (
            <p className="text-xs text-red-600 dark:text-red-400">{errors.scheduleDate}</p>
          ) : null}
          {warnings?.scheduleDate ? (
            <p className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-300">
              <FiAlertCircle size={13} className="mt-0.5 flex-shrink-0" />
              <span>{warnings.scheduleDate}</span>
            </p>
          ) : null}
        </div>

        <label className="inline-flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <input
            type="checkbox"
            checked={Boolean(schedule.isAllDay)}
            onChange={(event) => onToggleAllDay(schedule.id, event.target.checked)}
            disabled={disabled}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span>All day</span>
        </label>
      </div>

      {errors?.general ? (
        <p className="mt-3 text-xs text-red-600 dark:text-red-400">{errors.general}</p>
      ) : null}

      <div className="mt-4 space-y-3">
        {!schedule.isAllDay && Array.isArray(schedule.times) && schedule.times.length > 0 ? (
          schedule.times.map((slot) => (
            <TimeSlot
              key={slot.id}
              slot={slot}
              errors={errors?.times?.[slot.id] || null}
              onChange={(timeId, field, value) => onTimeChange(schedule.id, timeId, field, value)}
              onRemove={(timeId) => onRemoveTime(schedule.id, timeId)}
              isDark={isDark}
              disabled={disabled}
            />
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
            This date will be treated as an all-day event.
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-start">
        <AddTimeButton
          onClick={() => onAddTime(schedule.id)}
          disabled={addTimeDisabled}
          title={addTimeTitle}
        />
      </div>
    </div>
  );
};

DateCard.propTypes = {
  schedule: PropTypes.shape({
    id: PropTypes.string.isRequired,
    scheduleDate: PropTypes.string,
    isAllDay: PropTypes.bool,
    times: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        startTime: PropTypes.string,
        endTime: PropTypes.string,
      }),
    ),
  }).isRequired,
  index: PropTypes.number.isRequired,
  totalSchedules: PropTypes.number.isRequired,
  errors: PropTypes.shape({
    scheduleDate: PropTypes.string,
    general: PropTypes.string,
    times: PropTypes.object,
  }),
  warnings: PropTypes.shape({
    scheduleDate: PropTypes.string,
  }),
  onDateChange: PropTypes.func.isRequired,
  onToggleAllDay: PropTypes.func.isRequired,
  onMove: PropTypes.func.isRequired,
  onRemoveDate: PropTypes.func.isRequired,
  onAddTime: PropTypes.func.isRequired,
  onTimeChange: PropTypes.func.isRequired,
  onRemoveTime: PropTypes.func.isRequired,
  isDark: PropTypes.bool,
  disabled: PropTypes.bool,
};

DateCard.defaultProps = {
  errors: null,
  warnings: null,
  isDark: false,
  disabled: false,
};

export default DateCard;
