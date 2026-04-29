import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import Swal from "sweetalert2";
import { FiAlertCircle, FiCalendar } from "react-icons/fi";
import AddDateButton from "./AddDateButton";
import DateCard from "./DateCard";
import {
  MAX_EVENT_DATES,
  MAX_TIME_SLOTS_PER_DATE,
  createEmptySchedule,
  createEmptyTimeSlot,
  mergeSchedulesByDate,
} from "../../utils/eventValidation";

const skeletonRows = Array.from({ length: 2 }, (_, index) => index);

const EventScheduleManager = ({
  value,
  onChange,
  errors = null,
  warnings = null,
  isDark = false,
  disabled = false,
  isLoading = false,
}) => {
  const [actionError, setActionError] = useState("");

  const schedules = useMemo(
    () =>
      mergeSchedulesByDate(
        Array.isArray(value) && value.length > 0 ? value : [createEmptySchedule()],
      ),
    [value],
  );

  const commitSchedules = (nextSchedules) => {
    setActionError("");
    onChange(
      mergeSchedulesByDate(nextSchedules).map((schedule, index) => ({
        ...schedule,
        sortOrder: index,
      })),
    );
  };

  const handleAddDate = () => {
    if (schedules.length >= MAX_EVENT_DATES) {
      setActionError(`You can add up to ${MAX_EVENT_DATES} dates per event.`);
      return;
    }

    commitSchedules([...schedules, createEmptySchedule()]);
  };

  const handleDateChange = (scheduleId, scheduleDate) => {
    commitSchedules(
      schedules.map((schedule) =>
        schedule.id === scheduleId ? { ...schedule, scheduleDate } : schedule,
      ),
    );
  };

  const handleToggleAllDay = (scheduleId, isAllDay) => {
    commitSchedules(
      schedules.map((schedule) =>
        schedule.id === scheduleId
          ? {
              ...schedule,
              isAllDay,
              times: isAllDay
                ? []
                : Array.isArray(schedule.times) && schedule.times.length > 0
                  ? schedule.times
                  : [createEmptyTimeSlot()],
            }
          : schedule,
      ),
    );
  };

  const handleMoveSchedule = (scheduleId, direction) => {
    const currentIndex = schedules.findIndex((schedule) => schedule.id === scheduleId);
    const targetIndex = currentIndex + direction;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= schedules.length) {
      return;
    }

    const nextSchedules = [...schedules];
    const [movedItem] = nextSchedules.splice(currentIndex, 1);
    nextSchedules.splice(targetIndex, 0, movedItem);
    commitSchedules(nextSchedules);
  };

  const handleRemoveDate = async (scheduleId) => {
    if (schedules.length <= 1) {
      setActionError("Add another date before removing this one.");
      return;
    }

    const result = await Swal.fire({
      icon: "warning",
      title: "Remove this date?",
      text: "This will remove the date and all of its time slots.",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#2563eb",
      confirmButtonText: "Remove date",
    });

    if (!result.isConfirmed) {
      return;
    }

    commitSchedules(schedules.filter((schedule) => schedule.id !== scheduleId));
  };

  const handleAddTime = (scheduleId) => {
    commitSchedules(
      schedules.map((schedule) => {
        if (schedule.id !== scheduleId) {
          return schedule;
        }

        const currentTimes = Array.isArray(schedule.times) ? schedule.times : [];
        if (currentTimes.length >= MAX_TIME_SLOTS_PER_DATE) {
          setActionError(
            `You can add up to ${MAX_TIME_SLOTS_PER_DATE} time slots for one date.`,
          );
          return schedule;
        }

        return {
          ...schedule,
          isAllDay: false,
          times: [...currentTimes, createEmptyTimeSlot()],
        };
      }),
    );
  };

  const handleTimeChange = (scheduleId, timeId, field, fieldValue) => {
    commitSchedules(
      schedules.map((schedule) =>
        schedule.id === scheduleId
          ? {
              ...schedule,
              times: (schedule.times || []).map((time) =>
                time.id === timeId ? { ...time, [field]: fieldValue } : time,
              ),
            }
          : schedule,
      ),
    );
  };

  const handleRemoveTime = (scheduleId, timeId) => {
    commitSchedules(
      schedules.map((schedule) => {
        if (schedule.id !== scheduleId) {
          return schedule;
        }

        const nextTimes = (schedule.times || []).filter((time) => time.id !== timeId);
        return {
          ...schedule,
          times: nextTimes,
        };
      }),
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {skeletonRows.map((row) => (
          <div
            key={row}
            className="animate-pulse rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950/90"
          >
            <div className="h-4 w-24 rounded bg-gray-200 dark:bg-slate-700" />
            <div className="mt-4 h-11 w-full rounded-xl bg-gray-200 dark:bg-slate-700" />
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="h-24 rounded-xl bg-gray-200 dark:bg-slate-700" />
              <div className="h-24 rounded-xl bg-gray-200 dark:bg-slate-700" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const topLevelError = errors?.general || actionError;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-slate-100">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-200">
              <FiCalendar size={15} />
            </span>
            Event Schedule
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            Add up to {MAX_EVENT_DATES} dates and {MAX_TIME_SLOTS_PER_DATE} time slots per date.
          </p>
        </div>

        <AddDateButton
          onClick={handleAddDate}
          disabled={disabled || schedules.length >= MAX_EVENT_DATES}
          remainingCount={Math.max(0, MAX_EVENT_DATES - schedules.length)}
          title={
            schedules.length >= MAX_EVENT_DATES
              ? `You can add up to ${MAX_EVENT_DATES} dates per event.`
              : "Add another date"
          }
        />
      </div>

      {topLevelError ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <FiAlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{topLevelError}</span>
        </div>
      ) : null}

      <div className="space-y-4">
        {schedules.map((schedule, index) => (
          <DateCard
            key={schedule.id}
            schedule={schedule}
            index={index}
            totalSchedules={schedules.length}
            errors={errors?.dates?.[schedule.id] || null}
            warnings={warnings?.dates?.[schedule.id] || null}
            onDateChange={handleDateChange}
            onToggleAllDay={handleToggleAllDay}
            onMove={handleMoveSchedule}
            onRemoveDate={handleRemoveDate}
            onAddTime={handleAddTime}
            onTimeChange={handleTimeChange}
            onRemoveTime={handleRemoveTime}
            isDark={isDark}
            disabled={disabled}
          />
        ))}
      </div>
    </section>
  );
};

EventScheduleManager.propTypes = {
  value: PropTypes.arrayOf(PropTypes.object),
  onChange: PropTypes.func.isRequired,
  errors: PropTypes.shape({
    general: PropTypes.string,
    dates: PropTypes.object,
  }),
  warnings: PropTypes.shape({
    dates: PropTypes.object,
  }),
  isDark: PropTypes.bool,
  disabled: PropTypes.bool,
  isLoading: PropTypes.bool,
};

export default EventScheduleManager;
