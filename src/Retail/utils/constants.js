const {
  VITE_API_BASE_URL,
} = import.meta.env;

export const RETAIL_PROXY_BASE_URL = VITE_API_BASE_URL
  ? `${String(VITE_API_BASE_URL).replace(/\/$/, '')}/retail`
  : '/retail';

export const MEDUSA_TOKEN_KEY = 'medusa_retail_token';
export const MEDUSA_CART_ID_KEY = 'medusa_retail_cart_id';
export const MEDUSA_REGION_ID_KEY = 'medusa_region_id';

export const DEFAULT_CURRENCY_CODE = 'inr';
export const DEFAULT_LOCALE = 'en-IN';

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
