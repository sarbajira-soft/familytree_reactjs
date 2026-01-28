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

export function getErrorMessage(error) {
  if (!error) return 'Something went wrong';
  if (typeof error === 'string') return error;
  if (error.response && error.response.data) {
    const data = error.response.data;
    if (typeof data === 'string') return data;
    if (data.message) return data.message;
    if (Array.isArray(data.errors) && data.errors.length > 0) return data.errors[0].message || data.errors[0];
  }
  if (error.message) return error.message;
  return 'Something went wrong';
}
