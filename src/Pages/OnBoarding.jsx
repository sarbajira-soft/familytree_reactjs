import React, { useState, useEffect, useRef } from "react";

import {
  FaUser,
  FaUsers,
  FaEnvelope,
  FaInfoCircle,
  FaCloudUploadAlt,
} from "react-icons/fa";

import AuthLogo from "../Components/AuthLogo";

import PhoneInput from "react-phone-input-2";

import "react-phone-input-2/lib/material.css";

import { jwtDecode } from "jwt-decode";

import { useLocation } from "react-router-dom";

import Swal from "sweetalert2";

import PropTypes from "prop-types";

import { authFetchResponse } from "../utils/authFetch";
import { getToken } from "../utils/auth";

const SECTIONS = [
  {
    id: "basic",
    title: "Basic Information",
    icon: <FaUser className="mr-3" />,
    description: "General information about you",
  },
  {
    id: "family",
    title: "Family and Identity",
    icon: <FaUsers className="mr-3" />,
    description: "Share a bit about your background",
  },
  {
    id: "contact",
    title: "Personal Preferences & Contact",
    icon: <FaEnvelope className="mr-3" />,
    description: "How you like to be reached and what you prefer",
  },
  {
    id: "bio",
    title: "Bio & System-Generated Info",
    icon: <FaInfoCircle className="mr-3" />,
    description: "Basic info about you and system updates",
  },
];

const NAME_PATTERN = /^[a-zA-Z0-9\s]+$/;

const INDIAN_RELIGIONS = [
  "Hindu",
  "Muslim",
  "Christian",
  "Sikh",
  "Buddhist",
  "Jain",
  "Zoroastrian (Parsi)",
];

const INDIAN_LANGUAGES = [
  "Tamil",
  "Hindi",
  "Telugu",
  "Malayalam",
  "Kannada",
  "Marathi",
  "Gujarati",
  "Bengali",
  "Punjabi",
  "Urdu",
  "Odia",
  "Assamese",
  "English",
];

const MAX_PROFILE_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_PROFILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/gif",
]);

const isBlank = (value) => String(value || "").trim() === "";

const normalizePhoneDigits = (value) => String(value || "").replaceAll(/\D/g, "");

const getContactNumberFallback = (profileContact, userCountryCode, userMobile) => {
  const profileDigits = normalizePhoneDigits(profileContact);
  if (profileDigits) return profileDigits;
  return normalizePhoneDigits(`${userCountryCode || ""}${userMobile || ""}`);
};

const deriveContactFields = (data) => {
  const digits = normalizePhoneDigits(data.contactNumber);
  if (!digits) return null;

  const dialCodeDigits = normalizePhoneDigits(data.contactCountryCode);
  if (dialCodeDigits && digits.startsWith(dialCodeDigits)) {
    const mobile = digits.slice(dialCodeDigits.length);
    if (mobile) {
      return {
        contactNumber: digits,
        countryCode: `+${dialCodeDigits}`,
        mobile,
      };
    }
  }

  return { contactNumber: digits };
};

const validateProfileFile = (file) => {
  if (!file) return { isValid: true };

  if (file.size > MAX_PROFILE_FILE_SIZE) {
    return {
      isValid: false,
      message: "File too large. Max size is 5MB.",
    };
  }

  if (!ALLOWED_PROFILE_TYPES.has(file.type)) {
    return {
      isValid: false,
      message: "Unsupported file type. Please upload JPG, PNG, or GIF.",
    };
  }

  return { isValid: true };
};

const validateName = (value, fieldLabel) => {
  const trimmed = String(value || "").trim();
  if (trimmed === "") return `${fieldLabel} is required`;
  if (trimmed.length < 2) return `${fieldLabel} must be at least 2 characters`;
  if (!NAME_PATTERN.test(trimmed))
    return `${fieldLabel} should only contain letters and numbers`;
  return null;
};

const OPTIONAL_TEXT_PATTERN = /^[A-Za-z][A-Za-z .'-]*$/;

const validateOptionalText = (value, fieldLabel) => {
  const trimmed = String(value || "").trim();
  if (trimmed === "") return null;
  if (!OPTIONAL_TEXT_PATTERN.test(trimmed)) {
    return `${fieldLabel} can contain only letters, spaces, and . ' -`;
  }
  return null;
};

const isNumericValue = (value) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  return !Number.isNaN(parsed);
};

const parsePositiveInt = (value) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return parsed;
};

const calculateAge = (dobValue) => {
  const dob = String(dobValue || "").trim();
  if (dob === "") return "";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return "";
  birthDate.setHours(0, 0, 0, 0);

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age < 0 ? "" : age;
};

const validateDob = (dobValue) => {
  const dob = String(dobValue || "").trim();
  if (dob === "") return "Date of birth is required";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const birthDate = new Date(dob);
  birthDate.setHours(0, 0, 0, 0);

  if (birthDate > today) return "Date of birth cannot be in the future";

  const maxAge = 150;
  const age = Math.floor((today - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
  if (age > maxAge) return "Please enter a valid date of birth";

  return null;
};

const validateSelectWithOther = (
  selectedValue,
  otherValue,
  selectKey,
  otherKey,
  selectMessage,
  otherMessage,
) => {
  const errors = {};

  if (!selectedValue || selectedValue === 0) {
    errors[selectKey] = selectMessage;
  } else if (selectedValue === "other" && isBlank(otherValue)) {
    errors[otherKey] = otherMessage;
  }

  return errors;
};

const validateOptionalSelectWithOther = (
  selectedValue,
  otherValue,
  otherKey,
  otherMessage,
) => {
  const errors = {};

  if (selectedValue === "other" && isBlank(otherValue)) {
    errors[otherKey] = otherMessage;
  }

  return errors;
};

const buildBasicSectionErrors = (data) => {
  const errors = {};

  const firstNameError = validateName(data.firstName, "First name");
  if (firstNameError) errors.firstName = firstNameError;

  const lastNameError = validateName(data.lastName, "Last name");
  if (lastNameError) errors.lastName = lastNameError;

  const dobError = validateDob(data.dob);
  if (dobError) errors.dob = dobError;

  if (isBlank(data.gender)) errors.gender = "Gender is required";

  return errors;
};

const buildFamilySectionErrors = (data) => {
  const errors = {};

  if (isBlank(data.fatherName)) errors.fatherName = "Father's name is required";
  if (isBlank(data.motherName)) errors.motherName = "Mother's name is required";

  const casteError = validateOptionalText(data.caste, "Caste");
  if (casteError) errors.caste = casteError;

  const kuladevataError = validateOptionalText(data.kuladevata, "Kuladevata");
  if (kuladevataError) errors.kuladevata = kuladevataError;

  Object.assign(
    errors,
    validateSelectWithOther(
      data.motherTongue,
      data.motherTongueOther,
      "motherTongue",
      "motherTongueOther",
      "Mother tongue is required",
      "Please enter mother tongue",
    ),
  );

  Object.assign(
    errors,
    validateOptionalSelectWithOther(
      data.religionId,
      data.religionOther,
      "religionOther",
      "Please enter religion",
    ),
  );

  Object.assign(
    errors,
    validateOptionalSelectWithOther(
      data.gothram,
      data.gothramOther,
      "gothramOther",
      "Please enter gothram",
    ),
  );

  return errors;
};

const buildContactSectionErrors = (data) => {
  const errors = {};
  const contactNumber = String(data.contactNumber || "").trim();

  if (contactNumber === "") {
    errors.contactNumber = "Contact number is required";
  } else if (contactNumber.length < 10) {
    errors.contactNumber = "Please enter a valid contact number";
  }

  if (isBlank(data.address)) errors.address = "Address is required";
  return errors;
};

const SECTION_ERROR_BUILDERS = {
  basic: buildBasicSectionErrors,
  family: buildFamilySectionErrors,
  contact: buildContactSectionErrors,
};

const getSectionErrors = (activeSection, data) => {
  const builder = SECTION_ERROR_BUILDERS[activeSection];
  return builder ? builder(data) : {};
};

const SECTION_FIELD_MAP = {
  basic: new Set(["firstName", "lastName", "dob", "gender", "profile"]),
  family: new Set([
    "fatherName",
    "motherName",
    "motherTongue",
    "motherTongueOther",
    "religionId",
    "religionOther",
    "caste",
    "gothram",
    "gothramOther",
    "kuladevata",
  ]),
  contact: new Set(["contactNumber", "address"]),
};

const getSectionForErrors = (errors) => {
  const errorKeys = Object.keys(errors);
  for (const key of errorKeys) {
    for (const [section, fields] of Object.entries(SECTION_FIELD_MAP)) {
      if (fields.has(key)) return section;
    }
  }
  return null;
};

const getAllSectionErrors = (data) => ({
  ...buildBasicSectionErrors(data),
  ...buildFamilySectionErrors(data),
  ...buildContactSectionErrors(data),
});

const getFieldErrorFromApiMessage = (message) => {
  const lower = String(message || "").toLowerCase();
  if (lower.includes("file") || lower.includes("image")) {
    return { field: "profile", section: "basic" };
  }
  if (lower.includes("caste")) {
    return { field: "caste", section: "family" };
  }
  if (lower.includes("phone number") || lower.includes("mobile")) {
    return { field: "contactNumber", section: "contact" };
  }
  return null;
};

const focusFirstErrorField = (errors, fieldRefs) => {
  const firstError = Object.keys(errors)[0];
  if (!firstError) return;
  const ref = fieldRefs[firstError]?.current;
  if (ref) {
    ref.scrollIntoView({ behavior: "smooth", block: "center" });
    ref.focus();
    return;
  }
  const fallback = document.querySelector(
    `[name="${firstError}"], [id="${firstError}"]`,
  );
  if (fallback) {
    fallback.scrollIntoView({ behavior: "smooth", block: "center" });
    fallback.focus();
  }
};

const areAllMandatoryFieldsFilled = (data) => {
  if (
    isBlank(data.firstName) ||
    isBlank(data.lastName) ||
    isBlank(data.dob) ||
    isBlank(data.gender)
  ) {
    return false;
  }

  if (
    isBlank(data.fatherName) ||
    isBlank(data.motherName) ||
    !data.motherTongue ||
    data.motherTongue === 0 ||
    data.motherTongue === ""
  ) {
    return false;
  }

  if (data.motherTongue === "other" && isBlank(data.motherTongueOther))
    return false;
  if (data.religionId === "other" && isBlank(data.religionOther)) return false;
  if (data.gothram === "other" && isBlank(data.gothramOther)) return false;

  if (isBlank(data.contactNumber) || isBlank(data.address)) return false;
  return true;
};

const buildChildFieldsFromNames = (childrenArray) => {
  const childFields = {};
  (childrenArray || []).forEach((name, index) => {
    childFields[`childName${index}`] = name;
  });
  return childFields;
};

const fetchDropdownDataForOnboarding = async (setDropdownData) => {
  try {
    setDropdownData((prev) => ({ ...prev, loading: true, error: null }));

    const endpoints = [
      `${import.meta.env.VITE_API_BASE_URL}` + "/language",
      `${import.meta.env.VITE_API_BASE_URL}` + "/religion",
      `${import.meta.env.VITE_API_BASE_URL}` + "/gothram",
    ];

    const responses = await Promise.all(
      endpoints.map((url) =>
        authFetchResponse(url, {
          method: "GET",
          skipThrow: true,
          headers: {
            accept: "application/json",
          },
        })
      )
    );
    const data = await Promise.all(responses.map((res) => res.json()));

    const languages = data[0].data || data[0] || [];
    const religions = data[1].data || data[1] || [];
    const gothrams = data[2].data || data[2] || [];
    const fallbackLanguages = INDIAN_LANGUAGES.map((language) => ({
      id: language,
      name: language,
    }));
    const fallbackReligions = INDIAN_RELIGIONS.map((religion) => ({
      id: religion,
      name: religion,
    }));

    setDropdownData({
      languages: languages.length > 0 ? languages : fallbackLanguages,
      religions: religions.length > 0 ? religions : fallbackReligions,
      gothrams,
      loading: false,
      error: null,
    });
  } catch (error) {
    console.error("Failed to load dropdown options", error);

    setDropdownData((prev) => ({
      ...prev,
      loading: false,
      error: "Failed to load dropdown options",
    }));
  }
};

const fetchAndApplyUserDetails = async ({
  userId,
  token,
  setUserLoading,
  setFormData,
}) => {
  try {
    setUserLoading(true);

    console.log(`[OnBoarding] Starting user profile fetch for userId: ${userId}`);

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await authFetchResponse(`/user/profile/${userId}`, {
      method: "GET",
      skipThrow: true,
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log(
      `[OnBoarding] Profile fetch completed in ${Date.now() - startTime}ms`,
    );

    if (!response.ok) throw new Error("Failed to fetch user details");

    const jsonData = await response.json();
    const { userProfile } = jsonData.data;
    const userCountryCode = jsonData.data?.countryCode || "";
    const userMobile = jsonData.data?.mobile || "";

    const childrenArray = userProfile.childrenNames
      ? JSON.parse(userProfile.childrenNames)
      : [];

    const otherLanguage = userProfile.otherLanguage || "";
    const otherReligion = userProfile.otherReligion || "";
    const otherGothram = userProfile.otherGothram || "";

    setFormData((prev) => {
      const childFields = buildChildFieldsFromNames(childrenArray);

      const contactNumber = getContactNumberFallback(
        userProfile.contactNumber,
        userCountryCode,
        userMobile,
      );

      let motherTongueValue = 0;
      if (userProfile.languageId) {
        motherTongueValue = Number.parseInt(userProfile.languageId, 10);
      } else if (otherLanguage) {
        motherTongueValue = "other";
      }

      let religionValue = 0;
      if (userProfile.religionId) {
        religionValue = Number.parseInt(userProfile.religionId, 10);
      } else if (otherReligion) {
        religionValue = "other";
      }

      let gothramValue = 0;
      if (userProfile.gothramId) {
        gothramValue = Number.parseInt(userProfile.gothramId, 10);
      } else if (otherGothram) {
        gothramValue = "other";
      }

      return {
        ...prev,
        firstName: userProfile.firstName || "",
        lastName: userProfile.lastName || "",
        dob: userProfile.dob ? userProfile.dob.split("T")[0] : "",
        age: calculateAge(userProfile.dob) || 0,
        gender: userProfile.gender || "",
        maritalStatus: userProfile.maritalStatus || "",
        spouseName: userProfile.spouseName || "",
        marriageDate: userProfile.marriageDate
          ? userProfile.marriageDate.split("T")[0]
          : "",
        childrenCount: childrenArray.length || 0,
        ...childFields,
        fatherName: userProfile.fatherName || "",
        motherName: userProfile.motherName || "",
        motherTongue: motherTongueValue,
        motherTongueOther: otherLanguage,
        religionId: religionValue,
        religionOther: otherReligion,
        caste: userProfile.caste || "",
        gothram: gothramValue,
        gothramOther: otherGothram,
        kuladevata: userProfile.kuladevata || "",
        hobbies: userProfile.hobbies || "",
        likes: userProfile.likes || "",
        dislikes: userProfile.dislikes || "",
        favoriteFoods: userProfile.favoriteFoods || "",
        address: userProfile.address || "",
        contactNumber,
        contactCountryCode: userCountryCode || prev.contactCountryCode || "+91",
        bio: userProfile.bio || "",
        profile: userProfile.profile || "",
        profileUrl: userProfile.profile || "",
        familyCode: prev.familyCode || userProfile.familyCode || "",
      };
    });
  } catch (error) {
    console.error("Error fetching user details:", error);

    if (error.name === "AbortError") {
      console.error("Request timed out after 30 seconds");
    }
  } finally {
    setUserLoading(false);
  }
};

const shouldSkipOnSave = (key, data) => {
  if (
    key === "motherTongueOther" ||
    key === "religionOther" ||
    key === "gothramOther"
  )
    return true;
  if (["motherTongue", "religionId", "gothram"].includes(key)) return true;
  if (key === "contactCountryCode") return true;
  if (key === "childrenNames" || key === "profile") return true;
  if (key.startsWith("childName")) return true;

  const value = data[key];
  if (value === undefined || value === null) return true;

  const optionalTrimmedFields = new Set([
    "caste",
    "kuladevata",
    "region",
    "hobbies",
    "likes",
    "dislikes",
    "favoriteFoods",
    "bio",
  ]);

  const isSingle = data.maritalStatus === "Single";
  const trimmed = typeof value === "string" ? value.trim() : value;
  if (optionalTrimmedFields.has(key) && trimmed === "") return true;
  if (key === "marriageDate" && (isSingle || !trimmed)) return true;
  if (key === "spouseName" && (isSingle || !trimmed)) return true;

  return false;
};

const appendNonSkippedFields = (payload, data) => {
  Object.keys(data).forEach((key) => {
    if (!shouldSkipOnSave(key, data)) {
      payload.append(key, data[key]);
    }
  });
};

const applyLanguageFields = (payload, data) => {
  const selectedValue = String(data.motherTongue || "").trim();
  const otherValue = String(data.motherTongueOther || "").trim();
  if (selectedValue === "" || selectedValue === "0") {
    payload.delete("languageId");
    payload.delete("otherLanguage");
    return;
  }
  if (selectedValue === "other") {
    payload.delete("languageId");
    if (otherValue) {
      payload.set("otherLanguage", otherValue);
    } else {
      payload.delete("otherLanguage");
    }
    return;
  }

  const parsedId = parsePositiveInt(selectedValue);
  if (parsedId) {
    payload.set("languageId", parsedId);
    payload.delete("otherLanguage");
    return;
  }

  if (selectedValue) {
    payload.delete("languageId");
    payload.set("otherLanguage", selectedValue);
  } else {
    payload.delete("languageId");
    payload.delete("otherLanguage");
  }
};

const applyReligionFields = (payload, data) => {
  const selectedValue = String(data.religionId || "").trim();
  const otherValue = String(data.religionOther || "").trim();
  if (selectedValue === "" || selectedValue === "0") {
    payload.delete("religionId");
    payload.delete("otherReligion");
    return;
  }
  if (selectedValue === "other") {
    payload.delete("religionId");
    if (otherValue) {
      payload.set("otherReligion", otherValue);
    } else {
      payload.delete("otherReligion");
    }
    return;
  }

  const parsedId = parsePositiveInt(selectedValue);
  if (parsedId) {
    payload.set("religionId", parsedId);
    payload.delete("otherReligion");
    return;
  }

  if (selectedValue) {
    payload.delete("religionId");
    payload.set("otherReligion", selectedValue);
  } else {
    payload.delete("religionId");
    payload.delete("otherReligion");
  }
};

const applyGothramFields = (payload, data) => {
  const selectedValue = String(data.gothram || "").trim();
  const otherValue = String(data.gothramOther || "").trim();
  if (selectedValue === "" || selectedValue === "0") {
    payload.delete("gothramId");
    payload.delete("otherGothram");
    return;
  }
  if (selectedValue === "other") {
    payload.delete("gothramId");
    if (otherValue) {
      payload.set("otherGothram", otherValue);
    } else {
      payload.delete("otherGothram");
    }
    return;
  }

  const parsedId = parsePositiveInt(selectedValue);
  if (parsedId) {
    payload.set("gothramId", parsedId);
    payload.delete("otherGothram");
    return;
  }

  if (selectedValue) {
    payload.delete("gothramId");
    payload.set("otherGothram", selectedValue);
  } else {
    payload.delete("gothramId");
    payload.delete("otherGothram");
  }
};

const applyChildrenNames = (payload, data) => {
  if (data.maritalStatus !== "Married" || data.childrenCount <= 0) return;

  const childrenNames = [];
  for (let i = 0; i < data.childrenCount; i++) {
    if (data[`childName${i}`]) {
      childrenNames.push(data[`childName${i}`]);
    }
  }

  if (childrenNames.length > 0) {
    payload.append("childrenNames", JSON.stringify(childrenNames));
  }
};

const applyProfileFile = (payload, data) => {
  if (data.profile instanceof File) {
    payload.append("profile", data.profile);
  }
};

const applyContactFields = (payload, data) => {
  const derived = deriveContactFields(data);
  if (!derived) return;

  if (derived.contactNumber) {
    payload.set("contactNumber", derived.contactNumber);
  }

  if (derived.countryCode) {
    payload.set("countryCode", derived.countryCode);
  }

  if (derived.mobile) {
    payload.set("mobile", derived.mobile);
  }
};

const finalizeProfilePayload = (payload, data) => {
  payload.set(
    "childrenCount",
    Number.parseInt(String(data.childrenCount || "0"), 10) || "0",
  );
  payload.set("familyCode", data.familyCode || "");
  payload.delete("motherTongue");
  payload.delete("gothram");
  payload.delete("childrenCount");
  payload.delete("profileUrl");
  payload.delete("contactCountryCode");
};

const buildProfileUpdateFormData = (data) => {
  const payload = new FormData();
  appendNonSkippedFields(payload, data);
  applyLanguageFields(payload, data);
  applyReligionFields(payload, data);
  applyGothramFields(payload, data);
  applyChildrenNames(payload, data);
  applyProfileFile(payload, data);
  applyContactFields(payload, data);
  finalizeProfilePayload(payload, data);
  return payload;
};

const OnBoardingSidebar = ({ sections, activeSection, onSelectSection }) => (
  <div className="hidden lg:block w-[35%] border-r shadow-lg shadow-blue-100 z-10 p-6">
    <div className="flex flex-col h-full">
      {/* Logo */}

      <div className="flex mb-7">
        <AuthLogo className="w-18 h-18" />
      </div>

      <nav className="space-y-10 relative">
        {sections.map((section, index) => {
          const isActive = activeSection === section.id;

          const isCompleted =
            sections.findIndex((s) => s.id === activeSection) > index;

          const textColor =
            isActive || isCompleted ? "text-black" : "text-[rgb(135,138,145)]";

          const iconColor =
            isActive || isCompleted ? "text-black" : "text-[rgb(135,138,145)]";

          const lineColor =
            isActive || isCompleted ? "bg-black" : "bg-[rgb(135,138,145)]";

          return (
            <div key={section.id} className="relative pl-2">
              {/* Vertical line centered on icon */}

              {index !== sections.length - 1 && (
                <div
                  className={`absolute top-10 left-[20px] h-[calc(100%+10px)] w-px ${lineColor}`}
                />
              )}

              <button
                type="button"
                className="flex items-center gap-4 w-full text-left bg-unset"
                onClick={() => onSelectSection(section.id)}
              >
                {/* Icon Box - stays centered */}

                <div className="w-10 h-10 flex items-center justify-center shadow-md rounded-md bg-white z-10">
                  <div className={`text-lg ${iconColor}`}>{section.icon}</div>
                </div>

                {/* Text aligned left */}

                <div>
                  <div className={`text-sm font-semibold ${textColor}`}>
                    {section.title}
                  </div>

                  <p className="text-xs text-gray-500 leading-4">
                    {section.description}
                  </p>
                </div>
              </button>
            </div>
          );
        })}
      </nav>
    </div>
  </div>
);

OnBoardingSidebar.propTypes = {
  sections: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,

      title: PropTypes.string.isRequired,

      icon: PropTypes.node,

      description: PropTypes.string,
    }),
  ).isRequired,

  activeSection: PropTypes.string.isRequired,

  onSelectSection: PropTypes.func.isRequired,
};

const OnBoardingFooter = ({
  isFirst,

  isLast,

  allMandatoryFilled,

  isSaving,

  goToPrevious,

  goToNext,

  handleSave,
}) => (
  <div className="mt-12 flex justify-between border-t pt-6 items-center">
    {/* Back */}

    <button
      className={`bg-unset text-gray-600 hover:text-black text-sm flex items-center gap-1 ${isFirst ? "cursor-default opacity-50" : "cursor-pointer"}`}
      onClick={goToPrevious}
      disabled={isFirst}
    >
      <span>&larr;</span> <span>Back</span>
    </button>

    {/* Right Side: Next/Save */}

    <div className="flex items-center gap-5">
      {isLast ? (
        <button
          className={`px-6 py-2 rounded-md text-white text-sm flex items-center justify-center gap-2 min-w-[80px] ${!allMandatoryFilled || isSaving
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-primary hover:bg-primary-dark"
            }`}
          onClick={handleSave}
          disabled={!allMandatoryFilled || isSaving}
        >
          {isSaving ? (
            <>
              <svg
                className="w-4 h-4 animate-spin text-white"
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
                  d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
                />
              </svg>

              <span>Saving...</span>
            </>
          ) : (
            "Save"
          )}
        </button>
      ) : (
        <button
          className="bg-unset text-sm flex items-center gap-1 text-primary px-6 py-2 rounded-md"
          onClick={goToNext}
        >
          <span>Next</span> <span>&rarr;</span>
        </button>
      )}
    </div>
  </div>
);

OnBoardingFooter.propTypes = {
  isFirst: PropTypes.bool.isRequired,

  isLast: PropTypes.bool.isRequired,

  allMandatoryFilled: PropTypes.bool.isRequired,

  isSaving: PropTypes.bool.isRequired,

  goToPrevious: PropTypes.func.isRequired,

  goToNext: PropTypes.func.isRequired,

  handleSave: PropTypes.func.isRequired,
};

const ApiAlerts = ({ apiError, apiSuccess }) => (
  <>
    {apiError ? (
      <div
        className="mb-4 p-3 text-sm text-red-700 bg-red-100 rounded border border-red-300"
        role="alert"
      >
        {apiError}
      </div>
    ) : null}

    {apiSuccess ? (
      <output className="mb-4 p-3 text-sm text-green-700 bg-green-100 rounded border border-green-300 block">
        {apiSuccess}
      </output>
    ) : null}
  </>
);

ApiAlerts.propTypes = {
  apiError: PropTypes.string,

  apiSuccess: PropTypes.string,
};

const FamilySection = ({
  formData,
  errors,
  fieldRefs,
  handleChange,
  dropdownData,
}) => (
  <div className="max-w-2xl mx-auto">
    <div className="mb-8 text-center">
      <h1 className="text-xl font-semibold text-gray-800 mb-2">
        Fill in fields to update family and identity
      </h1>

      <p className="text-sm text-gray-600">
        This helps us maintain correct personal information!
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label
          htmlFor="fatherName"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Father's name <span className="text-red-500">*</span>
        </label>

        <input
          id="fatherName"
          ref={fieldRefs.fatherName}
          type="text"
          name="fatherName"
          value={formData.fatherName}
          onChange={handleChange}
          placeholder="Enter father name"
          className={`w-full px-4 py-2.5 border rounded-md text-sm placeholder:text-sm focus:outline-none focus:ring-2 ${errors.fatherName
              ? "border-red-500 focus:ring-red-300"
              : "border-gray-300 focus:ring-[var(--color-primary)]"
            }`}
        />

        {errors.fatherName && (
          <p className="text-red-500 text-xs mt-1">{errors.fatherName}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="motherName"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Mother's name <span className="text-red-500">*</span>
        </label>

        <input
          id="motherName"
          ref={fieldRefs.motherName}
          type="text"
          name="motherName"
          value={formData.motherName}
          onChange={handleChange}
          placeholder="Enter mother name"
          className={`w-full px-4 py-2.5 border rounded-md text-sm placeholder:text-sm focus:outline-none focus:ring-2 ${errors.motherName
              ? "border-red-500 focus:ring-red-300"
              : "border-gray-300 focus:ring-[var(--color-primary)]"
            }`}
        />

        {errors.motherName && (
          <p className="text-red-500 text-xs mt-1">{errors.motherName}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="motherTongue"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Mother Tongue <span className="text-red-500">*</span>
        </label>

        <select
          id="motherTongue"
          ref={fieldRefs.motherTongue}
          name="motherTongue"
          value={formData.motherTongue || ""}
          onChange={handleChange}
          disabled={dropdownData.loading}
          className={`w-full px-4 py-2.5 border rounded-md text-sm placeholder:text-sm focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed ${errors.motherTongue
              ? "border-red-500 focus:ring-red-300"
              : "border-gray-300 focus:ring-[var(--color-primary)]"
            }`}
        >
          <option value="">Select Mother Tongue</option>

          {dropdownData.languages.map((language) => (
            <option key={language.id} value={language.id}>
              {language.name}
            </option>
          ))}

          <option value="other">Others</option>
        </select>

        {errors.motherTongue && (
          <p className="text-red-500 text-xs mt-1">{errors.motherTongue}</p>
        )}

        {formData.motherTongue === "other" && (
          <div className="mt-2">
            <input
              type="text"
              name="motherTongueOther"
              value={formData.motherTongueOther || ""}
              onChange={handleChange}
              placeholder="Enter mother tongue"
              className={`w-full px-4 py-2.5 border rounded-md text-sm placeholder:text-sm focus:outline-none focus:ring-2 ${errors.motherTongueOther
                  ? "border-red-500 focus:ring-red-300"
                  : "border-gray-300 focus:ring-[var(--color-primary)]"
                }`}
            />

            {errors.motherTongueOther && (
              <p className="text-red-500 text-xs mt-1">
                {errors.motherTongueOther}
              </p>
            )}
          </div>
        )}
      </div>

      <div>
        <label
          htmlFor="religionId"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Religion
        </label>

        <select
          id="religionId"
          ref={fieldRefs.religionId}
          name="religionId"
          value={formData.religionId || ""}
          onChange={handleChange}
          disabled={dropdownData.loading}
          className={`w-full px-4 py-2.5 border rounded-md text-sm placeholder:text-sm focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed ${errors.religionId
              ? "border-red-500 focus:ring-red-300"
              : "border-gray-300 focus:ring-[var(--color-primary)]"
            }`}
        >
          <option value="">Select Religion</option>

          {dropdownData.religions.map((religion) => (
            <option key={religion.id} value={religion.id}>
              {religion.name}
            </option>
          ))}

          <option value="other">Others</option>
        </select>

        {errors.religionId && (
          <p className="text-red-500 text-xs mt-1">{errors.religionId}</p>
        )}

        {formData.religionId === "other" && (
          <div className="mt-2">
            <input
              type="text"
              name="religionOther"
              value={formData.religionOther || ""}
              onChange={handleChange}
              placeholder="Enter religion"
              className={`w-full px-4 py-2.5 border rounded-md text-sm placeholder:text-sm focus:outline-none focus:ring-2 ${errors.religionOther
                  ? "border-red-500 focus:ring-red-300"
                  : "border-gray-300 focus:ring-[var(--color-primary)]"
                }`}
            />

            {errors.religionOther && (
              <p className="text-red-500 text-xs mt-1">
                {errors.religionOther}
              </p>
            )}
          </div>
        )}
      </div>

      <div>
        <label
          htmlFor="caste"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Caste
        </label>

        <input
          id="caste"
          ref={fieldRefs.caste}
          type="text"
          name="caste"
          value={formData.caste}
          onChange={handleChange}
          placeholder="Enter your caste"
          className={`w-full px-4 py-2.5 border rounded-md text-sm placeholder:text-sm focus:outline-none focus:ring-2 ${errors.caste
              ? "border-red-500 focus:ring-red-300"
              : "border-gray-300 focus:ring-[var(--color-primary)]"
            }`}
        />

        {errors.caste && (
          <p className="text-red-500 text-xs mt-1">{errors.caste}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="gothram"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Gothram
        </label>

        <select
          id="gothram"
          ref={fieldRefs.gothram}
          name="gothram"
          value={formData.gothram || ""}
          onChange={handleChange}
          disabled={dropdownData.loading}
          className={`w-full px-4 py-2.5 border rounded-md text-sm placeholder:text-sm focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed ${errors.gothram
              ? "border-red-500 focus:ring-red-300"
              : "border-gray-300 focus:ring-[var(--color-primary)]"
            }`}
        >
          <option value="">Select Gothram</option>

          {dropdownData.gothrams.map((gothram) => (
            <option key={gothram.id} value={gothram.id}>
              {gothram.name}
            </option>
          ))}

          <option value="other">Others</option>
        </select>

        {errors.gothram && (
          <p className="text-red-500 text-xs mt-1">{errors.gothram}</p>
        )}

        {formData.gothram === "other" && (
          <div className="mt-2">
            <input
              type="text"
              name="gothramOther"
              value={formData.gothramOther || ""}
              onChange={handleChange}
              placeholder="Enter gothram"
              className={`w-full px-4 py-2.5 border rounded-md text-sm placeholder:text-sm focus:outline-none focus:ring-2 ${errors.gothramOther
                  ? "border-red-500 focus:ring-red-300"
                  : "border-gray-300 focus:ring-[var(--color-primary)]"
                }`}
            />

            {errors.gothramOther && (
              <p className="text-red-500 text-xs mt-1">
                {errors.gothramOther}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="md:col-span-2">
        <label
          htmlFor="kuladevata"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Kuladevata
        </label>

        <input
          id="kuladevata"
          ref={fieldRefs.kuladevata}
          type="text"
          name="kuladevata"
          value={formData.kuladevata || ""}
          onChange={handleChange}
          placeholder="Enter Kuladevata"
          className={`w-full px-4 py-2.5 border rounded-md text-sm placeholder:text-sm focus:outline-none focus:ring-2 ${errors.kuladevata
              ? "border-red-500 focus:ring-red-300"
              : "border-gray-300 focus:ring-[var(--color-primary)]"
            }`}
        />

        {errors.kuladevata && (
          <p className="text-red-500 text-xs mt-1">{errors.kuladevata}</p>
        )}
      </div>
    </div>
  </div>
);

FamilySection.propTypes = {
  formData: PropTypes.object.isRequired,

  errors: PropTypes.object.isRequired,

  fieldRefs: PropTypes.object.isRequired,

  handleChange: PropTypes.func.isRequired,

  dropdownData: PropTypes.shape({
    languages: PropTypes.arrayOf(PropTypes.object).isRequired,
    religions: PropTypes.arrayOf(PropTypes.object).isRequired,
    gothrams: PropTypes.arrayOf(PropTypes.object).isRequired,
    loading: PropTypes.bool.isRequired,
    error: PropTypes.string,
  }).isRequired,
};

const BasicSection = ({
  formData,
  errors,
  fieldRefs,
  handleChange,
  setFormData,
  setErrors,
  calculateAge,
  setApiError,
}) => (
  <div className="max-w-3xl mx-auto">
    {/* Header Section */}

    <div className="mb-8 text-center">
      <h3 className="text-xl font-semibold text-gray-800">
        Let's begin! Fill out your name & basic information
      </h3>

      <p className="text-sm text-gray-600">
        Start by sharing a few quick details about yourself
      </p>
    </div>

    {/* Image Upload */}

    <div className="flex justify-center mb-8">
      <div className="relative w-32 h-32 rounded-full border-2 border-gray-300 flex flex-col items-center justify-center overflow-hidden shadow-lg">
        {formData.profile ? (
          <>
            <img
              src={
                formData.profile instanceof File
                  ? URL.createObjectURL(formData.profile)
                  : formData.profile
              }
              alt="Profile"
              className="w-full h-full object-cover rounded-full"
            />

            <div className="absolute inset-0 bg-black bg-opacity-60 flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-all duration-300 rounded-full backdrop-blur-sm">
              <label
                htmlFor="profileUpload"
                className="text-white text-xs font-medium cursor-pointer mb-3 hover:text-blue-300 transition-colors flex items-center gap-1 bg-blue-500 bg-opacity-80 px-3 py-1.5 rounded-full hover:bg-blue-600"
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Change
                <input
                  id="profileUpload"
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,image/gif"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    const validation = validateProfileFile(file);
                    if (!validation.isValid) {
                      setErrors((prev) => ({
                        ...prev,
                        profile: validation.message,
                      }));
                      setApiError("");
                      return;
                    }

                    setErrors((prev) => {
                      const nextErrors = { ...prev };
                      delete nextErrors.profile;
                      return nextErrors;
                    });
                    setApiError("");
                    setFormData((prev) => ({
                      ...prev,
                      profile: file,
                    }));
                  }}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,

                    profile: null,
                  }))
                }
                className="text-white text-xs font-medium hover:text-red-200 transition-all duration-200 flex items-center gap-1 bg-red-500 bg-opacity-80 px-3 py-1.5 rounded-full hover:bg-red-600 hover:scale-105 transform"
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Remove
              </button>
            </div>
          </>
        ) : (
          <label
            htmlFor="profileUpload"
            className="flex flex-col items-center justify-center text-gray-500 cursor-pointer w-full h-full hover:text-gray-700 transition-colors"
          >
            <FaCloudUploadAlt className="text-2xl mb-1" />

            <span className="text-xs text-center w-full">
              Upload your profile photo
            </span>

            <input
              id="profileUpload"
              type="file"
              accept="image/jpeg,image/png,image/jpg,image/gif"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                const validation = validateProfileFile(file);
                if (!validation.isValid) {
                  setErrors((prev) => ({
                    ...prev,
                    profile: validation.message,
                  }));
                  setApiError("");
                  return;
                }

                setErrors((prev) => {
                  const nextErrors = { ...prev };
                  delete nextErrors.profile;
                  return nextErrors;
                });
                setApiError("");
                setFormData((prev) => ({
                  ...prev,
                  profile: file,
                }));
              }}
              className="hidden"
            />
          </label>
        )}
      </div>
    </div>

    {errors.profile && (
      <p className="text-red-500 text-xs mt-2 text-center">{errors.profile}</p>
    )}

    {/* Form Grid */}

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Firstname */}

      <div>
        <label
          htmlFor="firstName"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          First Name <span className="text-red-500">*</span>
        </label>

        <input
          id="firstName"
          ref={fieldRefs.firstName}
          type="text"
          name="firstName"
          value={formData.firstName || ""}
          onChange={handleChange}
          placeholder="Enter your first name"
          className={`w-full px-4 py-2.5 border rounded-md text-sm placeholder:text-sm focus:outline-none focus:ring-2 ${errors.firstName
              ? "border-red-500 focus:ring-red-300"
              : "border-gray-300 focus:ring-[var(--color-primary)]"
            }`}
        />

        {errors.firstName && (
          <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
        )}
      </div>

      {/* Lastname */}

      <div>
        <label
          htmlFor="lastName"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Last Name <span className="text-red-500">*</span>
        </label>

        <input
          id="lastName"
          ref={fieldRefs.lastName}
          type="text"
          name="lastName"
          value={formData.lastName || ""}
          onChange={handleChange}
          placeholder="Enter your last name"
          className={`w-full px-4 py-2.5 border rounded-md text-sm placeholder:text-sm focus:outline-none focus:ring-2 ${errors.lastName
              ? "border-red-500 focus:ring-red-300"
              : "border-gray-300 focus:ring-[var(--color-primary)]"
            }`}
        />

        {errors.lastName && (
          <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
        )}
      </div>

      {/* Date of Birth */}

      <div>
        <label
          htmlFor="dob"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Date of Birth <span className="text-red-500">*</span>
        </label>

        <div className="relative">
          <input
            id="dob"
            ref={fieldRefs.dob}
            type="date"
            name="dob"
            value={formData.dob || ""}
            onChange={handleChange}
            max={new Date().toISOString().split("T")[0]}
            className={`w-full px-4 py-2.5 pr-16 border rounded-md text-sm placeholder:text-sm focus:outline-none focus:ring-2 ${errors.dob
                ? "border-red-500 focus:ring-red-300"
                : "border-gray-300 focus:ring-[var(--color-primary)]"
              }`}
            placeholder="Select your date of birth"
          />

          <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>

          {formData.dob && (
            <div className="absolute inset-y-0 right-10 flex items-center pr-1">
              <button
                type="button"
                onClick={() => {
                  setFormData((prev) => ({ ...prev, dob: "" }));

                  if (errors.dob) {
                    setErrors((prev) => {
                      const newErrors = { ...prev };

                      delete newErrors.dob;

                      return newErrors;
                    });
                  }
                }}
                className="text-gray-400 hover:text-red-500 transition-colors duration-200"
                title="Clear date"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>

        {formData.dob && (
          <div className="mt-1 text-xs text-gray-500 flex items-center gap-1">
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Selected:{" "}
            {new Date(formData.dob).toLocaleDateString("en-US", {
              weekday: "long",

              year: "numeric",

              month: "long",

              day: "numeric",
            })}
          </div>
        )}

        {errors.dob && <p className="text-red-500 text-xs mt-1">{errors.dob}</p>}
      </div>

      {/* Age (Auto-calculated) */}

      <div>
        <label
          htmlFor="age"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Age
        </label>

        <input
          id="age"
          type="number"
          value={calculateAge(formData.dob) || ""}
          readOnly
          placeholder="Age will be calculated automatically"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm placeholder:text-sm bg-gray-50 text-gray-600 cursor-not-allowed focus:outline-none"
        />
      </div>

      {/* Gender */}

      <div>
        <label
          htmlFor="gender"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Gender <span className="text-red-500">*</span>
        </label>

        <select
          id="gender"
          ref={fieldRefs.gender}
          name="gender"
          value={formData.gender || ""}
          onChange={handleChange}
          className={`w-full px-4 py-2.5 border rounded-md text-sm placeholder:text-sm focus:outline-none focus:ring-2 ${errors.gender
              ? "border-red-500 focus:ring-red-300"
              : "border-gray-300 focus:ring-[var(--color-primary)]"
            }`}
        >
          <option value="">Select Gender</option>

          <option value="Male">Male</option>

          <option value="Female">Female</option>

          <option value="Other">Other</option>
        </select>

        {errors.gender && (
          <p className="text-red-500 text-xs mt-1">{errors.gender}</p>
        )}
      </div>

      {/* Marital Status */}

      <div>
        <label
          htmlFor="maritalStatus"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Marital Status
        </label>

        <select
          id="maritalStatus"
          name="maritalStatus"
          value={formData.maritalStatus || ""}
          onChange={handleChange}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        >
          <option value="">Select Status</option>

          <option value="Single">Single</option>

          <option value="Married">Married</option>
        </select>
      </div>

      {/* Spouse Name */}

      {formData.maritalStatus === "Married" && (
        <div>
          <label
            htmlFor="spouseName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Spouse Name
          </label>

          <input
            id="spouseName"
            type="text"
            name="spouseName"
            value={formData.spouseName || ""}
            onChange={handleChange}
            placeholder="Enter spouse name"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>
      )}

      {/* Marriage Date */}

      {formData.maritalStatus === "Married" && (
        <div>
          <label
            htmlFor="marriageDate"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Marriage Date
          </label>

          <div className="relative">
            <input
              id="marriageDate"
              type="date"
              name="marriageDate"
              value={formData.marriageDate || ""}
              onChange={handleChange}
              max={new Date().toISOString().split("T")[0]}
              className="w-full px-4 py-2.5 pr-16 border border-gray-300 rounded-md text-sm placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              placeholder="Select marriage date"
            />

            <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>

            {formData.marriageDate && (
              <div className="absolute inset-y-0 right-10 flex items-center pr-1">
                <button
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({
                      ...prev,
                      marriageDate: "",
                    }));
                  }}
                  className="text-gray-400 hover:text-red-500 transition-colors duration-200"
                  title="Clear date"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {formData.marriageDate && (
            <div className="mt-1 text-xs text-gray-500 flex items-center gap-1">
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Selected:{" "}
              {new Date(formData.marriageDate).toLocaleDateString("en-US", {
                weekday: "long",

                year: "numeric",

                month: "long",

                day: "numeric",
              })}
            </div>
          )}
        </div>
      )}

      {/* Children Count */}

      {formData.maritalStatus === "Married" && (
        <div>
          <label
            htmlFor="childrenCount"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Children Count
          </label>

          <input
            id="childrenCount"
            type="number"
            name="childrenCount"
            value={formData.childrenCount || ""}
            onChange={(e) => {
              const newCount = Number.parseInt(e.target.value || "0", 10);

              setFormData((prev) => {
                const updated = { ...prev, childrenCount: newCount };

                for (let i = 0; i < newCount; i++) {
                  if (prev[`childName${i}`]) {
                    updated[`childName${i}`] = prev[`childName${i}`];
                  } else {
                    updated[`childName${i}`] = ""; // initialize if not present
                  }
                }

                for (let i = newCount; i < 20; i++) {
                  if (Object.hasOwn(updated, `childName${i}`)) {
                    delete updated[`childName${i}`];
                  }
                }

                return updated;
              });
            }}
            placeholder="Enter number of children"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>
      )}

      {/* Children Name Inputs */}

      {formData.maritalStatus === "Married" &&
        Number.parseInt(String(formData.childrenCount), 10) > 0 && (
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({
              length: Number.parseInt(String(formData.childrenCount), 10),
            }).map((_, index) => {
              const fieldName = `childName${index}`;
              return (
                <input
                  key={fieldName}
                  type="text"
                  placeholder={`Child ${index + 1} Name`}
                  value={formData[fieldName] || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      [fieldName]: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              );
            })}
          </div>
        )}
    </div>
  </div>
);

BasicSection.propTypes = {
  formData: PropTypes.object.isRequired,

  errors: PropTypes.object.isRequired,

  fieldRefs: PropTypes.object.isRequired,

  handleChange: PropTypes.func.isRequired,

  setFormData: PropTypes.func.isRequired,

  setErrors: PropTypes.func.isRequired,

  setApiError: PropTypes.func.isRequired,

  calculateAge: PropTypes.func.isRequired,
};

const ContactSection = ({
  formData,
  errors,
  fieldRefs,
  handleChange,
  setFormData,
  setErrors,
}) => (
  <div className="max-w-2xl mx-auto">
    <div className="mb-8 text-center">
      <h1 className="text-xl font-semibold text-gray-800 mb-2">
        Fill in fields to update Personal Preferences & Contact
      </h1>

      <p className="text-sm text-gray-600">
        This helps us maintain correct personal information!
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Contact number */}

      <div className="">
        <label
          htmlFor="contactNumber"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Contact number <span className="text-red-500">*</span>
        </label>

        <div className="max-w-sm">
          <PhoneInput
            country={"in"}
            value={formData.contactNumber}
            onChange={(phone, data) => {
              setFormData((prev) => ({
                ...prev,
                contactNumber: phone,
                contactCountryCode: data?.dialCode ? `+${data.dialCode}` : prev.contactCountryCode,
              }));

              setErrors((prev) => {
                const newErrors = { ...prev };

                delete newErrors.contactNumber;

                return newErrors;
              });
            }}
            inputProps={{
              id: "contactNumber",
              name: "contactNumber",

              required: true,

              placeholder: "8122345789",

              ref: fieldRefs.contactNumber,
            }}
            specialLabel=""
            disableSearchIcon={true}
            containerStyle={{
              width: "100%",
            }}
            inputStyle={{
              width: "100%",

              height: "44px",

              fontSize: "14px",

              paddingLeft: "60px",

              borderTop: `1px solid ${errors.contactNumber ? "#ef4444" : "#d1d5db"}`,

              borderBottom: `1px solid ${errors.contactNumber ? "#ef4444" : "#d1d5db"}`,

              borderRight: `1px solid ${errors.contactNumber ? "#ef4444" : "#d1d5db"}`,

              borderLeft: "none",

              borderRadius: "0 6px 6px 0",

              outline: "none",

              boxShadow: errors.contactNumber
                ? "0 0 0 2px rgba(239, 68, 68, 0.2)"
                : "none",
            }}
            buttonStyle={{
              borderTop: `1px solid ${errors.contactNumber ? "#ef4444" : "#d1d5db"}`,

              borderBottom: `1px solid ${errors.contactNumber ? "#ef4444" : "#d1d5db"}`,

              borderLeft: `1px solid ${errors.contactNumber ? "#ef4444" : "#d1d5db"}`,

              borderRight: "none",

              borderRadius: "6px 0 0 6px",

              backgroundColor: "white",

              width: "48px",

              height: "44px",
            }}
            dropdownStyle={{
              borderRadius: "6px",

              border: "1px solid #d1d5db",

              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",

              zIndex: 50,
            }}
          />

          {errors.contactNumber && (
            <p className="text-red-500 text-xs mt-1">
              {errors.contactNumber}
            </p>
          )}
        </div>
      </div>

      {/* Your hobbies */}

      <div>
        <label
          htmlFor="hobbies"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Your hobbies
        </label>

        <input
          id="hobbies"
          type="text"
          name="hobbies"
          value={formData.hobbies}
          onChange={handleChange}
          placeholder="Playing football"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </div>

      {/* Likes */}

      <div>
        <label
          htmlFor="likes"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Likes
        </label>

        <input
          id="likes"
          type="text"
          name="likes"
          value={formData.likes}
          onChange={handleChange}
          placeholder="Watching movies in theatre"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </div>

      {/* Dislikes */}

      <div>
        <label
          htmlFor="dislikes"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Dislikes
        </label>

        <input
          id="dislikes"
          type="text"
          name="dislikes"
          value={formData.dislikes}
          onChange={handleChange}
          placeholder="Loud music"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </div>

      {/* Favourite food */}

      <div>
        <label
          htmlFor="favoriteFoods"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Favourite food
        </label>

        <input
          id="favoriteFoods"
          type="text"
          name="favoriteFoods"
          value={formData.favoriteFoods}
          onChange={handleChange}
          placeholder="Biryani"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </div>

      {/* Enter address */}

      <div className="md:col-span-2">
        <label
          htmlFor="address"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Enter address <span className="text-red-500">*</span>
        </label>

        <input
          id="address"
          ref={fieldRefs.address}
          type="text"
          name="address"
          value={formData.address}
          onChange={handleChange}
          placeholder="204, North Anna Salai, Chennai"
          className={`w-full px-4 py-2.5 border rounded-md text-sm placeholder:text-sm focus:outline-none focus:ring-2 ${errors.address
              ? "border-red-500 focus:ring-red-300"
              : "border-gray-300 focus:ring-[var(--color-primary)]"
            }`}
        />

        {errors.address && (
          <p className="text-red-500 text-xs mt-1">{errors.address}</p>
        )}
      </div>
    </div>
  </div>
);

ContactSection.propTypes = {
  formData: PropTypes.object.isRequired,

  errors: PropTypes.object.isRequired,

  fieldRefs: PropTypes.object.isRequired,

  handleChange: PropTypes.func.isRequired,

  setFormData: PropTypes.func.isRequired,

  setErrors: PropTypes.func.isRequired,
};

const BioSection = ({ formData, handleChange }) => (
  <div className="max-w-2xl mx-auto">
    <div className="mb-8 text-center">
      <h1 className="text-xl font-semibold text-gray-800 mb-2">
        Fill in fields to update Bio
      </h1>

      <p className="text-sm text-gray-600">
        This helps us maintain correct personal information!
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
      {/* Bio */}

      <div className="md:col-span-2">
        <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
          Bio
        </label>

        <textarea
          id="bio"
          name="bio"
          value={formData.bio || ""}
          onChange={handleChange}
          placeholder="Share a short story from your life — a moment, a lesson, or a memory you'd like future generations to remember."
          rows="6"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
        />
      </div>

      {/* Bio Writing Tips */}

      <div className="md:col-span-2 mt-6">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
          <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
            <svg
              className="w-4 h-4 mr-2 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Bio Tips
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-start space-x-2">
                <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center mt-0.5">
                  <span className="text-gray-700 text-xs font-bold">1</span>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-800">
                    Highlight key moments
                  </p>

                  <p className="text-xs text-gray-600">
                    Special achievements and celebrations
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center mt-0.5">
                  <span className="text-gray-700 text-xs font-bold">2</span>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-800">
                    Express your values
                  </p>

                  <p className="text-xs text-gray-600">
                    Your beliefs and what drives you
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start space-x-2">
                <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center mt-0.5">
                  <span className="text-gray-700 text-xs font-bold">3</span>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-800">
                    Share aspirations
                  </p>

                  <p className="text-xs text-gray-600">
                    Dreams and future goals
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center mt-0.5">
                  <span className="text-gray-700 text-xs font-bold">4</span>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-800">
                    Be authentic
                  </p>

                  <p className="text-xs text-gray-600">
                    Write in your own voice
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-700 italic text-center">
              Your story will inspire generations and create unforgettable family memories
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

BioSection.propTypes = {
  formData: PropTypes.object.isRequired,

  handleChange: PropTypes.func.isRequired,
};

const SectionContent = ({
  activeSection,
  formData,
  errors,
  fieldRefs,
  handleChange,
  setFormData,
  setErrors,
  setApiError,
  dropdownData,
  calculateAge,
}) => {
  const sectionMap = {
    family: (
      <FamilySection
        formData={formData}
        errors={errors}
        fieldRefs={fieldRefs}
        handleChange={handleChange}
        dropdownData={dropdownData}
      />
    ),
    basic: (
      <BasicSection
        formData={formData}
        errors={errors}
        fieldRefs={fieldRefs}
        handleChange={handleChange}
        setFormData={setFormData}
        setErrors={setErrors}
        calculateAge={calculateAge}
        setApiError={setApiError}
      />
    ),
    contact: (
      <ContactSection
        formData={formData}
        errors={errors}
        fieldRefs={fieldRefs}
        handleChange={handleChange}
        setFormData={setFormData}
        setErrors={setErrors}
      />
    ),
    bio: <BioSection formData={formData} handleChange={handleChange} />,
  };

  return sectionMap[activeSection] || null;
};

SectionContent.propTypes = {
  activeSection: PropTypes.string.isRequired,

  formData: PropTypes.object.isRequired,

  errors: PropTypes.object.isRequired,

  fieldRefs: PropTypes.object.isRequired,

  handleChange: PropTypes.func.isRequired,

  setFormData: PropTypes.func.isRequired,

  setErrors: PropTypes.func.isRequired,

  setApiError: PropTypes.func.isRequired,

  dropdownData: PropTypes.shape({
    languages: PropTypes.arrayOf(PropTypes.object).isRequired,
    religions: PropTypes.arrayOf(PropTypes.object).isRequired,
    gothrams: PropTypes.arrayOf(PropTypes.object).isRequired,
    loading: PropTypes.bool.isRequired,
    error: PropTypes.string,
  }).isRequired,

  calculateAge: PropTypes.func.isRequired,
};

const OnBoarding = () => {
  const location = useLocation();

  const params = new URLSearchParams(location.search);

  const urlFamilyCode = params.get("familyCode");

  const [userId, setUserId] = useState(null);

  const [token, setToken] = useState(null);

  const [isSaving, setIsSaving] = useState(false);

  const sections = SECTIONS;

  const [activeSection, setActiveSection] = useState("basic");

  const currentIndex = sections.findIndex((sec) => sec.id === activeSection);

  const isFirst = currentIndex === 0;

  const isLast = currentIndex === sections.length - 1;

  // Refs for form fields

  const fieldRefs = {
    firstName: useRef(null),

    lastName: useRef(null),

    dob: useRef(null),

    gender: useRef(null),

    fatherName: useRef(null),

    motherName: useRef(null),

    motherTongue: useRef(null),

    caste: useRef(null),

    religionId: useRef(null),

    gothram: useRef(null),

    kuladevata: useRef(null),

    contactNumber: useRef(null),

    address: useRef(null),
  };

  const [errors, setErrors] = useState({});

  const [userLoading, setUserLoading] = useState(true);

  const [apiError, setApiError] = useState("");

  const [apiSuccess, setApiSuccess] = useState("");

  const [formData, setFormData] = useState({
    firstName: "",

    lastName: "",

    dob: "",

    age: 0,

    gender: "",

    maritalStatus: "",

    spouseName: "",

    marriageDate: "",

    childrenCount: 0,

    profile: null,

    fatherName: "",

    motherName: "",

    motherTongue: 0,

    motherTongueOther: "",

    religionId: 0,

    religionOther: "",

    caste: "",

    gothram: 0,

    gothramOther: "",

    kuladevata: "",

    hobbies: "",

    likes: "",

    dislikes: "",

    favoriteFoods: "",

    address: "",

    contactNumber: "",
    contactCountryCode: "+91",

    bio: "",

    familyCode: urlFamilyCode || "",
  });

  const [dropdownData, setDropdownData] = useState({
    languages: [],

    religions: [],

    gothrams: [],

    loading: true,

    error: null,
  });

  // Initialize token and user ID

  useEffect(() => {
    const storedToken = getToken();

    if (!storedToken) {
      setApiError("Authentication token not found. Please login again.");

      return;
    }

    try {
      const decoded = jwtDecode(storedToken);

      setToken(storedToken);

      setUserId(decoded?.userId || decoded?.id || decoded?.sub);
    } catch (error) {
      console.error("Invalid token. Please login again.", error);

      setApiError("Invalid token. Please login again.");
    }
  }, []);

  const handleChange = (e) => {
    const { name, value, type } = e.target;

    let processedValue = value;

    if (["motherTongue", "religionId", "gothram"].includes(name)) {
      if (value === "other") {
        processedValue = "other";
      } else if (value === "") {
        processedValue = 0;
      } else if (isNumericValue(value)) {
        processedValue = Number.parseInt(value, 10);
      } else {
        processedValue = value;
      }
    } else if (type === "number" || name === "childrenCount") {
      processedValue = value === "" ? 0 : Number.parseInt(value, 10);
    }

    setFormData((prev) => ({
      ...prev,

      [name]: processedValue,

      ...(name === "motherTongue" &&
        processedValue !== "other" && { motherTongueOther: "" }),

      ...(name === "religionId" &&
        processedValue !== "other" && { religionOther: "" }),

      ...(name === "gothram" &&
        processedValue !== "other" && { gothramOther: "" }),

      ...(name === "dob" && { age: calculateAge(value) }), // Update age when DOB changes
    }));

    // Clear error for this field

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };

        delete newErrors[name];

        return newErrors;
      });
    }

    const otherFieldMap = {
      motherTongue: "motherTongueOther",
      religionId: "religionOther",
      gothram: "gothramOther",
    };
    if (otherFieldMap[name] && processedValue !== "other") {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[otherFieldMap[name]];
        return newErrors;
      });
    }
  };

  const validateCurrentSection = () => {
    const newErrors = getSectionErrors(activeSection, formData);
    setErrors(newErrors);
    focusFirstErrorField(newErrors, fieldRefs);
    return Object.keys(newErrors).length === 0;
  };

  const goToPrevious = () => {
    if (!isFirst) {
      const prevSection = sections[currentIndex - 1];

      setActiveSection(prevSection.id);

      setErrors({});
    }
  };

  const goToNext = () => {
    if (validateCurrentSection() && !isLast) {
      const nextSection = sections[currentIndex + 1];

      setActiveSection(nextSection.id);
    }
  };

  const applyValidationErrors = (allErrors) => {
    setErrors(allErrors);
    const targetSection = getSectionForErrors(allErrors);
    if (targetSection && targetSection !== activeSection) {
      setActiveSection(targetSection);
    } else {
      focusFirstErrorField(allErrors, fieldRefs);
    }
    setApiError("");
  };

  useEffect(() => {
    const errorKeys = Object.keys(errors);
    if (errorKeys.length === 0) return;
    const targetSection = getSectionForErrors(errors);
    if (targetSection && targetSection !== activeSection) return;
    const timer = setTimeout(() => {
      focusFirstErrorField(errors, fieldRefs);
    }, 50);
    return () => clearTimeout(timer);
  }, [errors, activeSection, fieldRefs]);

  const validateProfileFileSelection = () => {
    if (!(formData.profile instanceof File)) return true;
    const validation = validateProfileFile(formData.profile);
    if (validation.isValid) return true;
    setErrors((prev) => ({
      ...prev,
      profile: validation.message,
    }));
    setApiError("");
    setActiveSection("basic");
    return false;
  };

  const validateBeforeSave = () => {
    const allErrors = getAllSectionErrors(formData);
    if (Object.keys(allErrors).length > 0) {
      applyValidationErrors(allErrors);
      return false;
    }

    return validateProfileFileSelection();
  };

  const applyApiErrorToField = (error) => {
    const fieldError = getFieldErrorFromApiMessage(error?.message);
    if (fieldError) {
      setErrors((prev) => ({
        ...prev,
        [fieldError.field]: error.message,
      }));
      setActiveSection(fieldError.section);
      setApiError("");
      return true;
    }
    return false;
  };

  const handleSave = async () => {
    // Check all mandatory fields before saving
    if (!validateBeforeSave()) return;

    setIsSaving(true);

    setApiError("");

    setApiSuccess("");

    try {
      if (!userId || !token) {
        setApiError("Authentication required. Please login again.");

        return;
      }

      const formDataToSend = buildProfileUpdateFormData(formData);

      const response = await authFetchResponse(
        `/user/profile/update/${userId}`,
        {
          method: "PUT",
          skipThrow: true,
          body: formDataToSend,
        }
      );

      if (!response.ok) {
        let errorMessage =
          response.status === 413
            ? "File too large. Max size is 5MB."
            : "Failed to update profile";

        try {
          const errorData = await response.json();
          if (errorData?.message) {
            errorMessage = errorData.message;
          }
        } catch (error) {
          console.warn("Failed to parse error response:", error);
        }

        throw new Error(errorMessage);
      }

      setApiSuccess("Profile updated successfully!");

      // Show welcome message with SweetAlert

      Swal.fire({
        title: "Profile locked in",
        html: `
          <div class="ft-swal-body">
            <p class="ft-swal-lead">Your profile is now part of the family story.</p>
            <p class="ft-swal-sub">Everything is saved and ready to explore.</p>
            <div class="ft-swal-chip">Member status: Active</div>
          </div>
        `,
        icon: "success",
        iconColor: "var(--color-primary)",
        confirmButtonText: "Go to My Profile",
        backdrop: "rgba(25, 118, 210, 0.08)",
        buttonsStyling: false,
        customClass: {
          popup: "ft-swal-popup",
          title: "ft-swal-title",
          htmlContainer: "ft-swal-text",
          confirmButton: "ft-swal-confirm",
          icon: "ft-swal-icon",
        },
        allowOutsideClick: false,
        allowEscapeKey: false,
      }).then((result) => {
        if (result.isConfirmed) {
          globalThis.location.href = "/myprofile";
        }
      });
    } catch (error) {
      if (!applyApiErrorToField(error)) {
        setApiError(error?.message || "Network error. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }

  };

  // Fetch dropdown data

  useEffect(() => {
    fetchDropdownDataForOnboarding(setDropdownData);
  }, []);

  // Fetch user details

  useEffect(() => {
    if (!userId || !token) return;
    fetchAndApplyUserDetails({ userId, token, setUserLoading, setFormData });
  }, [userId, token]);

  const allMandatoryFilled = areAllMandatoryFieldsFilled(formData);

  return (
    <div
      className="flex items-center justify-center bg-gray-100 p-6 overflow-y-auto"
      style={{ minHeight: '100dvh', paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex flex-col lg:flex-row w-full max-w-6xl bg-white rounded-lg shadow-lg overflow-hidden">
        {userLoading && (
          <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center">
            <div className="text-white text-lg font-semibold">Loading...</div>

            {/* You can replace this with a spinner animation if you have one */}
          </div>
        )}

        {/* Left - Tracking (40%) */}

        <OnBoardingSidebar
          sections={sections}
          activeSection={activeSection}
          onSelectSection={setActiveSection}
        />

        {/* Right - Form Section (60%) */}

        <div className="w-full lg:w-[65%] p-6 sm:p-8 md:p-10">
          <ApiAlerts apiError={apiError} apiSuccess={apiSuccess} />
          <SectionContent
            activeSection={activeSection}
            formData={formData}
            errors={errors}
            fieldRefs={fieldRefs}
            handleChange={handleChange}
            setFormData={setFormData}
            setErrors={setErrors}
            setApiError={setApiError}
            dropdownData={dropdownData}
            calculateAge={calculateAge}
          />
          <OnBoardingFooter
            isFirst={isFirst}
            isLast={isLast}
            allMandatoryFilled={allMandatoryFilled}
            isSaving={isSaving}
            goToPrevious={goToPrevious}
            goToNext={goToNext}
            handleSave={handleSave}
          />
        </div>
      </div>
    </div>
  );
};

export default OnBoarding;
