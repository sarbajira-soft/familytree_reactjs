import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthLogo from '../Components/AuthLogo';
import { setAuthData, getUserIdFromToken } from '../utils/auth';
import { useUser } from '../Contexts/UserContext';

const VerifyOtp = () => {
  const navigate = useNavigate();
  const { refetchUser } = useUser();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const familyCode = params.get('familyCode');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');

  const [canResend, setCanResend] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  
  // Check for email in location state or redirect
  useEffect(() => {
    if (!location.state?.email) {
      navigate('/register', { replace: true });
    } else {
      setEmail(location.state.email);
    }
    if (location.state.mobile) setMobile(location.state.mobile);
  }, [location.state, navigate]);

  // Handle OTP resend cooldown
  useEffect(() => {
    let otpSent = parseInt(localStorage.getItem('otp_sent_time'), 10);

    if (!otpSent) {
      otpSent = Date.now();
      localStorage.setItem('otp_sent_time', otpSent.toString());
    }

    const checkTimeLeft = () => {
      const now = Date.now();
      const diff = 15 * 60 * 1000 - (now - otpSent); // 15 minutes
      if (diff > 0) {
        setTimeLeft(Math.ceil(diff / 1000));
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

  if (!email) {
    return null; // Don't show UI if email not present
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');

    if (!otp) {
      setError('Please enter the OTP');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/user/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName:email, otp }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.message || 'OTP verification failed');
        setIsLoading(false);
        return;
      }

      const data = await response.json();

      const tokenUserId = getUserIdFromToken(data.accessToken);
      const minimalUser = {
        userId: tokenUserId,
        email: email || '',
        mobile: mobile || '',
      };

      // IMPORTANT: use setAuthData so we refresh session expiry and userInfo
      // (otherwise an old sessionExpiry can instantly clear the new token)
      const stayLoggedIn = localStorage.getItem('stayLoggedIn') === 'true';
      setAuthData(data.accessToken, minimalUser, stayLoggedIn);

      // Ensure the UserContext is populated before navigating to a PrivateRoute
      // (otherwise PrivateRoute sees token but userInfo=null and redirects to /login)
      await refetchUser();

      if (familyCode) {
        navigate(`/on-boarding?familyCode=${familyCode}`);
      } else {
        navigate('/on-boarding');
      }
    } catch (err) {
      console.log(err);
      
      setError('OTP verification failed. Please try again.');
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/user/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, mobile  }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to resend OTP');
        return;
      }

      // Reset resend timer
      localStorage.setItem('otp_sent_time', Date.now().toString());
      setCanResend(false);

      setError('OTP has been resent to your email');
    } catch (err) {
      setError('Failed to resend OTP. Please try again.');
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
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Verify Your Email</h2>
          <p className="text-sm text-gray-500 mt-1">
            We've sent a verification code to {email} {mobile ? ' or ' + mobile : ''}
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

        {/* OTP Form */}
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div>
            <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
              Enter OTP
            </label>
            <input
              id="otp"
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              placeholder="Enter 6-digit OTP"
              maxLength="6"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-[var(--color-primary)] hover:brightness-110 text-white font-semibold rounded-lg transition disabled:opacity-70"
          >
            {isLoading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </form>

        {/* Resend OTP */}
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
                You can resend OTP in {Math.floor(timeLeft / 60)}m {timeLeft % 60}s
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyOtp;
