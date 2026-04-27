import React, { useEffect, useState } from 'react';
import {
  FiAlertCircle,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiX,
  FiFilter,
  FiLoader,
  FiPackage,
  FiShield,
} from 'react-icons/fi';
import { useRetail } from '../context/RetailContext';
import OrderCard from './OrderCard';
import OrderDetailsModal from './OrderDetailsModal';

const Orders = () => {
  const {
    orders,
    fetchOrders,
    fetchOrdersPage,
    loading,
    error,
    user,
    paymentRecovery,
    clearPaymentRecovery,
  } = useRetail();

  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [pageOffset, setPageOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 50;
  const paymentRecoveryStatus = (paymentRecovery?.status || '').toString().toLowerCase();
  const showPaymentRecoveryBanner =
    paymentRecovery?.active && paymentRecovery?.presentation !== 'modal';

  useEffect(() => {
    (async () => {
      setPageOffset(0);
      const first = (await fetchOrdersPage({ limit: pageSize, offset: 0, append: false })) || [];
      setHasMore(Array.isArray(first) && first.length === pageSize);
    })();
  }, [fetchOrdersPage]);

  const sortedOrders = [...orders];

  const filteredOrders = sortedOrders.filter((order) => {
    if (statusFilter === 'all') return true;
    const payment = (order.payment_status || order.paymentStatus || '').toLowerCase();
    const fulfillment = (order.fulfillment_status || order.fulfillmentStatus || order.status || '').toLowerCase();

    if (statusFilter === 'pending') {
      return payment === 'awaiting' || payment === 'pending' || fulfillment === 'not_fulfilled' || fulfillment === 'pending';
    }
    if (statusFilter === 'completed') {
      return payment === 'captured' || payment === 'paid' || fulfillment === 'fulfilled';
    }
    if (statusFilter === 'delivered') {
      return fulfillment === 'delivered' || fulfillment === 'shipped' || fulfillment === 'completed';
    }
    return true;
  });

  if (loading && orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white px-4 py-10 text-center text-xs text-gray-600">
        <FiLoader className="mb-3 animate-spin text-2xl text-blue-500" />
        <p>Loading your orders...</p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      {showPaymentRecoveryBanner && (
        <div className="overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.10)]">
          <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 px-5 py-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
                <FiCheckCircle className="text-2xl" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-50/90">
                  Secure Checkout
                </p>
                <h2 className="text-lg font-semibold">
                  {paymentRecoveryStatus === 'completed'
                    ? 'Order created successfully'
                    : paymentRecoveryStatus === 'pending_capture'
                    ? 'Waiting for payment capture'
                    : ['failed', 'expired', 'abandoned'].includes(paymentRecoveryStatus)
                    ? 'Payment update available'
                    : 'Payment received'}
                </h2>
              </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  clearPaymentRecovery && clearPaymentRecovery();
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Close payment status"
              >
                <FiX className="text-lg" />
              </button>
            </div>
          </div>

          <div className="space-y-4 px-5 py-5">
            <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 px-4 py-4 text-emerald-900">
              {paymentRecoveryStatus === 'completed' ? (
                <FiCheck className="mt-0.5 text-lg" />
              ) : ['failed', 'expired', 'abandoned'].includes(paymentRecoveryStatus) ? (
                <FiAlertCircle className="mt-0.5 text-lg" />
              ) : (
                <FiLoader className="mt-0.5 animate-spin text-lg" />
              )}
              <div>
                <p className="text-sm font-semibold">
                  {paymentRecoveryStatus === 'completed'
                    ? 'Your order is ready'
                    : ['failed', 'expired', 'abandoned'].includes(paymentRecoveryStatus)
                    ? 'We could not confirm the payment'
                    : 'Finalizing your order'}
                </p>
                <p className="mt-1 text-sm leading-6 text-emerald-900/80">
                  {paymentRecovery?.message ||
                    (paymentRecoveryStatus === 'completed'
                      ? 'Your payment was verified and the order was created successfully.'
                      : paymentRecoveryStatus === 'pending_capture'
                      ? 'Your bank has authorized the payment. We are waiting for final capture confirmation before placing the order.'
                      : ['failed', 'expired', 'abandoned'].includes(paymentRecoveryStatus)
                      ? 'We could not finalize the payment. If the amount was deducted, the bank or gateway may auto-reverse it.'
                      : 'Payment received. We are finalizing your order securely.')}
                </p>
                {paymentRecoveryStatus === 'completed' && paymentRecovery?.order ? (
                  <p className="mt-2 text-xs font-semibold text-emerald-800">
                    Order #
                    {paymentRecovery.order?.display_id ||
                      paymentRecovery.order?.displayId ||
                      paymentRecovery.order?.id ||
                      ''}
                    {' '}has been created.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <FiShield className="text-emerald-600" />
                  Payment protected
                </div>
                <p className="mt-2 text-xs leading-5 text-gray-600">
                  {paymentRecoveryStatus === 'completed'
                    ? 'Your payment was verified successfully and the backend has already created the order.'
                    : ['failed', 'expired', 'abandoned'].includes(paymentRecoveryStatus)
                    ? 'The payment could not be confirmed. Please avoid retrying immediately if money was already deducted.'
                    : 'Your payment was received and is being verified on the server before the order is placed.'}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <FiClock className="text-emerald-600" />
                  Orders will refresh here
                </div>
                <p className="mt-2 text-xs leading-5 text-gray-600">
                  {paymentRecoveryStatus === 'completed'
                    ? 'You can close this banner anytime. Your new order is now available in the list below.'
                    : ['failed', 'expired', 'abandoned'].includes(paymentRecoveryStatus)
                    ? 'You can close this banner after reviewing the payment status.'
                    : 'We are checking your payment status automatically. Your order history will update once it completes.'}
                </p>
              </div>
            </div>

            <p className="text-center text-xs text-gray-500">
              {paymentRecoveryStatus === 'completed'
                ? 'This banner will stay here until you close it.'
                : ['failed', 'expired', 'abandoned'].includes(paymentRecoveryStatus)
                ? 'If the amount was deducted, do not pay again immediately. The gateway or bank may still auto-reverse it.'
                : 'If the amount was deducted, do not retry payment. We&apos;ll either confirm the order or the payment will be auto-reversed/refunded by the bank.'}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Order history</h2>
          <p className="hidden text-xs text-gray-500 md:block">Track your past purchases and reorder items.</p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="relative">
            <FiFilter className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-40 appearance-none rounded-full border border-gray-200 bg-white py-1.5 pl-7 pr-6 text-[11px] text-gray-700 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="delivered">Delivered</option>
            </select>
          </div>
          <span className="text-[11px] text-gray-500">
            {filteredOrders.length} order{filteredOrders.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <FiAlertCircle className="text-sm" />
          <span className="flex-1 truncate">{error}</span>
        </div>
      )}

      {!loading && orders.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-12 text-center text-xs text-gray-600">
          <FiPackage className="mb-3 text-4xl text-gray-300" />
          <p className="font-semibold text-gray-800">No orders yet</p>
          <p className="mt-1 max-w-xs text-xs text-gray-500">
            When you place orders using this store, they will appear here for easy tracking and
            reordering.
          </p>
        </div>
      )}

      {orders.length > 0 && (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onViewDetails={() => setSelectedOrderId(order.id)}
            />
          ))}
        </div>
      )}

      {user && orders.length > 0 && hasMore && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={async () => {
              const nextOffset = pageOffset + pageSize;
              const next = (await fetchOrdersPage({ limit: pageSize, offset: nextOffset, append: true })) || [];
              setPageOffset(nextOffset);
              setHasMore(Array.isArray(next) && next.length === pageSize);
            }}
            disabled={loading}
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:border-blue-400 hover:text-blue-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}

      <OrderDetailsModal
        open={!!selectedOrderId}
        orderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
      />

      {loading && orders.length > 0 && (
        <div className="mt-2 flex items-center justify-center gap-2 text-[11px] text-gray-500">
          <FiLoader className="animate-spin" />
          <span>Refreshing orders...</span>
        </div>
      )}
    </section>
  );
};

export default Orders;
