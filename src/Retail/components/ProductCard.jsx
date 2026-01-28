import React, { useMemo, useState } from 'react';
import { FiShoppingCart, FiCheckCircle } from 'react-icons/fi';
import { formatAmount, getProductDefaultVariant, getProductThumbnail, getVariantPriceAmount } from '../utils/helpers';

const ProductCard = ({ product, onViewDetails, onAddToCart }) => {
  const defaultVariant = useMemo(() => getProductDefaultVariant(product), [product]);

  const initialOptions = useMemo(() => {
    if (!defaultVariant || !Array.isArray(defaultVariant.options)) return {};
    return defaultVariant.options.reduce((acc, opt) => {
      if (opt.option_id && opt.value) {
        acc[opt.option_id] = opt.value;
      }
      return acc;
    }, {});
  }, [defaultVariant]);

  const [selectedOptions, setSelectedOptions] = useState(initialOptions);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);

  const currentVariant = useMemo(() => {
    if (!Array.isArray(product.variants) || product.variants.length === 0) {
      return null;
    }

    const optionIds = Object.keys(selectedOptions || {});
    if (optionIds.length === 0) {
      return defaultVariant || product.variants[0];
    }

    const match = product.variants.find((variant) => {
      if (!Array.isArray(variant.options)) return false;
      return optionIds.every((id) => {
        const value = selectedOptions[id];
        const opt = variant.options.find((o) => o.option_id === id);
        return opt && opt.value === value;
      });
    });

    return match || defaultVariant || product.variants[0];
  }, [product.variants, selectedOptions, defaultVariant]);

  const priceAmount = getVariantPriceAmount(currentVariant);
  const image = getProductThumbnail(product);

  const inventory =
    typeof currentVariant?.inventory_quantity === 'number'
      ? currentVariant.inventory_quantity
      : typeof product.inventory_quantity === 'number'
        ? product.inventory_quantity
        : null;

  const inStock = inventory == null ? true : inventory > 0;

  const handleOptionChange = (optionId, value) => {
    setSelectedOptions((prev) => ({ ...prev, [optionId]: value }));
  };

  const handleAddToCart = async () => {
    if (!currentVariant || !onAddToCart || !inStock || adding) return;
    try {
      setAdding(true);
      await onAddToCart(currentVariant.id, 1);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } finally {
      setAdding(false);
    }
  };

  const options = Array.isArray(product.options) ? product.options : [];

  const handleCardClick = () => {
    if (typeof onViewDetails === 'function') {
      onViewDetails(product);
    }
  };

  const handleCardKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && typeof onViewDetails === 'function') {
      e.preventDefault();
      onViewDetails(product);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      className="group flex flex-col overflow-hidden rounded-lg bg-white text-left shadow-md outline-none ring-0 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-gray-100">
        <img
          src={image}
          alt={product.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            e.target.src = 'https://placehold.co/400x300?text=No+Image';
          }}
        />
        {!inStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white shadow-sm">
              Out of stock
            </span>
          </div>
        )}
        <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-[11px] font-medium text-gray-700 shadow">
          {product.collection?.title || 'Featured'}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-2.5">
        <h3 className="mb-0.5 line-clamp-2 text-[13px] font-semibold text-gray-900">{product.title}</h3>
        {product.subtitle ? (
          <p className="mb-0.5 line-clamp-1 text-[11px] text-gray-500">{product.subtitle}</p>
        ) : (
          product.description && (
            <p className="mb-0.5 line-clamp-2 text-[11px] text-gray-500">
              {product.description}
            </p>
          )
        )}
        <div className="mt-1.5 flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-blue-600">{formatAmount(priceAmount)}</p>
          <button
            type="button"
            disabled={!inStock || adding}
            onClick={(e) => {
              e.stopPropagation();
              handleAddToCart();
            }}
            className={`flex items-center justify-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-sm transition w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed ${
              inStock
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {added ? <FiCheckCircle className="text-xs" /> : <FiShoppingCart className="text-xs" />}
            <span>{added ? 'Added' : 'Add to cart'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProductCard;
