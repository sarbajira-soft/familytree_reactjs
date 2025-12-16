export const MEDUSA_BASE_URL = 'http://localhost:9000';

export const MEDUSA_PUBLISHABLE_KEY = 'pk_d6c426b8403ff692eb7bca7f01f6842ab6cfa533efd6e57f23a5eb033b7e41c5';

export const MEDUSA_TOKEN_KEY = 'medusa_retail_token';
export const MEDUSA_CART_ID_KEY = 'medusa_retail_cart_id';

export const DEFAULT_CURRENCY_CODE = 'inr';
export const DEFAULT_LOCALE = 'en-IN';
export const DEFAULT_TAX_RATE = 0.13;

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
