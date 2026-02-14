const {
  VITE_MEDUSA_BASE_URL,
  VITE_MEDUSA_PUBLISHABLE_KEY,
  VITE_MEDUSA_TOKEN_KEY,
  VITE_MEDUSA_CART_ID_KEY,
  VITE_DEFAULT_CURRENCY_CODE,
  VITE_DEFAULT_LOCALE,
  VITE_DEFAULT_TAX_RATE,
} = import.meta.env;

export const MEDUSA_BASE_URL = VITE_MEDUSA_BASE_URL;

export const MEDUSA_PUBLISHABLE_KEY =
  VITE_MEDUSA_PUBLISHABLE_KEY ;

export const MEDUSA_TOKEN_KEY = VITE_MEDUSA_TOKEN_KEY ;
export const MEDUSA_CART_ID_KEY = VITE_MEDUSA_CART_ID_KEY ;
export const MEDUSA_REGION_ID_KEY = 'medusa_region_id';

export const DEFAULT_CURRENCY_CODE = VITE_DEFAULT_CURRENCY_CODE ;
export const DEFAULT_LOCALE = VITE_DEFAULT_LOCALE;
export const DEFAULT_TAX_RATE =
  typeof VITE_DEFAULT_TAX_RATE !== 'undefined'
    ? Number(VITE_DEFAULT_TAX_RATE)
    : 0.13;

export function buildBaseHeaders(token) {
  const headers = {
    'x-publishable-api-key': MEDUSA_PUBLISHABLE_KEY,
  };

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
