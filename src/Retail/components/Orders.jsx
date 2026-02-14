import React, { useEffect, useState } from 'react';
import { FiAlertCircle, FiFilter, FiLoader, FiPackage } from 'react-icons/fi';
import { useRetail } from '../context/RetailContext';
import OrderCard from './OrderCard';
import OrderDetailsModal from './OrderDetailsModal';

const Orders = () => {
  const { orders, fetchOrders, fetchOrdersPage, loading, error, user } = useRetail();

  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [pageOffset, setPageOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 50;

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

  if (!user) {
    return (
      <section className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-12 text-center text-xs text-gray-600">
        <FiPackage className="mb-3 text-4xl text-gray-300" />
        <p className="font-semibold text-gray-800">Sign in to view your orders</p>
        <p className="mt-1 max-w-xs text-xs text-gray-500">
          Once you complete purchases while signed in, your order history will appear here.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
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

      {loading && orders.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white px-4 py-10 text-center text-xs text-gray-600">
          <FiLoader className="mb-3 animate-spin text-2xl text-blue-500" />
          <p>Loading your orders...</p>
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
