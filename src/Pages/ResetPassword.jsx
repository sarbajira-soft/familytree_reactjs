import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthLogo from '../Components/AuthLogo';
import { markOtpSent, readOtpSecondsLeft } from '../utils/otpCooldown';
import {
  OTP_LENGTH,
  extractDigitsFromClipboardEvent,
  isValidOtp,
  sanitizeOtpInput,
} from '../utils/inputSanitizers';
import { UI_MESSAGES } from '../utils/apiMessages';

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');

  const [canResend, setCanResend] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validatePassword = (password) => {
    const minLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

    return {
      isValid: minLength && hasUpperCase && hasSpecialChar,
      minLength,
      hasUpperCase,
      hasSpecialChar,
    };
  };

  useEffect(() => {
    if (!location.state?.email) {
      navigate('/forgot-password', { replace: true });
    } else {
      setEmail(location.state.email);
    }
  }, [location.state, navigate]);

  useEffect(() => {
    return () => {
      try {
        if (window.__resetPasswordSuccessTimeout) {
          clearTimeout(window.__resetPasswordSuccessTimeout);
          window.__resetPasswordSuccessTimeout = null;
        }
      } catch {}
    };
  }, []);

  useEffect(() => {
    const checkTimeLeft = () => {
      const secondsLeft = readOtpSecondsLeft();
      if (secondsLeft > 0) {
        setTimeLeft(secondsLeft);
        setCanResend(false);
      } else {
        setTimeLeft(0);
        setCanResend(true);
      }
    };

    checkTimeLeft();
    const interval = setInterval(checkTimeLeft, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!email) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!otp || !newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (!isValidOtp(otp)) {
      setError(`Please enter a valid ${OTP_LENGTH}-digit OTP`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      setError(
        'Password must be at least 8 characters and include 1 uppercase letter and 1 special character'
      );
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/user/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, otp: sanitizeOtpInput(otp), newPassword, confirmPassword }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const apiMessage = String(data?.message || '').trim();
        if (apiMessage.toLowerCase().includes('invalid otp')) {
          setError(UI_MESSAGES.INVALID_OTP);
        } else {
          setError(apiMessage || 'Reset failed. Try again.');
        }
        setIsLoading(false);
        return;
      }

      setSuccess('Password updated successfully');
      setIsLoading(false);
      try {
        if (window.__resetPasswordSuccessTimeout) {
          clearTimeout(window.__resetPasswordSuccessTimeout);
        }
        window.__resetPasswordSuccessTimeout = setTimeout(() => {
          navigate('/login');
        }, 2000);
      } catch {
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    } catch (err) {
      setError('Reset failed. Please try again.');
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/user/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || 'Failed to resend OTP');
        return;
      }

      markOtpSent();
      setCanResend(false);
      setError('OTP has been resent to your email');
    } catch (err) {
      setError('Failed to resend OTP. Please try again.');
    }
  };

  return (
    <div className="min-h-screen w-full bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center mb-1">
          <AuthLogo className="w-28 h-28" />
        </div>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Reset Password</h2>
          <p className="text-sm text-gray-500 mt-1">
            Enter the OTP and your new password
          </p>
        </div>

        {success && (
          <div className="mb-4 p-3 text-sm rounded border text-green-700 bg-green-100 border-green-300">
            {success}
          </div>
        )}

        {error && (
          <div className={`mb-4 p-3 text-sm rounded border ${
            error.includes('resent')
              ? 'text-green-700 bg-green-100 border-green-300'
              : 'text-red-700 bg-red-100 border-red-300'
          }`}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
              OTP
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={otp}
              onChange={(e) => setOtp(sanitizeOtpInput(e.target.value))}
              onPaste={(e) => {
                const digits = extractDigitsFromClipboardEvent(e);
                if (!digits) {
                  e.preventDefault();
                  return;
                }
                e.preventDefault();
                setOtp(sanitizeOtpInput(digits));
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              placeholder="Enter 6-digit OTP"
              maxLength={OTP_LENGTH}
            />
          </div>

          <div className="relative">
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <input
              id="newPassword"
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              placeholder="Enter new password"
              autoComplete="new-password"
            />
            <span
              className="absolute top-[38px] right-3 cursor-pointer text-gray-600 hover:text-gray-800"
              onClick={() => setShowNewPassword((prev) => !prev)}
            >
              {showNewPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 0-1.304.248-2.55.7-3.688M9.172 9.172A3 3 0 0115.828 15.828M16.24 16.24L3.76 3.76" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </span>
          </div>

          {newPassword && (
            <div className="text-xs text-gray-600">
              Password must be at least 8 characters and include 1 uppercase letter and 1 special character.
            </div>
          )}

          <div className="relative">
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              placeholder="Re-enter new password"
              autoComplete="new-password"
            />
            <span
              className="absolute top-[38px] right-3 cursor-pointer text-gray-600 hover:text-gray-800"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
            >
              {showConfirmPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 0-1.304.248-2.55.7-3.688M9.172 9.172A3 3 0 0115.828 15.828M16.24 16.24L3.76 3.76" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-[var(--color-primary)] hover:brightness-110 text-white font-semibold rounded-lg transition disabled:opacity-70"
          >
            {isLoading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <div className="text-center mt-4 text-sm">
          <p className="text-gray-500">
            Didn't receive the code?{' '}
            {canResend ? (
              <button
                onClick={handleResendOtp}
                className="bg-unset text-[var(--color-primary)] hover:underline focus:outline-none"
              >
                Resend OTP
              </button>
            ) : (
              <span className="text-gray-400">
                You can resend OTP in {timeLeft}s
              </span>
            )}
          </p>
        </div>

        <div className="text-center mt-4 text-sm">
          <p>
            <a
              href="/"
              className="text-[var(--color-primary)] hover:underline focus:outline-none"
            >
              &larr; Back to Login
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
