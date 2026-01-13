import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '../Contexts/UserContext';
import LoadingSpinner from '../Components/LoadingSpinner';
import { getToken } from '../utils/auth';
import HomePageShimmer from '../Pages/HomePageShimmer';

const PrivateRoute = ({ children }) => {
  const token = getToken();
  const { userInfo, userLoading } = useUser();
  const location = useLocation();

  const fromPath = `${location.pathname}${location.search || ''}`;

  // If no token, redirect to login
  if (!token) {
    return <Navigate to="/login" state={{ from: fromPath }} replace />;
  }

  if (userLoading) {
    // return <LoadingSpinner fullScreen={true} text="Loading..." />;
    return <HomePageShimmer/>
  }

  if (!userInfo) {
    return <Navigate to="/login" state={{ from: fromPath }} replace />;
  }

  const isOnTermsPage = location.pathname === '/terms';

  if (!isOnTermsPage && userInfo.hasAcceptedTerms === false) {
    return <Navigate to="/terms" replace />;
  }

  // If user is authenticated and context is loaded, allow access
  return children;
};

// New component for role-based access control
const RoleBasedRoute = ({ children, allowedRoles = [], requireFamilyCode = false, requireApprovedStatus = false }) => {
  const token = getToken();
  const { userInfo, userLoading } = useUser();
  const location = useLocation();

  const fromPath = `${location.pathname}${location.search || ''}`;

  // If no token, redirect to login
  if (!token) {
    return <Navigate to="/login" state={{ from: fromPath }} replace />;
  }

  // If still loading user info, show loading spinner
  if (userLoading) {
    return <LoadingSpinner fullScreen={true} text="Loading user information..." />;
  }

  // If no user info, redirect to login
  if (!userInfo) {
    return <Navigate to="/login" state={{ from: fromPath }} replace />;
  }

  // Check role requirements
  if (allowedRoles.length > 0 && !allowedRoles.includes(userInfo.role)) {
    return <Navigate to="/myprofile" replace />;
  }

  // Check familyCode requirement
  if (requireFamilyCode && (!userInfo.familyCode || userInfo.familyCode === '')) {
    return <Navigate to="/myprofile" replace />;
  }

  // Check approvedStatus requirement
  if (requireApprovedStatus && userInfo.approveStatus !== 'approved') {
    return <Navigate to="/myprofile" replace />;
  }

  return children;
};

export default PrivateRoute;
export { RoleBasedRoute };
