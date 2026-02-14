import React, { useMemo, useState } from 'react';
import { FiAlertCircle, FiArrowLeft, FiArrowRight, FiShoppingCart } from 'react-icons/fi';
import { useRetail } from '../context/RetailContext';
import { formatAmount } from '../utils/helpers';
import CartItem from './CartItem';
import Checkout from './Checkout';
import CartProductDetailModal from './CartProductDetailModal';

const Cart = ({ onContinueShopping, onViewOrders }) => {
  const { cart, totals, loading, error, updateCartQuantity, removeFromCart, refreshCart } = useRetail();

  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [showProductDetail, setShowProductDetail] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState(null);

  const items = cart?.items || [];

  const handleIncrease = async (item) => {
    if (updatingItemId === item.id) return;
    setUpdatingItemId(item.id);
    try {
      await updateCartQuantity(item.id, (item.quantity || 0) + 1);
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleDecrease = async (item) => {
    if ((item.quantity || 0) <= 1) return;
    if (updatingItemId === item.id) return;
    setUpdatingItemId(item.id);
    try {
      await updateCartQuantity(item.id, (item.quantity || 0) - 1);
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleRemove = (item) => {
    removeFromCart({
      lineItemId: item.id,
      variantId: item.variant_id || item.variant?.id,
      quantity: item.quantity,
    });
  };

  const handleViewItemDetails = (item) => {
    const productId = item.product_id || item.product?.id;
    if (!productId) return;
    const variantId = item.variant_id || item.variant?.id;
    setSelectedProductId(productId);
    setSelectedVariantId(variantId || null);
    setShowProductDetail(true);
  };

  const taxIncluded = useMemo(() => {
    return cart?.tax_total != null && cart.tax_total > 0;
  }, [cart]);

  if (showCheckout) {
    return (
      <Checkout
        onBack={() => setShowCheckout(false)}
        onContinueShopping={onContinueShopping}
        onViewOrders={onViewOrders}
      />
    );
  }

  if (!cart || items.length === 0) {
    return (
      <section className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-12 text-center">
        <FiShoppingCart className="mb-3 text-4xl text-gray-300" />
        <h2 className="text-base font-semibold text-gray-800">Your cart is empty</h2>
        <p className="mt-1 text-xs text-gray-500">
          Add products from the store and they will appear here.
        </p>
        {typeof onContinueShopping === 'function' && (
          <button
            type="button"
            onClick={onContinueShopping}
            className="mt-4 inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <FiArrowLeft className="mr-1" /> Continue shopping
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Shopping cart</h2>
          <button
            type="button"
            onClick={refreshCart}
            className="text-xs bg-white text-gray-500 hover:text-blue-600"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <FiAlertCircle className="text-sm" />
            <span className="flex-1 truncate">{error}</span>
          </div>
        )}

        <div className="space-y-3">
          {items.map((item) => (
            <CartItem
              key={item.id}
              item={item}
              onIncrease={() => handleIncrease(item)}
              onDecrease={() => handleDecrease(item)}
              onRemove={() => handleRemove(item)}
              onViewDetails={() => handleViewItemDetails(item)}
              isUpdating={updatingItemId === item.id}
            />
          ))}
        </div>
      </div>

      <aside className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Order summary</h3>

        <div className="space-y-1 text-xs text-gray-600">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span className="font-medium text-gray-900">{formatAmount(totals.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>GST (included)</span>
            <span className="font-medium text-gray-900">{formatAmount(totals.tax)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Shipping</span>
            <span className="font-medium text-gray-900">
              {totals.shipping > 0 ? formatAmount(totals.shipping) : 'Calculated at checkout'}
            </span>
          </div>
          <div className="mt-1 border-t border-gray-100 pt-2 text-sm font-semibold text-gray-900">
            <div className="flex items-center justify-between">
              <span>Total</span>
              <span>{formatAmount(totals.total)}</span>
            </div>
          </div>
          {taxIncluded && (
            <p className="mt-1 text-[11px] text-gray-500">
              Prices are tax inclusive. GST is shown separately in the summary.
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => setShowCheckout(true)}
          className="mt-2 inline-flex items-center justify-center rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 disabled:opacity-50"
        >
          {loading ? 'Preparing checkout...' : (
            <>
              Proceed to checkout <FiArrowRight className="ml-1" />
            </>
          )}
        </button>

        {typeof onContinueShopping === 'function' && (
          <button
            type="button"
            onClick={onContinueShopping}
            className="mt-1 inline-flex  items-center justify-center rounded-full border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:border-blue-400 hover:text-blue-700"
          >
            <FiArrowLeft className="mr-1" /> Continue shopping
          </button>
        )}

        <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
          Secure checkout powered with Razor Pay. Orders will appear in your order history
          after completion.
        </div>
      </aside>

      <CartProductDetailModal
        open={showProductDetail}
        productId={selectedProductId}
        initialVariantId={selectedVariantId}
        onClose={() => {
          setShowProductDetail(false);
          setSelectedProductId(null);
          setSelectedVariantId(null);
        }}
      />
    </section>
  );
};

export default Cart;
