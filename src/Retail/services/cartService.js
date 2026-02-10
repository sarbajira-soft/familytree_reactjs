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
  // 1) Load Medusa shipping options that are valid for this cart.
  const baseRes = await client.get('/store/shipping-options', {
    params: { cart_id: cartId },
    headers: buildBaseHeaders(token),
  });

  const baseData = baseRes.data || {};
  let options = [];
  if (Array.isArray(baseData)) {
    options = baseData;
  } else if (Array.isArray(baseData.shipping_options)) {
    options = baseData.shipping_options;
  } else if (Array.isArray(baseData.shippingOptions)) {
    options = baseData.shippingOptions;
  } else if (Array.isArray(baseData.data)) {
    options = baseData.data;
  }

  if (!Array.isArray(options) || options.length === 0) {
    return [];
  }

  // 1.5) Optionally load Shiprocket standard/express metadata (ETA etc.) via
  // the existing custom /store/shipping/rates endpoint. This endpoint uses
  // the same aggregation logic as the fulfillment provider but also exposes
  // `eta` and `eta_days` for the selected standard/express choices.
  let shiprocketRates = null;
  try {
    const ratesRes = await client.post(
      '/store/shipping/rates',
      {
        cart_id: cartId,
        // Forward payment mode so the backend can distinguish COD vs online.
        payment_mode: paymentMode || undefined,
      },
      { headers: buildJsonHeaders(token) },
    );

    shiprocketRates = ratesRes.data || null;
  } catch (e) {
    // If this call fails for any reason, we still proceed with calculated
    // pricing; we just won't have dynamic ETA metadata.
    shiprocketRates = null;
  }

  // 2) For options with price_type="calculated", ask Medusa to calculate
  // their price using the associated fulfillment provider (Shiprocket).
  const enriched = await Promise.all(
    options.map(async (opt) => {
      const priceType = (opt.price_type || opt.priceType || '').toString().toLowerCase();

      if (priceType !== 'calculated') {
        return opt;
      }

      try {
        const res = await client.post(
          `/store/shipping-options/${opt.id}/calculate`,
          {
            cart_id: cartId,
            // Forward a minimal hint about payment mode so the provider
            // can distinguish COD vs online if needed.
            data: paymentMode ? { payment_mode: paymentMode } : {},
          },
          { headers: buildJsonHeaders(token) },
        );

        const payload = res.data || {};
        const so = payload.shipping_option || payload.shippingOption || null;
        const calc = so?.calculated_price || so?.calculatedPrice || null;
        const calculated =
          typeof calc?.calculated_amount === 'number'
            ? calc.calculated_amount
            : typeof so?.amount === 'number'
            ? so.amount
            : null;

        if (calculated == null) {
          return opt;
        }

        // Merge expected delivery date metadata when available. We only do
        // this for Shiprocket-backed options, and we rely on the option's
        // data.id / data.name to distinguish standard vs express.
        let metadata = opt.metadata || null;

        const providerId = (opt.provider_id || opt.providerId || '').toString().toLowerCase();

        if (shiprocketRates && providerId.includes('shiprocket')) {
          const dataObj = (opt.data || {});
          const idOrNameRaw =
            (typeof dataObj.id === 'string' && dataObj.id) ||
            (typeof dataObj.name === 'string' && dataObj.name) ||
            '';

          const idOrName = idOrNameRaw.toString().toLowerCase();
          const isExpress = idOrName.includes('express');

          const rateBlock = isExpress
            ? shiprocketRates.express || shiprocketRates.standard || null
            : shiprocketRates.standard || shiprocketRates.express || null;

          if (rateBlock) {
            const nextMeta = { ...(metadata || {}) };

            if (typeof rateBlock.eta === 'string') {
              nextMeta.eta = rateBlock.eta;
            }

            if (typeof rateBlock.eta_days === 'number') {
              nextMeta.eta_days = rateBlock.eta_days;
            }

            metadata = nextMeta;
          }
        }

        const enrichedOpt = {
          ...opt,
          amount: calculated,
        };

        if (metadata) {
          enrichedOpt.metadata = metadata;
        }

        return enrichedOpt;
      } catch {
        // If calculation fails, fall back to the original option.
        return opt;
      }
    }),
  );

  return enriched;
}

export async function clearShippingMethods(cartId, token) {
  const cart = await getCart(cartId, token);
  const methods = Array.isArray(cart.shipping_methods)
    ? cart.shipping_methods
    : Array.isArray(cart.shippingMethods)
    ? cart.shippingMethods
    : [];

  if (!methods.length) {
    return cart;
  }

  for (const method of methods) {
    if (!method || !method.id) continue;
    try {
      await client.delete(
        `/store/carts/${cartId}/shipping-methods/${method.id}`,
        { headers: buildBaseHeaders(token) },
      );
    } catch {
      // ignore and continue deleting others
    }
  }

  const refreshed = await getCart(cartId, token);
  return refreshed;
}

export async function addShippingMethod({ cartId, optionId, data = {}, token }) {
  await clearShippingMethods(cartId, token);

  const body = {
    option_id: optionId,
    data,
  };

  const res = await client.post(`/store/carts/${cartId}/shipping-methods`, body, {
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

export async function verifyRazorpayPayment({
  paymentCollectionId,
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
  token,
}) {
  const res = await client.post(
    '/store/payments/razorpay/verify',
    {
      payment_collection_id: paymentCollectionId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    },
    { headers: buildJsonHeaders(token) },
  );

  return res.data;
}
