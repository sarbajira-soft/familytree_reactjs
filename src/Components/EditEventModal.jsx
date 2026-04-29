import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  FiCalendar,
  FiFileText,
  FiImage,
  FiLoader,
  FiMapPin,
  FiPlus,
  FiTrash2,
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
  normalizeEventSchedulesInput,
  toApiSchedules,
  validateEventSchedules,
} from "../utils/eventValidation";

const MAX_EVENT_TITLE_LENGTH = 50;
const MAX_EVENT_LOCATION_LENGTH = 250;
const MAX_EVENT_DESCRIPTION_LENGTH = 250;
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
const EDIT_EVENT_FORM_ID = "edit-event-form";

const isScheduleBlank = (schedule) =>
  !String(schedule?.scheduleDate || "").trim() &&
  !Boolean(schedule?.isAllDay) &&
  !(Array.isArray(schedule?.times) ? schedule.times : []).some(
    (slot) => String(slot?.startTime || "").trim() || String(slot?.endTime || "").trim(),
  );

const EditEventModal = ({
  isOpen,
  onClose,
  event,
  onEventUpdated,
  apiBaseUrl = import.meta.env.VITE_API_BASE_URL,
}) => {
  const { userInfo } = useUser();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [title, setTitle] = useState("");
  const [schedules, setSchedules] = useState([createEmptySchedule()]);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState({});
  const [scheduleWarnings, setScheduleWarnings] = useState({});
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const initialSchedules = useMemo(
    () => normalizeEventSchedulesInput(event),
    [event],
  );
  const initialExistingImages = useMemo(
    () => (Array.isArray(event?.eventImages) ? event.eventImages : []),
    [event],
  );
  const initialTitle = String(event?.title || "").trim();
  const initialLocation = String(event?.location || "").trim();
  const initialDescription = String(event?.description || "").trim();

  const isDirty = useMemo(() => {
    const schedulesChanged =
      JSON.stringify(toApiSchedules(schedules)) !== JSON.stringify(toApiSchedules(initialSchedules));
    const existingImagesChanged =
      existingImages.length !== initialExistingImages.length ||
      existingImages.some((image, index) => image !== initialExistingImages[index]);

    return Boolean(
      String(title || "").trim() !== initialTitle ||
      String(location || "").trim() !== initialLocation ||
      String(description || "").trim() !== initialDescription ||
      schedulesChanged ||
      existingImagesChanged ||
      images.length > 0,
    );
  }, [
    description,
    existingImages,
    images.length,
    initialDescription,
    initialExistingImages,
    initialLocation,
    initialSchedules,
    initialTitle,
    location,
    schedules,
    title,
  ]);

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
  }, [isOpen, onClose, isDirty, isLoading]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleBeforeUnload = (browserEvent) => {
      if (!isDirty || isLoading) {
        return;
      }

      browserEvent.preventDefault();
      browserEvent.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, isLoading, isOpen]);

  useEffect(() => {
    if (!isOpen || !event) {
      return;
    }

    setTitle(event.title || "");
    setSchedules(normalizeEventSchedulesInput(event));
    setLocation(event.location || "");
    setDescription(event.description || "");
    setExistingImages(Array.isArray(event.eventImages) ? event.eventImages : []);
    setImages([]);
    setErrors({});
    setScheduleWarnings({});
  }, [event, isOpen]);

  useEffect(() => {
    setImagePreviews((previousPreviews) => {
      previousPreviews.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (error) {
          void error;
        }
      });

      return (images || []).map((file) => URL.createObjectURL(file));
    });
  }, [images]);

  const getImageKey = (file) =>
    `${file?.name || ""}-${file?.size || 0}-${file?.lastModified || 0}`;

  const getMaxImageCountError = () =>
    `You can upload a maximum of ${MAX_EVENT_IMAGE_COUNT} images.`;

  const confirmDiscardChanges = async () => {
    if (!isDirty) {
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
    return normalized || "Unable to update the event. Please try again.";
  };

  const handleImageChange = (browserEvent) => {
    const files = Array.from(browserEvent.target.files || []);
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
      browserEvent.target.value = null;
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

      const allowedNewImageCount = Math.max(0, MAX_EVENT_IMAGE_COUNT - existingImages.length);
      if (unique.length > allowedNewImageCount) {
        setErrors((prevErrors) => ({
          ...(prevErrors || {}),
          images: getMaxImageCountError(),
        }));
        return unique.slice(0, allowedNewImageCount);
      }

      setErrors((prevErrors) => ({ ...(prevErrors || {}), images: undefined }));
      return unique;
    });

    browserEvent.target.value = null;
  };

  const handleRemoveNewImage = (index) => {
    setImages((prev) => (prev || []).filter((_, imageIndex) => imageIndex !== index));
  };

  const handleRemoveExistingImage = (index) => {
    setExistingImages((prev) => prev.filter((_, imageIndex) => imageIndex !== index));
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

    if (normalizedLocation.length > MAX_EVENT_LOCATION_LENGTH) {
      nextErrors.location = `Location must be ${MAX_EVENT_LOCATION_LENGTH} characters or less.`;
    }

    if (normalizedDescription.length > MAX_EVENT_DESCRIPTION_LENGTH) {
      nextErrors.description = `Description must be ${MAX_EVENT_DESCRIPTION_LENGTH} characters or less.`;
    }

    if (existingImages.length + images.length > MAX_EVENT_IMAGE_COUNT) {
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

  const handleSubmit = async (browserEvent) => {
    browserEvent.preventDefault();

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

    if (!event?.id) {
      return;
    }

    setIsLoading(true);

    const normalizedTitle = String(title || "").trim();
    const normalizedDescription = String(description || "").trim();
    const normalizedLocation = String(location || "").trim();
    const resolvedFamilyCode = String(event.familyCode || userInfo?.familyCode || "").trim();

    try {
      const token = getToken();
      if (!token) {
        Swal.fire({
          icon: "error",
          title: "Authentication Error",
          text: "No access token found.",
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
      formData.append("eventTitle", normalizedTitle);
      formData.append("eventDescription", normalizedDescription);
      formData.append("eventDate", eventDate);
      if (eventTime) {
        formData.append("eventTime", eventTime);
      }
      formData.append("schedules", JSON.stringify(apiSchedules));
      formData.append("location", normalizedLocation);
      formData.append("familyCode", resolvedFamilyCode);
      formData.append("updatedAt", String(event.updatedAt || ""));

      images.forEach((image) => {
        formData.append("eventImages", image);
      });

      existingImages.forEach((image) => {
        formData.append("eventImages", image);
      });

      if ((existingImages || []).length === 0 && (images || []).length === 0) {
        formData.append("clearImages", "true");
      }

      const response = await authFetchResponse(`${apiBaseUrl}/event/edit/${event.id}`, {
        method: "PUT",
        skipThrow: true,
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        Swal.fire({
          icon: "error",
          title: "Can’t update event",
          text: getFriendlyError(response.status, errorText),
        });
        setIsLoading(false);
        return;
      }

      const responseData = await response.json();
      Swal.fire({
        icon: "success",
        title: "Event updated",
        text: "Your changes have been saved.",
        confirmButtonColor: "#10b981",
      });

      onEventUpdated?.(responseData?.data || null);
      onClose?.();
    } catch (error) {
      console.error("Error updating event:", error);
      Swal.fire({
        icon: "error",
        title: "Can’t update event",
        text: error?.message || "Something went wrong. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  if (!event) {
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-2 pb-24 pt-10 font-inter backdrop-blur-sm sm:px-4 sm:pb-8 sm:pt-6">
        <div className="relative flex max-h-[calc(100vh-160px)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-4 text-white">
            <div className="text-center">
              <div className="flex items-center justify-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                  <FiCalendar size={16} />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Edit Event</h2>
                  <p className="text-xs text-primary-100">Loading event details</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              <div className="h-12 animate-pulse rounded-xl bg-gray-200 dark:bg-slate-800" />
              <EventScheduleManager
                value={[createEmptySchedule()]}
                onChange={() => {}}
                isDark={isDark}
                disabled
                isLoading
              />
              <div className="h-12 animate-pulse rounded-xl bg-gray-200 dark:bg-slate-800" />
              <div className="h-28 animate-pulse rounded-xl bg-gray-200 dark:bg-slate-800" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-2 pb-24 pt-10 font-inter backdrop-blur-sm sm:px-4 sm:pb-8 sm:pt-6">
      <div className="relative flex max-h-[calc(100vh-160px)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="relative bg-gradient-to-r from-primary-600 to-primary-700 p-4 text-white">
          <button
            type="button"
            onClick={() => handleClose()}
            className="absolute right-3 top-3 rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <FiX size={20} />
          </button>
          <div className="text-center">
            <div className="flex items-center justify-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <FiCalendar size={16} />
              </div>
              <div>
                <h2 className="text-xl font-bold">Edit Event</h2>
                <p className="text-xs text-primary-100">Update your event details</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form id={EDIT_EVENT_FORM_ID} onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-slate-200">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-500/15">
                  <FiFileText size={12} className="text-primary-600 dark:text-primary-300" />
                </span>
                Event Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(browserEvent) => {
                  setTitle(browserEvent.target.value);
                  if (errors.title) {
                    setErrors((prev) => ({ ...prev, title: undefined }));
                  }
                }}
                required
                maxLength={MAX_EVENT_TITLE_LENGTH}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 transition-all duration-200 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:bg-slate-900"
                placeholder="Enter event title..."
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
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-slate-200">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-500/15">
                  <FiMapPin size={12} className="text-primary-600 dark:text-primary-300" />
                </span>
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(browserEvent) => {
                  setLocation(browserEvent.target.value.slice(0, MAX_EVENT_LOCATION_LENGTH));
                  if (errors.location) {
                    setErrors((prev) => ({ ...prev, location: undefined }));
                  }
                }}
                maxLength={MAX_EVENT_LOCATION_LENGTH}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 transition-all duration-200 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:bg-slate-900"
                placeholder="Enter event location..."
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
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-slate-200">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-500/15">
                  <FiFileText size={12} className="text-primary-600 dark:text-primary-300" />
                </span>
                Description
              </label>
              <textarea
                value={description}
                onChange={(browserEvent) => {
                  setDescription(browserEvent.target.value);
                  if (errors.description) {
                    setErrors((prev) => ({ ...prev, description: undefined }));
                  }
                }}
                rows="4"
                className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 transition-all duration-200 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:bg-slate-900"
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

            {existingImages.length > 0 ? (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-slate-200">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-500/15">
                    <FiImage size={12} className="text-primary-600 dark:text-primary-300" />
                  </span>
                  Existing Images
                </label>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {existingImages.map((src, index) => (
                    <div key={`${src}-${index}`} className="group relative">
                      <img
                        src={src}
                        alt={`Existing Image ${index + 1}`}
                        className="h-24 w-full rounded-xl border-2 border-gray-200 object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => handleRemoveExistingImage(index)}
                          className="z-10 rounded-full bg-red-500 p-1 text-white transition-colors hover:bg-red-600"
                          title="Remove image"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-slate-200">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-500/15">
                  <FiImage size={12} className="text-primary-600 dark:text-primary-300" />
                </span>
                Add New Images
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
                          onClick={() => handleRemoveNewImage(index)}
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
                    onClick={() => document.getElementById("edit-event-image-input")?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary-300 py-3 text-primary-600 transition-colors hover:bg-primary-50 dark:border-primary-400/40 dark:text-primary-200 dark:hover:bg-primary-500/10"
                  >
                    <FiPlus size={16} />
                    Add More Images
                  </button>
                </div>
              ) : (
                <div
                  className="flex min-h-32 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary-300 p-6 transition-colors hover:bg-primary-50 dark:border-primary-400/40 dark:hover:bg-primary-500/10"
                  onClick={() => document.getElementById("edit-event-image-input")?.click()}
                >
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-500/15">
                    <FiImage size={24} className="text-primary-600 dark:text-primary-200" />
                  </div>
                  <p className="mb-1 font-medium text-primary-600 dark:text-primary-200">
                    Add New Images
                  </p>
                  <p className="text-center text-sm text-gray-500 dark:text-slate-400">
                    Click to select up to {MAX_EVENT_IMAGE_COUNT} images
                  </p>
                </div>
              )}

              <input
                id="edit-event-image-input"
                type="file"
                accept="image/jpeg,image/png,image/jpg,image/gif"
                multiple
                className="hidden"
                onChange={handleImageChange}
              />
            </div>
          </form>
        </div>

        <div className="border-t border-gray-200 bg-gray-50 p-6 pb-16 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleClose()}
              disabled={isLoading}
              className="flex-1 rounded-xl border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              form={EDIT_EVENT_FORM_ID}
              disabled={isLoading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-secondary-500 to-secondary-600 px-6 py-3 font-semibold text-white shadow-lg transition-all duration-200 hover:scale-[1.01] hover:from-secondary-600 hover:to-secondary-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <FiLoader className="animate-spin" size={16} />
                  Updating...
                </>
              ) : (
                "Update Event"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

EditEventModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  event: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    title: PropTypes.string,
    description: PropTypes.string,
    location: PropTypes.string,
    eventImages: PropTypes.arrayOf(PropTypes.string),
    schedules: PropTypes.arrayOf(PropTypes.object),
    date: PropTypes.string,
    time: PropTypes.string,
    familyCode: PropTypes.string,
    updatedAt: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  }),
  onEventUpdated: PropTypes.func,
  apiBaseUrl: PropTypes.string,
};

EditEventModal.defaultProps = {
  onClose: undefined,
  event: null,
  onEventUpdated: undefined,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
};

export default EditEventModal;
