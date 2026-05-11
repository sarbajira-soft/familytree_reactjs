import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useUser } from '../Contexts/UserContext';
import { getToken } from '../utils/auth';
import SharedGalleryView from '../Components/SharedGalleryView';

const PublicSharedGalleryPage = () => {
  const { shareId } = useParams();
  const { userInfo, userLoading } = useUser();
  const token = getToken();

  if (token && userLoading && !userInfo) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eff6ff_100%)] px-4 py-10">
        <div className="mx-auto max-w-3xl animate-pulse rounded-[32px] border border-gray-200 bg-white p-6 shadow-xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-gray-200" />
            <div className="space-y-2">
              <div className="h-4 w-40 rounded bg-gray-200" />
              <div className="h-3 w-24 rounded bg-gray-100" />
            </div>
          </div>
          <div className="h-72 rounded-[28px] bg-gray-100" />
        </div>
      </div>
    );
  }

  if (token && userInfo && shareId) {
    return <Navigate to={`/app/shared-gallery/${encodeURIComponent(shareId)}`} replace />;
  }

  return <SharedGalleryView context="web" />;
};

export default PublicSharedGalleryPage;
