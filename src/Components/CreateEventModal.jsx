import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  FiCalendar,
  FiCheckCircle,
  FiFileText,
  FiImage,
  FiLoader,
  FiMapPin,
  FiPlus,
  FiX,
} from "react-icons/fi";
import Swal from "sweetalert2";
import { useUser } from "../Contexts/UserContext";
import { useTheme } from "../Contexts/ThemeContext";
import { getToken } from "../utils/auth";
import { authFetchResponse } from "../utils/authFetch";
import EventScheduleManager from "./EventScheduleManager";
import {
  createEmptySchedule,
  EVENT_SCHEDULE_REQUIRED_MESSAGE,
  getLegacyEventDateTime,
  mergeSchedulesByDate,
  toApiSchedules,
  validateEventSchedules,
} from "../utils/eventValidation";

const MAX_EVENT_TITLE_LENGTH = 50;
const MAX_EVENT_DESCRIPTION_LENGTH = 250;
const MAX_EVENT_LOCATION_LENGTH = 250;
const MAX_EVENT_IMAGE_COUNT = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/gif",
];
const INVALID_IMAGE_TYPE_ERROR =
  "Only image files (jpeg, png, jpg, gif) are allowed.";
const CREATE_EVENT_FORM_ID = "create-event-form";

const isScheduleBlank = (schedule) =>
  !String(schedule?.scheduleDate || "").trim() &&
  !Boolean(schedule?.isAllDay) &&
  !(Array.isArray(schedule?.times) ? schedule.times : []).some(
    (slot) => String(slot?.startTime || "").trim() || String(slot?.endTime || "").trim(),
  );

const CreateEventModal = ({
  isOpen,
  onClose,
  onEventCreated,
  apiBaseUrl = import.meta.env.VITE_API_BASE_URL,
}) => {
  const { userInfo } = useUser();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [title, setTitle] = useState("");
  const [schedules, setSchedules] = useState([createEmptySchedule()]);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [errors, setErrors] = useState({});
  const [scheduleWarnings, setScheduleWarnings] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [familyCode, setFamilyCode] = useState("");

  const getPreferredFamilyCode = () => String(userInfo?.familyCode || "").trim();

  const getImageKey = (file) =>
    [file?.name, file?.size, file?.lastModified, file?.type].join(":");

  const getMaxImageCountError = () =>
    `You can upload a maximum of ${MAX_EVENT_IMAGE_COUNT} images.`;

  const isDirty = useMemo(() => {
    const hasScheduleDraft = mergeSchedulesByDate(schedules).some((schedule) => !isScheduleBlank(schedule));

    return Boolean(
      String(title || "").trim() ||
      String(location || "").trim() ||
      String(description || "").trim() ||
      images.length > 0 ||
      hasScheduleDraft,
    );
  }, [description, images.length, location, schedules, title]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    if (typeof onClose !== "function") {
      return undefined;
    }
    if (!window.__appModalBackStack) {
      window.__appModalBackStack = [];
    }

    const handler = () => {
      handleClose();
    };

    window.__appModalBackStack.push(handler);

    return () => {
      const stack = window.__appModalBackStack;
      if (!Array.isArray(stack)) {
        return;
      }
      const index = stack.lastIndexOf(handler);
      if (index >= 0) {
        stack.splice(index, 1);
      }
    };
  }, [isOpen, onClose, isDirty, isLoading, showSuccess]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleBeforeUnload = (event) => {
      if (!isDirty || isLoading || showSuccess) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, isLoading, isOpen, showSuccess]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const preferredCode = getPreferredFamilyCode();
    setFamilyCode(preferredCode);
    setSchedules([createEmptySchedule()]);
    setErrors({});
    setScheduleWarnings({});
    setShowSuccess(false);
  }, [isOpen, userInfo?.familyCode]);

  useEffect(() => {
    const nextPreviews = (images || []).map((file) => URL.createObjectURL(file));
    setImagePreviews(nextPreviews);

    return () => {
      nextPreviews.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (error) {
          void error;
        }
      });
    };
  }, [images]);

  const resetForm = () => {
    setTitle("");
    setSchedules([createEmptySchedule()]);
    setLocation("");
    setDescription("");
    setImages([]);
    setErrors({});
    setScheduleWarnings({});
    setIsLoading(false);
    setShowSuccess(false);
    setFamilyCode(getPreferredFamilyCode());
  };

  const confirmDiscardChanges = async () => {
    if (!isDirty || showSuccess) {
      return true;
    }

    const result = await Swal.fire({
      icon: "warning",
      title: "Discard changes?",
      text: "You have unsaved event changes.",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#2563eb",
      confirmButtonText: "Discard",
    });

    return result.isConfirmed;
  };

  const handleClose = async ({ skipConfirm = false } = {}) => {
    if (isLoading) {
      return;
    }

    const canClose = skipConfirm ? true : await confirmDiscardChanges();
    if (!canClose) {
      return;
    }

    resetForm();
    onClose?.();
  };

  const getFriendlyError = (status, rawText) => {
    const text = String(rawText || "");
    const lower = text.toLowerCase();

    const normalizeValidationMessages = (messages) => {
      const values = Array.isArray(messages) ? messages : [messages];
      return values
        .map((message) => String(message || "").trim())
        .filter(Boolean)
        .map((message) => {
          if (message === "eventTitle should not be empty") {
            return "Event title is required.";
          }
          if (message === "Event title must be at most 50 characters") {
            return "Event title must be 50 characters or less.";
          }
          if (message === "Location must be 250 characters or less") {
            return "Location must be 250 characters or less.";
          }
          return message;
        })
        .join(" ");
    };

    try {
      const parsed = JSON.parse(text);
      if (parsed?.message) {
        return normalizeValidationMessages(parsed.message);
      }
    } catch (error) {
      void error;
    }

    if (status === 401) {
      return "Your session has expired. Please sign in again.";
    }
    if (status === 403) {
      if (lower.includes("blocked")) {
        return "You are blocked from this family.";
      }
      return "You do not have permission to perform this action.";
    }
    if (status === 409) {
      return "This event was updated elsewhere. Refresh and try again.";
    }
    if (status === 413 || lower.includes("file too large") || lower.includes("payload too large")) {
      return "Image is too large. Please upload images up to 5MB.";
    }
    if (lower.includes("too many files") || lower.includes("limit_file_count")) {
      return getMaxImageCountError();
    }
    if (lower.includes("only image") || lower.includes("image files") || lower.includes("mimetype")) {
      return "Only image files (jpeg, jpg, png, gif, webp) are allowed.";
    }

    const normalized = text.replace(/\s+/g, " ").trim();
    return normalized || "Unable to create the event. Please try again.";
  };

  const handleImageChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      return;
    }

    const invalidTypeFiles = files.filter(
      (file) => !ALLOWED_IMAGE_MIME_TYPES.includes(String(file?.type || "").toLowerCase()),
    );
    const validTypeFiles = files.filter((file) =>
      ALLOWED_IMAGE_MIME_TYPES.includes(String(file?.type || "").toLowerCase()),
    );

    if (invalidTypeFiles.length > 0) {
      setErrors((prev) => ({
        ...(prev || {}),
        images: INVALID_IMAGE_TYPE_ERROR,
      }));
    }

    const validSizeFiles = validTypeFiles.filter(
      (file) => Number(file?.size || 0) <= MAX_IMAGE_BYTES,
    );
    const hasOversize = validSizeFiles.length !== validTypeFiles.length;

    if (hasOversize) {
      setErrors((prev) => ({
        ...(prev || {}),
        images: "Image is too large. Please select an image less than 5MB.",
      }));
    } else if (!invalidTypeFiles.length) {
      setErrors((prev) => ({ ...(prev || {}), images: undefined }));
    }

    if (!validSizeFiles.length) {
      event.target.value = null;
      return;
    }

    setImages((prev) => {
      const merged = [...(prev || []), ...validSizeFiles];
      const seen = new Set();
      const unique = [];

      merged.forEach((file) => {
        const key = getImageKey(file);
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(file);
        }
      });

      if (unique.length > MAX_EVENT_IMAGE_COUNT) {
        setErrors((prevErrors) => ({
          ...(prevErrors || {}),
          images: getMaxImageCountError(),
        }));
        return unique.slice(0, MAX_EVENT_IMAGE_COUNT);
      }

      setErrors((prevErrors) => ({ ...(prevErrors || {}), images: undefined }));
      return unique;
    });

    event.target.value = null;
  };

  const handleRemoveImage = (index) => {
    setImages((prev) => {
      const nextImages = (prev || []).filter((_, imageIndex) => imageIndex !== index);
      if (nextImages.length < MAX_EVENT_IMAGE_COUNT) {
        setErrors((prevErrors) => ({ ...(prevErrors || {}), images: undefined }));
      }
      return nextImages;
    });
  };

  const validateForm = () => {
    const nextErrors = {};
    const normalizedTitle = String(title || "").trim();
    const normalizedLocation = String(location || "").trim();
    const normalizedDescription = String(description || "").trim();
    const scheduleValidation = validateEventSchedules(schedules);

    if (!normalizedTitle) {
      nextErrors.title = "Event title is required.";
    } else if (normalizedTitle.length > MAX_EVENT_TITLE_LENGTH) {
      nextErrors.title = `Event title must be ${MAX_EVENT_TITLE_LENGTH} characters or less.`;
    }

    if (normalizedDescription.length > MAX_EVENT_DESCRIPTION_LENGTH) {
      nextErrors.description = `Description must be ${MAX_EVENT_DESCRIPTION_LENGTH} characters or less.`;
    }

    if (normalizedLocation.length > MAX_EVENT_LOCATION_LENGTH) {
      nextErrors.location = `Location must be ${MAX_EVENT_LOCATION_LENGTH} characters or less.`;
    }

    if ((images || []).length > MAX_EVENT_IMAGE_COUNT) {
      nextErrors.images = getMaxImageCountError();
    }

    setErrors({
      ...nextErrors,
      schedules: scheduleValidation.errors,
    });
    setScheduleWarnings(scheduleValidation.warnings);

    return {
      isValid: Object.keys(nextErrors).length === 0 && scheduleValidation.isValid,
      normalizedSchedules: scheduleValidation.normalizedSchedules,
      hasPastDates: scheduleValidation.hasPastDates,
    };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validation = validateForm();
    if (!validation.isValid) {
      return;
    }

    if (validation.hasPastDates) {
      const result = await Swal.fire({
        icon: "warning",
        title: "Past date selected",
        text: "One or more event dates are in the past. Do you want to continue?",
        showCancelButton: true,
        confirmButtonColor: "#2563eb",
        cancelButtonColor: "#6b7280",
        confirmButtonText: "Continue",
      });

      if (!result.isConfirmed) {
        return;
      }
    }

    setIsLoading(true);

    const normalizedTitle = String(title || "").trim();
    const normalizedLocation = String(location || "").trim();
    const normalizedDescription = String(description || "").trim();
    const targetFamilyCode = String(familyCode || userInfo?.familyCode || "").trim();

    if (!userInfo?.userId || !targetFamilyCode) {
      Swal.fire({
        icon: "warning",
        title: "Missing info",
        text: "User ID or Family Code missing.",
      });
      setIsLoading(false);
      return;
    }

    try {
      const token = getToken();
      if (!token) {
        Swal.fire({
          icon: "warning",
          title: "No access token",
          text: "Please sign in again.",
        });
        setIsLoading(false);
        return;
      }

      const apiSchedules = toApiSchedules(validation.normalizedSchedules);
      const { eventDate, eventTime } = getLegacyEventDateTime(validation.normalizedSchedules);

      if (!apiSchedules.length || !eventDate) {
        setErrors((prev) => ({
          ...(prev || {}),
          schedules: {
            general: EVENT_SCHEDULE_REQUIRED_MESSAGE,
            dates: prev?.schedules?.dates || {},
          },
        }));
        setIsLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append("userId", String(userInfo.userId));
      formData.append("eventTitle", normalizedTitle);
      if (normalizedDescription) {
        formData.append("eventDescription", normalizedDescription);
      }
      if (eventDate) {
        formData.append("eventDate", eventDate);
      }
      if (eventTime) {
        formData.append("eventTime", eventTime);
      }
      formData.append("schedules", JSON.stringify(apiSchedules));
      if (normalizedLocation) {
        formData.append("location", normalizedLocation);
      }
      formData.append("familyCode", targetFamilyCode);

      images.forEach((image) => {
        formData.append("eventImages", image);
      });

      const response = await authFetchResponse(`${apiBaseUrl}/event/create`, {
        method: "POST",
        skipThrow: true,
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        Swal.fire({
          icon: "error",
          title: "Can’t create event",
          text: getFriendlyError(response.status, errorText),
        });
        setIsLoading(false);
        return;
      }

      const responseData = await response.json();
      onEventCreated?.(responseData?.data || null);
      setShowSuccess(true);
    } catch (error) {
      console.error("Error creating event:", error);
      Swal.fire({
        icon: "error",
        title: "Something went wrong",
        text: error?.message || "Unable to create the event. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-2 pb-24 pt-8 font-inter backdrop-blur-sm sm:items-center sm:px-4 sm:pb-6 sm:pt-4">
      <div
        className="relative flex max-h-[calc(100vh-140px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-transparent bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:max-w-3xl sm:rounded-3xl"
      >
        {showSuccess ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 p-6 text-center dark:bg-slate-950/90">
            <div className="w-full max-w-md rounded-2xl border-4 border-green-500 bg-white p-8 shadow-lg dark:bg-slate-900">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                <FiCheckCircle size={40} className="text-green-600" />
              </div>
              <h3 className="mb-3 text-2xl font-bold text-gray-800 dark:text-slate-100">
                Success!
              </h3>
              <p className="mb-6 text-lg text-gray-600 dark:text-slate-300">
                Event created successfully.
              </p>
              <button
                type="button"
                className="rounded-full bg-green-600 px-8 py-2 text-lg font-semibold text-white shadow transition hover:bg-green-700"
                onClick={() => handleClose({ skipConfirm: true })}
              >
                OK
              </button>
            </div>
          </div>
        ) : null}

        <div className="relative bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-3 text-white sm:p-4">
          <button
            type="button"
            onClick={() => handleClose()}
            disabled={isLoading}
            className="absolute right-3 top-3 rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiX size={20} />
          </button>
          <div className="text-center">
            <div className="flex items-center justify-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <FiCalendar size={14} />
              </div>
              <div>
                <h2 className="text-lg font-bold sm:text-xl">Create New Event</h2>
                <p className="text-[11px] text-primary-100 sm:text-xs">
                  Plan your next family gathering
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:p-6">
          <form id={CREATE_EVENT_FORM_ID} onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-slate-200 sm:text-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-500/15">
                  <FiFileText size={11} className="text-primary-600 dark:text-primary-300" />
                </span>
                Event Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  if (errors.title) {
                    setErrors((prev) => ({ ...prev, title: undefined }));
                  }
                }}
                maxLength={MAX_EVENT_TITLE_LENGTH}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 transition-all duration-200 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-100 dark:focus:bg-slate-800 sm:px-4 sm:py-3"
                placeholder="Enter event title..."
                required
              />
              {errors.title ? <p className="text-xs text-red-600">{errors.title}</p> : null}
              <div className="flex items-center justify-between text-[11px] text-gray-500">
                <span>Max {MAX_EVENT_TITLE_LENGTH} characters.</span>
                <span className={title.length > MAX_EVENT_TITLE_LENGTH ? "text-red-600" : ""}>
                  {title.length}/{MAX_EVENT_TITLE_LENGTH}
                </span>
              </div>
            </div>

            <EventScheduleManager
              value={schedules}
              onChange={(nextSchedules) => {
                setSchedules(nextSchedules);
                setErrors((prev) => ({ ...(prev || {}), schedules: undefined }));
              }}
              errors={errors.schedules}
              warnings={scheduleWarnings}
              isDark={isDark}
              disabled={isLoading}
            />

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-slate-200 sm:text-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-500/15">
                  <FiMapPin size={11} className="text-primary-600 dark:text-primary-300" />
                </span>
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(event) => {
                  setLocation(event.target.value.slice(0, MAX_EVENT_LOCATION_LENGTH));
                  if (errors.location) {
                    setErrors((prev) => ({ ...prev, location: undefined }));
                  }
                }}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 transition-all duration-200 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-100 dark:focus:bg-slate-800 sm:px-4 sm:py-3"
                placeholder="Enter event location..."
                maxLength={MAX_EVENT_LOCATION_LENGTH}
              />
              {errors.location ? <p className="text-xs text-red-600">{errors.location}</p> : null}
              <div className="flex items-center justify-between text-[11px] text-gray-500">
                <span>Max {MAX_EVENT_LOCATION_LENGTH} characters.</span>
                <span className={location.length > MAX_EVENT_LOCATION_LENGTH ? "text-red-600" : ""}>
                  {location.length}/{MAX_EVENT_LOCATION_LENGTH}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-slate-200 sm:text-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-500/15">
                  <FiFileText size={11} className="text-primary-600 dark:text-primary-300" />
                </span>
                Description
              </label>
              <textarea
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  if (errors.description) {
                    setErrors((prev) => ({ ...prev, description: undefined }));
                  }
                }}
                rows="4"
                className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-900 transition-all duration-200 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-100 dark:focus:bg-slate-800 sm:px-4"
                placeholder="Tell us about your event..."
              />
              {errors.description ? (
                <p className="text-xs text-red-600">{errors.description}</p>
              ) : null}
              <div className="flex items-center justify-between text-[11px] text-gray-500">
                <span>Max {MAX_EVENT_DESCRIPTION_LENGTH} characters.</span>
                <span
                  className={
                    description.length > MAX_EVENT_DESCRIPTION_LENGTH ? "text-red-600" : ""
                  }
                >
                  {description.length}/{MAX_EVENT_DESCRIPTION_LENGTH}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-slate-200 sm:text-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-500/15">
                  <FiImage size={11} className="text-primary-600 dark:text-primary-300" />
                </span>
                Event Images
              </label>

              {errors.images ? <p className="text-xs text-red-600">{errors.images}</p> : null}

              {imagePreviews.length > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {imagePreviews.map((src, index) => (
                      <div key={src} className="group relative">
                        <img
                          src={src}
                          alt={`Preview ${index + 1}`}
                          className="h-24 w-full rounded-xl border-2 border-gray-200 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="absolute right-2 top-2 z-10 rounded-full bg-black/60 p-1.5 text-white opacity-100 transition-opacity hover:bg-black/70 sm:opacity-0 sm:group-hover:opacity-100"
                          aria-label={`Remove image ${index + 1}`}
                        >
                          <FiX size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => document.getElementById("event-image-input")?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary-300 py-3 text-primary-600 transition-colors hover:bg-primary-50 dark:border-primary-400/40 dark:text-primary-200 dark:hover:bg-primary-500/10"
                  >
                    <FiPlus size={16} />
                    Add More Images
                  </button>
                </div>
              ) : (
                <div
                  className="flex min-h-32 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary-300 p-6 transition-colors hover:bg-primary-50 dark:border-primary-400/40 dark:hover:bg-primary-500/10"
                  onClick={() => document.getElementById("event-image-input")?.click()}
                >
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-500/15">
                    <FiImage size={24} className="text-primary-600 dark:text-primary-200" />
                  </div>
                  <p className="mb-1 font-medium text-primary-600 dark:text-primary-200">
                    Add Event Images
                  </p>
                  <p className="text-center text-sm text-gray-500 dark:text-slate-400">
                    Click to select up to {MAX_EVENT_IMAGE_COUNT} images
                  </p>
                </div>
              )}

              <input
                id="event-image-input"
                type="file"
                accept="image/jpeg,image/png,image/jpg,image/gif"
                multiple
                className="hidden"
                onChange={handleImageChange}
              />
            </div>
          </form>
        </div>

        <div className="border-t border-gray-200 bg-gray-50 p-4 pb-16 dark:border-slate-800 dark:bg-slate-900/70 sm:px-6">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleClose()}
              disabled={isLoading}
              className="flex-1 rounded-xl border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              form={CREATE_EVENT_FORM_ID}
              disabled={isLoading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-secondary-500 to-secondary-600 px-6 py-3 font-semibold text-white shadow-lg transition-all duration-200 hover:scale-[1.01] hover:from-secondary-600 hover:to-secondary-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <FiLoader className="animate-spin" size={16} />
                  Creating...
                </>
              ) : (
                "Create Event"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

CreateEventModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  onEventCreated: PropTypes.func,
  apiBaseUrl: PropTypes.string,
};

CreateEventModal.defaultProps = {
  onClose: undefined,
  onEventCreated: undefined,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
};

export default CreateEventModal;
