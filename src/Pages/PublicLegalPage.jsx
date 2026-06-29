import React, { useState, useEffect } from 'react';
import AuthLogo from '../Components/AuthLogo';

const PublicLegalPage = () => {
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
    document.title = "Terms and Privacy";
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

  return (
    <div className="min-h-screen w-full bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8 sm:p-12">
        <div className="flex flex-col items-center mb-8 border-b border-gray-200 pb-8">
          <AuthLogo className="w-20 h-20 mb-4" />
          <h1 className="text-3xl font-extrabold text-gray-900 text-center">Terms and Privacy</h1>
          <p className="text-sm text-gray-500 mt-2">
            Please find the current versions of our Terms & Conditions and Privacy Policy below.
          </p>
        </div>

        <div className="space-y-12">
          {/* Terms & Conditions */}
          <section className="prose prose-sm max-w-none">
            <div className="flex justify-between items-baseline mb-4 border-b border-gray-100 pb-2">
              <h2 className="text-2xl font-bold text-gray-800 m-0">{documents.terms.title}</h2>
              <span className="text-xs font-semibold text-gray-400">Version: {documents.terms.version}</span>
            </div>
            <div
              className="text-gray-700 leading-relaxed space-y-4"
              dangerouslySetInnerHTML={{ __html: documents.terms.content }}
            />
          </section>

          {/* Divider */}
          <div className="border-t border-gray-200 my-8"></div>

          {/* Privacy Policy */}
          <section className="prose prose-sm max-w-none">
            <div className="flex justify-between items-baseline mb-4 border-b border-gray-100 pb-2">
              <h2 className="text-2xl font-bold text-gray-800 m-0">{documents.privacy.title}</h2>
              <span className="text-xs font-semibold text-gray-400">Version: {documents.privacy.version}</span>
            </div>
            <div
              className="text-gray-700 leading-relaxed space-y-4"
              dangerouslySetInnerHTML={{ __html: documents.privacy.content }}
            />
          </section>
        </div>
      </div>
    </div>
  );
};

export default PublicLegalPage;
