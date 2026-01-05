import React, { useEffect, useMemo, useState } from 'react';
import { FiAlertCircle, FiFilter, FiLoader, FiSearch } from 'react-icons/fi';
import { useRetail } from '../context/RetailContext';
import ProductCard from './ProductCard';
import ProductDetail from './ProductDetail';
import { getVariantPriceAmount } from '../utils/helpers';
import { ArrowLeft } from 'lucide-react';
import * as productService from '../services/productService';

const ProductList = ({ initialProductId }) => {
  const { products, fetchProducts, loading, error, addToCart, token } = useRetail();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('featured');
  const [collectionFilter, setCollectionFilter] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [initialSelectionDone, setInitialSelectionDone] = useState(false);
  const [initialDetailLoading, setInitialDetailLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (!initialProductId || initialSelectionDone) return;

    let cancelled = false;

    const loadProduct = async () => {
      try {
        setInitialDetailLoading(true);
        const product = await productService.fetchProductById(initialProductId, token || null);
        if (!cancelled && product) {
          setSelectedProduct(product);
          setDetailOpen(true);
          setInitialSelectionDone(true);
          setInitialDetailLoading(false);
          return;
        }
      } catch (err) {
        // If direct fetch fails, fall back to any already-loaded products list
        if (!cancelled && Array.isArray(products) && products.length > 0) {
          const match = products.find((p) => p.id === initialProductId);
          if (match) {
            setSelectedProduct(match);
            setDetailOpen(true);
            setInitialSelectionDone(true);
          }
        }
      } finally {
        if (!cancelled) {
          setInitialDetailLoading(false);
        }
      }
    };

    loadProduct();

    return () => {
      cancelled = true;
    };
  }, [initialProductId, token, products, initialSelectionDone]);

  const collections = useMemo(() => {
    const set = new Set();
    products.forEach((p) => {
      if (p.collection?.title) set.add(p.collection.title);
    });
    return Array.from(set).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter((p) => {
        return (
          (p.title && p.title.toLowerCase().includes(term)) ||
          (p.description && p.description.toLowerCase().includes(term))
        );
      });
    }

    if (collectionFilter !== 'all') {
      result = result.filter((p) => p.collection?.title === collectionFilter);
    }

    result.sort((a, b) => {
      if (sortBy === 'price-low' || sortBy === 'price-high') {
        const getAmount = (product) => {
          const variant =
            Array.isArray(product.variants) && product.variants.length > 0
              ? product.variants[0]
              : null;
          return variant ? getVariantPriceAmount(variant) : 0;
        };
        const pa = getAmount(a);
        const pb = getAmount(b);
        return sortBy === 'price-low' ? pa - pb : pb - pa;
      }

      if (sortBy === 'name') {
        return (a.title || '').localeCompare(b.title || '');
      }

      if (sortBy === 'newest') {
        const da = new Date(a.created_at || 0).getTime();
        const db = new Date(b.created_at || 0).getTime();
        return db - da;
      }

      return 0;
    });

    return result;
  }, [products, searchTerm, collectionFilter, sortBy]);

  const handleViewDetails = (product) => {
    setSelectedProduct(product);
    setDetailOpen(true);
  };

  const handleAddToCart = async (variantId, quantity) => {
    await addToCart(variantId, quantity);
  };

  const showSkeleton = loading && products.length === 0;

  return (
    <section aria-label="Products">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Browse products</h2>
          <p className="text-xs text-gray-500">Search, filter, and sort Medusa products.</p>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative w-full md:w-64">
            <FiSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search products..."
              className="w-full rounded-full border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-xs text-gray-900 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          <div className="flex gap-2 text-xs">
            <div className="relative">
              <FiFilter className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={collectionFilter}
                onChange={(e) => setCollectionFilter(e.target.value)}
                className="w-32 appearance-none rounded-full border border-gray-200 bg-white py-1.5 pl-7 pr-6 text-[11px] text-gray-700 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="all">All collections</option>
                {collections.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">
                
              </span>
            </div>

            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-32 appearance-none rounded-full border border-gray-200 bg-white py-1.5 pl-3 pr-6 text-[11px] text-gray-700 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="featured">Featured</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="name">Name</option>
                <option value="newest">Newest</option>
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">
                
              </span>
            </div>
          </div>
        </div>
      </div>

      {error && !loading && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <FiAlertCircle className="text-sm" />
          <span className="flex-1 truncate">{error}</span>
          <button
            type="button"
            onClick={fetchProducts}
            className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      )}

      {showSkeleton && !detailOpen && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="flex animate-pulse flex-col rounded-xl border border-gray-100 bg-white p-3"
            >
              <div className="mb-3 h-40 rounded-lg bg-gray-100" />
              <div className="mb-2 h-3 w-3/4 rounded bg-gray-100" />
              <div className="mb-1 h-3 w-1/2 rounded bg-gray-100" />
              <div className="mt-3 h-4 w-1/3 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      )}

      {!showSkeleton && filteredProducts.length > 0 && !detailOpen && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onViewDetails={handleViewDetails}
              onAddToCart={handleAddToCart}
            />
          ))}
        </div>
      )}

      {!showSkeleton && filteredProducts.length > 0 && detailOpen && selectedProduct && (
        <div className="mt-2 space-y-3">
          <button
            type="button"
            onClick={() => {
              setDetailOpen(false);
              setSelectedProduct(null);
            }}
            className="inline-flex bg-white items-center rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-blue-400 hover:text-blue-700"
          >
              <ArrowLeft size={14} />
            Back to products
          </button>

          <ProductDetail
            product={selectedProduct}
            isOpen
            onClose={() => {
              setDetailOpen(false);
              setSelectedProduct(null);
            }}
            onAddToCart={handleAddToCart}
            mode="page"
          />
        </div>
      )}

      {!showSkeleton && !loading && filteredProducts.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center">
          <FiAlertCircle className="mb-2 text-2xl text-gray-400" />
          <p className="text-sm font-medium text-gray-700">No products found</p>
          <p className="mt-1 text-xs text-gray-500">
            Try clearing your filters or adjusting your search term.
          </p>
          {products.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setCollectionFilter('all');
                setSortBy('featured');
              }}
              className="mt-3 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Reset filters
            </button>
          )}
        </div>
      )}

      {loading && products.length > 0 && !detailOpen && (
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500">
          <FiLoader className="animate-spin" />
          <span>Refreshing products...</span>
        </div>
      )}
    </section>
  );
};

export default ProductList;
