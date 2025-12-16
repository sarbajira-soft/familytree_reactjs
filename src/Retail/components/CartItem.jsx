import React from 'react';
import { FiMinus, FiPlus, FiTrash2 } from 'react-icons/fi';
import { formatAmount } from '../utils/helpers';

const CartItem = ({ item, onIncrease, onDecrease, onRemove, onViewDetails, isUpdating }) => {
  const unitPrice = item.unit_price || 0;
  const total = item.total || unitPrice * (item.quantity || 0);
  const image =
    item.thumbnail ||
    item.variant?.product?.thumbnail ||
    'https://placehold.co/80x80?text=Item';

  const canDecrease = (item.quantity || 0) > 1;

  return (
    <div className="flex gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      <button
        type="button"
        onClick={onViewDetails}
        className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <img
          src={image}
          alt={item.title}
          className="h-full w-full object-cover"
          onError={(e) => {
            e.target.src = 'https://placehold.co/80x80?text=Item';
          }}
        />
      </button>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className="truncate text-sm font-semibold text-gray-900 cursor-pointer hover:text-blue-600"
              onClick={onViewDetails}
            >
              {item.title}
            </p>
            {item.variant?.title && (
              <p className="truncate text-xs text-gray-500">{item.variant.title}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onRemove}
            disabled={isUpdating}
            className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FiTrash2 className="text-xs" />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 text-xs text-gray-600">
            <button
              type="button"
              onClick={onDecrease}
              disabled={!canDecrease || isUpdating}
              className="px-2 text-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FiMinus />
            </button>
            <span className="min-w-[1.5rem] text-center font-semibold">{item.quantity}</span>
            <button
              type="button"
              onClick={onIncrease}
              disabled={isUpdating}
              className="px-2 text-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FiPlus />
            </button>
          </div>

          <div className="text-right text-xs">
            <p className="font-semibold text-gray-900">{formatAmount(total)}</p>
            <p className="text-[11px] text-gray-500">
              {formatAmount(unitPrice)} each
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartItem;
