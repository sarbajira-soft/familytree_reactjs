import axios from 'axios';
import {
  RETAIL_PROXY_BASE_URL,
  buildBaseHeaders,
  buildJsonHeaders,
} from '../utils/constants';

const client = axios.create({
  baseURL: RETAIL_PROXY_BASE_URL,
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

export async function fetchOrdersPaged(token, { limit = 50, offset = 0, order = '-created_at' } = {}) {
  const res = await client.get('/store/orders', {
    headers: buildBaseHeaders(token),
    params: {
      limit,
      offset,
      order,
    },
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

export async function cancelOrder(orderId, token) {
  const res = await client.post(
    `/store/orders/${orderId}/cancel`,
    {},
    {
      headers: buildJsonHeaders(token),
    },
  );

  return res.data?.order || res.data;
}

export async function fetchOrderTracking(orderId, token) {
  const res = await client.get(`/store/orders/${orderId}/tracking`, {
    headers: buildBaseHeaders(token),
  });

  return res.data || null;
}

export async function fetchOrderTimeline(orderId, token) {
  const res = await client.get(`/store/orders/${orderId}/timeline`, {
    headers: buildBaseHeaders(token),
  });

  return res.data || null;
}

export async function fetchOrderInvoice(orderId, token) {
  const res = await client.get(`/store/orders/${orderId}/invoice`, {
    headers: buildBaseHeaders(token),
    responseType: 'text',
  });

  return typeof res.data === 'string' ? res.data : '';
}

export async function fetchReturnReasons(token) {
  const res = await client.get('/store/return-reasons', {
    headers: buildBaseHeaders(token),
    params: {
      limit: 100,
    },
  });

  const data = res.data;
  if (Array.isArray(data?.return_reasons)) return data.return_reasons;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}

async function submitOrderRequest({ orderId, items, note, token, requestType }) {
  const normalizedItems = Array.isArray(items)
    ? items
        .map((item) => ({
          id: item.item_id || item.id,
          quantity: typeof item.quantity === 'number' ? item.quantity : 1,
          reason_id: item.reason_id || null,
          note: item.note || null,
        }))
        .filter((item) => item.id && item.quantity > 0)
    : [];

  const res = await client.post(
    `/store/orders/${orderId}/return-request`,
    {
      request_type: requestType,
      items: normalizedItems,
      note: note || null,
    },
    {
      headers: buildJsonHeaders(token),
    },
  );

  const data = res.data;
  return data.request || data.return || data;
}

export async function createReturn({ orderId, items, note, token }) {
  return await submitOrderRequest({
    orderId,
    items,
    note,
    token,
    requestType: 'return',
  });
}

export async function createRefundRequest({ orderId, items, note, token }) {
  return await submitOrderRequest({
    orderId,
    items,
    note,
    token,
    requestType: 'refund',
  });
}
