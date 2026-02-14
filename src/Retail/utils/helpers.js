import { DEFAULT_CURRENCY_CODE, DEFAULT_LOCALE } from './constants';

export function formatAmount(amount, currencyCode = DEFAULT_CURRENCY_CODE) {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return '₹0';
  const value = amount;
  try {
    return value.toLocaleString(DEFAULT_LOCALE, {
      style: 'currency',
      currency: currencyCode.toUpperCase(),
      maximumFractionDigits: 2,
    });
  } catch {
    return `₹${value.toFixed(2)}`;
  }
}

export function getProductThumbnail(product) {
  if (!product) return 'https://placehold.co/400x300?text=No+Image';
  if (product.thumbnail) return product.thumbnail;
  if (Array.isArray(product.images) && product.images.length > 0) {
    const img = product.images[0];
    if (typeof img === 'string') return img;
    if (img.url) return img.url;
  }
  return 'https://placehold.co/400x300?text=No+Image';
}

export function getProductDefaultVariant(product) {
  if (!product || !Array.isArray(product.variants) || product.variants.length === 0) {
    return null;
  }

  const inrVariant = product.variants.find((variant) =>
    Array.isArray(variant.prices) &&
    variant.prices.some((p) => p.currency_code && p.currency_code.toLowerCase() === DEFAULT_CURRENCY_CODE)
  );

  return inrVariant || product.variants[0];
}

export function getVariantPriceAmount(variant) {
  if (!variant) return 0;

  // console.log("variant -----",variant);

  const calculated = variant.calculated_price || variant.calculatedPrice;
  if (calculated) {
    if (typeof calculated.calculated_amount === 'number') return calculated.calculated_amount;
    if (typeof calculated.original_amount === 'number') return calculated.original_amount;
    if (typeof calculated.amount === 'number') return calculated.amount;
  }

  if (Array.isArray(variant.prices) && variant.prices.length > 0) {
    const inrPrice = variant.prices.find(
      (p) => p.currency_code && p.currency_code.toLowerCase() === DEFAULT_CURRENCY_CODE,
    );
    const price = inrPrice || variant.prices[0];
    if (typeof price.amount === 'number') return price.amount;
  }

  if (typeof variant.price === 'number') return variant.price;
  if (typeof variant.unit_price === 'number') return variant.unit_price;

  return 0;
}

export function calculateCartCount(cart) {
  if (!cart || !Array.isArray(cart.items)) return 0;
  return cart.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
}

export function calculateCartTotals(cart) {
  if (!cart) {
    return {
      subtotal: 0,
      tax: 0,
      shipping: 0,
      total: 0,
    };
  }

  const subtotal = typeof cart.subtotal === 'number' ? cart.subtotal : 0;
  const tax = typeof cart.tax_total === 'number' ? cart.tax_total : 0;
  const shipping = typeof cart.shipping_total === 'number' ? cart.shipping_total : 0;
  const total = typeof cart.total === 'number' ? cart.total : subtotal + tax + shipping;

  return { subtotal, tax, shipping, total };
}

export function isInsufficientInventoryError(error) {
  const data = error?.response?.data;

  const candidates = [
    data,
    data?.error,
    data?.data,
    Array.isArray(data?.errors) ? data.errors[0] : null,
  ].filter(Boolean);

  const matchByCode = (obj) => {
    const code = obj?.code;
    if (typeof code === 'string' && code.toLowerCase() === 'insufficient_inventory') {
      return true;
    }
    return false;
  };

  if (candidates.some(matchByCode)) {
    return true;
  }

  const msg =
    data?.message ||
    data?.error?.message ||
    (Array.isArray(data?.errors) && data.errors.length ? data.errors[0]?.message : null) ||
    error?.message ||
    '';

  const normalized = String(msg).toLowerCase();

  if (normalized.includes('insufficient inventory')) return true;
  if (normalized.includes('required inventory')) return true;
  if (normalized.includes('out of stock')) return true;

  if (typeof data?.type === 'string' && data.type.toLowerCase() === 'not_allowed') {
    if (normalized.includes('variant') && normalized.includes('inventory')) return true;
  }

  return false;
}

export function getErrorMessage(error) {
  if (!error) return 'Something went wrong';
  if (typeof error === 'string') return error;

  const sanitize = (raw) => {
    if (!raw) return 'Something went wrong';
    const msg = String(raw);
    const normalized = msg.toLowerCase();

    if (
      normalized.includes('sales channel') ||
      normalized.includes('stock location') ||
      normalized.includes('is not associated with any stock location')
    ) {
      return 'This item is currently unavailable. Please try again later or choose a different variant.';
    }

    if (normalized.includes('variant') && normalized.includes('not found')) {
      return 'This item is currently unavailable. Please refresh and try again.';
    }

    if (normalized.includes('insufficient inventory') || normalized.includes('out of stock')) {
      return 'This item is out of stock.';
    }

    if (normalized.includes('cart') && normalized.includes('completed')) {
      return 'Your cart is already completed. Please refresh and try again.';
    }

    if (msg.length > 160) {
      return 'Something went wrong. Please try again.';
    }

    return msg;
  };

  if (error.response && error.response.data) {
    const data = error.response.data;
    if (typeof data === 'string') return data;
    if (data.message) return sanitize(data.message);
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return sanitize(data.errors[0].message || data.errors[0]);
    }
  }
  if (error.message) return sanitize(error.message);
  return 'Something went wrong';
}
