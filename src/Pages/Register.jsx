import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import AuthLogo from "../Components/AuthLogo";
import countryList from "react-select-country-list";
import { getCountryCallingCode } from "react-phone-number-input";
import { isValidPhoneNumber } from "libphonenumber-js";
import Select from "react-select";

const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const familyCode = params.get("familyCode");
  const firstNameRef = useRef(null);
  const mobileRef = useRef(null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
   countryCode:"+91",
    password: "",
     confirmPassword: "",
     hasAcceptedTerms: false,
     hasAcceptedPrivacy: false,
   });

  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const apiErrorRef = useRef(null);

const countries = countryList().getData();

const countryOptions = countries
  .filter((country) => {
    try {
      getCountryCallingCode(country.value);
      return true;
    } catch {
      return false;
    }
  })
  .map((country) => ({
    value: `+${getCountryCallingCode(country.value)}`,
    label: `${country.label} (+${getCountryCallingCode(country.value)})`,
  }));

  const NAME_MIN_LENGTH = 2;
  const NAME_MAX_LENGTH = 30;

  const sanitizeNameInput = (value) => {
    const sanitized = value.replace(/[^A-Za-z\s]/g, "");
    return sanitized.slice(0, NAME_MAX_LENGTH);
  };

  // Password validation function
  const validatePassword = (password) => {
    const minLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
      password
    );

    return {
      isValid: minLength && hasUpperCase && hasSpecialChar,
      minLength,
      hasUpperCase,
      hasSpecialChar,
    };
  };

  const validate = () => {
    const newErrors = {};

    const firstNameTrimmed = formData.firstName.trim();
    const lastNameTrimmed = formData.lastName.trim();

    if (!firstNameTrimmed) {
      newErrors.firstName = "First name is required";
    } else if (
      firstNameTrimmed.length < NAME_MIN_LENGTH ||
      firstNameTrimmed.length > NAME_MAX_LENGTH
    ) {
      newErrors.firstName = `First name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters`;
    } else if (!/^[A-Za-z]+(\s[A-Za-z]+)*$/.test(firstNameTrimmed)) {
      newErrors.firstName = "First name can contain letters only";
    }

    if (!lastNameTrimmed) {
      newErrors.lastName = "Last name is required";
    } else if (
      lastNameTrimmed.length < NAME_MIN_LENGTH ||
      lastNameTrimmed.length > NAME_MAX_LENGTH
    ) {
      newErrors.lastName = `Last name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters`;
    } else if (!/^[A-Za-z]+(\s[A-Za-z]+)*$/.test(lastNameTrimmed)) {
      newErrors.lastName = "Last name can contain letters only";
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    // Mobile number validation - fixed for Indian numbers
   if (!formData.mobile.trim()) {
  newErrors.mobile = "Mobile number is required";
} else {
  const fullPhone =
    formData.countryCode + formData.mobile;

  if (!isValidPhoneNumber(fullPhone)) {
    newErrors.mobile =
      "Please enter a valid phone number";
  }
}

    // Password validation
    if (!formData.password.trim()) {
      newErrors.password = "Password is required";
    } else {
      const passwordValidation = validatePassword(formData.password);
      if (!passwordValidation.isValid) {
        newErrors.password =
          "Password must be at least 8 characters with 1 uppercase letter and 1 special character";
      }
    }

    // Confirm password validation
    if (!formData.confirmPassword.trim()) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (!formData.hasAcceptedTerms || !formData.hasAcceptedPrivacy) {
      newErrors.hasAcceptedTerms =
        "You must agree to the Terms & Conditions and Privacy Policy to create an account";
    }

    setErrors(newErrors);

    if (newErrors.firstName) {
      firstNameRef.current?.focus();
    }

    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });

    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  const handleMobileChange = (value) => {
    // Allow only numbers and limit to 10 digits
    const mobileValue = value.replace(/\D/g, "");
    handleChange("mobile", mobileValue);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError("");

    if (!validate()) return;

    setIsLoading(true);

    try {
      // Create API data
      const apiData = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        mobile: formData.mobile,
        countryCode: formData.countryCode,
        password: formData.password,
        hasAcceptedTerms: formData.hasAcceptedTerms,
        hasAcceptedPrivacy: formData.hasAcceptedPrivacy,
      };

      console.log("Sending API data:", apiData);

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/user/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        setApiError(
          errorData.message || "Registration failed. Please check your details."
        );
        setTimeout(() => {
          apiErrorRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          apiErrorRef.current?.focus();
        }, 100);
        return;
      }

      const data = await response.json();
      // Navigate to OTP verification page
      if (familyCode) {
        navigate(`/verify-otp?familyCode=${familyCode}`, {
          state: { email: data.email, mobile: data.mobile },
        });
      } else {
        navigate("/verify-otp", {
          state: { email: data.email, mobile: data.mobile },
        });
      }
    } catch (error) {
      setApiError(
        "Registration failed. Please check your network and try again."
      );
      setTimeout(() => {
        apiErrorRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        apiErrorRef.current?.focus();
      }, 100);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Logo */}
      <div className="flex justify-center mb-1">
        <AuthLogo className="w-28 h-28" />
      </div>

      {/* Title */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
          Create your account
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Please enter your details to sign up
        </p>
      </div>

        {apiError && (
          <div
            ref={apiErrorRef}
            tabIndex="-1"
            className="error-alert mb-4 p-3 text-sm text-red-700 bg-red-100 rounded border border-red-300 focus:outline-none focus:ring-2 focus:ring-red-300"
          >
            {apiError}
            <button
              onClick={() => setApiError("")}
              className="ml-3 font-bold hover:text-red-900"
              aria-label="Dismiss error"
              style={{ float: "right" }}
            >
              &times;
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* First Name and Last Name in same row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="firstName"
                className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1"
              >
                First name <span className="text-red-500">*</span>
              </label>
              <input
                id="firstName"
                ref={firstNameRef}
                type="text"
                value={formData.firstName}
                onChange={(e) =>
                  handleChange("firstName", sanitizeNameInput(e.target.value))
                }
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 dark:bg-slate-900 dark:text-white dark:border-slate-700 dark:placeholder-gray-400 ${
                  errors.firstName
                    ? "border-red-500 focus:ring-red-300"
                    : "border-gray-300 dark:border-slate-700 focus:ring-[#1976d2]"
                }`}
                placeholder="Enter first name"
                maxLength={NAME_MAX_LENGTH}
                autoCapitalize="words"
                style={{ textTransform: "capitalize" }}
              />
              {errors.firstName && (
                <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
              )}
            </div>
            <div>
              <label
                htmlFor="lastName"
                className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1"
              >
                Last name <span className="text-red-500">*</span>
              </label>
              <input
                id="lastName"
                type="text"
                value={formData.lastName}
                onChange={(e) =>
                  handleChange("lastName", sanitizeNameInput(e.target.value))
                }
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 dark:bg-slate-900 dark:text-white dark:border-slate-700 dark:placeholder-gray-400 ${
                  errors.lastName
                    ? "border-red-500 focus:ring-red-300"
                    : "border-gray-300 dark:border-slate-700 focus:ring-[#1976d2]"
                }`}
                placeholder="Enter last name"
                maxLength={NAME_MAX_LENGTH}
                autoCapitalize="words"
                style={{ textTransform: "capitalize" }}
              />
              {errors.lastName && (
                <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
              )}
            </div>
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1"
            >
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 dark:bg-slate-900 dark:text-white dark:border-slate-700 dark:placeholder-gray-400 ${
                errors.email
                  ? "border-red-500 focus:ring-red-300"
                  : "border-gray-300 dark:border-slate-700 focus:ring-[#1976d2]"
              }`}
              placeholder="Enter email"
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email}</p>
            )}
          </div>

          {/* Mobile Number */}
          <div>
            <label
              htmlFor="mobile"
              className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1"
            >
              Mobile number <span className="text-red-500">*</span>
            </label>
            <div className="flex">
              {/* Country Code - Small Box */}
             <div className="w-52 mr-2 p-2">
  <Select
    options={countryOptions}
    value={
      countryOptions.find(
        (option) => option.value === formData.countryCode
      )
    }
    onChange={(selected) =>
      handleChange("countryCode", selected.value)
    }
    isSearchable
    placeholder="Select Country"
  />
</div>

              {/* Mobile Number - Big Box */}
              <div className="flex-1">
                <input
                  id="mobile"
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) => handleMobileChange(e.target.value)}
                  className={`w-full h-12 px-4 border rounded-lg focus:outline-none focus:ring-2 dark:bg-slate-900 dark:text-white dark:border-slate-700 dark:placeholder-gray-400 ${
                    errors.mobile
                      ? "border-red-500 focus:ring-red-300"
                      : "border-gray-300 dark:border-slate-700 focus:ring-[#1976d2]"
                  }`}
                  placeholder="Enter mobile number"
                  maxLength={15}
                  inputMode="numeric"
                />
              </div>
            </div>
            {errors.mobile && (
              <p className="text-red-500 text-xs mt-1">{errors.mobile}</p>
            )}
          </div>

          {/* Password */}
          <div className="relative">
            <label
              htmlFor="password"
              className="block text-sm font-bold text-gray-800 dark:text-gray-300 mb-1"
            >
              Password <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={(e) => handleChange("password", e.target.value)}
              className={`w-full px-4 py-3 pr-10 border rounded-lg focus:outline-none focus:ring-2 dark:bg-slate-900 dark:text-white dark:border-slate-700 dark:placeholder-gray-400 ${
                errors.password
                  ? "border-red-500 focus:ring-red-300"
                  : "border-gray-300 dark:border-slate-700 focus:ring-[#1976d2]"
              }`}
              placeholder="Enter password"
              autoComplete="new-password"
            />
            <span
              onClick={() => setShowPassword(!showPassword)}
              className="absolute top-9 right-3 cursor-pointer text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {showPassword ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7.5a11.05 11.05 0 013.304-4.348M3 3l18 18M16.24 16.24A5 5 0 017.76 7.76"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M1.5 12S5.5 5.5 12 5.5 22.5 12 22.5 12s-4 6.5-10.5 6.5S1.5 12 1.5 12z"
                  />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </span>
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password}</p>
            )}

            {/* Password Requirements */}
            {formData.password && (
              <div className="mt-2 text-xs">
                <p className="text-gray-600 mb-1">Password requirements:</p>
                <div className="space-y-1">
                  <div
                    className={`flex items-center ${
                      formData.password.length >= 8
                        ? "text-green-600"
                        : "text-gray-400"
                    }`}
                  >
                    <span className="mr-1">
                      {formData.password.length >= 8 ? "✓" : "○"}
                    </span>
                    At least 8 characters
                  </div>
                  <div
                    className={`flex items-center ${
                      /[A-Z]/.test(formData.password)
                        ? "text-green-600"
                        : "text-gray-400"
                    }`}
                  >
                    <span className="mr-1">
                      {/[A-Z]/.test(formData.password) ? "✓" : "○"}
                    </span>
                    1 uppercase letter
                  </div>
                  <div
                    className={`flex items-center ${
                      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
                        formData.password
                      )
                        ? "text-green-600"
                        : "text-gray-400"
                    }`}
                  >
                    <span className="mr-1">
                      {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
                        formData.password
                      )
                        ? "✓"
                        : "○"}
                    </span>
                    1 special character
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="relative">
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-bold text-gray-800 mb-1"
            >
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              value={formData.confirmPassword}
              onChange={(e) => handleChange("confirmPassword", e.target.value)}
              onPaste={(e) => {
                e.preventDefault();
                setErrors((prev) => ({
                  ...prev,
                  confirmPassword: "Pasting into Confirm Password is not allowed",
                }));
              }}
              onDrop={(e) => {
                e.preventDefault();
              }}
               className={`w-full px-4 py-3 pr-10 border rounded-lg focus:outline-none focus:ring-2 dark:bg-slate-900 dark:text-white dark:border-slate-700 dark:placeholder-gray-400 ${
                errors.confirmPassword
                  ? "border-red-500 focus:ring-red-300"
                 : "border-gray-300 dark:border-slate-700 focus:ring-[#1976d2]"
              }`}
              placeholder="Confirm password"
              autoComplete="new-password"
            />
            <span
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute top-9 right-3 cursor-pointer text-gray-600 hover:text-gray-800"
            >
              {showConfirmPassword ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7.5a11.05 11.05 0 013.304-4.348M3 3l18 18M16.24 16.24A5 5 0 017.76 7.76"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M1.5 12S5.5 5.5 12 5.5 22.5 12 22.5 12s-4 6.5-10.5 6.5S1.5 12 1.5 12z"
                  />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </span>
            {errors.confirmPassword && (
              <p className="text-red-500 text-xs mt-1">
                {errors.confirmPassword}
              </p>
            )}
          </div>

          <div className="pt-2">
            <div className="flex items-start space-x-2">
              <input
                id="hasAcceptedTermsAndPrivacy"
                type="checkbox"
                checked={formData.hasAcceptedTerms && formData.hasAcceptedPrivacy}
                onChange={(e) => {
                  setFormData(prev => ({
                    ...prev,
                    hasAcceptedTerms: e.target.checked,
                    hasAcceptedPrivacy: e.target.checked,
                  }));
                  setErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors.hasAcceptedTerms;
                    delete newErrors.hasAcceptedPrivacy;
                    return newErrors;
                  });
                }}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-[#1976d2] focus:ring-[#1976d2]"
              />
              <label
                htmlFor="hasAcceptedTermsAndPrivacy"
                className="text-xs text-gray-700 dark:text-gray-300 select-none"
              >
                I agree to the{" "}
                <a
                  href="/terms-and-privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1976d2] underline hover:text-[#1565c0]"
                >
                  Terms & Conditions
                </a>{" "}
                and{" "}
                <a
                  href="/terms-and-privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1976d2] underline hover:text-[#1565c0]"
                >
                  Privacy Policy
                </a>
                , confirm that I have permission to share my family members'
                information, will provide only valid contact details, and consent to the processing of personal data
              </label>
            </div>
            {errors.hasAcceptedTerms && (
              <p className="text-red-500 text-xs mt-1">
                {errors.hasAcceptedTerms}
              </p>
            )}
          </div>

          {/* Submit Button with loading state */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 bg-[#1976d2] hover:bg-[#1565c0] text-white font-semibold rounded-lg transition flex justify-center items-center ${
              isLoading ? "opacity-75 cursor-not-allowed" : ""
            }`}
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Processing...
              </>
            ) : (
              "Sign Up"
            )}
          </button>
        </form>



        {/* Login Link */}
        <p className="text-center text-sm text-gray-500 mt-6 pb-8">
          Already have an account?{" "}
          <Link to="/login" className="text-[#1976d2] hover:underline">
            Login
          </Link>
        </p>
    </>
  );
};

export default Register;
