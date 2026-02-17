import { clearAuthData, getToken } from './auth';
import { throwIfNotOk } from './apiMessages';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const isJwtExpired = (token) => {
  try {
    if (!token) return true;

    const parts = String(token).split('.');
    if (parts.length !== 3) return false;

    const base64Url = parts[1];
    const base64 = base64Url.replaceAll('-', '+').replaceAll('_', '/');
    const payload = JSON.parse(
  decodeURIComponent(
    atob(base64)
      .split('')
      .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  )
);

    const exp = Number(payload?.exp);
    if (!Number.isFinite(exp) || exp <= 0) return false;
    return Date.now() >= exp * 1000;
  } catch (_) {
    return false;
  }
};

export const authFetchResponse = async (endpoint, options = {}) => {

  console.log("-------authFetchResponse Centeralized--------");
 
  const token = getToken();
  const { skipThrow, ...fetchOptions } = options || {};
  const isFormData =
    typeof FormData !== 'undefined' && fetchOptions?.body instanceof FormData;

  if (token && isJwtExpired(token)) {
    clearAuthData();

    try {
      const path = globalThis?.location?.pathname;
      if (path && path !== '/login' && path !== '/register') {
        globalThis.location.href = '/login';
      }
    } catch (_) {
      // ignore
    }

    return new Response(JSON.stringify({ message: 'Session expired' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const headers = {
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...(token && { Authorization: `Bearer ${token}` }),
    ...fetchOptions.headers,
  };

  const url = /^https?:\/\//i.test(String(endpoint || ''))
    ? endpoint
    : `${API_BASE_URL}${endpoint}`;

  let response;
  try {
    response = await fetch(url, {
      ...fetchOptions,
      headers,
    });
  } catch (_) {
    if (!skipThrow) {
      throw new Error('Network error. Please check your internet connection and try again.');
    }

    return new Response(
      JSON.stringify({ message: 'Network error. Please check your internet connection and try again.' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  if (response?.status === 401) {
    clearAuthData();

    try {
      const path = globalThis?.location?.pathname;
      if (path && path !== '/login' && path !== '/register') {
        globalThis.location.href = '/login';
      }
    } catch (_) {
      // ignore
    }
  }

  if (!skipThrow) {
    await throwIfNotOk(response, {
      fallback: 'We couldn’t complete your request right now. Please try again.',
    });
  }

  return response;
};

export const authFetch = async (endpoint, options = {}) => {
  const response = await authFetchResponse(endpoint, options);

  try {
    return await response.json();
  } catch (_) {
    return null;
  }
};
