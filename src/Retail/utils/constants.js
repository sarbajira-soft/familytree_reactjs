const {
  VITE_API_BASE_URL,
} = import.meta.env;

export const RETAIL_PROXY_BASE_URL = VITE_API_BASE_URL
  ? `${String(VITE_API_BASE_URL).replace(/\/$/, '')}/retail`
  : '/retail';

export let MEDUSA_TOKEN_KEY = 'medusa_retail_token';
export let MEDUSA_CART_ID_KEY = 'medusa_retail_cart_id';
export const MEDUSA_REGION_ID_KEY = 'medusa_region_id';

export let DEFAULT_CURRENCY_CODE = 'inr';
export let DEFAULT_LOCALE = 'en-IN';

export async function loadRetailConfig() {
  if (typeof window === 'undefined' || !RETAIL_PROXY_BASE_URL) {
    return;
  }

  try {
    const res = await fetch(`${RETAIL_PROXY_BASE_URL}/config`);
    if (!res.ok) {
      return;
    }

    const data = await res.json();

    if (typeof data?.tokenKey === 'string' && data.tokenKey.trim()) {
      MEDUSA_TOKEN_KEY = data.tokenKey.trim();
    }

    if (typeof data?.cartIdKey === 'string' && data.cartIdKey.trim()) {
      MEDUSA_CART_ID_KEY = data.cartIdKey.trim();
    }

    if (typeof data?.defaultCurrencyCode === 'string' && data.defaultCurrencyCode.trim()) {
      DEFAULT_CURRENCY_CODE = data.defaultCurrencyCode.trim().toLowerCase();
    }

    if (typeof data?.defaultLocale === 'string' && data.defaultLocale.trim()) {
      DEFAULT_LOCALE = data.defaultLocale.trim();
    }

    
  } catch {
    // Keep frontend-safe defaults when backend config isn't reachable.
  }
}

export function buildBaseHeaders(token) {
  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

export function buildJsonHeaders(token) {
  return {
    ...buildBaseHeaders(token),
    'Content-Type': 'application/json',
  };
}
