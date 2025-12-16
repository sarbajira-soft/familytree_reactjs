import React from 'react';
import { FiPackage, FiTruck, FiCreditCard, FiChevronDown } from 'react-icons/fi';
import { formatAmount } from '../utils/helpers';

const statusBadgeClasses = {
  pending: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  fulfilled: 'bg-green-100 text-green-800',
  delivered: 'bg-green-100 text-green-800',
  canceled: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-700',
  default: 'bg-gray-100 text-gray-700',
};

const StatusBadge = ({ label, status }) => {
  const key = (status || '').toLowerCase();
  const cls = statusBadgeClasses[key] || statusBadgeClasses.default;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {label && <span className="mr-1 text-[9px] uppercase text-gray-500">{label}</span>}
      <span>{(status || 'unknown').replace(/_/g, ' ')}</span>
    </span>
  );
};

const OrderCard = ({ order, onViewDetails, onReorder, isReordering }) => {
  const createdAt = order.created_at || order.createdAt || order.created_at;
  const dateLabel = createdAt ? new Date(createdAt).toLocaleDateString('en-IN') : '';

  const items = Array.isArray(order.items) ? order.items : [];
  const itemSummary = items.slice(0, 2).map((i) => i.title).join(', ');
  const remainingCount = items.length > 2 ? items.length - 2 : 0;

  const total = typeof order.total === 'number' ? order.total : 0;
  const paymentStatus = order.payment_status || order.paymentStatus;
  const fulfillmentStatus = order.fulfillment_status || order.fulfillmentStatus;

  return (
    <article className="rounded-xl border border-gray-100 bg-white p-3 text-xs shadow-sm">
      <header className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <FiPackage className="text-blue-500" />
            <span className="font-semibold text-gray-900">Order {order.display_id || order.id}</span>
          </div>
          <p className="text-[11px] text-gray-500">Placed on {dateLabel}</p>
          {itemSummary && (
            <p className="truncate text-[11px] text-gray-600">
              {itemSummary}
              {remainingCount > 0 && ` + ${remainingCount} more`}
            </p>
          )}
        </div>
        <div className="text-right space-y-1">
          <p className="text-sm font-semibold text-gray-900">{formatAmount(total)}</p>
          <div className="flex flex-wrap justify-end gap-1">
            <StatusBadge label="Payment" status={paymentStatus} />
            <StatusBadge label="Delivery" status={fulfillmentStatus || order.status} />
          </div>
        </div>
      </header>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-gray-100 pt-2">
        <div className="flex items-center gap-2 text-[11px] text-gray-600">
          <FiTruck className="text-gray-400" />
          <span>
            {order.shipping_address?.city || order.shipping_address?.address_1
              ? `Ships to ${order.shipping_address.city || order.shipping_address.address_1}`
              : 'Shipping details available in order'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onReorder?.(order)}
            disabled={isReordering}
            className="inline-flex items-center bg-white rounded-full border border-orange-400 px-2.5 py-1 text-[11px] font-semibold text-orange-600 hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiCreditCard className="mr-1" /> Reorder
          </button>
          <button
            type="button"
            onClick={() => onViewDetails?.(order)}
            className="inline-flex items-center bg-white rounded-full border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-600 hover:border-blue-400 hover:text-blue-700"
          >
            View details <FiChevronDown className="ml-1" />
          </button>
        </div>
      </div>
    </article>
  );
};

export default OrderCard;
