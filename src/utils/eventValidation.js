export const MAX_EVENT_DATES = 5;
export const MAX_TIME_SLOTS_PER_DATE = 3;
export const MAX_SCHEDULE_TITLE_LENGTH = 25;
export const EVENT_DATE_MIN = "1900-01-01";
export const EVENT_DATE_MAX = "2100-12-31";
export const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_24H_REGEX = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
const TIME_24H_WITH_OPTIONAL_SECONDS_REGEX =
  /^([01]?[0-9]|2[0-3]):([0-5][0-9])(?::([0-5][0-9]))?$/;
export const EVENT_SCHEDULE_REQUIRED_MESSAGE =
  "At least one date with a time slot is required, or mark the date as all-day.";

let scheduleCounter = 0;
let timeCounter = 0;

const nextScheduleId = () => {
  scheduleCounter += 1;
  return `schedule-${Date.now()}-${scheduleCounter}`;
};

const nextTimeId = () => {
  timeCounter += 1;
  return `time-${Date.now()}-${timeCounter}`;
};

const asTrimmedString = (value) => String(value ?? "").trim();

const normalizeTimeValue = (value) => {
  const cleaned = asTrimmedString(value);
  if (!cleaned) {
    return "";
  }

  const match = cleaned.match(TIME_24H_WITH_OPTIONAL_SECONDS_REGEX);
  if (!match) {
    return cleaned;
  }

  const [, hour, minute] = match;
  return `${String(hour).padStart(2, "0")}:${minute}`;
};

const isValidDateOnlyString = (value) => {
  if (!DATE_ONLY_REGEX.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() + 1 === month &&
    candidate.getUTCDate() === day
  );
};

const normalizeBoolean = (value) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value === 1;
  }
  const normalized = asTrimmedString(value).toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
};

const sortTimeSlots = (slots = []) =>
  [...slots].sort((left, right) =>
    asTrimmedString(left?.startTime).localeCompare(asTrimmedString(right?.startTime)),
  );

const hasMeaningfulTimeValue = (slots = []) =>
  (Array.isArray(slots) ? slots : []).some(
    (slot) => asTrimmedString(slot?.startTime) || asTrimmedString(slot?.endTime),
  );

export const createEmptyTimeSlot = (values = {}) => ({
  id: values.id || nextTimeId(),
  startTime: normalizeTimeValue(values.startTime),
  endTime: normalizeTimeValue(values.endTime),
});

export const createEmptySchedule = (values = {}) => {
  const isAllDay = normalizeBoolean(values.isAllDay);
  const inputTimes = Array.isArray(values.times)
    ? values.times
    : Array.isArray(values.timeSlots)
      ? values.timeSlots
      : [];

  const normalizedTimes = inputTimes.length
    ? sortTimeSlots(inputTimes.map((time) => createEmptyTimeSlot(time)))
    : isAllDay
      ? []
      : [createEmptyTimeSlot()];

  return {
    id: values.id || nextScheduleId(),
    scheduleTitle: asTrimmedString(
      values.scheduleTitle || values.schedule_title || values.title || values.eventName,
    ),
    scheduleDate: asTrimmedString(values.scheduleDate || values.date),
    isAllDay,
    sortOrder: Number.isFinite(Number(values.sortOrder)) ? Number(values.sortOrder) : 0,
    times: normalizedTimes,
  };
};

export const isScheduleDraftBlank = (schedule = {}) => {
  const normalizedSchedule = createEmptySchedule(schedule);

  return (
    !asTrimmedString(normalizedSchedule.scheduleTitle) &&
    !asTrimmedString(normalizedSchedule.scheduleDate) &&
    !Boolean(normalizedSchedule.isAllDay) &&
    !hasMeaningfulTimeValue(normalizedSchedule.times)
  );
};

const getSchedulesForSubmission = (schedules = []) =>
  mergeSchedulesByDate(schedules).filter((schedule) => !isScheduleDraftBlank(schedule));

export const mergeSchedulesByDate = (schedules = []) => {
  const safeSchedules = Array.isArray(schedules) ? schedules : [];
  return safeSchedules.map((rawSchedule, index) => {
    const schedule = createEmptySchedule({
      ...rawSchedule,
      times:
        Array.isArray(rawSchedule?.times) && rawSchedule.times.length > 0
          ? rawSchedule.times
          : rawSchedule?.isAllDay
            ? []
            : Array.isArray(rawSchedule?.times)
              ? []
              : Array.isArray(rawSchedule?.timeSlots)
                ? rawSchedule.timeSlots
                : rawSchedule?.times,
    });
    const normalizedTimes = schedule.isAllDay
      ? []
      : sortTimeSlots(
          (Array.isArray(schedule.times) && schedule.times.length > 0
            ? schedule.times
            : [createEmptyTimeSlot()]).map((time) => createEmptyTimeSlot(time)),
        );

    return {
      ...schedule,
      sortOrder: index,
      times: normalizedTimes,
    };
  });
};

export const normalizeEventSchedulesInput = (input) => {
  const fallbackScheduleTitle = asTrimmedString(input?.eventTitle || input?.title);
  const rawSchedules = Array.isArray(input)
    ? input
    : Array.isArray(input?.schedules)
      ? input.schedules
      : [];

  if (rawSchedules.length > 0) {
    return mergeSchedulesByDate(
      rawSchedules.map((schedule, index) =>
        createEmptySchedule({
          id: schedule.id,
          scheduleTitle:
            schedule.scheduleTitle ||
            schedule.schedule_title ||
            schedule.title ||
            schedule.eventName ||
            fallbackScheduleTitle,
          scheduleDate: schedule.scheduleDate || schedule.schedule_date,
          isAllDay: schedule.isAllDay,
          sortOrder: schedule.sortOrder ?? index,
          times:
            Array.isArray(schedule.times) && schedule.times.length > 0
              ? schedule.times
              : Array.isArray(schedule.timeSlots)
                ? schedule.timeSlots
                : [],
        }),
      ),
    );
  }

  const fallbackDate = asTrimmedString(input?.eventDate || input?.date);
  const fallbackTime = asTrimmedString(input?.eventTime || input?.time);

  if (fallbackDate) {
    return [
      createEmptySchedule({
        scheduleTitle: fallbackScheduleTitle,
        scheduleDate: fallbackDate,
        isAllDay: !fallbackTime || fallbackTime.toLowerCase() === "all day",
        times:
          !fallbackTime || fallbackTime.toLowerCase() === "all day"
            ? []
            : [createEmptyTimeSlot({ startTime: fallbackTime })],
      }),
    ];
  }

  return [createEmptySchedule()];
};

export const toApiSchedules = (schedules = []) =>
  getSchedulesForSubmission(schedules).map((schedule, index) => ({
    scheduleTitle: asTrimmedString(schedule.scheduleTitle),
    scheduleDate: asTrimmedString(schedule.scheduleDate),
    isAllDay: Boolean(schedule.isAllDay),
    sortOrder: index,
    times: Boolean(schedule.isAllDay)
      ? []
      : sortTimeSlots(schedule.times).map((time) => ({
          startTime: normalizeTimeValue(time.startTime),
          ...(normalizeTimeValue(time.endTime)
            ? { endTime: normalizeTimeValue(time.endTime) }
            : {}),
        })),
  }));

export const getLegacyEventDateTime = (schedules = []) => {
  const firstSchedule = toApiSchedules(schedules)[0];
  if (!firstSchedule) {
    return { eventDate: "", eventTime: "" };
  }

  return {
    eventDate: firstSchedule.scheduleDate,
    eventTime: firstSchedule.isAllDay ? "" : normalizeTimeValue(firstSchedule.times?.[0]?.startTime),
  };
};

export const validateEventSchedules = (schedules = [], options = {}) => {
  const normalizedSchedules = getSchedulesForSubmission(schedules);
  const todayString = options.todayString || new Date().toISOString().split("T")[0];
  const errors = {
    general: "",
    dates: {},
  };
  const warnings = {
    dates: {},
  };
  let hasPastDates = false;

  if (!normalizedSchedules.length) {
    errors.general = EVENT_SCHEDULE_REQUIRED_MESSAGE;
    return {
      isValid: false,
      errors,
      warnings,
      normalizedSchedules,
      hasPastDates,
    };
  }

  if (normalizedSchedules.length > MAX_EVENT_DATES) {
    errors.general = `You can add up to ${MAX_EVENT_DATES} dates per event.`;
  }

  normalizedSchedules.forEach((schedule, index) => {
    const scheduleErrors = {
      scheduleTitle: "",
      scheduleDate: "",
      general: "",
      times: {},
    };

    const scheduleTitle = asTrimmedString(schedule.scheduleTitle);
    if (!scheduleTitle) {
      scheduleErrors.scheduleTitle = "Event name is required.";
    } else if (scheduleTitle.length > MAX_SCHEDULE_TITLE_LENGTH) {
      scheduleErrors.scheduleTitle =
        `Schedule name must be ${MAX_SCHEDULE_TITLE_LENGTH} characters or less.`;
    }

    const scheduleDate = asTrimmedString(schedule.scheduleDate);
    if (!scheduleDate) {
      scheduleErrors.scheduleDate = "Event date is required.";
    } else if (!isValidDateOnlyString(scheduleDate)) {
      scheduleErrors.scheduleDate = "Enter a valid date in YYYY-MM-DD format.";
    } else {
      const previousSchedule = normalizedSchedules[index - 1];
      const previousScheduleDate = asTrimmedString(previousSchedule?.scheduleDate);

      if (scheduleDate < EVENT_DATE_MIN || scheduleDate > EVENT_DATE_MAX) {
        scheduleErrors.scheduleDate = `Date must be between ${EVENT_DATE_MIN} and ${EVENT_DATE_MAX}.`;
      } else if (previousScheduleDate && scheduleDate <= previousScheduleDate) {
        scheduleErrors.scheduleDate = "Each date must be later than the previous date.";
      }
      if (scheduleDate < todayString) {
        warnings.dates[schedule.id] = {
          ...(warnings.dates[schedule.id] || {}),
          scheduleDate: "This date is in the past. You can still save after confirming.",
        };
        hasPastDates = true;
      }
    }

    const timeSlots = Array.isArray(schedule.times) ? sortTimeSlots(schedule.times) : [];
    if (schedule.isAllDay && timeSlots.length > 0) {
      scheduleErrors.general = "All-day dates cannot contain time slots.";
    }

    if (!schedule.isAllDay && timeSlots.length < 1) {
      scheduleErrors.general = "Add at least one time slot or mark this date as all-day.";
    }

    if (timeSlots.length > MAX_TIME_SLOTS_PER_DATE) {
      scheduleErrors.general = `You can add up to ${MAX_TIME_SLOTS_PER_DATE} time slots for one date.`;
    }

    const seenStartTimes = new Set();
    timeSlots.forEach((time) => {
      const timeErrors = {};
      const startTime = normalizeTimeValue(time.startTime);
      const endTime = normalizeTimeValue(time.endTime);

      if (!TIME_24H_REGEX.test(startTime)) {
        timeErrors.startTime = "Use HH:MM in 24-hour format.";
      }

      if (endTime && !TIME_24H_REGEX.test(endTime)) {
        timeErrors.endTime = "Use HH:MM in 24-hour format.";
      }

      if (startTime && seenStartTimes.has(startTime)) {
        timeErrors.startTime = "Duplicate start times are not allowed.";
      }

      if (startTime) {
        seenStartTimes.add(startTime);
      }

      if (startTime && endTime && endTime <= startTime) {
        timeErrors.endTime = "End time must be after the start time.";
      }

      if (Object.keys(timeErrors).length > 0) {
        scheduleErrors.times[time.id] = timeErrors;
      }
    });

    if (
      scheduleErrors.scheduleTitle ||
      scheduleErrors.scheduleDate ||
      scheduleErrors.general ||
      Object.keys(scheduleErrors.times).length > 0
    ) {
      errors.dates[schedule.id] = scheduleErrors;
    }
  });

  return {
    isValid:
      !errors.general &&
      Object.keys(errors.dates).length === 0,
    errors,
    warnings,
    normalizedSchedules,
    hasPastDates,
  };
};

export const formatEventDateLabel = (rawDate) => {
  const cleaned = asTrimmedString(rawDate);
  if (!cleaned) {
    return "";
  }

  if (DATE_ONLY_REGEX.test(cleaned)) {
    const [year, month, day] = cleaned.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(parsed);
    }
  }

  const parsed = new Date(cleaned);
  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(parsed);
  }

  return cleaned;
};

export const formatEventTimeLabel = (rawTime) => {
  const cleaned = normalizeTimeValue(rawTime);
  if (!cleaned) {
    return "";
  }

  const normalized = cleaned.length === 5 ? `${cleaned}:00` : cleaned;
  const parsed = new Date(`1970-01-01T${normalized}`);
  if (Number.isNaN(parsed.getTime())) {
    return cleaned;
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
};

export const formatTimeRangeLabel = (timeSlot = {}) => {
  const startTime = asTrimmedString(timeSlot.startTime);
  const endTime = asTrimmedString(timeSlot.endTime);

  if (!startTime) {
    return "All day";
  }

  if (!endTime) {
    return formatEventTimeLabel(startTime);
  }

  return `${formatEventTimeLabel(startTime)} - ${formatEventTimeLabel(endTime)}`;
};

export const getNextUpcomingSchedule = (schedules = [], todayString) => {
  const normalizedSchedules = mergeSchedulesByDate(schedules);
  const compareDate = todayString || new Date().toISOString().split("T")[0];

  return (
    normalizedSchedules.find((schedule) => asTrimmedString(schedule.scheduleDate) >= compareDate) ||
    normalizedSchedules[0] ||
    null
  );
};

export const formatScheduleHeadline = (schedule) => {
  if (!schedule) {
    return "";
  }

  const scheduleTitle = asTrimmedString(schedule.scheduleTitle);
  const formattedDate = formatEventDateLabel(schedule.scheduleDate);
  if (schedule.isAllDay) {
    const headline = `${formattedDate} all day`;
    return scheduleTitle ? `${scheduleTitle} - ${headline}` : headline;
  }

  const firstTime = Array.isArray(schedule.times) ? schedule.times[0] : null;
  if (!firstTime) {
    return scheduleTitle ? `${scheduleTitle} - ${formattedDate}` : formattedDate;
  }

  const headline = `${formattedDate} at ${formatTimeRangeLabel(firstTime)}`;
  return scheduleTitle ? `${scheduleTitle} - ${headline}` : headline;
};
