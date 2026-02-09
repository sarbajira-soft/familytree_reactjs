import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	FiLoader,
	FiX,
	FiPackage,
	FiTruck,
	FiCheckCircle,
	FiDownload,
	FiRotateCcw,
} from 'react-icons/fi';
import { useRetail } from '../context/RetailContext';
import { formatAmount, getErrorMessage } from '../utils/helpers';

const OrderDetailsModal = ({ open, orderId, onClose }) => {
  const { retrieveOrder, createReturn } = useRetail();

  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [order, setOrder] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

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
  const primaryTitle = items[0]?.title || 'Order details';
  const headerTitle = items.length > 1 ? `${primaryTitle} + ${items.length - 1} more` : primaryTitle;

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
  const orderContext = order?.context || order?.cart?.context || {};

  const orderStatusRaw = order?.status || '';
  const orderStatusLower = String(orderStatusRaw || '').toLowerCase();
  const fulfillmentLower = String(fulfillmentStatus || '').toLowerCase();

  const isCancelled =
    orderStatusLower === 'canceled' ||
    orderStatusLower === 'cancelled' ||
    fulfillmentLower === 'canceled' ||
    fulfillmentLower === 'cancelled';

  const isDelivered =
    fulfillmentLower === 'delivered' || fulfillmentLower === 'partially_delivered';

  let progressStage = 0;
  if (['fulfilled', 'confirmed'].includes(fulfillmentLower)) {
    progressStage = 1;
  } else if (['shipped', 'partially_shipped'].includes(fulfillmentLower)) {
    progressStage = 2;
  } else if (['in_transit', 'out_for_delivery'].includes(fulfillmentLower)) {
    progressStage = 3;
  } else if (['delivered', 'partially_delivered'].includes(fulfillmentLower)) {
    progressStage = 4;
  }

  const stepPlaced = true;
  const stepFulfilled = progressStage >= 1;
  const stepShipped = progressStage >= 2;
  const stepOutForDelivery = progressStage >= 3;
  const stepDelivered = progressStage >= 4;

  const isReturnable = isDelivered && !isCancelled;

  const activeCircleClasses =
    'flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white';
  const inactiveCircleClasses =
    'flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-400';
  const activeLineClasses = 'h-0.5 flex-1 bg-green-500';
  const inactiveLineClasses = 'h-0.5 flex-1 bg-gray-200';

  const paymentCollection =
    order?.payment_collection ||
    (Array.isArray(order?.payment_collections) ? order.payment_collections[0] : null) ||
    (Array.isArray(order?.paymentCollections) ? order.paymentCollections[0] : null);

  const paymentSessions = Array.isArray(paymentCollection?.payment_sessions)
    ? paymentCollection.payment_sessions
    : Array.isArray(paymentCollection?.paymentSessions)
    ? paymentCollection.paymentSessions
    : [];

  const primarySession = paymentSessions[0] || null;
  const payments = Array.isArray(order?.payments) ? order.payments : [];
  const primaryPayment = payments[0] || null;

  const providerIdRaw =
    primarySession?.provider_id ||
    primarySession?.providerId ||
    primaryPayment?.provider_id ||
    primaryPayment?.providerId ||
    '';

  const sessionData = primarySession?.data || {};

  const contextPaymentRaw =
    (typeof orderContext.payment_type === 'string' && orderContext.payment_type) ||
    (typeof orderContext.payment_mode === 'string' && orderContext.payment_mode) ||
    (typeof orderContext.payment_method === 'string' && orderContext.payment_method) ||
    '';

  const contextPaymentLower = contextPaymentRaw.toLowerCase();

  const paymentStatusLabel = (paymentStatus || 'unknown').replace(/_/g, ' ');
  const paymentStatusLower = (paymentStatus || '').toLowerCase();

  let paymentMethodLabel = 'Cash on delivery';

  const providerIdLower = providerIdRaw.toLowerCase();

  if (
    providerIdLower.includes('razorpay') ||
    sessionData.razorpay_order_id ||
    sessionData.razorpay_payment_id
  ) {
    paymentMethodLabel = 'Online (Razorpay)';
  } else if (
    contextPaymentLower.includes('online') ||
    contextPaymentLower.includes('razorpay') ||
    contextPaymentLower.includes('prepaid') ||
    contextPaymentLower.includes('card') ||
    contextPaymentLower.includes('upi')
  ) {
    paymentMethodLabel = 'Online payment';
  } else if (
    contextPaymentLower.includes('cod') ||
    contextPaymentLower.includes('cash_on_delivery') ||
    contextPaymentLower.includes('cash-on-delivery')
  ) {
    paymentMethodLabel = 'Cash on delivery';
  } else if (
    paymentStatusLower === 'captured' ||
    paymentStatusLower === 'paid' ||
    paymentStatusLower === 'completed' ||
    paymentStatusLower === 'succeeded'
  ) {
    // If we know the payment is fully completed but have no explicit COD hint,
    // assume this was an online/prepaid payment.
    paymentMethodLabel = 'Online payment';
  }

  const providerId = providerIdRaw;

  const razorpayOrderId =
    sessionData.razorpay_order_id ||
    sessionData.order_id ||
    sessionData.razorpayOrderId ||
    null;

  const razorpayPaymentId =
    sessionData.razorpay_payment_id ||
    sessionData.payment_id ||
    sessionData.razorpayPaymentId ||
    null;

  const razorpayStatusRaw =
    sessionData.latest_status ||
    primarySession?.status ||
    paymentCollection?.status ||
    paymentCollection?.payment_status ||
    null;

  const razorpayStatus = razorpayStatusRaw ? String(razorpayStatusRaw).replace(/_/g, ' ') : null;
  const paymentStatusClass =
    paymentStatusLower === 'captured' || paymentStatusLower === 'paid'
      ? 'text-sm font-semibold text-green-600'
      : 'text-sm font-semibold text-gray-900';

  const handleCreateReturn = async () => {
    if (!order || actionLoading || !isReturnable) return;
    const confirmed = window.confirm('Do you want to request a return and refund for this order?');
    if (!confirmed) return;
    const returnItems = items.map((item) => ({
      item_id: item.id,
      quantity: typeof item.quantity === 'number' ? item.quantity : 1,
    }));
    if (!returnItems.length) {
      setActionError('No items available to return.');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const createdReturn = await createReturn({
        orderId: order.id,
        items: returnItems,
      });
      if (createdReturn && createdReturn.id) {
        setActionSuccess('Return request created successfully.');
      } else {
        setActionSuccess('Return request created.');
      }
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadInvoice = () => {
    if (!order) return;
    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) {
      setActionError('Unable to open invoice window. Please allow popups in your browser.');
      return;
    }
    const documentTitle = `Invoice_${order.display_id || order.id || ''}`;
    const customerName =
      (shippingAddress && ((shippingAddress.first_name || '') + ' ' + (shippingAddress.last_name || ''))) ||
      '';
    const linesHtml = items
      .map((item) => {
        const lineTotalValue = item.total || (item.unit_price || 0) * (item.quantity || 0);
        const lineTotalFormatted = formatAmount(lineTotalValue);
        return `<tr><td style="padding:4px 8px;border:1px solid #e5e7eb;font-size:12px;">${item.title || ''}</td><td style="padding:4px 8px;border:1px solid #e5e7eb;font-size:12px;text-align:center;">${item.quantity || 1}</td><td style="padding:4px 8px;border:1px solid #e5e7eb;font-size:12px;text-align:right;">${lineTotalFormatted}</td></tr>`;
      })
      .join('');
    const customerHtml = customerName
      ? '<p style="font-size:12px;margin:0 0 4px;">Customer: ' + customerName + '</p>'
      : '';
    const shippingBlock = shippingAddress
      ? `
        <h2>Shipping address</h2>
        <p style="font-size:12px;margin:0 0 2px;">${(shippingAddress.first_name || '') + ' ' + (shippingAddress.last_name || '')}</p>
        <p style="font-size:12px;margin:0 0 2px;">${shippingAddress.address_1 || ''}</p>
        ${shippingAddress.address_2 ? `<p style="font-size:12px;margin:0 0 2px;">${shippingAddress.address_2}</p>` : ''}
        <p style="font-size:12px;margin:0 0 2px;">${[shippingAddress.city, shippingAddress.province, shippingAddress.postal_code].filter(Boolean).join(', ')}</p>
        ${shippingAddress.country_code ? `<p style="font-size:12px;margin:0 0 2px;">${String(shippingAddress.country_code).toUpperCase()}</p>` : ''}
        ${shippingAddress.phone ? `<p style="font-size:12px;margin:0 0 2px;">${shippingAddress.phone}</p>` : ''}
      `
      : `
        <h2>Shipping address</h2>
        <p style="font-size:12px;margin:0 0 2px;">Not available</p>
      `;
    const billingBlock = billingAddress
      ? `
        <h2>Billing address</h2>
        <p style="font-size:12px;margin:0 0 2px;">${(billingAddress.first_name || '') + ' ' + (billingAddress.last_name || '')}</p>
        <p style="font-size:12px;margin:0 0 2px;">${billingAddress.address_1 || ''}</p>
        ${billingAddress.address_2 ? `<p style="font-size:12px;margin:0 0 2px;">${billingAddress.address_2}</p>` : ''}
        <p style="font-size:12px;margin:0 0 2px;">${[billingAddress.city, billingAddress.province, billingAddress.postal_code].filter(Boolean).join(', ')}</p>
        ${billingAddress.country_code ? `<p style="font-size:12px;margin:0 0 2px;">${String(billingAddress.country_code).toUpperCase()}</p>` : ''}
        ${billingAddress.phone ? `<p style="font-size:12px;margin:0 0 2px;">${billingAddress.phone}</p>` : ''}
      `
      : `
        <h2>Billing address</h2>
        <p style="font-size:12px;margin:0 0 2px;">Not available</p>
      `;
    const deliveryChargeValue = typeof shippingTotal === 'number' ? shippingTotal : 0;
    const deliveryChargeFormatted = formatAmount(deliveryChargeValue);
    const html = `
      <html>
        <head>
          <title>${documentTitle}</title>
          <style>
            body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #111827; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            h2 { font-size: 14px; margin: 12px 0 4px; }
            table { border-collapse: collapse; width: 100%; margin-top: 8px; }
          </style>
        </head>
        <body>
          <h1>Invoice</h1>
          <p style="font-size:12px;margin:0 0 4px;">Order ${order.display_id || order.id || ''}</p>
          <p style="font-size:12px;margin:0 0 4px;">Date: ${dateLabel || ''}</p>
          ${customerHtml}
          <h2>Items</h2>
          <table>
            <thead>
              <tr>
                <th style="padding:4px 8px;border:1px solid #e5e7eb;font-size:12px;text-align:left;">Product</th>
                <th style="padding:4px 8px;border:1px solid #e5e7eb;font-size:12px;text-align:center;">Qty</th>
                <th style="padding:4px 8px;border:1px solid #e5e7eb;font-size:12px;text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${linesHtml}
            </tbody>
          </table>
          <div style="display:flex;gap:16px;margin-top:16px;">
            <div style="flex:1;">
              ${shippingBlock}
            </div>
            <div style="flex:1;">
              ${billingBlock}
            </div>
          </div>
          <h2 style="margin-top:16px;">Summary</h2>
          <p style="font-size:12px;margin:0 0 2px;">Total amount: ${formatAmount(total)}</p>
          <p style="font-size:12px;margin:0 0 2px;">Delivery charge: ${deliveryChargeFormatted}</p>
          <p style="font-size:12px;margin:0 0 2px;">Payment method: ${paymentMethodLabel}</p>
          <p style="font-size:11px;margin-top:16px;color:#6b7280;">Use your browser's Print dialog to save this invoice as PDF.</p>
          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[999] p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h3 className="text-base font-semibold text-gray-900">{headerTitle}</h3>
              <p className="text-[11px] text-gray-500">
                {order ? 'Order details' : 'Loading order'}
                {dateLabel ? ` · ${dateLabel}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-white rounded-full hover:bg-gray-100 text-gray-600"
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
                <div className="rounded-xl border border-gray-100 bg-white p-3">
                  <p className="text-[11px] font-semibold text-gray-900 mb-2">Order progress</p>
                  {isCancelled ? (
                    <p className="text-xs font-semibold text-red-600">This order has been cancelled.</p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-center text-center">
                        <div className={stepPlaced ? activeCircleClasses : inactiveCircleClasses}>
                          <FiPackage className="text-xs" />
                        </div>
                        <span className="mt-1 text-[10px] text-gray-600">Placed</span>
                      </div>
                      <div className={stepFulfilled ? activeLineClasses : inactiveLineClasses} />
                      <div className="flex flex-col items-center text-center">
                        <div className={stepFulfilled ? activeCircleClasses : inactiveCircleClasses}>
                          <FiCheckCircle className="text-xs" />
                        </div>
                        <span className="mt-1 text-[10px] text-gray-600">Fulfilled</span>
                      </div>
                      <div className={stepShipped ? activeLineClasses : inactiveLineClasses} />
                      <div className="flex flex-col items-center text-center">
                        <div className={stepShipped ? activeCircleClasses : inactiveCircleClasses}>
                          <FiTruck className="text-xs" />
                        </div>
                        <span className="mt-1 text-[10px] text-gray-600">Shipped</span>
                      </div>
                      <div className={stepOutForDelivery ? activeLineClasses : inactiveLineClasses} />
                      <div className="flex flex-col items-center text-center">
                        <div className={stepOutForDelivery ? activeCircleClasses : inactiveCircleClasses}>
                          <FiTruck className="text-xs" />
                        </div>
                        <span className="mt-1 text-[10px] text-gray-600">Out for delivery</span>
                      </div>
                      <div className={stepDelivered ? activeLineClasses : inactiveLineClasses} />
                      <div className="flex flex-col items-center text-center">
                        <div className={stepDelivered ? activeCircleClasses : inactiveCircleClasses}>
                          <FiCheckCircle className="text-xs" />
                        </div>
                        <span className="mt-1 text-[10px] text-gray-600">Delivered</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <p className="text-[11px] text-gray-500">Payment status</p>
                    <p className={paymentStatusClass}>{paymentStatusLabel}</p>
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
                  <h4 className="text-xs font-semibold text-gray-900">Payment details</h4>
                  <div className="mt-1 space-y-0.5 text-[11px] text-gray-600">
                    <p>
                      <span className="font-medium text-gray-800">Method: </span>
                      {paymentMethodLabel}
                    </p>
                    {providerId && (
                      <p>
                        <span className="font-medium text-gray-800">Provider ID: </span>
                        {providerId}
                      </p>
                    )}
                    {razorpayOrderId && (
                      <p>
                        <span className="font-medium text-gray-800">Razorpay order ID: </span>
                        {razorpayOrderId}
                      </p>
                    )}
                    {razorpayPaymentId && (
                      <p>
                        <span className="font-medium text-gray-800">Razorpay payment ID: </span>
                        {razorpayPaymentId}
                      </p>
                    )}
                    {razorpayStatus && (
                      <p>
                        <span className="font-medium text-gray-800">Transaction status: </span>
                        {razorpayStatus}
                      </p>
                    )}
                    {!providerId && !razorpayOrderId && !razorpayPaymentId && !razorpayStatus && (
                      <p className="text-gray-500">No additional payment transaction details available.</p>
                    )}
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
                          {(item.product_id || item.product?.id) && (
                            <button
                              type="button"
                              onClick={() => {
                                const productId = item.product_id || item.product?.id;
                                if (!productId) return;
                                onClose();
                                navigate(`/gifts-memories?productId=${productId}`);
                              }}
                              className="mt-1 bg-white inline-flex items-center text-[11px] font-medium text-blue-600 hover:underline"
                            >
                              View item
                            </button>
                          )}
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

                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="flex-1 space-y-1">
                    {actionError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] text-red-700">
                        {actionError}
                      </div>
                    )}
                    {actionSuccess && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] text-emerald-700">
                        {actionSuccess}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {isReturnable && (
                      <button
                        type="button"
                        onClick={handleCreateReturn}
                        disabled={actionLoading}
                        className="inline-flex items-center rounded-full border border-amber-300 px-3 py-1.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <FiRotateCcw className="mr-1" />
                        <span>Request return</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleDownloadInvoice}
                      disabled={actionLoading}
                      className="inline-flex items-center rounded-full bg-gray-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-black disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <FiDownload className="mr-1" />
                      <span>Invoice PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex bg-orange-400 text-white items-center rounded-full border border-gray-200 px-3 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-orange-600 "
                    >
                      <span>Close</span>
                    </button>
                  </div>
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
