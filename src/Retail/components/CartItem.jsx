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

  const variantTitle =
    item.variant_title ||
    item.variantTitle ||
    item.variant?.title ||
    item.variant_title;

  const options = Array.isArray(item?.variant?.options)
    ? item.variant.options
    : Array.isArray(item?.options)
    ? item.options
    : [];

  const productOptions = Array.isArray(item?.variant?.product?.options)
    ? item.variant.product.options
    : [];

  const optionIdToTitle = productOptions.reduce((map, opt) => {
    const id = opt?.id;
    if (id) {
      map[id] = opt?.title || opt?.name || '';
    }
    return map;
  }, {});

  const getOptionValue = (name) => {
    const normalizedName = String(name || '').toLowerCase();
    const found = options.find((o) => {
      const fromOptionObj = o?.option?.title || o?.option_title || o?.title || '';
      const fromProductMap = o?.option_id ? optionIdToTitle[o.option_id] : '';
      const title = fromOptionObj || fromProductMap || '';
      return String(title).toLowerCase() === normalizedName;
    });
    return found?.value || found?.option_value || '';
  };

  const color = getOptionValue('color') || getOptionValue('colour');
  const size = getOptionValue('size');
  const optionLabelParts = [
    color ? `Color: ${color}` : null,
    size ? `Size: ${size}` : null,
  ].filter(Boolean);

  const derivedFromVariantTitle = (() => {
    if (!variantTitle) return null;
    const parts = String(variantTitle)
      .split('/')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length < 2) return null;
    const derivedSize = parts[0];
    const derivedColor = parts.slice(1).join(' / ');
    const derivedParts = [
      derivedColor ? `Color: ${derivedColor}` : null,
      derivedSize ? `Size: ${derivedSize}` : null,
    ].filter(Boolean);
    return derivedParts.length ? derivedParts : null;
  })();

  const genericOptionParts = optionLabelParts.length
    ? []
    : options
        .map((o) => {
          const fromOptionObj = o?.option?.title || o?.option_title || o?.title || '';
          const fromProductMap = o?.option_id ? optionIdToTitle[o.option_id] : '';
          const title = (fromOptionObj || fromProductMap || '').toString().trim();
          const value = (o?.value || o?.option_value || '').toString().trim();
          if (!title || !value) return null;
          return `${title}: ${value}`;
        })
        .filter(Boolean);

  const optionLabel = (
    optionLabelParts.length
      ? optionLabelParts
      : derivedFromVariantTitle?.length
      ? derivedFromVariantTitle
      : genericOptionParts
  )
    .filter(Boolean)
    .join(' | ');

  const shouldShowOptionLabel =
    Boolean(optionLabel) &&
    // If variant title already conveys size/color (e.g. "S / Black"),
    // avoid repeating it as an extra "Color/Size" line.
    !(variantTitle && derivedFromVariantTitle?.length && optionLabel === derivedFromVariantTitle.join(' | '));

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

      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 max-w-full">
            <p
              className="line-clamp-2 break-words text-sm font-semibold text-gray-900 cursor-pointer hover:text-blue-600"
              onClick={onViewDetails}
            >
              {item.title}
            </p>
            {variantTitle && (
              <p className="line-clamp-1 break-words text-xs text-gray-500">{variantTitle}</p>
            )}
            {shouldShowOptionLabel && (
              <p className="line-clamp-1 break-words text-[11px] text-gray-500">{optionLabel}</p>
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
              className="px-2 bg-white text-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FiMinus />
            </button>
            <span className="min-w-[1.5rem] text-center font-semibold">{item.quantity}</span>
            <button
              type="button"
              onClick={onIncrease}
              disabled={isUpdating}
              className="px-2 bg-white text-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
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
