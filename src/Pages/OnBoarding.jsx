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

/* ─── Inline Styles (CSS-in-JS for animations not easily done with Tailwind) ─ */

const animationStyles = `
  @keyframes ob-float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-8px); }
  }
  @keyframes ob-gradient {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes ob-fadeUp {
    from { opacity: 0; transform: translateY(24px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes ob-pulse-ring {
    0% { box-shadow: 0 0 0 0 rgba(25, 118, 210, 0.3); }
    70% { box-shadow: 0 0 0 12px rgba(25, 118, 210, 0); }
    100% { box-shadow: 0 0 0 0 rgba(25, 118, 210, 0); }
  }
  .ob-float { animation: ob-float 4s ease-in-out infinite; }
  .ob-gradient-bg {
    background: linear-gradient(135deg, #1976D2, #1565C0, #0D47A1, #1976D2);
    background-size: 300% 300%;
    animation: ob-gradient 6s ease infinite;
  }
  .ob-fade-up { animation: ob-fadeUp 0.5s ease-out forwards; }
  .ob-pulse-ring { animation: ob-pulse-ring 2s ease-out infinite; }
  .ob-stagger-1 { animation-delay: 0.1s; opacity: 0; }
  .ob-stagger-2 { animation-delay: 0.2s; opacity: 0; }
  .ob-stagger-3 { animation-delay: 0.3s; opacity: 0; }
`;

/* ─── Sub-components ─────────────────────────────────── */

const ApiAlerts = ({ apiError, apiSuccess }) => (
  <>
    {apiError && (
      <div className="mb-5 p-4 text-sm text-red-700 bg-red-50 dark:bg-red-950/30 dark:text-red-300 rounded-xl border border-red-200 dark:border-red-900/50" role="alert">
        {apiError}
      </div>
    )}
    {apiSuccess && (
      <output className="mb-5 p-4 text-sm text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-300 rounded-xl border border-green-200 dark:border-green-900/50 block">
        {apiSuccess}
      </output>
    )}
  </>
);

ApiAlerts.propTypes = {
  apiError: PropTypes.string,
  apiSuccess: PropTypes.string,
};

const FeatureCard = ({ icon, title, desc }) => (
  <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 hover:bg-white/15 transition-all duration-300">
    <div className="p-2.5 bg-white/20 rounded-xl shrink-0">
      {icon}
    </div>
    <div>
      <h4 className="text-white font-semibold text-sm">{title}</h4>
      <p className="text-blue-100/70 text-xs mt-0.5 leading-relaxed">{desc}</p>
    </div>
  </div>
);

FeatureCard.propTypes = {
  icon: PropTypes.node.isRequired,
  title: PropTypes.string.isRequired,
  desc: PropTypes.string.isRequired,
};

/* ─── Input Component ────────────────────────────────── */

const FormField = React.forwardRef(({
  id, label, error, required, children, className = "",
}, ref) => (
  <div className={className}>
    <label htmlFor={id} className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    {children
      ? children
      : null
    }
    {error && (
      <p className="text-red-500 text-[11px] mt-1 flex items-center gap-1">
        <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
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

const inputCls = (hasError) =>
  `w-full px-4 py-3 bg-slate-50/80 dark:bg-slate-800/60 border rounded-xl text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all duration-200 outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-primary-500 focus:ring-[3px] focus:ring-primary-500/10 ${
    hasError ? "border-red-400 focus:ring-red-500/10" : "border-slate-200 dark:border-slate-700/80"
  }`;

/* ═══════════════════════════════════════════════════════
   OnBoarding Component
   ═══════════════════════════════════════════════════════ */

const OnBoarding = () => {
  const location = useLocation();
  const navigate = useNavigate();
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
    if (isBlank(d.fatherName)) e.fatherName = "Father's name is required";
    if (isBlank(d.motherName)) e.motherName = "Mother's name is required";
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

      setApiSuccess("Profile updated successfully!");
      Swal.fire({
        title: "Profile locked in",
        html: `<div class="ft-swal-body"><p class="ft-swal-lead">Your profile is now part of the family story.</p><p class="ft-swal-sub">Everything is saved and ready to explore.</p><div class="ft-swal-chip">Member status: Active</div></div>`,
        icon: "success", iconColor: "var(--color-primary)", confirmButtonText: "Go to My Profile",
        backdrop: "rgba(25,118,210,0.08)", buttonsStyling: false,
        customClass: { popup: "ft-swal-popup", title: "ft-swal-title", htmlContainer: "ft-swal-text", confirmButton: "ft-swal-confirm", icon: "ft-swal-icon" },
        allowOutsideClick: false, allowEscapeKey: false,
      }).then((r) => { if (r.isConfirmed) globalThis.location.href = "/myprofile"; });
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
    <>
      <style>{animationStyles}</style>

      <div className="fixed inset-0 flex flex-col lg:flex-row bg-white dark:bg-slate-950" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>

        {/* ═══ Loading overlay ═══ */}
        {userLoading && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-50 flex items-center justify-center">
            <div className="text-center p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center">
              <div className="w-14 h-14 border-[3px] border-primary-400 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-slate-700 dark:text-slate-300 font-semibold">Loading your details...</p>
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">This will only take a moment</p>
            </div>
          </div>
        )}

        {/* ═══ Left Branding Panel (visible on lg+) ═══ */}
        <div className="hidden lg:flex lg:w-[42%] xl:w-[38%] ob-gradient-bg relative overflow-hidden flex-col justify-between p-10 xl:p-14">
          {/* Decorative shapes */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-20 left-0 w-48 h-48 bg-white/5 rounded-full -translate-x-1/2" />
          <div className="absolute top-1/2 right-10 w-24 h-24 bg-white/5 rounded-2xl rotate-45" />

          {/* Top: Logo + headline */}
          <div className="relative z-10">
            {/* <div className="flex items-center gap-3 mb-10">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <img src="/assets/logo-green-light.png" alt="Familyss" className="w-8 h-8 object-contain" />
              </div>
              <span className="text-white/90 text-xl font-bold tracking-wide">Familyss</span>
            </div> */}

            <h2 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight tracking-tight">
              Set up your
              <br />
              <span className="text-blue-200">family profile</span>
            </h2>
            <p className="text-blue-100/70 mt-4 text-sm leading-relaxed max-w-xs">
              A few quick details and you're ready to connect with your family tree.
            </p>
          </div>

          {/* Features */}
          <div className="relative z-10 space-y-3 ob-float">
            <FeatureCard
              icon={<FaUser className="text-white text-sm" />}
              title="Quick Setup"
              desc="Just fill your basic info — we'll do the rest."
            />
            <FeatureCard
              icon={<FaUsers className="text-white text-sm" />}
              title="Family Connections"
              desc="Link with generations of family members."
            />
            <FeatureCard
              icon={<FaCheck className="text-white text-sm" />}
              title="Secure & Private"
              desc="Your data stays within your family circle."
            />
          </div>

          {/* Progress indicator */}
          <div className="relative z-10 mt-8">
            <div className="flex items-center justify-between text-xs text-blue-100/80 mb-2">
              <span>Profile completion</span>
              <span className="font-bold text-white">{progressPercent}%</span>
            </div>
            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* ═══ Right Form Panel ═══ */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Mobile header (visible below lg) */}
          <div className="lg:hidden ob-gradient-bg px-5 pt-6 pb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                  <img src="/assets/logo-green-light.png" alt="Familyss" className="w-6 h-6 object-contain" />
                </div>
                <span className="text-white/90 text-lg font-bold">Familyss</span>
              </div>
              <h2 className="text-xl font-bold text-white">Complete Your Profile</h2>
              <p className="text-blue-100/70 text-xs mt-1">Just a few details to get started</p>

              {/* Mobile progress bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] text-blue-100/80 mb-1.5">
                  <span>{filledCount} of 8 fields completed</span>
                  <span className="font-bold text-white">{progressPercent}%</span>
                </div>
                <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable form area */}
          <div className="flex-1 overflow-y-auto" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
            <div className="max-w-xl mx-auto px-5 sm:px-8 py-8 lg:py-10">

              {/* Desktop heading (hidden on mobile since we have the header) */}
              <div className="hidden lg:block mb-8">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">
                      Complete Your Profile
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                      Fill in the details below to finish setting up your account.
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSave} className="space-y-8">
                <ApiAlerts apiError={apiError} apiSuccess={apiSuccess} />

                {/* ── Profile Photo ── */}
                <div className="flex flex-col items-center ob-fade-up">
                  <div className="relative group">
                    <div className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden shadow-lg border-4 border-white dark:border-slate-800 transition-all duration-300 group-hover:shadow-xl ${!formData.profile ? "ob-pulse-ring" : ""}`}>
                      {formData.profile ? (
                        <img
                          src={formData.profile instanceof File ? URL.createObjectURL(formData.profile) : formData.profile}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary-50 to-blue-100 dark:from-slate-800 dark:to-slate-700 flex flex-col items-center justify-center">
                          <FaCloudUploadAlt className="text-2xl text-primary-400 mb-1" />
                          <span className="text-[9px] font-bold uppercase tracking-widest text-primary-500/70">Add Photo</span>
                        </div>
                      )}

                      {/* Hover overlay */}
                      <label htmlFor="profileUpload" className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center cursor-pointer rounded-full">
                        <FaCamera className="text-white text-lg" />
                        <span className="text-[9px] text-white/90 font-medium mt-1 uppercase tracking-wider">{formData.profile ? "Change" : "Upload"}</span>
                      </label>
                    </div>

                    {/* Floating camera button */}
                    <label htmlFor="profileUpload" className="absolute -bottom-1 -right-1 w-9 h-9 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95">
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
                      className="mt-3 text-[11px] text-red-500 hover:text-red-600 font-semibold transition-colors">
                      Remove photo
                    </button>
                  )}
                  {errors.profile && <p className="text-red-500 text-xs mt-2">{errors.profile}</p>}
                </div>

                {/* ── Section: Personal Details ── */}
                <div className="ob-fade-up ob-stagger-1">
                  <div className="flex items-center gap-2.5 mb-5">
                    <div className="w-8 h-8 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
                      <FaUser className="text-primary-500 text-xs" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Personal Details</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <FormField id="dob" label="Date of Birth" required error={errors.dob}>
                      <input id="dob" ref={fieldRefs.dob} type="date" name="dob" value={formData.dob || ""} onChange={handleChange}
                        min="1900-01-01" max="2100-12-31" className={inputCls(errors.dob)} />
                    </FormField>

                    <FormField id="gender" label="Gender" required error={errors.gender}>
                      <select id="gender" ref={fieldRefs.gender} name="gender" value={formData.gender || ""} onChange={handleChange}
                        className={inputCls(errors.gender)}>
                        <option value="">Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </FormField>
                  </div>
                </div>

                {/* ── Section: Parents ── */}
                <div className="ob-fade-up ob-stagger-2">
                  <div className="flex items-center gap-2.5 mb-5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                      <FaUsers className="text-emerald-500 text-xs" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Parents' Information</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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

                {/* ── Section: Address ── */}
                <div className="ob-fade-up ob-stagger-3">
                  <div className="flex items-center gap-2.5 mb-5">
                    <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
                      <FaMapMarkerAlt className="text-violet-500 text-xs" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Address Details</h3>
                  </div>

                  <div className="space-y-5">
                    <FormField id="addressLine1" label="Address Line 1" required error={errors.addressLine1}>
                      <input id="addressLine1" ref={fieldRefs.addressLine1} type="text" name="addressLine1" value={formData.addressLine1}
                        onChange={handleChange} placeholder="House No, Street, Area" className={inputCls(errors.addressLine1)} />
                    </FormField>

                    <FormField id="addressLine2" label="Address Line 2 (Optional)">
                      <input id="addressLine2" ref={fieldRefs.addressLine2} type="text" name="addressLine2" value={formData.addressLine2}
                        onChange={handleChange} placeholder="Landmark, Locality" className={inputCls(false)} />
                    </FormField>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
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
                </div>

                {/* ── Submit ── */}
                <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800/80">
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:block">
                    All fields marked with <span className="text-red-400">*</span> are mandatory
                  </p>

                  <button
                    type="submit"
                    disabled={!allFilled || isSaving}
                    className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl font-bold text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-2.5 ${
                      !allFilled || isSaving
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                        : "bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-600/20 hover:shadow-xl hover:shadow-primary-600/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
                    }`}
                  >
                    {isSaving ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                        </svg>
                        Saving...
                      </>
                    ) : (
                      <>
                        <FaCheck className="text-xs" />
                        Complete Onboarding
                      </>
                    )}
                  </button>
                </div>
              </form>

            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default OnBoarding;
