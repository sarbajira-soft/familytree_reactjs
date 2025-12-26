import axios from 'axios';
import { MEDUSA_BASE_URL, MEDUSA_PUBLISHABLE_KEY, buildBaseHeaders, buildJsonHeaders } from '../utils/constants';

const client = axios.create({
  baseURL: MEDUSA_BASE_URL,
  headers: {
    'x-publishable-api-key': MEDUSA_PUBLISHABLE_KEY,
  },
});

export async function createCart(token) {
  const res = await client.post(
    '/store/carts',
    {},
    { 
      headers: buildJsonHeaders(token)
     },
  );

  const data = res.data;
  const cart = data.cart || data;
  return cart;
}

export async function getCart(cartId, token) {
  const res = await client.get(`/store/carts/${cartId}`, {
    headers: buildBaseHeaders(token),
  });
  const data = res.data;
  return data.cart || data;
}

export async function addLineItem({ cartId, variantId, quantity, token }) {
  const res = await client.post(
    `/store/carts/${cartId}/line-items`,
    {
      variant_id: variantId,
      quantity,
    },
    { headers: buildJsonHeaders(token) },
  );

  const data = res.data;
  return data.cart || data;
}

export async function updateLineItemQuantity({ cartId, lineItemId, quantity, token }) {
  const res = await client.post(
    `/store/carts/${cartId}/line-items/${lineItemId}`,
    { quantity },
    { headers: buildJsonHeaders(token) },
  );

  const data = res.data;
  return data.cart || data;
}

export async function removeLineItem({ cartId, lineItemId, token }) {
  const res = await client.delete(`/store/carts/${cartId}/line-items/${lineItemId}`, {
    headers: buildBaseHeaders(token),
  });

  const data = res.data;
  // Medusa's line-item delete returns the deleted line item and, in some setups,
  // the updated parent cart under `parent`. Prefer the cart if present.
  if (!data) return null;

  if (data.cart) return data.cart;
  if (data.parent) return data.parent;

  return data;
}

export async function transferCart(cartId, token) {
  const res = await client.post(
    `/store/carts/${cartId}/transfer`,
    {},
    { headers: buildJsonHeaders(token) },
  );

  const data = res.data;
  return data.cart || data;
}

export async function updateCart({ cartId, body, token }) {
  const res = await client.post(
    `/store/carts/${cartId}`,
    body,
    { headers: buildJsonHeaders(token) },
  );

  const data = res.data;
  return data.cart || data;
}

export async function getShippingOptions(cartId, token) {
  const res = await client.get('/store/shipping-options', {
    params: { cart_id: cartId },
    headers: buildBaseHeaders(token),
  });

  const data = res.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.shipping_options)) return data.shipping_options;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

export async function addShippingMethod({ cartId, optionId, data = {}, token }) {
  const res = await client.post(
    `/store/carts/${cartId}/shipping-methods`,
    {
      option_id: optionId,
      data,
    },
    { headers: buildJsonHeaders(token) },
  );

  const payload = res.data;
  return payload.cart || payload;
}

export async function createPaymentCollection(cartId, token) {
  const res = await client.post(
    '/store/payment-collections',
    { cart_id: cartId },
    { headers: buildJsonHeaders(token) },
  );

  const data = res.data;
  const collection = data.payment_collection || data;
  return collection;
}

export async function initPaymentSession({ paymentCollectionId, providerId = 'pp_system_default', token }) {
  const res = await client.post(
    `/store/payment-collections/${paymentCollectionId}/payment-sessions`,
    { provider_id: providerId },
    { headers: buildJsonHeaders(token) },
  );

  const data = res.data;
  return data.payment_collection || data;
}

export async function completeCart(cartId, token) {
  const res = await client.post(
    `/store/carts/${cartId}/complete`,
    {},
    { headers: buildJsonHeaders(token) },
  );

  const data = res.data;
  return data.order || data;
}
