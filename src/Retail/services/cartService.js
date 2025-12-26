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

export async function getShippingOptions(cartId, token, paymentMode) {
  // 1) Load real Medusa shipping options that are valid for this cart.
  const baseRes = await client.get('/store/shipping-options', {
    params: { cart_id: cartId },
    headers: buildBaseHeaders(token),
  });

  const baseData = baseRes.data || {};
  let baseOptions = [];
  if (Array.isArray(baseData)) {
    baseOptions = baseData;
  } else if (Array.isArray(baseData.shipping_options)) {
    baseOptions = baseData.shipping_options;
  } else if (Array.isArray(baseData.shippingOptions)) {
    baseOptions = baseData.shippingOptions;
  } else if (Array.isArray(baseData.data)) {
    baseOptions = baseData.data;
  }

  // If no base options are available, there is nothing valid we can attach.
  if (!Array.isArray(baseOptions) || baseOptions.length === 0) {
    return [];
  }

  // 2) Fetch dynamic Shiprocket rates (Standard / Express) for this cart,
  // using the current payment mode (e.g., 'cod' vs 'online') so Shiprocket
  // can apply the correct COD flag.
  let dynamic = null;
  try {
    const ratesRes = await client.post(
      '/store/shipping/rates',
      {
        cart_id: cartId,
        payment_type: paymentMode || undefined,
      },
      { headers: buildJsonHeaders(token) },
    );
    dynamic = ratesRes.data || null;
  } catch {
    // If Shiprocket fails, fall back to native prices.
    dynamic = null;
  }

  const standardRate =
    dynamic && dynamic.serviceable !== false && dynamic.standard
      ? dynamic.standard
      : null;
  const expressRate =
    dynamic && dynamic.serviceable !== false && dynamic.express
      ? dynamic.express
      : null;

  // 3) Merge: keep real option IDs, but override label/amount for Standard/Express
  // using Shiprocket rates when available.
  const merged = baseOptions.map((opt) => {
    const typeCode =
      (opt.type && opt.type.code) ||
      opt.code ||
      (typeof opt.name === 'string' ? opt.name.toLowerCase() : '');

    if (typeCode === 'standard' && standardRate && typeof standardRate.amount === 'number') {
      return {
        ...opt,
        label: standardRate.eta
          ? `Standard (${standardRate.eta})`
          : opt.type?.label || opt.name || 'Standard Delivery',
        amount: standardRate.amount,
        metadata: {
          ...(opt.metadata || {}),
          shipping_type: 'standard',
          eta: standardRate.eta || null,
          eta_days: standardRate.eta_days ?? null,
        },
      };
    }

    if (typeCode === 'express' && expressRate && typeof expressRate.amount === 'number') {
      return {
        ...opt,
        label: expressRate.eta
          ? `Express (${expressRate.eta})`
          : opt.type?.label || opt.name || 'Express Delivery',
        amount: expressRate.amount,
        metadata: {
          ...(opt.metadata || {}),
          shipping_type: 'express',
          eta: expressRate.eta || null,
          eta_days: expressRate.eta_days ?? null,
        },
      };
    }

    return opt;
  });

  return merged;
}

export async function addShippingMethod({ cartId, optionId, data = {}, token }) {
  const hasShiprocketAmount =
    data &&
    typeof data.shiprocket_amount === 'number' &&
    !Number.isNaN(data.shiprocket_amount) &&
    data.shiprocket_amount >= 0;

  const endpoint = hasShiprocketAmount
    ? '/store/shiprocket/shipping-method'
    : `/store/carts/${cartId}/shipping-methods`;

  const body = hasShiprocketAmount
    ? {
        cart_id: cartId,
        shipping_option_id: optionId,
        amount: data.shiprocket_amount,
        data,
      }
    : {
        option_id: optionId,
        data,
      };

  const res = await client.post(endpoint, body, {
    headers: buildJsonHeaders(token),
  });

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
