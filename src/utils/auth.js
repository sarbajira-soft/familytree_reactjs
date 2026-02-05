/**
 * Utility functions for handling authentication
 */

// Key names for localStorage
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  USER_INFO: 'userInfo',
  STAY_LOGGED_IN: 'stayLoggedIn',
  SESSION_EXPIRY: 'sessionExpiry'
};

// Session timeout in milliseconds (12 hours)
const SESSION_TIMEOUT = 12 * 60 * 60 * 1000;

/**
 * Extracts user ID from JWT token
 * @param {string} token - JWT token
 * @returns {string|null} User ID or null if invalid token
 */
export const getUserIdFromToken = (token) => {
  try {
    if (!token) return null;
    
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) return null;
    
    const base64Url = tokenParts[1];
    const base64 = base64Url.replaceAll('-', '+').replaceAll('_', '/');
    const payload = JSON.parse(globalThis.atob(base64));
    
    return payload?.id || payload?.sub || payload?.userId || null;
  } catch (error) {
    console.error('Error parsing token:', error);
    return null;
  }
};

/**
 * Gets the current user's ID from local storage
 * @returns {string|null} User ID or null if not logged in
 */
export const getCurrentUserId = () => {
  const token = getToken();
  return token ? getUserIdFromToken(token) : null;
};

/**
 * Get authentication token from storage
 * @returns {string|null} Token or null if not available or expired
 */
export const getToken = () => {
  // Check if session has expired
  const expiryTime = localStorage.getItem(STORAGE_KEYS.SESSION_EXPIRY);
  if (expiryTime && Date.now() > Number(expiryTime)) {
    clearAuthData();
    return null;
  }
  
  return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
};

/**
 * Get user info from storage
 * @returns {Object|null} User info or null if not available
 */
export const getUserInfo = () => {
  const userInfo = localStorage.getItem(STORAGE_KEYS.USER_INFO);
  return userInfo ? JSON.parse(userInfo) : null;
};

/**
 * Set authentication data in storage
 * @param {string} token - JWT token
 * @param {Object} user - User info
 * @param {boolean} stayLoggedIn - Whether to keep the user logged in
 */
export const setAuthData = (token, user, stayLoggedIn = false) => {
  if (!token || !user) return;
  
  // Set token and user info
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
  localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(user));
  localStorage.setItem(STORAGE_KEYS.STAY_LOGGED_IN, stayLoggedIn.toString());
  
  // Set session expiry if not staying logged in
  const expiryTime = stayLoggedIn ? null : Date.now() + SESSION_TIMEOUT;
  return expiryTime
    ? localStorage.setItem(STORAGE_KEYS.SESSION_EXPIRY, expiryTime.toString())
    : localStorage.removeItem(STORAGE_KEYS.SESSION_EXPIRY);
};

/**
 * Clear all authentication data from storage
 */
export const clearAuthData = () => {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
  sessionStorage.removeItem('tempLoginSession');
};

/**
 * Check if user is authenticated
 * @returns {boolean} True if user is authenticated
 */
export const isAuthenticated = () => {
  return Boolean(getToken());
};

/**
 * Initialize authentication state
 * Should be called when app loads
 */
export const initializeAuth = () => {
  // Clear expired session if exists
  const expiryTime = localStorage.getItem(STORAGE_KEYS.SESSION_EXPIRY);
  if (expiryTime && Date.now() > Number(expiryTime)) {
    clearAuthData();
  }
};