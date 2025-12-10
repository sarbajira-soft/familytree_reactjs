import React, { createContext, useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { 
  getToken, 
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
        // Treat 401 from myProfile as invalid session
        try {
          const errJson = await response.json();
          console.error('User session error:', errJson?.message || errJson);
        } catch (_) {
          // ignore json parse errors
        }
        clearUserData();
        window.location.href = '/login';
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch user details');

      const jsonData = await response.json();
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
      } = jsonData.data || {};
      
      if (!userProfile) throw new Error('No user profile returned');

      let childrenArray = [];

      if (userProfile.childrenNames) {
        try {
          // If it's valid JSON (e.g. '["Son", "Daugther"]')
          childrenArray = JSON.parse(userProfile.childrenNames);
          if (!Array.isArray(childrenArray)) {
            childrenArray = userProfile.childrenNames.split(',').map(c => c.trim());
          }
        } catch (err) {
          // Fallback: treat as comma-separated string
          childrenArray = userProfile.childrenNames.split(',').map(c => c.trim());
        }
      }

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
        motherTongue: parseInt(userProfile.languageId) || 0,
        religionId: parseInt(userProfile.religionId) || 0,
        caste: userProfile.caste || '',
        gothram: parseInt(userProfile.gothramId) || 0,
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

        raw: userProfile,
      });
      
    } catch (err) {
      console.error('Error fetching user:', err);
      // If we cannot load the user while a token exists, treat this as an
      // invalid session and clear all auth state to avoid redirect loops
      // between GuestRoute and PrivateRoute.
      clearUserData();
    } finally {
      setUserLoading(false);
    }
  }, [clearUserData]);

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
          clearAuthData();
          clearUserData();
          
          // Redirect to login if on a protected page
          if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
            window.location.href = '/login';
          }
        }
      }
    };

    // Run page load check immediately
    handlePageLoad();

    // REMOVED: beforeunload and visibility change handlers as they were causing issues
    // The session will only be cleared when a new browser session starts (not during page refreshes or form submissions)

  }, [clearUserData]);

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