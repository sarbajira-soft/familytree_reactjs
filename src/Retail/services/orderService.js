import axios from 'axios';
import {
  MEDUSA_BASE_URL,
  MEDUSA_PUBLISHABLE_KEY,
  buildBaseHeaders,
  buildJsonHeaders,
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

export async function createReturn({ orderId, items, returnShipping, token }) {
	const normalizedItems = Array.isArray(items)
		? items.map((item) => ({
				item_id: item.item_id || item.id,
				quantity: typeof item.quantity === 'number' ? item.quantity : 1,
		  }))
		: [];

	const body = {
		order_id: orderId,
		items: normalizedItems,
	};

	if (returnShipping && returnShipping.option_id) {
		body.return_shipping = { option_id: returnShipping.option_id };
	}

	const res = await client.post('/store/returns', body, {
		headers: buildJsonHeaders(token),
	});

	const data = res.data;
	return data.return || data;
}
