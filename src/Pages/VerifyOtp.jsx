import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthLogo from '../Components/AuthLogo';
import { setAuthData, getUserIdFromToken } from '../utils/auth';
import { useUser } from '../Contexts/UserContext';
import {
  OTP_SENT_STORAGE_KEY,
  markOtpSent,
  readOtpSecondsLeft,
} from '../utils/otpCooldown';
import {
  OTP_LENGTH,
  extractDigitsFromClipboardEvent,
  isValidOtp,
  sanitizeOtpInput,
} from '../utils/inputSanitizers';
import { UI_MESSAGES } from '../utils/apiMessages';

const VerifyOtp = () => {
  const navigate = useNavigate();
  const { refetchUser } = useUser();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const familyCode = params.get('familyCode');
  const step = params.get('step') || 'email'; // 'email' or 'mobile'
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');

  const [canResend, setCanResend] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const stateEmail = location.state?.email;
    const stateMobile = location.state?.mobile;

    if (stateEmail || stateMobile) {
      if (stateEmail) setEmail(stateEmail);
      if (stateMobile) setMobile(stateMobile);
      return;
    }

    navigate('/register', { replace: true });
  }, [location.state, navigate]);

  useEffect(() => {
    if (!localStorage.getItem(OTP_SENT_STORAGE_KEY)) {
      markOtpSent();
    }

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
  }, [step]); // Re-run effect when step changes to reset timer state

  const userName = step === 'email' ? email : mobile;
  if (!userName) {
    return null;
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');

    if (!isValidOtp(otp)) {
      setError(`Please enter a valid ${OTP_LENGTH}-digit OTP`);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/user/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName, otp: sanitizeOtpInput(otp) }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const apiMessage = String(errorData?.message || '').trim();
        if (apiMessage.toLowerCase().includes('invalid otp')) {
          setError(UI_MESSAGES.INVALID_OTP);
        } else {
          setError(apiMessage || 'OTP verification failed');
        }
        return;
      }

      const data = await response.json();

      if (data.nextStep === 'mobile-verification') {
        setOtp('');
        // Remove OTP sent key to force restart the cooldown timer for mobile OTP
        localStorage.removeItem(OTP_SENT_STORAGE_KEY);
        markOtpSent();
        navigate(`/verify-otp?step=mobile${familyCode ? `&familyCode=${familyCode}` : ''}`, {
          state: { email, mobile },
          replace: true,
        });
        setError(data.message || 'Email verified! A verification code has been sent to your mobile phone.');
        return;
      }

      if (data.nextStep === 'email-verification') {
        setOtp('');
        localStorage.removeItem(OTP_SENT_STORAGE_KEY);
        markOtpSent();
        navigate(`/verify-otp?step=email${familyCode ? `&familyCode=${familyCode}` : ''}`, {
          state: { email, mobile },
          replace: true,
        });
        setError(data.message || 'Mobile verified! A verification code has been sent to your email.');
        return;
      }

      const tokenUserId = getUserIdFromToken(data.accessToken);
      const minimalUser = {
        userId: tokenUserId,
        email: email || '',
        mobile: mobile || '',
      };

      // Save auth data and update user context before navigating
      setAuthData(data.accessToken, minimalUser, true);
      await refetchUser();

      if (familyCode) {
        navigate(`/on-boarding?familyCode=${familyCode}`);
      } else {
        navigate('/on-boarding');
      }
    } catch (err) {
      console.error('OTP verification failed:', err);
      setError('OTP verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/user/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: step === 'email' ? email : undefined,
          mobile: step === 'mobile' ? mobile : undefined,
          channel: step === 'email' ? 'email' : 'sms',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || 'Failed to resend OTP');
        return;
      }

      // Restart cooldown
      localStorage.removeItem(OTP_SENT_STORAGE_KEY);
      markOtpSent();
      setCanResend(false);

      setError(`OTP has been resent to your ${step === 'email' ? 'email' : 'mobile'}`);
    } catch (err) {
      console.error('Failed to resend OTP:', err);
      setError('Failed to resend OTP. Please try again.');
    }
  };

  return (
    <>
      <div className="flex justify-center mb-1">
        <AuthLogo className="w-28 h-28" />
      </div>

      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          {step === 'email' ? 'Verify Your Email' : 'Verify Your Mobile'}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          We've sent a verification code to {step === 'email' ? email : mobile}
        </p>
      </div>

        {error && (
          <div className={`mb-4 p-3 text-sm rounded border ${
            error.includes('resent')
              ? 'text-green-700 bg-green-100 border-green-300'
              : 'text-red-700 bg-red-100 border-red-300'
          }`}>
            {error}
          </div>
        )}

        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div>
            <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
              Enter OTP
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={OTP_LENGTH}
              value={otp}
              onChange={(e) => setOtp(sanitizeOtpInput(e.target.value))}
              onPaste={(e) => {
                e.preventDefault();
                setOtp(sanitizeOtpInput(extractDigitsFromClipboardEvent(e)));
              }}
              className="w-full px-4 dark:text-white dark:bg-slate-900  py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              placeholder={`Enter ${OTP_LENGTH}-digit OTP`}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-[var(--color-primary)] hover:brightness-110 text-white font-semibold rounded-lg transition disabled:opacity-70"
          >
            {isLoading ? 'Verifying...' : step === 'email' ? 'Verify Email' : 'Verify Mobile'}
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
    </>
  );
};

export default VerifyOtp;
