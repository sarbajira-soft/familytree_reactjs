import React, { useEffect, useState } from 'react';
import { useRetail } from '../context/RetailContext';
import * as productService from '../services/productService';
import ProductDetail from './ProductDetail';

const CartProductDetailModal = ({ open, productId, onClose }) => {
  const { token, addToCart } = useRetail();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !productId) {
      setProduct(null);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);

    productService
      .fetchProductById(productId, token || null)
      .then((data) => {
        if (!mounted) return;
        setProduct(data);
      })
      .catch(() => {
        if (!mounted) return;
        setProduct(null);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [open, productId, token]);

  const handleAddToCart = async (variantId, quantity) => {
    await addToCart(variantId, quantity);
  };

  if (!open) return null;

  if (loading || !product) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-6">
        <div className="rounded-2xl bg-white px-6 py-4 text-xs text-gray-600 shadow-2xl">
          Loading product details...
        </div>
      </div>
    );
  }

  return (
    <ProductDetail
      product={product}
      isOpen={open}
      onClose={onClose}
      onAddToCart={handleAddToCart}
    />
  );
};

export default CartProductDetailModal;
