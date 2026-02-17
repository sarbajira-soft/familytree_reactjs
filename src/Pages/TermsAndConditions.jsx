import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLogo from '../Components/AuthLogo';
import { useUser } from '../Contexts/UserContext';
import { getToken } from '../utils/auth';
import { authFetchResponse } from '../utils/authFetch';

const TermsAndConditions = () => {
  const navigate = useNavigate();
  const { userInfo, refetchUser } = useUser();
  const [accepted, setAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    if (userInfo && userInfo.hasAcceptedTerms) {
      navigate('/dashboard', { replace: true });
    }
  }, [userInfo, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    if (!accepted) {
      setApiError('You must accept the Terms & Conditions to continue.');
      return;
    }

    try {
      setIsSubmitting(true);
      const token = getToken();

      const response = await authFetchResponse('/user/accept-terms', {
        method: 'POST',
        skipThrow: true,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accepted: true,
          termsVersion: 'v1.0.0',
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
          <h1 className="text-2xl font-bold text-gray-800">Terms & Conditions</h1>
          <p className="text-sm text-gray-500 mt-1">
            Please read these terms carefully. You must accept them to continue using the application.
          </p>
        </div>

        {apiError && (
          <div className="mb-4 p-3 text-sm text-red-700 bg-red-100 rounded border border-red-300">
            {apiError}
          </div>
        )}

        <div className="mb-6 max-h-72 overflow-y-auto pr-2 text-sm text-gray-700 space-y-3">
          <p>
            This application is designed to help you build and maintain your family tree and share memories with your trusted
            family members. By using the application, you agree to provide accurate information about yourself and any family
            members you add.
          </p>
          <p>
            When you add details about your family members, you confirm that you have their permission where required by law,
            and that you will not provide fake, misleading, or harmful contact information.
          </p>
          <p>
            You are responsible for keeping your login credentials confidential and for all activities that occur under your
            account. You agree not to share your password or allow others to use your account.
          </p>
          <p>
            Non-app users are family members who do not have their own login. For these members, only general information
            should be stored. You must not use dummy or fabricated email addresses or phone numbers for them. Where contact
            details are unknown, you must leave those fields empty.
          </p>
          <p>
            You agree not to upload content that is unlawful, abusive, harassing, defamatory, or that violates the privacy or
            rights of others. We reserve the right to remove content that violates these rules and, if necessary, to restrict or
            disable your access.
          </p>
          <p>
            We may update these Terms & Conditions from time to time. When we do, we will update the version number displayed
            here. If there are material changes, you may be asked to review and accept the updated terms before continuing to
            use the application.
          </p>
          <p className="font-semibold">Current terms version: v1.0.0</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-start space-x-2">
            <input
              id="acceptTerms"
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
            />
            <label htmlFor="acceptTerms" className="text-sm text-gray-700">
              I agree to the Terms & Conditions and confirm that I have permission to share my family members' information and
              will provide only valid contact details
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

export default TermsAndConditions;
