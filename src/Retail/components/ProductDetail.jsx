import React, { useEffect, useMemo, useState } from 'react';
import { FiX, FiShoppingCart } from 'react-icons/fi';
import { formatAmount, getProductDefaultVariant, getVariantPriceAmount } from '../utils/helpers';

const ProductDetail = ({ product, isOpen, onClose, onAddToCart, mode = 'modal' }) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [isAdding, setIsAdding] = useState(false);

  const defaultVariant = useMemo(() => getProductDefaultVariant(product), [product]);

  const imageCount = Array.isArray(product?.images) ? product.images.length : 0;

  useEffect(() => {
    if (!product) return;
    const initialOptions = {};
    if (defaultVariant && Array.isArray(defaultVariant.options)) {
      defaultVariant.options.forEach((opt) => {
        if (opt.option_id && opt.value) {
          initialOptions[opt.option_id] = opt.value;
        }
      });
    }
    setSelectedOptions(initialOptions);
    setQuantity(1);
    setActiveImageIndex(0);
  }, [product, defaultVariant]);

  useEffect(() => {
    if (!isOpen || !product || imageCount <= 1) return;

    const intervalId = setInterval(() => {
      setActiveImageIndex((prev) => {
        if (imageCount === 0) return 0;
        return (prev + 1) % imageCount;
      });
    }, 4000);

    return () => clearInterval(intervalId);
  }, [isOpen, product, imageCount]);

  const currentVariant = useMemo(() => {
    if (!product || !Array.isArray(product.variants) || product.variants.length === 0) {
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
  }, [product, selectedOptions, defaultVariant]);

  if (!product) return null;
  if (mode === 'modal' && !isOpen) return null;

  const priceAmount = getVariantPriceAmount(currentVariant);
  console.log("priceAmount -----",priceAmount);
  const images = Array.isArray(product.images) && product.images.length > 0 ? product.images : [];
  const fullImageUrl = (img) => {
    if (!img) return 'https://placehold.co/600x400?text=No+Image';
    if (typeof img === 'string') return img;
    if (img.url) return img.url;
    return 'https://placehold.co/600x400?text=No+Image';
  };

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
    if (!currentVariant || !onAddToCart || !inStock || isAdding) return;
    try {
      setIsAdding(true);
      await onAddToCart(currentVariant.id, quantity);
    } finally {
      setIsAdding(false);
    }
  };

  const options = Array.isArray(product.options) ? product.options : [];

  if (mode === 'page') {
    return (
      <div className="mt-2 grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="relative overflow-hidden rounded-xl bg-white">
            <img
              src={fullImageUrl(images[activeImageIndex])}
              alt={product.title}
              className="aspect-[4/3] w-full object-cover"
              onError={(e) => {
                e.target.src = 'https://placehold.co/600x400?text=No+Image';
              }}
            />
            {inStock ? (
              <span className="absolute left-3 top-3 rounded-full bg-green-100 px-2.5 py-1 text-[10px] font-semibold text-green-700 shadow-sm">
                In stock
              </span>
            ) : (
              <span className="absolute left-3 top-3 rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-semibold text-red-700 shadow-sm">
                Out of stock
              </span>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, index) => (
                <button
                  key={img.id || index}
                  type="button"
                  onClick={() => setActiveImageIndex(index)}
                  className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border ${
                    index === activeImageIndex
                      ? 'border-blue-500 ring-1 ring-blue-300'
                      : 'border-gray-200'
                  }`}
                >
                  <img
                    src={fullImageUrl(img)}
                    alt="Thumbnail"
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-sm">
          <div>
            <h1 className="text-base font-semibold text-gray-900">{product.title}</h1>
            {product.collection?.title && (
              <p className="text-[11px] text-gray-500">{product.collection.title}</p>
            )}
          </div>

          <div>
            <p className="text-2xl font-bold text-blue-600">{formatAmount(priceAmount)}</p>
            {currentVariant?.title && (
              <p className="text-xs text-gray-500">Variant: {currentVariant.title}</p>
            )}
          </div>

          {product.description && (
            <div className="space-y-1 text-xs text-gray-600">
              <p className="font-semibold text-gray-800">Description</p>
              <p className="max-h-24 overflow-y-auto whitespace-pre-line leading-relaxed">
                {product.description}
              </p>
            </div>
          )}

          {options.length > 0 && (
            <div className="space-y-3">
              {options.map((option) => (
                <div key={option.id} className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-gray-600">{option.title}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {option.values?.map((value) => {
                      const selected = selectedOptions[option.id] === value.value;
                      return (
                        <button
                          key={value.id || value.value}
                          type="button"
                          onClick={() => handleOptionChange(option.id, value.value)}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                            selected
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:text-blue-600'
                          }`}
                        >
                          {value.value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 text-xs text-gray-600">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="px-2 bg-white text-gray-500 disabled:opacity-40"
              >
                -
              </button>
              <span className="min-w-[1.75rem] text-center font-semibold">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                disabled={quantity >= 10}
                className="px-2 bg-white text-gray-500 disabled:opacity-40"
              >
                +
              </button>
            </div>

            <button
              type="button"
              disabled={!inStock || isAdding}
              onClick={handleAddToCart}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed ${
                inStock
                  ? 'bg-orange-500 text-white hover:bg-orange-600'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <FiShoppingCart />
              <span>Add to cart</span>
            </button>
          </div>

          {inventory > 0 && (
            <p className="text-[11px] text-gray-500">Only {inventory} left in stock</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="max-h-full w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{product.title}</h2>
            {product.collection?.title && (
              <p className="text-[11px] text-gray-500">{product.collection.title}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
          >
            <FiX />
          </button>
        </div>

        <div className="grid gap-4 border-t border-gray-100 bg-gray-50/60 p-4 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <div className="relative overflow-hidden rounded-xl bg-white">
              <img
                src={fullImageUrl(images[activeImageIndex])}
                alt={product.title}
                className="aspect-[4/3] w-full object-cover"
                onError={(e) => {
                  e.target.src = 'https://placehold.co/600x400?text=No+Image';
                }}
              />
              {inStock ? (
                <span className="absolute left-3 top-3 rounded-full bg-green-100 px-2.5 py-1 text-[10px] font-semibold text-green-700 shadow-sm">
                  In stock
                </span>
              ) : (
                <span className="absolute left-3 top-3 rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-semibold text-red-700 shadow-sm">
                  Out of stock
                </span>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, index) => (
                  <button
                    key={img.id || index}
                    type="button"
                    onClick={() => setActiveImageIndex(index)}
                    className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border ${
                      index === activeImageIndex
                        ? 'border-blue-500 ring-1 ring-blue-300'
                        : 'border-gray-200'
                    }`}
                  >
                    <img
                      src={fullImageUrl(img)}
                      alt="Thumbnail"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 rounded-xl bg-white p-4">
            <div>
              <p className="text-2xl font-bold text-blue-600">{formatAmount(priceAmount)}</p>
              {currentVariant?.title && (
                <p className="text-xs text-gray-500">Variant: {currentVariant.title}</p>
              )}
            </div>

            {product.description && (
              <div className="space-y-1 text-xs text-gray-600">
                <p className="font-semibold text-gray-800">Description</p>
                <p className="max-h-24 overflow-y-auto whitespace-pre-line leading-relaxed">
                  {product.description}
                </p>
              </div>
            )}

            {options.length > 0 && (
              <div className="space-y-3">
                {options.map((option) => (
                  <div key={option.id} className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-gray-600">{option.title}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {option.values?.map((value) => {
                        const selected = selectedOptions[option.id] === value.value;
                        return (
                          <button
                            key={value.id || value.value}
                            type="button"
                            onClick={() => handleOptionChange(option.id, value.value)}
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                              selected
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:text-blue-600'
                            }`}
                          >
                            {value.value}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 text-xs text-gray-600">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="px-2 bg-white text-gray-500 disabled:opacity-40"
                >
                  -
                </button>
                <span className="min-w-[1.75rem] text-center font-semibold">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                  disabled={quantity >= 10}
                  className="px-2 bg-white text-gray-500 disabled:opacity-40"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                disabled={!inStock || isAdding}
                onClick={handleAddToCart}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  inStock
                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                <FiShoppingCart />
                <span>Add to cart</span>
              </button>
            </div>

            {inventory > 0 && (
              <p className="text-[11px] text-gray-500">Only {inventory} left in stock</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
