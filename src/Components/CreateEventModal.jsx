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
import { jwtDecode } from "jwt-decode";
import Swal from "sweetalert2";
import { useUser } from "../Contexts/UserContext";

const CreateEventModal = ({
  isOpen,
  onClose,
  apiBaseUrl = import.meta.env.VITE_API_BASE_URL,
}) => {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  // NEW: State for success popup
  const [showSuccess, setShowSuccess] = useState(false);

  const [userId, setUserId] = useState(null);
  const [familyCode, setFamilyCode] = useState(null);

  const { userInfo } = useUser();

  useEffect(() => {
    console.log("User Info in CreateEventModal:", userInfo);
    // console.log('🔗 API Base URL:', apiBaseUrl);
    // console.log('🌍 Environment VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
  }, [apiBaseUrl]);

  // NEW: Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTitle("");
      setDate("");
      setTime("");
      setLocation("");
      setDescription("");
      setImages([]);
      setImagePreviews([]);
      setShowSuccess(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem("access_token");

        if (!token) {
          Swal.fire({
            icon: "warning",
            title: "No access token",
            text: "Please sign in again.",
          });
          return;
        }

        const decoded = jwtDecode(token);

        const uid = decoded.id || decoded.userId;
        if (!uid) {
          Swal.fire({
            icon: "error",
            title: "User ID not found",
            text: "Please sign in again.",
          });
          return;
        }
        setUserId(uid);

        const userEndpoint = `${apiBaseUrl}/user/profile/${uid}`;

        const res = await fetch(userEndpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error("❌ User API failed:", errorText);
          Swal.fire({
            icon: "error",
            title: "API Error",
            text: `${res.status} - ${errorText}`,
          });
          return;
        }

        const userData = await res.json();

        const fc =
          userData?.data?.userProfile?.familyMember?.familyCode ||
          userData?.data?.userProfile?.familyCode;

        if (fc) {
          setFamilyCode(fc);
          console.log("✅ Family Code set:", fc);
        } else {
          console.warn("❌ No familyCode found in API response");
        }
      } catch (err) {
        console.error("💥 Fetch user error:", err);
        Swal.fire({
          icon: "error",
          title: "Fetch failed",
          text: `Error fetching user data: ${err.message}`,
        });
      }
    };

    // if (isOpen) {
    //   fetchUserData();
    // }
  }, [isOpen, apiBaseUrl]);

  if (!isOpen) return null;

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setImages(files);
    setImagePreviews(files.map((file) => URL.createObjectURL(file)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const token = localStorage.getItem("access_token");
      const formData = new FormData();

      // Add event fields
      formData.append("eventTitle", title);
      formData.append("eventDescription", description);
      formData.append("eventDate", date);
      formData.append("eventTime", time);
      formData.append("location", location);

      // **NEW: Send images to REMOVE (if user removed any)**
      if (imagesToRemove.length > 0) {
        imagesToRemove.forEach((id) =>
          formData.append("imagesToRemove", id.toString())
        );
      }

      // Add NEW images
      newImages.forEach((img) => {
        formData.append("eventImages", img);
      });

      const response = await fetch(`${apiBaseUrl}/event/${eventId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("❌ Create event API error:", errText);
        Swal.fire({
          icon: "error",
          title: "Create Event Error",
          text: `${response.status} - ${errText}`,
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
        text: err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 font-inter">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl relative max-h-[95vh] flex flex-col overflow-hidden">
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
                onClick={() => {
                  setShowSuccess(false);
                  // Reset form
                  setTitle("");
                  setDate("");
                  setTime("");
                  setLocation("");
                  setDescription("");
                  setImages([]);
                  setImagePreviews([]);
                  onClose();
                }}
              >
                OK
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-4 relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white/80 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10"
          >
            <FiX size={20} />
          </button>
          <div className="text-center">
            <div className="flex items-center justify-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <FiCalendar size={16} />
              </div>
              <div>
                <h2 className="text-xl font-bold">Create New Event</h2>
                <p className="text-primary-100 text-xs">
                  Plan your next family gathering
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Event Title */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
                <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                  <FiFileText size={12} className="text-primary-600" />
                </div>
                Event Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                placeholder="Enter event title..."
              />
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
                  <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                    <FiCalendar size={12} className="text-primary-600" />
                  </div>
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
                  <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                    <FiClock size={12} className="text-primary-600" />
                  </div>
                  Time
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
                <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                  <FiMapPin size={12} className="text-primary-600" />
                </div>
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                placeholder="Enter event location..."
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
                <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                  <FiFileText size={12} className="text-primary-600" />
                </div>
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows="4"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white resize-none"
                placeholder="Tell us about your event..."
              ></textarea>
            </div>

            {/* Image Upload */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
                <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                  <FiImage size={12} className="text-primary-600" />
                </div>
                Event Images
              </label>

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
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
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
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageChange}
              />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-6 pb-20 border-t border-gray-200">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-3 px-6 border bg-white border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 bg-gradient-to-r from-secondary-500 to-secondary-600 text-white py-3 px-6 rounded-xl font-semibold hover:from-secondary-500 hover:to-secondary-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
