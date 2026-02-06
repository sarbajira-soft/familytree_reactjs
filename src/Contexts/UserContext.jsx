import React, { createContext, useState, useEffect, useContext, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { 
  getToken, 
  getUserIdFromToken,
  getUserInfo, 
  setAuthData, 
  clearAuthData, 
  isAuthenticated, 
  initializeAuth 
} from '../utils/auth';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [userInfo, setUserInfo] = useState(() => {
    // Initialize with user info from localStorage if available
    return getUserInfo();
  });
  
  const [userLoading, setUserLoading] = useState(() => {
    // Initialize as true if there's a token (indicating we need to fetch user data)
    return isAuthenticated();
  });

  // Initialize auth state when context mounts
  useEffect(() => {
    initializeAuth();
  }, []);

  const clearUserData = useCallback(() => {
    setUserInfo(null);
    setUserLoading(false);
    clearAuthData();
  }, []);

  const redirectToLogin = useCallback(() => {
    if (globalThis?.location) {
      globalThis.location.href = '/login';
    }
  }, []);

  const parseChildrenNames = useCallback((childrenNames) => {
    if (!childrenNames) return [];
    if (Array.isArray(childrenNames)) return childrenNames;

    if (typeof childrenNames === 'string') {
      try {
        const parsed = JSON.parse(childrenNames);
        if (Array.isArray(parsed)) return parsed;
      } catch (err) {
        console.warn('Failed to parse childrenNames JSON, falling back to CSV:', err);
      }
      return childrenNames.split(',').map((c) => c.trim());
    }

    return [];
  }, []);

  const toIntOrZero = useCallback((value) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }, []);

  const persistAuthData = useCallback((token, user) => {
    try {
      const stayLoggedIn = localStorage.getItem('stayLoggedIn') === 'true';
      setAuthData(token, user, stayLoggedIn);
    } catch (err) {
      console.warn('Failed to persist auth data:', err);
    }
  }, []);

  const buildMinimalUser = useCallback((token, jsonData) => {
    const data = jsonData?.data || {};
    const tokenUserId = getUserIdFromToken(token);
    const currentUser = jsonData?.currentUser || {};

    const isAppUser =
      typeof data.isAppUser === 'boolean' ? data.isAppUser : !!currentUser.isAppUser;
    const hasAcceptedTerms =
      typeof data.hasAcceptedTerms === 'boolean'
        ? data.hasAcceptedTerms
        : !!currentUser.hasAcceptedTerms;

    return {
      userId: tokenUserId,
      email: data.email || currentUser.email || '',
      countryCode: data.countryCode || currentUser.countryCode || '',
      mobile: data.mobile || currentUser.mobile || '',
      status: data.status || currentUser.status || 0,
      role: data.role || currentUser.role || 0,
      isAppUser,
      hasAcceptedTerms,
      termsVersion: data.termsVersion || 'v1.0.0',
      termsAcceptedAt: data.termsAcceptedAt || null,
      raw: null,
    };
  }, []);

  const handleUnauthorized = useCallback(
    async (response) => {
      try {
        const errJson = await response.json();
        console.error('User session error:', errJson?.message || errJson);
      } catch (err) {
        console.warn('Failed to parse 401 response:', err);
      }

      clearUserData();
      redirectToLogin();
    },
    [clearUserData, redirectToLogin],
  );

  const fetchUserDetails = useCallback(async () => {
    const token = getToken();
    if (!token) {
      console.warn('Authentication token not found or expired.');
      clearUserData();
      return;
    }

    try {
      setUserLoading(true);

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/user/myProfile`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.status === 401) {
        await handleUnauthorized(response);
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch user details');

      const jsonData = await response.json();
      const data = jsonData.data || {};
      const {
        userProfile,
        email,
        countryCode,
        mobile,
        status,
        role,
        isAppUser,
        hasAcceptedTerms,
        termsVersion,
        termsAcceptedAt,
      } = data;

      if (!userProfile) {
        const minimalUser = buildMinimalUser(token, jsonData);
        setUserInfo(minimalUser);
        persistAuthData(token, minimalUser);
        return;
      }

      const childrenArray = parseChildrenNames(userProfile.childrenNames);

      const childFields = {};
      childrenArray.forEach((name, index) => {
        childFields[`childName${index}`] = name;
      });

      setUserInfo({
        userId: userProfile.userId,
        firstName: userProfile.firstName || '',
        lastName: userProfile.lastName || '',
        dob: userProfile.dob?.split('T')[0] || '',
        age: calculateAge(userProfile.dob),
        gender: userProfile.gender || '',
        email: email || userProfile.email || '',
        maritalStatus: userProfile.maritalStatus || '',
        marriageDate: userProfile.marriageDate?.split('T')[0] || '',
        spouseName: userProfile.spouseName || '',
        region: userProfile.region || '',
        childrenCount: childrenArray.length || 0,
        ...childFields, // Safe generated fields like childName0, childName1, etc.

        fatherName: userProfile.fatherName || '',
        motherName: userProfile.motherName || '',
        motherTongue: toIntOrZero(userProfile.languageId),
        religionId: toIntOrZero(userProfile.religionId),
        caste: userProfile.caste || '',
        gothram: toIntOrZero(userProfile.gothramId),
        kuladevata: userProfile.kuladevata || '',
        hobbies: userProfile.hobbies || '',
        likes: userProfile.likes || '',
        dislikes: userProfile.dislikes || '',
        favoriteFoods: userProfile.favoriteFoods || '',
        address: userProfile.address || '',
        contactNumber: userProfile.contactNumber || '',
        bio: userProfile.bio || '',
        profileUrl: userProfile.profile || '',
        // Prefer profile.familyCode as primary; if missing, fall back to membership familyCode
        familyCode: userProfile.familyCode || userProfile.familyMember?.familyCode || '',
        // If no familyMember join row but profile has a familyCode, treat as approved
        approveStatus:
          userProfile.familyMember?.approveStatus ||
          (userProfile.familyCode ? 'approved' : 'pending'),
        name: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim(),
        
        countryCode: countryCode || '',
        mobile: mobile || '',
        status: status || 0,
        role: role || 0,
        isAppUser: typeof isAppUser === 'boolean' ? isAppUser : !!jsonData.currentUser?.isAppUser,
        hasAcceptedTerms: typeof hasAcceptedTerms === 'boolean' ? hasAcceptedTerms : !!jsonData.currentUser?.hasAcceptedTerms,
        termsVersion: termsVersion || 'v1.0.0',
        termsAcceptedAt: termsAcceptedAt || null,

        isPrivate: typeof userProfile.isPrivate === 'boolean' ? userProfile.isPrivate : false,

        raw: userProfile,
      });
      
    } catch (err) {
      console.error('Error fetching user:', err);
      // Only hard-logout on explicit 401 handling above.
      // For other errors (network/server), keep the session so the user isn't
      // unexpectedly logged out during onboarding.
      try {
        const existingUser = getUserInfo();
        if (existingUser) {
          setUserInfo(existingUser);
        } else {
          const tokenUserId = getUserIdFromToken(token);
          setUserInfo({
            userId: tokenUserId,
            email: '',
            mobile: '',
            raw: null,
          });
        }
      } catch (storageError) {
        console.warn('Failed to recover user from storage:', storageError);
      }
    } finally {
      setUserLoading(false);
    }
  }, [buildMinimalUser, clearUserData, handleUnauthorized, parseChildrenNames, persistAuthData, toIntOrZero]);

  useEffect(() => {
    fetchUserDetails();
  }, [fetchUserDetails]);

  // Listen for localStorage changes (when user logs in)
  
  // FIXED: Simplified session management - only handle actual browser close
  useEffect(() => {
    // Set up session management on page load
    const handlePageLoad = () => {
      const stayLoggedIn = localStorage.getItem('stayLoggedIn');
      
      // Only check if this is actually a fresh browser session
      // Use sessionStorage to detect if this is a new browser session vs page refresh
      if (!sessionStorage.getItem('browserSessionActive')) {
        // This is a new browser session
        sessionStorage.setItem('browserSessionActive', 'true');
        
        // If user previously chose not to stay logged in, clear the session
        if (stayLoggedIn === 'false') {
          clearUserData();
          
          // Redirect to login if on a protected page
          const path = globalThis?.location?.pathname;
          if (path && path !== '/login' && path !== '/register') {
            redirectToLogin();
          }
        }
      }
    };

    // Run page load check immediately
    handlePageLoad();

    // REMOVED: beforeunload and visibility change handlers as they were causing issues
    // The session will only be cleared when a new browser session starts (not during page refreshes or form submissions)

  }, [clearUserData, redirectToLogin]);

  const contextValue = useMemo(() => ({
    userInfo,
    userLoading,
    refetchUser: fetchUserDetails,
    logout: clearUserData,
    isPersistentLogin: localStorage.getItem('stayLoggedIn') === 'true',
  }), [userInfo, userLoading, fetchUserDetails, clearUserData]);

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
};

UserProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useUser = () => useContext(UserContext);

// Utility to calculate age from DOB
const calculateAge = (dob) => {
  if (!dob) return 0;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};