import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLogo from '../Components/AuthLogo';
import { setAuthData, isAuthenticated } from '../utils/auth';
import { useUser } from '../Contexts/UserContext';
import { MEDUSA_TOKEN_KEY } from '../Retail/utils/constants';
import * as retailAuthService from '../Retail/services/authService';

const Login = () => {
  const navigate = useNavigate();
  const { refetchUser } = useUser();
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);

  const [formData, setFormData] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(false); // New state for checkbox

  const validate = () => {
    const newErrors = {};
    if (!formData.username.trim()) newErrors.username = 'Email or phone is required';
    if (!formData.password.trim()) newErrors.password = 'Password is required';

    setErrors(newErrors);

    if (newErrors.username) {
      usernameRef.current?.focus();
    } else if (newErrors.password) {
      passwordRef.current?.focus();
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

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/user/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setApiError(errorData.message || 'Login failed. Please check credentials.');
        return;
      }

      const data = await response.json();
      
      setAuthData(data.accessToken, data.user, stayLoggedIn);

      try {
        const email = data?.user?.email;
        if (email && formData.password) {
          const { token: medusaToken } = await retailAuthService.loginCustomer({
            email,
            password: formData.password,
          });

          if (medusaToken) {
            localStorage.setItem(MEDUSA_TOKEN_KEY, medusaToken);
          }
        }
      } catch (err) {
        console.warn('Medusa customer login failed:', err);
      }
      
      await refetchUser();
      
      navigate('/dashboard');
    } catch (error) {
      setApiError('Login failed. Please check your network or credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="flex justify-center mb-1">
          <AuthLogo className="w-28 h-28" />
        </div>

        {/* Title */}
        <div className="text-center mb-9">
          <h2 className="text-2xl font-bold text-gray-800">Welcome back!!!</h2>
          <p className="text-sm text-gray-500 mt-1">
            Please enter your login details
          </p>
        </div>

        {/* API Error */}
        {apiError && (
          <div className="error-alert mb-4 p-3 text-sm text-red-700 bg-red-100 rounded border border-red-300">
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
          {/* Username */}
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email or Phone
            </label>
            <input
              id="username"
              ref={usernameRef}
              type="text"
              value={formData.username}
              onChange={(e) => handleChange("username", e.target.value)}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                errors.username
                  ? "border-red-500 focus:ring-red-300"
                  : "border-gray-300 focus:ring-[var(--color-primary)]"
              }`}
              placeholder="Email or Phone No"
            />
            {errors.username && (
              <p className="text-red-500 text-xs mt-1">{errors.username}</p>
            )}
          </div>

          {/* Password */}
          <div className="relative">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              ref={passwordRef}
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={(e) => handleChange("password", e.target.value)}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                errors.password
                  ? "border-red-500 focus:ring-red-300"
                  : "border-gray-300 focus:ring-[var(--color-primary)]"
              }`}
              placeholder="Enter password"
            />
            {/* Eye Icon - Fixed SVG paths */}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute top-9 right-4 text-gray-500 hover:text-gray-700 focus:outline-none bg-transparent"
              tabIndex={-1}
            >
              {showPassword ? (
                // Eye with slash (hide password)
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                  />
                </svg>
              ) : (
                // Normal eye (show password)
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </button>
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password}</p>
            )}
          </div>

          {/* Options */}
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={stayLoggedIn}
                onChange={(e) => setStayLoggedIn(e.target.checked)}
                className="rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
              />
              <span>Stay logged in</span>
            </label>
            <a
              href="/forgot-password"
              className="text-[#1976d2] hover:underline"
            >
              Forgot password?
            </a>
          </div>

          {/* Submit Button with Loader */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3 flex items-center justify-center font-semibold rounded-lg transition ${
              isSubmitting
                ? "bg-gray-400 cursor-not-allowed text-white"
                : "bg-[#1976d2]   hover:bg-[#1565c0] text-white"
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <svg
                  className="animate-spin h-5 w-5 mr-2 text-white"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="white"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="white"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Logging in...
              </span>
            ) : (
              "Login"
            )}
          </button>
        </form>

        {/* Sign Up */}
        <p className="text-center text-sm text-gray-500 mt-6 pb-8">
          Don't have an account?{" "}
          <a href="/register" className="text-[#1976d2] hover:underline">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
};

export default Login;