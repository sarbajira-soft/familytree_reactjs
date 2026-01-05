import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiX, FiShoppingCart } from 'react-icons/fi';
import { RetailProvider, useRetail } from '../Retail/context/RetailContext';
import ProductDetail from '../Retail/components/ProductDetail';

const DashboardGiftProductModalContent = ({ isOpen, productId, onClose }) => {
  const { addToCart, products, fetchProducts, cart } = useRetail();
  const [product, setProduct] = useState(null);
  const [hasFetchedWithRegion, setHasFetchedWithRegion] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);
  const navigate = useNavigate();

  const handleGoToCart = () => {
    onClose();
    navigate('/gifts-memories?tab=cart');
  };

  const handleAddToCart = async (variantId, quantity) => {
    try {
      setAddSuccess(false);
      await addToCart(variantId, quantity);
      setAddSuccess(true);
    } catch {
      setAddSuccess(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const regionId = cart?.region_id || cart?.region?.id;
    if (!regionId || hasFetchedWithRegion) return;

    fetchProducts();
    setHasFetchedWithRegion(true);
  }, [isOpen, cart, hasFetchedWithRegion, fetchProducts]);

  useEffect(() => {
    if (!isOpen || !productId) {
      setProduct(null);
      setHasFetchedWithRegion(false);
      setAddSuccess(false);
      return;
    }
    if (!Array.isArray(products) || products.length === 0) {
      setProduct(null);
      return;
    }

    const match = products.find((p) => p.id === productId);
    setProduct(match || null);
  }, [isOpen, productId, products]);

  if (!isOpen) return null;

  const regionId = cart?.region_id || cart?.region?.id;

  const isLoading =
    !regionId ||
    (!product && (!Array.isArray(products) || products.length === 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Gift details</p>
            <p className="text-[11px] text-gray-500">Review this gift and add it to your cart.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
          >
            <FiX size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-xs text-gray-500">
              {'Loading gift details...'}
            </div>
          ) : product ? (
            <ProductDetail
              product={product}
              isOpen
              onClose={onClose}
              onAddToCart={handleAddToCart}
              mode="page"
            />
          ) : (
            <div className="flex h-40 items-center justify-center text-xs text-gray-500">
              {'Unable to load gift details.'}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 bg-gray-50">
          {addSuccess ? (
            <p className="text-[11px] font-semibold text-green-600">Added to cart</p>
          ) : (
            <p className="text-[11px] text-gray-500">
              Items you add here will appear in your cart.
            </p>
          )}
          <button
            type="button"
            onClick={handleGoToCart}
            className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-700"
          >
            <FiShoppingCart className="text-sm" />
            <span>Go to cart</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const DashboardGiftProductModal = ({ isOpen, productId, onClose }) => {
  if (!isOpen || !productId) return null;

  return (
    <RetailProvider>
      <DashboardGiftProductModalContent isOpen={isOpen} productId={productId} onClose={onClose} />
    </RetailProvider>
  );
};

export default DashboardGiftProductModal;
