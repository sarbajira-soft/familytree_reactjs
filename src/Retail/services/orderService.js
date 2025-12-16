import axios from 'axios';
import {
  MEDUSA_BASE_URL,
  MEDUSA_PUBLISHABLE_KEY,
  buildBaseHeaders,
} from '../utils/constants';

const client = axios.create({
  baseURL: MEDUSA_BASE_URL,
  headers: {
    'x-publishable-api-key': MEDUSA_PUBLISHABLE_KEY,
  },
});

export async function fetchOrders(token) {
  const res = await client.get('/store/orders', {
    headers: buildBaseHeaders(token),
  });

  const data = res.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.orders)) return data.orders;
  if (data && data.orders && Array.isArray(data.orders)) return data.orders;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

export async function retrieveOrder(orderId, token) {
  const res = await client.get(`/store/orders/${orderId}`, {
    headers: buildBaseHeaders(token),
  });

  const data = res.data;
  return data.order || data;
}
