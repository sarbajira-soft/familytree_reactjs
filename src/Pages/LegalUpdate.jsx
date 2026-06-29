import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLogo from '../Components/AuthLogo';
import { useUser } from '../Contexts/UserContext';
import { getToken } from '../utils/auth';
import { authFetchResponse } from '../utils/authFetch';

const LegalUpdate = () => {
  const navigate = useNavigate();
  const { userInfo, refetchUser } = useUser();
  const [accepted, setAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [documents, setDocuments] = useState({
    terms: {
      title: 'Terms & Conditions',
      version: 'v1.0.0',
      content: '<p>Loading terms and conditions...</p>',
    },
    privacy: {
      title: 'Privacy Policy',
      version: 'v1.0.0',
      content: '<p>Loading privacy policy...</p>',
    },
  });

  useEffect(() => {
    // Fetch both active documents
    const fetchDocs = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/legal/current`);
        if (res.ok) {
          const data = await res.json();
          setDocuments({
            terms: data.terms || documents.terms,
            privacy: data.privacy || documents.privacy,
          });
        }
      } catch (err) {
        console.error('Failed to fetch legal documents:', err);
      }
    };
    fetchDocs();
  }, []);

  useEffect(() => {
    if (userInfo && userInfo.hasAcceptedTerms && userInfo.hasAcceptedPrivacy) {
      navigate('/dashboard', { replace: true });
    }
  }, [userInfo, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    if (!accepted) {
      setApiError('You must accept the updated Terms & Conditions and Privacy Policy to continue.');
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
          acceptTerms: true,
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
    <div className="min-h-screen w-full bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-8 bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-center mb-4">
          <AuthLogo className="w-20 h-20" />
        </div>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Legal Documents Update</h1>
          <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
            Both our Terms & Conditions and Privacy Policy have been updated. Please read and accept them to continue using the application.
          </p>
        </div>

        {apiError && (
          <div className="mb-6 p-3 text-sm text-red-700 bg-red-100 rounded border border-red-300">
            {apiError}
          </div>
        )}

        <div className="flex flex-col gap-6 mb-8">
          {/* Terms Section */}
          <div className="p-5 rounded-lg border border-gray-200 bg-gray-50/50 flex flex-col h-[250px]">
            <h2 className="text-lg font-bold text-gray-800 mb-2">{documents.terms.title}</h2>
            <div className="flex-1 overflow-y-auto pr-2 text-sm text-gray-700 space-y-3 mb-4 scrollbar-thin">
              <div
                className="prose prose-sm prose-indigo space-y-3"
                dangerouslySetInnerHTML={{ __html: documents.terms.content }}
              />
            </div>
            <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
              <span className="text-xs font-semibold text-gray-400">Version: {documents.terms.version}</span>
            </div>
          </div>

          {/* Privacy Section */}
          <div className="p-5 rounded-lg border border-gray-200 bg-gray-50/50 flex flex-col h-[250px]">
            <h2 className="text-lg font-bold text-gray-800 mb-2">{documents.privacy.title}</h2>
            <div className="flex-1 overflow-y-auto pr-2 text-sm text-gray-700 space-y-3 mb-4 scrollbar-thin">
              <div
                className="prose prose-sm prose-indigo space-y-3"
                dangerouslySetInnerHTML={{ __html: documents.privacy.content }}
              />
            </div>
            <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
              <span className="text-xs font-semibold text-gray-400">Version: {documents.privacy.version}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 max-w-xl mx-auto">
          <div className="flex items-start space-x-3">
            <input
              id="acceptBoth"
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1 h-5 w-5 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
            />
            <label htmlFor="acceptBoth" className="text-sm text-gray-700 select-none cursor-pointer leading-relaxed">
              I have read and accept the updated Terms & Conditions and Privacy Policy.
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3 bg-[var(--color-primary)] text-white font-semibold rounded-lg flex items-center justify-center transition text-base shadow-sm ${
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

export default LegalUpdate;
