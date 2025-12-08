import React, { useState, useRef, useEffect } from "react";
import {
  FiX,
  FiImage,
  FiSend,
  FiChevronDown,
  FiSmile,
  FiTrash2,
  FiCheckCircle,
} from "react-icons/fi";
import { FaGlobeAmericas, FaUserFriends } from "react-icons/fa";
import EmojiPicker from "emoji-picker-react";
import { useUser } from "../Contexts/UserContext";

const CreatePostModal = ({
  isOpen,
  onClose,
  onPostCreated,
  currentUser,
  authToken,
  mode = "create",
  postData = null,
}) => {
  const { userInfo } = useUser();

  // State for form fields
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [currentPostImageUrl, setCurrentPostImageUrl] = useState(null);
  const [privacy, setPrivacy] = useState("public");
  const [familyCode, setFamilyCode] = useState("");

  // UI/logic states
  const [isLoading, setIsLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showPrivacyDropdown, setShowPrivacyDropdown] = useState(false);
  const [message, setMessage] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  // Refs
  const modalRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const privacyDropdownRef = useRef(null);
  const emojiPickerRef = useRef(null);

  // Initialize form fields when modal opens
  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && postData) {
        setContent(postData.caption || "");
        setPrivacy(
          postData.privacy === "private"
            ? "family"
            : postData.privacy || "family"
        );
        setFamilyCode(postData.familyCode || "");
        setCurrentPostImageUrl(postData.url || null);
        setImageFile(null);
        setImagePreview(null);
      } else {
        setContent("");
        setPrivacy("public");
        setFamilyCode(currentUser?.familyCode || userInfo?.familyCode || "");
        setImageFile(null);
        setImagePreview(null);
        setCurrentPostImageUrl(null);
      }
      setMessage("");
      setShowEmojiPicker(false);
      setShowPrivacyDropdown(false);
      setShowSuccess(false);
    }
  }, [isOpen, mode, postData, currentUser, userInfo]);

  // Close modal on click outside
  useEffect(() => {
    const handleClickOutsideModal = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutsideModal);
    }

    return () =>
      document.removeEventListener("mousedown", handleClickOutsideModal);
  }, [isOpen]);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutsidePrivacy = (event) => {
      if (
        privacyDropdownRef.current &&
        !privacyDropdownRef.current.contains(event.target)
      ) {
        setShowPrivacyDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutsidePrivacy);
    return () =>
      document.removeEventListener("mousedown", handleClickOutsidePrivacy);
  }, []);

  useEffect(() => {
    const handleClickOutsideEmoji = (event) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target)
      ) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutsideEmoji);
    }

    return () =>
      document.removeEventListener("mousedown", handleClickOutsideEmoji);
  }, [showEmojiPicker]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [content]);

  if (!isOpen || !currentUser || !authToken) {
    return null;
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.match("image.*")) {
      if (file.size > 5 * 1024 * 1024) {
        setMessage("Image size should be less than 5MB");
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setMessage("");
    } else {
      setImageFile(null);
      setImagePreview(null);
      setMessage("Please select a valid image file.");
    }
    setShowEmojiPicker(false);
  };

  const handleEmojiClick = (emojiData) => {
    const { emoji } = emojiData;
    const cursorPosition = textareaRef.current.selectionStart;
    const textBefore = content.substring(0, cursorPosition);
    const textAfter = content.substring(cursorPosition);

    setContent(textBefore + emoji + textAfter);

    setTimeout(() => {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        cursorPosition + emoji.length,
        cursorPosition + emoji.length
      );
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!content.trim() && !imageFile && !currentPostImageUrl) {
      setMessage("Please add some content or an image to your post.");
      return;
    }

    setIsLoading(true);

    const formData = new FormData();
    formData.append("caption", content.trim());
    formData.append("privacy", privacy === "family" ? "private" : privacy);
    formData.append("status", "1");if (privacy === "family") {
      formData.append("familyCode", familyCode);
    }


    if (imageFile) {
      formData.append("postImage", imageFile);
    }

    let url = `${import.meta.env.VITE_API_BASE_URL}/post`;
    let method = "POST";

    if (mode === "edit" && postData?.id) {
      url = `${import.meta.env.VITE_API_BASE_URL}/post/edit/${postData.id}`;
      method = "PUT";
    } else if (mode === "create") {
      url = `${import.meta.env.VITE_API_BASE_URL}/post/create`;
      method = "POST";
    }

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${mode} post`);
      }

      setShowSuccess(true);
      onPostCreated();

      // Auto-close after 2 seconds
      setTimeout(() => {
        setShowSuccess(false);
        handleClose();
      }, 2000);
    } catch (error) {
      console.error(`Error ${mode}ing post:`, error);
      setMessage(`Error: ${error.message || `Could not ${mode} post.`}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setContent("");
    setImageFile(null);
    setImagePreview(null);
    setCurrentPostImageUrl(null);
    setPrivacy("public");
    setFamilyCode(currentUser?.familyCode || userInfo?.familyCode || "");
    setIsLoading(false);
    setShowEmojiPicker(false);
    setShowPrivacyDropdown(false);
    setMessage("");
    setShowSuccess(false);
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
    setShowEmojiPicker(false);
  };

  const removeImage = () => {
    setImagePreview(null);
    setImageFile(null);
    setCurrentPostImageUrl(null);
    setMessage("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Check if user can use private option
  const hasFamilyCode =
    (currentUser?.familyCode || userInfo?.familyCode) &&
    (currentUser?.familyCode || userInfo?.familyCode).trim() !== "";
  const isApproved = userInfo?.approveStatus === "approved";
  const canUsePrivate = hasFamilyCode && isApproved;

  // Privacy options
  const PrivacyOptions = {
    family: {
      icon: <FaUserFriends className="mr-2 h-4 w-4" />,
      label: "Private",
      color: "text-blue-600",
    },
    public: {
      icon: <FaGlobeAmericas className="mr-2 h-4 w-4" />,
      label: "Public",
      color: "text-secondary-500",
    },
  };

  const availablePrivacyOptions = canUsePrivate
    ? PrivacyOptions
    : { public: PrivacyOptions.public };

  const currentPrivacyOption =
    PrivacyOptions[privacy] || PrivacyOptions["public"];

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 transition-all duration-300"
      onClick={handleClose}
    >
      <div
        ref={modalRef}
        className="bg-white pb-10 rounded-3xl shadow-2xl w-full max-w-2xl mx-auto transform transition-all duration-300 scale-100 opacity-100 max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col relative animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Success Popup Overlay */}
        {showSuccess && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-4 sm:p-6 text-center animate-fadeIn">
            <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-2xl max-w-sm w-full border-4 border-green-500 transform animate-scaleIn">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mb-5 sm:mb-6 mx-auto shadow-lg animate-bounce">
                <FiCheckCircle size={48} className="text-white" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3">
                Success!
              </h3>
              <p className="text-gray-600 mb-6 text-base sm:text-lg">
                {mode === "create"
                  ? "Post created successfully!"
                  : "Post updated successfully!"}
              </p>
              <button
                className="bg-gradient-to-r from-green-500 to-green-600 text-white px-8 sm:px-10 py-3 rounded-full font-semibold text-base sm:text-lg shadow-lg hover:shadow-xl hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-105 active:scale-95"
                onClick={() => {
                  setShowSuccess(false);
                  handleClose();
                }}
              >
                OK
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50">
          <h2 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-primary-600  to-primary-800 bg-clip-text text-transparent">
            {mode === "create" ? "Create New Post" : "Edit Post"}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 bg-white hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-all active:scale-95"
            title="Close"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Main Content */}
        <form
          onSubmit={handleSubmit}
          className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-grow custom-scrollbar"
        >
          {/* Author Info */}
          <div className="flex items-start sm:items-center gap-3 sm:gap-4 pb-4 border-b border-gray-100">
            <img
              src={currentUser.profileUrl}
              alt="Your Avatar"
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-3 border-blue-200 shadow-md flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 text-sm sm:text-base truncate">
                {currentUser.firstName}
              </p>

              {/* Privacy Dropdown */}
              <div className="relative mt-1.5" ref={privacyDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowPrivacyDropdown(!showPrivacyDropdown)}
                  className={`inline-flex justify-center items-center rounded-lg border border-gray-300 shadow-sm px-3 py-1.5 bg-white text-xs sm:text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2  transition-all active:scale-95 ${currentPrivacyOption.color}`}
                >
                  {currentPrivacyOption.icon}
                  <span className="hidden sm:inline">
                    {currentPrivacyOption.label}
                  </span>
                  <span className="sm:hidden">
                    {currentPrivacyOption.label.slice(0, 3)}
                  </span>
                  <FiChevronDown className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />
                </button>

                {showPrivacyDropdown && (
                  <div className="origin-top-left absolute left-0 mt-2 w-40 sm:w-44 rounded-xl shadow-xl bg-white ring-1 ring-black ring-opacity-5 z-30 overflow-hidden animate-slideDown">
                    <div className="py-1">
                      {Object.entries(availablePrivacyOptions).map(
                        ([value, { icon, label, color }]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => {
                              setPrivacy(value);
                              setShowPrivacyDropdown(false);
                            }}
                            className={`flex items-center w-full text-left bg-white px-4 py-2.5 sm:py-3 text-sm hover:bg-gray-50 transition-colors ${color} ${
                              privacy === value ? "bg-blue-50" : ""
                            }`}
                          >
                            {icon}
                            <span className="font-medium">{label}</span>
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Post Content Textarea */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              className="w-full p-3 sm:p-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800 placeholder-gray-400 resize-none min-h-[120px] sm:min-h-[140px] text-sm sm:text-base transition-all"
              placeholder={`What's on your mind, ${
                currentUser.firstName?.split("_")[0] || "there"
              }?`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={5000}
            />

            {/* Character count */}
            <div className="absolute bottom-2 sm:bottom-3 right-2 sm:right-3 text-xs text-gray-400">
              {content.length} / 5000
            </div>

            {/* Emoji Picker */}
            {/* Emoji Picker BACKDROP */}
            {showEmojiPicker && (
              <div
                className="fixed inset-0 bg-black/10 z-40"
                onClick={() => setShowEmojiPicker(false)}
              />
            )}

            {/* Emoji Picker Positioned Under Button */}
            {showEmojiPicker && (
              <div
                ref={emojiPickerRef}
                className="absolute z-50 mt-2 right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 shadow-2xl rounded-xl overflow-hidden bg-white"
                style={{ bottom: "-370px" }} // Moves picker BELOW the action row
              >
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  width={300}
                  height={350}
                  previewConfig={{ showPreview: false }}
                  searchDisabled
                  skinTonesDisabled
                  lazyLoadEmojis
                />
              </div>
            )}
          </div>

          {/* Hidden Family Code Input */}
          <input type="hidden" value={familyCode} />

          {/* Error Message */}
          {message && (
            <div
              className="bg-red-50 border-l-4 border-red-500 text-red-700 px-3 sm:px-4 py-3 rounded-lg relative animate-slideDown"
              role="alert"
            >
              <div className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5 text-lg">⚠️</span>
                <span className="block flex-1 text-xs sm:text-sm">
                  {message}
                </span>
                <button
                  onClick={() => setMessage("")}
                  className="text-red-500 hover:text-red-700 flex-shrink-0"
                >
                  <FiX size={18} />
                </button>
              </div>
            </div>
          )}

          {/* Image Preview */}
          {(imagePreview || currentPostImageUrl) && (
            <div className="relative rounded-xl overflow-hidden border-2 border-gray-200 group shadow-md">
              <img
                src={imagePreview || currentPostImageUrl}
                alt="Post Preview"
                className="w-full max-h-72 sm:max-h-96 object-contain bg-gray-100"
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-2 sm:top-3 right-2 sm:right-3 bg-red-500 text-white rounded-full p-2 sm:p-2.5 hover:bg-red-600 transition-all shadow-lg transform hover:scale-110 active:scale-95"
                title="Remove image"
              >
                <FiTrash2 size={16} className="sm:w-5 sm:h-5" />
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 rounded-xl p-3 sm:p-4 border border-blue-100">
            <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
              Add to your post
            </p>
            <div className="flex justify-between items-center gap-2 sm:gap-3 flex-wrap">
              <div className="flex gap-1.5 sm:gap-2">
                {/* Photo Button */}
                <button
                  type="button"
                  onClick={triggerFileInput}
                  className="p-2 sm:p-3 rounded-xl bg-white text-primary-600  transition-all shadow-md hover:shadow-lg flex items-center gap-1 sm:gap-2 transform hover:scale-105 active:scale-95"
                  title="Add photo"
                >
                  <FiImage size={18} className="sm:w-5 sm:h-5" />
                  <span className="text-xs sm:text-sm font-medium hidden sm:inline">
                    Photo
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />

                {/* Emoji Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEmojiPicker(!showEmojiPicker);
                  }}
                  className="p-2 sm:p-3 rounded-xl bg-white text-primary-600 hover:bg-yellow-50 transition-all shadow-md hover:shadow-lg flex items-center gap-1 sm:gap-2 transform hover:scale-105 active:scale-95"
                  title="Add emoji"
                >
                  <FiSmile size={18} className="sm:w-5 sm:h-5" />
                  <span className="text-xs sm:text-sm font-medium hidden sm:inline">
                    Emoji
                  </span>
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={
                  isLoading ||
                  (!content.trim() && !imageFile && !currentPostImageUrl)
                }
                className={`px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold text-white transition-all flex items-center gap-1.5 sm:gap-2 shadow-lg text-sm sm:text-base ${
                  content.trim() || imageFile || currentPostImageUrl
                    ? "bg-gradient-to-r  from-secondary-500  to-secondary-600 transform hover:scale-105 active:scale-95"
                    : "bg-gray-300 cursor-not-allowed"
                }`}
              >
                {isLoading ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 sm:h-5 sm:w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>
                      {mode === "create" ? "Posting..." : "Updating..."}
                    </span>
                  </>
                ) : (
                  <>
                    <FiSend size={16} className="sm:w-5 sm:h-5" />
                    <span>{mode === "create" ? "Post" : "Update"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }

        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }

        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #3b82f6, #8b5cf6);
          border-radius: 10px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #2563eb, #7c3aed);
        }
      `}</style>
    </div>
  );
};

export default CreatePostModal;
