import React, { useEffect, useMemo, useState } from 'react';
import { FiLoader, FiX } from 'react-icons/fi';
import { useRetail } from '../context/RetailContext';
import { formatAmount, getErrorMessage } from '../utils/helpers';

const OrderDetailsModal = ({ open, orderId, onClose }) => {
  const { retrieveOrder } = useRetail();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [order, setOrder] = useState(null);

  useEffect(() => {
    if (!open || !orderId) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    retrieveOrder(orderId)
      .then((data) => {
        if (!mounted) return;
        setOrder(data);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [open, orderId, retrieveOrder]);

  useEffect(() => {
    if (!open) {
      setOrder(null);
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const items = useMemo(() => (Array.isArray(order?.items) ? order.items : []), [order]);

  if (!open) return null;

  const createdAt = order?.created_at || order?.createdAt;
  const dateLabel = createdAt ? new Date(createdAt).toLocaleString('en-IN') : '';

  const total = typeof order?.total === 'number' ? order.total : 0;
  const subtotal = typeof order?.subtotal === 'number' ? order.subtotal : null;
  const taxTotal = typeof order?.tax_total === 'number' ? order.tax_total : null;
  const shippingTotal = typeof order?.shipping_total === 'number' ? order.shipping_total : null;

  const paymentStatus = order?.payment_status || order?.paymentStatus;
  const fulfillmentStatus = order?.fulfillment_status || order?.fulfillmentStatus || order?.status;

  const shippingAddress = order?.shipping_address;
  const billingAddress = order?.billing_address;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[999] p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Order details</h3>
              <p className="text-[11px] text-gray-500">
                {order?.display_id || order?.id ? `Order ${order.display_id || order.id}` : 'Loading order'}
                {dateLabel ? ` · ${dateLabel}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
              aria-label="Close"
            >
              <FiX />
            </button>
          </div>

          <div className="max-h-[75vh] overflow-y-auto px-5 py-4">
            {loading && (
              <div className="flex items-center justify-center py-10 text-sm text-gray-600">
                <FiLoader className="animate-spin mr-2" /> Loading order details...
              </div>
            )}

            {!loading && error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            {!loading && order && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <p className="text-[11px] text-gray-500">Payment status</p>
                    <p className="text-sm font-semibold text-gray-900">{(paymentStatus || 'unknown').replace(/_/g, ' ')}</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <p className="text-[11px] text-gray-500">Fulfillment status</p>
                    <p className="text-sm font-semibold text-gray-900">{(fulfillmentStatus || 'unknown').replace(/_/g, ' ')}</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <p className="text-[11px] text-gray-500">Total</p>
                    <p className="text-sm font-semibold text-gray-900">{formatAmount(total)}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-100 bg-white p-3">
                  <h4 className="text-xs font-semibold text-gray-900">Items</h4>
                  <div className="mt-2 space-y-2">
                    {items.length === 0 && <p className="text-[11px] text-gray-500">No items found on this order.</p>}
                    {items.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-3 border-t border-gray-100 pt-2 first:border-t-0 first:pt-0">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-gray-900">{item.title}</p>
                          {item.variant?.title && (
                            <p className="truncate text-[11px] text-gray-500">Variant: {item.variant.title}</p>
                          )}
                          {item.sku && <p className="truncate text-[11px] text-gray-500">SKU: {item.sku}</p>}
                        </div>
                        <div className="text-right text-[11px] text-gray-600">
                          <p>Qty: {item.quantity}</p>
                          <p>{formatAmount(item.total || (item.unit_price || 0) * (item.quantity || 0))}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-gray-100 bg-white p-3">
                    <h4 className="text-xs font-semibold text-gray-900">Shipping address</h4>
                    <div className="mt-2 text-[11px] text-gray-600 space-y-0.5">
                      {shippingAddress ? (
                        <>
                          <p className="text-gray-900 font-medium">{shippingAddress.first_name || ''} {shippingAddress.last_name || ''}</p>
                          <p>{shippingAddress.address_1}</p>
                          {shippingAddress.address_2 && <p>{shippingAddress.address_2}</p>}
                          <p>
                            {[shippingAddress.city, shippingAddress.province, shippingAddress.postal_code].filter(Boolean).join(', ')}
                          </p>
                          {shippingAddress.country_code && <p className="uppercase">{shippingAddress.country_code}</p>}
                          {shippingAddress.phone && <p>{shippingAddress.phone}</p>}
                        </>
                      ) : (
                        <p className="text-gray-500">Not available</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-white p-3">
                    <h4 className="text-xs font-semibold text-gray-900">Billing address</h4>
                    <div className="mt-2 text-[11px] text-gray-600 space-y-0.5">
                      {billingAddress ? (
                        <>
                          <p className="text-gray-900 font-medium">{billingAddress.first_name || ''} {billingAddress.last_name || ''}</p>
                          <p>{billingAddress.address_1}</p>
                          {billingAddress.address_2 && <p>{billingAddress.address_2}</p>}
                          <p>
                            {[billingAddress.city, billingAddress.province, billingAddress.postal_code].filter(Boolean).join(', ')}
                          </p>
                          {billingAddress.country_code && <p className="uppercase">{billingAddress.country_code}</p>}
                          {billingAddress.phone && <p>{billingAddress.phone}</p>}
                        </>
                      ) : (
                        <p className="text-gray-500">Not available</p>
                      )}
                    </div>
                  </div>
                </div>

                {(subtotal !== null || taxTotal !== null || shippingTotal !== null) && (
                  <div className="rounded-xl border border-gray-100 bg-white p-3">
                    <h4 className="text-xs font-semibold text-gray-900">Summary</h4>
                    <div className="mt-2 space-y-1 text-[11px] text-gray-600">
                      {subtotal !== null && (
                        <div className="flex justify-between">
                          <span>Subtotal</span>
                          <span className="font-medium">{formatAmount(subtotal)}</span>
                        </div>
                      )}
                      {taxTotal !== null && (
                        <div className="flex justify-between">
                          <span>Tax</span>
                          <span className="font-medium">{formatAmount(taxTotal)}</span>
                        </div>
                      )}
                      {shippingTotal !== null && (
                        <div className="flex justify-between">
                          <span>Shipping</span>
                          <span className="font-medium">{formatAmount(shippingTotal)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-gray-100 pt-2">
                        <span className="text-gray-900 font-semibold">Total</span>
                        <span className="text-gray-900 font-semibold">{formatAmount(total)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full border border-gray-200 px-4 py-2 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default OrderDetailsModal;
