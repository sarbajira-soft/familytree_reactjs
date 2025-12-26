import axios from 'axios';
import { MEDUSA_BASE_URL, MEDUSA_PUBLISHABLE_KEY, buildJsonHeaders } from '../utils/constants';

const client = axios.create({
  baseURL: MEDUSA_BASE_URL,
  headers: {
    'x-publishable-api-key': MEDUSA_PUBLISHABLE_KEY,
  },
});

function extractToken(data) {
  if (!data) return null;
  if (typeof data === 'string') return data;
  return data.token || data.access_token || data.bearer_token || null;
}

export async function registerCustomer({ email, password }) {
  const res = await client.post(
    '/auth/customer/emailpass/register',
    { email, password },
    { headers: buildJsonHeaders() },
  );

  const token = extractToken(res.data);
  return { token };
}

export async function completeCustomerProfile(token, profile) {
  const res = await client.post(
    '/store/customers',
    profile,
    { headers: buildJsonHeaders(token) },
  );

  const customer = res.data?.customer || res.data;
  return { customer };
}

export async function loginCustomer({ email, password }) {
  const res = await client.post(
    '/auth/customer/emailpass',
    { email, password },
    { headers: buildJsonHeaders() },
  );

  const token = extractToken(res.data) || res.data?.token;

  if (!token) {
    throw new Error('Login succeeded but no token was returned.');
  }

  const { customer } = await getCustomerProfile(token);

  return { token, customer };
}

export async function loginCustomerViaAppSso(appAccessToken) {
  if (!appAccessToken) {
    throw new Error('Missing app access token');
  }

  const res = await client.post(
    '/store/app-sso/login',
    {},
    {
      headers: {
        ...buildJsonHeaders(),
        Authorization: `Bearer ${appAccessToken}`,
      },
    },
  );

  const token = extractToken(res.data);
  if (!token) {
    throw new Error('SSO login succeeded but no token was returned.');
  }

  const { customer } = await getCustomerProfile(token);
  return { token, customer };
}

export async function getCustomerProfile(token) {
  const res = await client.get('/store/customers/me', {
    headers: buildJsonHeaders(token),
  });

  const customer = res.data?.customer || res.data;
  return { customer };
}

export async function updateCustomerProfile(token, body) {
  const res = await client.post(
    '/store/customers/me',
    body,
    { headers: buildJsonHeaders(token) },
  );

  const customer = res.data?.customer || res.data;
  return { customer };
}

export async function listCustomerAddresses(token) {
  const res = await client.get('/store/customers/me/addresses', {
    headers: buildJsonHeaders(token),
  });

  const data = res.data;
  if (Array.isArray(data?.addresses)) return data.addresses;
  if (Array.isArray(data)) return data;
  if (data?.customer && Array.isArray(data.customer.addresses)) return data.customer.addresses;
  return [];
}

export async function addCustomerAddress(token, address) {
  const res = await client.post(
    '/store/customers/me/addresses',
    address,
    { headers: buildJsonHeaders(token) },
  );

  const customer = res.data?.customer || res.data;
  return { customer };
}

export async function updateCustomerAddress(token, addressId, address) {
  const res = await client.post(
    `/store/customers/me/addresses/${addressId}`,
    address,
    { headers: buildJsonHeaders(token) },
  );

  const customer = res.data?.customer || res.data;
  return { customer };
}

export async function deleteCustomerAddress(token, addressId) {
  await client.delete(`/store/customers/me/addresses/${addressId}`, {
    headers: buildJsonHeaders(token),
  });

  // The delete endpoint often returns a minimal wrapper with `deleted: true` and a
  // `parent` object that does not include the updated addresses array. To keep the
  // frontend state accurate (and avoid clearing all addresses locally), re-fetch
  // the full customer profile after deletion.
  const { customer } = await getCustomerProfile(token);
  return { customer };
}
