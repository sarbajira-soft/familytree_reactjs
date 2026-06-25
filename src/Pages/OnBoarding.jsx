import React, { useState, useEffect, useRef } from "react";
import {
  FaUser,
  FaUsers,
  FaMapMarkerAlt,
  FaCloudUploadAlt,
  FaCamera,
  FaCheck,
} from "react-icons/fa";
import { jwtDecode } from "jwt-decode";
import { useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import PropTypes from "prop-types";
import { authFetchResponse } from "../utils/authFetch";
import { getToken } from "../utils/auth";
import { isValidPincode, sanitizePincodeInput } from "../utils/inputSanitizers";
import { useUser } from "../Contexts/UserContext";

/* ─── Constants ──────────────────────────────────────── */

const MAX_PROFILE_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_PROFILE_TYPES = new Set(["image/jpeg", "image/png", "image/jpg", "image/gif"]);

/* ─── Helpers ────────────────────────────────────────── */

const isBlank = (v) => String(v || "").trim() === "";

const validateProfileFile = (file) => {
  if (!file) return { isValid: true };
  if (file.size > MAX_PROFILE_FILE_SIZE) return { isValid: false, message: "File too large. Max size is 5MB." };
  if (!ALLOWED_PROFILE_TYPES.has(file.type)) return { isValid: false, message: "Unsupported file type. Please upload JPG, PNG, or GIF." };
  return { isValid: true };
};

const validateDob = (dobValue) => {
  const dob = String(dobValue || "").trim();
  if (dob === "") return "Date of birth is required";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return "Please enter a valid date of birth";
  birthDate.setHours(0, 0, 0, 0);
  if (birthDate > today) return "Date of birth cannot be in the future";
  if (Math.floor((today - birthDate) / (365.25 * 24 * 60 * 60 * 1000)) > 150) return "Please enter a valid date of birth";
  return null;
};

const focusFirstErrorField = (errors, fieldRefs) => {
  const key = Object.keys(errors)[0];
  if (!key) return;
  const ref = fieldRefs[key]?.current;
  if (ref) { ref.scrollIntoView({ behavior: "smooth", block: "center" }); ref.focus(); return; }
  const el = document.querySelector(`[name="${key}"], [id="${key}"]`);
  if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.focus(); }
};

/* ─── API helpers ────────────────────────────────────── */

const fetchAndApplyUserDetails = async ({ userId, token, setUserLoading, setFormData }) => {
  try {
    setUserLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await authFetchResponse(`/user/profile/${userId}`, {
      method: "GET", skipThrow: true,
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error("Failed to fetch user details");

    const jsonData = await response.json();
    const { userProfile } = jsonData.data;

    let addressLine1 = userProfile.addressLine1 || "";
    let addressLine2 = userProfile.addressLine2 || "";
    let district = userProfile.district || "";
    let state = userProfile.state || "";
    let pincode = userProfile.pincode || "";

    const addressString = userProfile.address || "";
    const addressParts = addressString
      ? addressString.split(',').map((p) => p.trim()).filter(Boolean)
      : [];

    if (!addressLine1 && !district && !state && !pincode && addressParts.length > 0) {
      const parts = [...addressParts];
      if (parts.length > 0 && /^\d{5,6}$/.test(parts[parts.length - 1])) {
        pincode = parts.pop();
      }
      if (parts.length > 0) state = parts.pop();
      if (parts.length > 0) district = parts.pop();
      if (parts.length > 0) addressLine1 = parts[0];
      if (parts.length > 1) addressLine2 = parts.slice(1).join(', ');
    }

    setFormData((prev) => ({
      ...prev,
      dob: userProfile.dob ? userProfile.dob.split("T")[0] : "",
      gender: userProfile.gender || "",
      fatherName: userProfile.fatherName || "",
      motherName: userProfile.motherName || "",
      addressLine1,
      addressLine2,
      district,
      state,
      pincode,
      profile: userProfile.profile || "",
      familyCode: prev.familyCode || userProfile.familyCode || "",
    }));
  } catch (err) {
    console.error("Error fetching user details:", err);
  } finally {
    setUserLoading(false);
  }
};

const buildProfileUpdateFormData = (data) => {
  const payload = new FormData();
  if (data.dob) payload.append("dob", data.dob);
  if (data.gender) payload.append("gender", data.gender);
  if (data.fatherName) payload.append("fatherName", data.fatherName);
  if (data.motherName) payload.append("motherName", data.motherName);

  const addr = [data.addressLine1, data.addressLine2, data.district, data.state, data.pincode]
    .map((p) => String(p || "").trim()).filter(Boolean);
  if (addr.length > 0) payload.set("address", addr.join(", "));

  if (data.profile instanceof File) payload.append("profile", data.profile);
  if (data.familyCode) payload.append("familyCode", data.familyCode);
  return payload;
};

/* ─── Sub-components ─────────────────────────────────── */

const ApiAlerts = ({ apiError, apiSuccess }) => (
  <>
    {apiError && (
      <div className="mb-4 p-3 text-xs text-red-700 bg-red-50 dark:bg-red-950/30 dark:text-red-300 rounded-xl border border-red-200 dark:border-red-900/50" role="alert">
        {apiError}
      </div>
    )}
    {apiSuccess && (
      <output className="mb-4 p-3 text-xs text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-300 rounded-xl border border-green-200 dark:border-green-900/50 block">
        {apiSuccess}
      </output>
    )}
  </>
);

ApiAlerts.propTypes = {
  apiError: PropTypes.string,
  apiSuccess: PropTypes.string,
};

/* ─── Input Component ────────────────────────────────── */

const FormField = React.forwardRef(({
  id, label, error, required, children, className = "",
}, ref) => (
  <div className={className}>
    <label htmlFor={id} className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    {children}
    {error && (
      <p className="text-red-500 text-[10px] mt-0.5 flex items-center gap-1">
        <svg className="w-2.5 h-2.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        {error}
      </p>
    )}
  </div>
));

FormField.displayName = "FormField";
FormField.propTypes = {
  id: PropTypes.string,
  label: PropTypes.string,
  error: PropTypes.string,
  required: PropTypes.bool,
  children: PropTypes.node,
  className: PropTypes.string,
};

const inputClsCompact = (hasError) =>
  `w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-800/40 border rounded-xl text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all duration-200 outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-[#1976d2] focus:ring-[3px] focus:ring-[#1976d2]/15 ${
    hasError ? "border-red-400 focus:ring-red-500/10 focus:border-red-400" : "border-slate-200 dark:border-slate-700/80"
  }`;

const inputCls = (hasError) =>
  `w-full px-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-800/40 border rounded-xl text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all duration-200 outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-[#1976d2] focus:ring-[3px] focus:ring-[#1976d2]/15 ${
    hasError ? "border-red-400 focus:ring-red-500/10 focus:border-red-400" : "border-slate-200 dark:border-slate-700/80"
  }`;

/* ═══════════════════════════════════════════════════════
   OnBoarding Component
   ═══════════════════════════════════════════════════════ */

const OnBoarding = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { refetchUser } = useUser();
  const urlFamilyCode = new URLSearchParams(location.search).get("familyCode");

  const [userId, setUserId] = useState(null);
  const [token, setToken] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [userLoading, setUserLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [apiSuccess, setApiSuccess] = useState("");

  const fieldRefs = {
    dob: useRef(null),
    gender: useRef(null),
    fatherName: useRef(null),
    motherName: useRef(null),
    addressLine1: useRef(null),
    addressLine2: useRef(null),
    district: useRef(null),
    state: useRef(null),
    pincode: useRef(null),
  };

  const [formData, setFormData] = useState({
    dob: "",
    gender: "",
    fatherName: "",
    motherName: "",
    addressLine1: "",
    addressLine2: "",
    district: "",
    state: "",
    pincode: "",
    profile: null,
    familyCode: urlFamilyCode || "",
  });

  /* Init auth */
  useEffect(() => {
    const storedToken = getToken();
    if (!storedToken) { setApiError("Authentication token not found. Please login again."); return; }
    try {
      const decoded = jwtDecode(storedToken);
      setToken(storedToken);
      setUserId(decoded?.userId || decoded?.id || decoded?.sub);
    } catch (err) {
      console.error("Invalid token.", err);
      setApiError("Invalid token. Please login again.");
    }
  }, []);

  /* Fetch profile */
  useEffect(() => {
    if (!userId || !token) return;
    fetchAndApplyUserDetails({ userId, token, setUserLoading, setFormData });
  }, [userId, token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const processed = name === "pincode" ? sanitizePincodeInput(value) : value;
    setFormData((prev) => ({ ...prev, [name]: processed }));
    if (errors[name]) setErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
  };

  const validateForm = (d) => {
    const e = {};
    const dobErr = validateDob(d.dob); if (dobErr) e.dob = dobErr;
    if (isBlank(d.gender)) e.gender = "Gender is required";

    const nameRegex = /^[A-Za-z][A-Za-z .'-]*$/;
    if (isBlank(d.fatherName)) {
      e.fatherName = "Father's name is required";
    } else if (!nameRegex.test(d.fatherName)) {
      e.fatherName = "Father's name can contain only letters, spaces";
    }

    if (isBlank(d.motherName)) {
      e.motherName = "Mother's name is required";
    } else if (!nameRegex.test(d.motherName)) {
      e.motherName = "Mother's name can contain only letters, spaces";
    }

    if (isBlank(d.addressLine1)) e.addressLine1 = "Address is required";
    if (isBlank(d.district)) e.district = "District is required";
    if (isBlank(d.state)) e.state = "State is required";
    if (isBlank(d.pincode)) e.pincode = "Pincode is required";
    else if (!isValidPincode(d.pincode)) e.pincode = "Must be exactly 6 digits";
    return e;
  };

  const handleSave = async (ev) => {
    if (ev) ev.preventDefault();
    const formErrors = validateForm(formData);
    if (Object.keys(formErrors).length > 0) { setErrors(formErrors); focusFirstErrorField(formErrors, fieldRefs); return; }

    if (formData.profile instanceof File) {
      const v = validateProfileFile(formData.profile);
      if (!v.isValid) { setErrors((p) => ({ ...p, profile: v.message })); return; }
    }

    setIsSaving(true); setApiError(""); setApiSuccess("");
    try {
      if (!userId || !token) { setApiError("Authentication required. Please login again."); return; }
      const payload = buildProfileUpdateFormData(formData);
      const response = await authFetchResponse(`/user/profile/update/${userId}`, { method: "PUT", skipThrow: true, body: payload });

      if (!response.ok) {
        let msg = response.status === 413 ? "File too large. Max 5MB." : "Failed to update profile";
        try { const d = await response.json(); if (d?.message) msg = d.message; } catch { /* ignore */ }
        throw new Error(msg);
      }

      const completeResponse = await authFetchResponse('/users/complete-onboarding', {
        method: "POST",
        skipThrow: true,
      });

      if (!completeResponse.ok) {
        let msg = "Failed to complete onboarding";
        try { const d = await completeResponse.json(); if (d?.message) msg = d.message; } catch { /* ignore */ }
        throw new Error(msg);
      }

      await refetchUser();

      setApiSuccess("Profile updated and onboarding completed successfully!");
      Swal.fire({
        title: "Profile locked in",
        html: `<div class="ft-swal-body"><p class="ft-swal-lead">Your profile is now part of the family story.</p><p class="ft-swal-sub">Everything is saved and ready to explore.</p><div class="ft-swal-chip">Member status: Active</div></div>`,
        icon: "success", iconColor: "var(--color-primary)", confirmButtonText: "Go to Dashboard",
        backdrop: "rgba(25,118,210,0.08)", buttonsStyling: false,
        customClass: { popup: "ft-swal-popup", title: "ft-swal-title", htmlContainer: "ft-swal-text", confirmButton: "ft-swal-confirm", icon: "ft-swal-icon" },
        allowOutsideClick: false, allowEscapeKey: false,
      }).then(() => { navigate("/dashboard"); });
    } catch (err) {
      const lower = String(err?.message || "").toLowerCase();
      if (lower.includes("file") || lower.includes("image")) {
        setErrors((p) => ({ ...p, profile: err.message }));
      } else {
        setApiError(err?.message || "Network error. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const allFilled = !isBlank(formData.dob) && !isBlank(formData.gender) && !isBlank(formData.fatherName) &&
    !isBlank(formData.motherName) && !isBlank(formData.addressLine1) && !isBlank(formData.district) &&
    !isBlank(formData.state) && !isBlank(formData.pincode);

  const filledCount = [formData.dob, formData.gender, formData.fatherName, formData.motherName,
    formData.addressLine1, formData.district, formData.state, formData.pincode]
    .filter((v) => !isBlank(v)).length;
  const progressPercent = Math.round((filledCount / 8) * 100);

  /* ─── Render ───────────────────────────────────────── */
  return (
    <form onSubmit={handleSave} className="min-h-screen bg-[#fcfcfc] dark:bg-slate-950 flex flex-col lg:flex-row transition-colors duration-300" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>

      {/* ═══ Loading overlay ═══ */}
      {userLoading && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-50 flex items-center justify-center">
          <div className="text-center p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center">
            <div className="w-12 h-12 border-[3px] border-[#1976d2] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-slate-700 dark:text-slate-300 font-semibold text-sm">Loading details...</p>
          </div>
        </div>
      )}

      {/* ═══ Left Column - Sticky Profile Panel (width ~32% on lg) ═══ */}
      <div className="w-full lg:w-[32%] xl:w-[28%] lg:h-screen lg:sticky lg:top-0 bg-white dark:bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-200/60 dark:border-slate-800/80 p-6 flex flex-col justify-start gap-6 shrink-0">
        
        {/* Top: Left-aligned Logo with border line */}
        <div className="w-full">
          <div className="flex items-center justify-center lg:justify-start gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="w-12 h-12 shrink-0">
              <img
                src="/assets/family-logo.png"
                alt="Familyss Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <img
              src="/assets/familyss.png"
              alt="Familyss"
              className="w-auto"
              style={{ height: "68px" }}
            />
          </div>
        </div>

        {/* Center: Profile Photo Uploader */}
        <div className="flex flex-col items-center justify-center py-2 w-full">
          <div className="flex flex-col items-center w-full">
            <div className="relative mb-2">
              <div className={`w-32 h-32 rounded-full overflow-hidden shadow-sm border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center relative bg-slate-50 dark:bg-slate-800 ${!formData.profile ? "ring-2 ring-offset-2 ring-[#1976d2]/20" : ""}`}>
                {formData.profile ? (
                  <img
                    src={formData.profile instanceof File ? URL.createObjectURL(formData.profile) : formData.profile}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg className="w-14 h-14 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
              </div>

              {/* Floating camera button */}
              <label htmlFor="profileUpload" className="absolute bottom-1 right-1 w-8 h-8 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-full shadow-md flex items-center justify-center cursor-pointer transition-all duration-200">
                <FaCamera className="text-xs" />
              </label>

              <input
                id="profileUpload" type="file" accept="image/jpeg,image/png,image/jpg,image/gif"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const v = validateProfileFile(file);
                  if (!v.isValid) { setErrors((p) => ({ ...p, profile: v.message })); return; }
                  setErrors((p) => { const n = { ...p }; delete n.profile; return n; });
                  setFormData((p) => ({ ...p, profile: file }));
                }}
                className="hidden"
              />
            </div>

            {formData.profile && (
              <button type="button" onClick={() => setFormData((p) => ({ ...p, profile: null }))}
                className="text-xs text-red-500 hover:text-red-600 font-semibold transition-colors">
                Remove photo
              </button>
            )}
            {errors.profile && <p className="text-red-500 text-[10px] mt-2 text-center leading-tight">{errors.profile}</p>}
          </div>
        </div>

        {/* Personal Details in sticky panel */}
        <div className="w-full border-t border-slate-100 dark:border-slate-800/80 pt-4 space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-200 dark:border-slate-800/80">
            <FaUser className="text-[#1976d2] text-xs" />
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Personal Details</h3>
          </div>
          <div className="space-y-3">
            <FormField id="dob" label="Date of Birth" required error={errors.dob}>
              <input id="dob" ref={fieldRefs.dob} type="date" name="dob" value={formData.dob || ""} onChange={handleChange}
                min="1900-01-01" max="2100-12-31" className={inputClsCompact(errors.dob)} />
            </FormField>

            <FormField id="gender" label="Gender" required error={errors.gender}>
              <select id="gender" ref={fieldRefs.gender} name="gender" value={formData.gender || ""} onChange={handleChange}
                className={inputClsCompact(errors.gender)}>
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </FormField>
          </div>
        </div>

        {/* Profile Completion Progress Bar directly under Personal Details */}
        <div className="w-full border-t border-slate-100 dark:border-slate-800/80 pt-4 hidden lg:block">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
            <span>Profile Completion</span>
            <span className="text-slate-700 dark:text-slate-300">{progressPercent}%</span>
          </div>
          <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-700/50">
            <div
              className="h-full bg-[#1976d2] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

      </div>

      {/* ═══ Right Column - Scrollable Form Content (width ~68% on lg) ═══ */}
      <div className="w-full lg:w-[68%] xl:w-[72%] flex-1 flex flex-col min-h-screen">
        
        {/* Scrollable form body */}
        <div className="flex-1 px-4 sm:px-8 py-8 lg:py-10 max-w-5xl w-full mx-auto">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight mb-2">
            Complete Your Profile
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-8">
            Enter your personal and family details to activate your account.
          </p>
          
          <div className="space-y-8">
            <ApiAlerts apiError={apiError} apiSuccess={apiSuccess} />

            {/* ── Section: Parents' Information ── */}
            <div className="space-y-5">
              <div className="flex items-center gap-2 pb-1.5 border-b border-slate-200 dark:border-slate-800/80">
                <FaUsers className="text-[#1976d2] text-xs" />
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Parents' Information</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-4">
                <FormField id="fatherName" label="Father's Name" required error={errors.fatherName}>
                  <input id="fatherName" ref={fieldRefs.fatherName} type="text" name="fatherName" value={formData.fatherName}
                    onChange={handleChange} placeholder="Enter father's name" className={inputCls(errors.fatherName)} />
                </FormField>

                <FormField id="motherName" label="Mother's Name" required error={errors.motherName}>
                  <input id="motherName" ref={fieldRefs.motherName} type="text" name="motherName" value={formData.motherName}
                    onChange={handleChange} placeholder="Enter mother's name" className={inputCls(errors.motherName)} />
                </FormField>
              </div>
            </div>

            {/* ── Section: Address Details ── */}
            <div className="space-y-5">
              <div className="flex items-center gap-2 pb-1.5 border-b border-slate-200 dark:border-slate-800/80">
                <FaMapMarkerAlt className="text-[#1976d2] text-xs" />
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Address Details</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-4">
                <FormField id="addressLine1" label="Address Line 1" required error={errors.addressLine1}>
                  <input id="addressLine1" ref={fieldRefs.addressLine1} type="text" name="addressLine1" value={formData.addressLine1}
                    onChange={handleChange} placeholder="House No, Street, Area" className={inputCls(errors.addressLine1)} />
                </FormField>

                <FormField id="addressLine2" label="Address Line 2 (Optional)">
                  <input id="addressLine2" ref={fieldRefs.addressLine2} type="text" name="addressLine2" value={formData.addressLine2}
                    onChange={handleChange} placeholder="Landmark, Locality" className={inputCls(false)} />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-5 gap-x-4">
                <FormField id="district" label="District" required error={errors.district}>
                  <input id="district" ref={fieldRefs.district} type="text" name="district" value={formData.district}
                    onChange={handleChange} placeholder="District" className={inputCls(errors.district)} />
                </FormField>

                <FormField id="state" label="State" required error={errors.state}>
                  <input id="state" ref={fieldRefs.state} type="text" name="state" value={formData.state}
                    onChange={handleChange} placeholder="State" className={inputCls(errors.state)} />
                </FormField>

                <FormField id="pincode" label="Pincode" required error={errors.pincode}>
                  <input id="pincode" ref={fieldRefs.pincode} type="text" name="pincode" value={formData.pincode}
                    onChange={handleChange} placeholder="6 digits" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                    className={inputCls(errors.pincode)} />
                </FormField>
              </div>
            </div>

            {/* ── Submit Panel ── */}
            <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800/80">
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                All fields marked with <span className="text-red-400">*</span> are mandatory
              </p>

              <button
                type="submit"
                disabled={!allFilled || isSaving}
                className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-xs tracking-wide transition-all duration-300 flex items-center justify-center gap-2 ${
                  !allFilled || isSaving
                    ? "bg-orange-600/10 dark:bg-orange-600/5 text-orange-600/40 dark:text-orange-600/30 cursor-not-allowed"
                    : "bg-orange-600 hover:bg-orange-700 text-white shadow-md shadow-orange-600/15 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
                }`}
              >
                {isSaving ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <FaCheck className="text-[10px]" />
                    Complete Onboarding
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>
    </form>
  );
};

export default OnBoarding;
