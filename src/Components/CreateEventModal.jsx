import React, { useState, useEffect } from "react";
import {
  FiX,
  FiCalendar,
  FiClock,
  FiMapPin,
  FiFileText,
  FiImage,
  FiPlus,
  FiLoader,
  FiCheckCircle,
} from "react-icons/fi";
import Swal from "sweetalert2";
import { useUser } from "../Contexts/UserContext";
import { getToken } from "../utils/auth";
import { authFetchResponse } from "../utils/authFetch";

const CreateEventModal = ({
  isOpen,
  onClose,
  apiBaseUrl = import.meta.env.VITE_API_BASE_URL,
}) => {
  const MAX_EVENT_TITLE_LENGTH = 50;
  const MAX_EVENT_DESCRIPTION_LENGTH = 250;
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const EVENT_DATE_MIN = "1900-01-01";
  const EVENT_DATE_MAX = "2100-12-31";

  const ALLOWED_IMAGE_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/gif",
  ];
  const INVALID_IMAGE_TYPE_ERROR =
    "Only image files (jpeg, png, jpg, gif) are allowed";
  const { userInfo } = useUser();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [familyCode, setFamilyCode] = useState("");

  const getPreferredFamilyCode = () => String(userInfo?.familyCode || "").trim();

  const getImageKey = (file) =>
    [file?.name, file?.size, file?.lastModified, file?.type].join(":");

  // Handle back button to close modal instead of navigating
  useEffect(() => {
    if (!isOpen) return;
    if (typeof onClose !== 'function') return;
    if (!window.__appModalBackStack) window.__appModalBackStack = [];

    const handler = () => {
      onClose();
    };

    window.__appModalBackStack.push(handler);

    return () => {
      const stack = window.__appModalBackStack;
      if (!Array.isArray(stack)) return;
      const idx = stack.lastIndexOf(handler);
      if (idx >= 0) stack.splice(idx, 1);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const preferredCode = getPreferredFamilyCode();
    if (preferredCode) {
      setFamilyCode(preferredCode);
    }
    setErrors({});
    setShowSuccess(false);
  }, [isOpen, userInfo?.familyCode]);

  useEffect(() => {
    const nextPreviews = (images || []).map((file) => URL.createObjectURL(file));
    setImagePreviews(nextPreviews);

    return () => {
      nextPreviews.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      });
    };
  }, [images]);

  const resetForm = () => {
    setTitle("");
    setDate("");
    setTime("");
    setLocation("");
    setDescription("");
    setImages([]);
    setErrors({});
    setIsLoading(false);
    setShowSuccess(false);
    setFamilyCode(getPreferredFamilyCode());
  };

  const handleClose = () => {
    if (isLoading) return;
    resetForm();
    onClose?.();
  };

  const getFriendlyError = (status, rawText) => {
    const text = String(rawText || "");
    const lower = text.toLowerCase();

    const normalizeValidationMessages = (messages) => {
      const arr = Array.isArray(messages) ? messages : [messages];
      const mapped = arr
        .map((m) => String(m || "").trim())
        .filter(Boolean)
        .map((m) => {
          if (m === "eventTitle should not be empty") return "Event title is required.";
          if (m === "Event title must be at most 50 characters") return "Event title must be 50 characters or less.";
          if (m === "eventDate should not be empty") return "Event date is required.";
          if (m === "eventDate must be a valid ISO 8601 date string") return "Event date is invalid. Please choose a valid date.";
          return m;
        });
      return mapped.join(" ");
    };

    const tryParseBackendJson = () => {
      try {
        return JSON.parse(text);
      } catch (e) {
        return null;
      }
    };

    const parsed = tryParseBackendJson();
    if (parsed && parsed.message) {
      return normalizeValidationMessages(parsed.message);
    }

    if (status === 401) {
      return "Your session has expired. Please sign in again.";
    }
    if (status === 403) {
      if (lower.includes("blocked")) return "You are blocked from this family.";
      return "You do not have permission to perform this action.";
    }
    if (status === 413 || lower.includes("file too large") || lower.includes("payload too large")) {
      return "Image is too large. Please upload images up to 5MB.";
    }
    if (lower.includes("only image") || lower.includes("image files") || lower.includes("mimetype")) {
      return "Only image files (jpeg, jpg, png, gif, webp) are allowed.";
    }

    const normalized = text.replace(/\s+/g, " ").trim();
    return normalized || "Unable to create the event. Please try again.";
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const invalidTypeFiles = files.filter(
      (file) => !ALLOWED_IMAGE_MIME_TYPES.includes(String(file?.type || "").toLowerCase())
    );
    const validTypeFiles = files.filter(
      (file) => ALLOWED_IMAGE_MIME_TYPES.includes(String(file?.type || "").toLowerCase())
    );

    if (invalidTypeFiles.length > 0) {
      setErrors((prev) => ({
        ...(prev || {}),
        images: INVALID_IMAGE_TYPE_ERROR,
      }));
    }

    const validSizeFiles = validTypeFiles.filter((file) => Number(file?.size || 0) <= MAX_IMAGE_BYTES);
    const hasOversize = validSizeFiles.length !== validTypeFiles.length;

    if (hasOversize) {
      setErrors((prev) => ({
        ...(prev || {}),
        images: "Image is too large. Please select an image less than 5MB.",
      }));
    } else if (errors.images && invalidTypeFiles.length === 0) {
      setErrors((prev) => ({ ...(prev || {}), images: undefined }));
    }

    if (!validSizeFiles.length) {
      e.target.value = null;
      return;
    }

    setImages((prev) => {
      const merged = [...(prev || []), ...validSizeFiles];
      const seen = new Set();
      const unique = [];
      for (const f of merged) {
        const key = getImageKey(f);
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(f);
        }
      }
      return unique;
    });

    e.target.value = null;
  };

  const handleRemoveImage = (index) => {
    setImages((prev) => (prev || []).filter((_, i) => i !== index));
  };

  const validateForm = () => {
    const nextErrors = {};

    const normalizedTitle = String(title || "").trim();
    const normalizedDate = String(date || "").trim();
    const normalizedTime = String(time || "").trim();
    const normalizedDescription = String(description || "").trim();

    if (!normalizedTitle) {
      nextErrors.title = "Event title is required.";
    } else if (normalizedTitle.length > MAX_EVENT_TITLE_LENGTH) {
      nextErrors.title = `Event title must be ${MAX_EVENT_TITLE_LENGTH} characters or less.`;
    }

    if (!normalizedDate) {
      nextErrors.date = "Event date is required.";
    } else if (!/^(\d{4})-(\d{2})-(\d{2})$/.test(normalizedDate)) {
      nextErrors.date = "Event date is invalid. Please choose a valid date.";
    } else if (normalizedDate < EVENT_DATE_MIN || normalizedDate > EVENT_DATE_MAX) {
      nextErrors.date = `Event date must be between ${EVENT_DATE_MIN} and ${EVENT_DATE_MAX}.`;
    }

    if (!normalizedTime) {
      nextErrors.time = "Event time is required.";
    } else if (!/^\d{2}:\d{2}(:\d{2})?$/.test(normalizedTime)) {
      nextErrors.time = "Event time is invalid. Please choose a valid time.";
    }

    if (normalizedDescription.length > MAX_EVENT_DESCRIPTION_LENGTH) {
      nextErrors.description = `Description must be ${MAX_EVENT_DESCRIPTION_LENGTH} characters or less.`;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const isValid = validateForm();
    if (!isValid) return;

    setIsLoading(true);

    const normalizedTitle = String(title || "").trim();

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

      const formData = new FormData();
      formData.append("userId", userInfo?.userId);
      formData.append("eventTitle", normalizedTitle);
      if (description && String(description).trim()) {
        formData.append("eventDescription", String(description).trim());
      }
      formData.append("eventDate", date);
      if (time && String(time).trim()) {
        formData.append("eventTime", String(time).trim());
      }
      if (location && String(location).trim()) {
        formData.append("location", String(location).trim());
      }
      formData.append("familyCode", targetFamilyCode);

      images.forEach((img) => {
        formData.append("eventImages", img);
      });

      const createEndpoint = `${apiBaseUrl}/event/create`;

      const response = await authFetchResponse(createEndpoint, {
        method: "POST",
        skipThrow: true,
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        Swal.fire({
          icon: "error",
          title: "Can’t create event",
          text: getFriendlyError(response.status, errText),
        });
        setIsLoading(false);
        return;
      }

      const resData = await response.json();

      // NEW: Show success popup
      setShowSuccess(true);
    } catch (err) {
      console.error("💥 Error creating event:", err);
      Swal.fire({
        icon: "error",
        title: "Something went wrong",
        text: err?.message || "Unable to create the event. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center px-2 sm:px-4 pt-8 pb-24 sm:pt-4 sm:pb-6 z-50 font-inter">
      <div
        className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md sm:max-w-2xl relative flex flex-col overflow-hidden"
        style={{ maxHeight: "calc(100vh - 140px)" }}
      >
        {/* NEW: Success Popup */}
        {showSuccess && (
          <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center z-10 p-6 text-center">
            <div className="border-4 border-green-500 rounded-2xl p-8 bg-white shadow-lg max-w-md w-full">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 mx-auto">
                <FiCheckCircle size={40} className="text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3">
                Success!
              </h3>
              <p className="text-gray-600 mb-6 text-lg">
                Event created successfully.
              </p>
              <button
                className="bg-green-600 text-white px-8 py-2 rounded-full font-semibold text-lg shadow hover:bg-green-700 transition"
                onClick={handleClose}
              >
                OK
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-3 sm:p-4 relative">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="absolute top-3 right-3 text-white/80 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiX size={20} />
          </button>
          <div className="text-center">
            <div className="flex items-center justify-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <FiCalendar size={14} />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold">Create New Event</h2>
                <p className="text-primary-100 text-[11px] sm:text-xs">
                  Plan your next family gathering
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            {/* Event Title */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-gray-700 font-semibold text-xs sm:text-sm">
                <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                  <FiFileText size={11} className="text-primary-600" />
                </div>
                Event Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                }}
                required
                maxLength={MAX_EVENT_TITLE_LENGTH}
                className="w-full px-3 py-2.5 sm:px-4 sm:py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white text-sm"
                placeholder="Enter event title..."
              />
              {errors.title ? <p className="text-red-600 text-xs">{errors.title}</p> : null}
              <div className="text-[11px] text-gray-500 flex items-center justify-between">
                <span>Max {MAX_EVENT_TITLE_LENGTH} characters.</span>
                <span className={title.length > MAX_EVENT_TITLE_LENGTH ? "text-red-600" : ""}>
                  {title.length}/{MAX_EVENT_TITLE_LENGTH}
                </span>
              </div>
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-gray-700 font-semibold text-xs sm:text-sm">
                  <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                    <FiCalendar size={11} className="text-primary-600" />
                  </div>
                  Date
                </label>
                <input
                  type="date"
                  onKeyDown={(e) => e.preventDefault()}
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    if (errors.date) setErrors((prev) => ({ ...prev, date: undefined }));
                  }}
                  required
                  min={EVENT_DATE_MIN}
                  max={EVENT_DATE_MAX}
                  className="w-full px-3 py-2.5 sm:px-4 sm:py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white text-sm"
                />
                {errors.date ? <p className="text-red-600 text-xs">{errors.date}</p> : null}
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-gray-700 font-semibold text-xs sm:text-sm">
                  <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                    <FiClock size={11} className="text-primary-600" />
                  </div>
                  Time
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => {
                    setTime(e.target.value);
                    if (errors.time) setErrors((prev) => ({ ...prev, time: undefined }));
                  }}
                  required
                  className="w-full px-3 py-2.5 sm:px-4 sm:py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white text-sm"
                />
                {errors.time ? <p className="text-red-600 text-xs">{errors.time}</p> : null}
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-gray-700 font-semibold text-xs sm:text-sm">
                <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                  <FiMapPin size={11} className="text-primary-600" />
                </div>
                Location
              </label>
              <input
                type="text"
                maxLength={100}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
                className="w-full px-3 py-2.5 sm:px-4 sm:py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white text-sm"
                placeholder="Enter event location..."
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-gray-700 font-semibold text-xs sm:text-sm">
                <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                  <FiFileText size={11} className="text-primary-600" />
                </div>
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value.slice(0, MAX_EVENT_DESCRIPTION_LENGTH));
                  if (errors.description) {
                    setErrors((prev) => ({ ...prev, description: undefined }));
                  }
                }}
                maxLength={MAX_EVENT_DESCRIPTION_LENGTH}
                rows="4"
                className="w-full px-3 py-2.5 sm:px-4 sm:py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white resize-none text-sm"
                placeholder="Tell us about your event..."
              ></textarea>
              {errors.description ? (
                <p className="text-red-600 text-xs">{errors.description}</p>
              ) : null}
              <div className="text-[11px] text-gray-500 flex items-center justify-between">
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

            {/* Image Upload */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-gray-700 font-semibold text-xs sm:text-sm">
                <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                  <FiImage size={11} className="text-primary-600" />
                </div>
                Event Images
              </label>

              {errors.images ? (
                <p className="text-red-600 text-xs">{errors.images}</p>
              ) : null}

              {imagePreviews.length > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {imagePreviews.map((src, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={src}
                          alt={`Preview ${idx + 1}`}
                          className="w-full h-24 object-cover rounded-xl border-2 border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute top-2 right-2 z-10 bg-black/60 hover:bg-black/70 text-white rounded-full p-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                          aria-label={`Remove image ${idx + 1}`}
                        >
                          <FiX size={14} />
                        </button>
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
                          <span className="text-white text-xs font-medium">
                            Image {idx + 1}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      document.getElementById("event-image-input").click()
                    }
                    className="w-full py-3 border-2 border-dashed border-primary-300 rounded-xl text-primary-600 bg-white hover:bg-primary-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <FiPlus size={16} />
                    Add More Images
                  </button>
                </div>
              ) : (
                <div
                  className="w-full min-h-32 border-2 border-dashed border-primary-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-primary-50 transition-colors p-6"
                  onClick={() =>
                    document.getElementById("event-image-input").click()
                  }
                >
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mb-3">
                    <FiImage size={24} className="text-primary-600" />
                  </div>
                  <p className="text-primary-600 font-medium mb-1">
                    Upload Event Images
                  </p>
                  <p className="text-gray-500 text-sm text-center">
                    Click to select multiple images
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

        {/* Footer */}
        <div className="bg-gray-50 px-4 py-3 sm:p-6 pb-4 sm:pb-6 border-t border-gray-200">
          <div className="flex flex-row gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 py-2.5 px-4 border bg-white border-gray-300 text-gray-700 rounded-xl font-medium text-sm sm:text-base hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 bg-gradient-to-r from-secondary-500 to-secondary-600 text-white py-2.5 px-4 rounded-xl font-semibold text-sm sm:text-base hover:from-secondary-500 hover:to-secondary-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

export default CreateEventModal;