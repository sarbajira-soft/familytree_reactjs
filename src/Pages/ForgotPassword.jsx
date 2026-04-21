import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AuthLogo from '../Components/AuthLogo';
import { markOtpSent } from '../utils/otpCooldown';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!email) {
      setError('Please enter your email');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/user/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Something went wrong. Please try again.');
      } else {
        markOtpSent();
        navigate('/reset-password', { state: { email } });
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    }

    setIsLoading(false);
  };

  return (
    <>
      {/* Logo */}
      <div className="flex justify-center mb-1">
        <AuthLogo className="w-28 h-28" />
      </div>

      {/* Title */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Forgot Password</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Enter your email to receive an OTP
        </p>
      </div>

        {error && (
          <div className="mb-4 p-3 text-sm rounded border text-red-700 bg-red-100 border-red-300">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 p-3 text-sm rounded border text-green-700 bg-green-100 border-green-300">
            {message}
          </div>
        )}

        {/* Email Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] dark:bg-slate-900 dark:text-white dark:placeholder-gray-400"
              placeholder="example@email.com"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-[var(--color-primary)] hover:brightness-110 text-white font-semibold rounded-lg transition disabled:opacity-70"
          >
            {isLoading ? 'Sending OTP...' : 'Send OTP'}
          </button>
        </form>

        {/* Back to Login */}
        <div className="text-center mt-6 text-sm">
          <Link
            to="/"
            className="text-[var(--color-primary)] hover:underline focus:outline-none"
          >
            &larr; Back to Login
          </Link>
        </div>
    </>
  );
};

export default ForgotPassword;

