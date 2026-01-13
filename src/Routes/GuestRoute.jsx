import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '../Contexts/UserContext';
import LoadingSpinner from '../Components/LoadingSpinner';
import { getToken } from '../utils/auth';

const GuestRoute = ({ children }) => {
  const token = getToken();
  const { userInfo, userLoading } = useUser();

  // If no token, allow access to guest routes
  if (!token) {
    return children;
  }

  // If user context is still loading, show loading spinner
  if (userLoading) {
    return <LoadingSpinner fullScreen={true} text="Loading..." />;
  }

  // Only redirect when we have both a token and resolved userInfo.
  // If token exists but userInfo is missing, allow the guest route to render.
  // (Prevents infinite redirect loops between PrivateRoute -> "/" and GuestRoute -> "/myprofile")
  if (userInfo) {
    return <Navigate to="/myprofile" replace />;
  }

  return children;
};

export default GuestRoute;