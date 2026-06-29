import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLogo from '../Components/AuthLogo';
import { useUser } from '../Contexts/UserContext';
import { getToken } from '../utils/auth';
import { authFetchResponse } from '../utils/authFetch';

const PrivacyPolicy = () => {
  const navigate = useNavigate();
  const { userInfo, refetchUser } = useUser();
  const [accepted, setAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [document, setDocument] = useState({
    title: 'Privacy Policy',
    version: 'v1.0.0',
    content: '<p>Loading privacy policy...</p>',
  });

  useEffect(() => {
    // Fetch active privacy policy content
    const fetchDoc = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/legal/privacy`);
        if (res.ok) {
          const data = await res.json();
          setDocument({
            title: data.title || 'Privacy Policy',
            version: data.version || 'v1.0.0',
            content: data.content || '<p>No content available.</p>',
          });
        }
      } catch (err) {
        console.error('Failed to fetch privacy policy:', err);
      }
    };
    fetchDoc();
  }, []);

  useEffect(() => {
    if (userInfo && userInfo.hasAcceptedPrivacy) {
      navigate('/dashboard', { replace: true });
    }
  }, [userInfo, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    if (!accepted) {
      setApiError('You must accept the Privacy Policy to continue.');
      return;
    }

    try {
      setIsSubmitting(true);
      const token = getToken();

      const response = await authFetchResponse('/user/accept-legal', {
        method: 'POST',
        skipThrow: true,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          acceptTerms: false,
          acceptPrivacy: true,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to save your consent. Please try again.';
        try {
          const errorData = await response.json();
          if (errorData?.message) {
            errorMessage = errorData.message;
          }
        } catch {}
        setApiError(errorMessage);
        return;
      }

      await refetchUser();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setApiError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-8 bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-center mb-4">
          <AuthLogo className="w-20 h-20" />
        </div>
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">{document.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Please read our Privacy Policy carefully. You must accept it to continue using the application.
          </p>
        </div>

        {apiError && (
          <div className="mb-4 p-3 text-sm text-red-700 bg-red-100 rounded border border-red-300">
            {apiError}
          </div>
        )}

        <div className="mb-6 max-h-72 overflow-y-auto pr-2 text-sm text-gray-700 space-y-3">
          <div
            className="prose prose-sm prose-indigo space-y-3"
            dangerouslySetInnerHTML={{ __html: document.content }}
          />
          <p className="font-semibold text-xs text-gray-400 mt-4">Version: {document.version}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-start space-x-2">
            <input
              id="acceptPrivacy"
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
            />
            <label htmlFor="acceptPrivacy" className="text-sm text-gray-700 select-none">
              I have read and accept the updated Privacy Policy.
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3 bg-[var(--color-primary)] text-white font-semibold rounded-lg flex items-center justify-center transition ${
              isSubmitting ? 'opacity-75 cursor-not-allowed' : 'hover:brightness-110'
            }`}
          >
            {isSubmitting ? 'Saving your consent...' : 'Accept and continue'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
