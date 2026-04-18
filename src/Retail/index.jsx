import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiClock, FiLoader, FiShield } from 'react-icons/fi';
import { RetailProvider, useRetail } from './context/RetailContext';
import Header from './components/Header';
import ProductList from './components/ProductList';
import Cart from './components/Cart';
import Orders from './components/Orders';
import Profile from './components/Profile';

const RetailToast = () => {
  const { toast, clearToast } = useRetail();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => {
      clearToast && clearToast();
    }, 2600);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  if (!toast) return null;

  const isError = (toast?.variant || 'error') === 'error';

  return (
    <div className="fixed left-4 right-4 sm:left-auto sm:right-4 top-16 z-[9999] flex justify-center sm:justify-end">
      <div
        className={`w-full sm:w-auto sm:min-w-[220px] max-w-md rounded-xl px-4 sm:px-5 py-3 text-sm font-semibold shadow-xl border ${
          isError
            ? 'bg-red-600 text-white border-red-700'
            : 'bg-gray-900 text-white border-gray-800'
        }`}
      >
        {toast?.message || 'Something went wrong'}
      </div>
    </div>
  );
};

const RetailToastTestTrigger = () => {
  const { showToast } = useRetail();

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('toastTest') === '1') {
        showToast && showToast('Toast test');
      }
    } catch {
      // ignore
    }
  }, [showToast]);

  return null;
};

const PaymentRecoveryScreen = () => {
  const { paymentRecovery } = useRetail();

  if (!paymentRecovery?.active) {
    return null;
  }

  const normalizedStatus = (paymentRecovery?.status || 'processing').toString().toLowerCase();
  const title =
    normalizedStatus === 'pending_capture'
      ? 'Waiting for payment capture'
      : 'Payment received';
  const message =
    paymentRecovery?.message ||
    (normalizedStatus === 'pending_capture'
      ? 'Your bank has authorized the payment. We are waiting for final capture confirmation before placing the order.'
      : 'We are securely finalizing your order. This usually takes only a few moments.');

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <section className="w-full max-w-lg overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.12)]">
        <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
              <FiCheckCircle className="text-2xl" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-50/90">
                Secure Checkout
              </p>
              <h1 className="text-xl font-semibold">{title}</h1>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 px-4 py-4 text-emerald-900">
            <FiLoader className="mt-0.5 animate-spin text-lg" />
            <div>
              <p className="text-sm font-semibold">Finalizing your order</p>
              <p className="mt-1 text-sm leading-6 text-emerald-900/80">{message}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <FiShield className="text-emerald-600" />
                Payment protected
              </div>
              <p className="mt-2 text-xs leading-5 text-gray-600">
                Your payment was received and is being verified on the server before the order is placed.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <FiClock className="text-emerald-600" />
                Please keep this open
              </div>
              <p className="mt-2 text-xs leading-5 text-gray-600">
                We are checking your payment status automatically. Your order history will refresh once it completes.
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-gray-500">
            If the amount was deducted, do not retry payment. We&apos;ll either confirm the order or the payment will be auto-reversed/refunded by the bank.
          </p>
        </div>
      </section>
    </main>
  );
};

const PullToRefresh = ({ children, onRefresh, disabled }) => {
  const containerRef = useRef(null);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const refreshingRef = useRef(false);

  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const maxPull = 110;
  const threshold = 70;

  const canStartPull = () => {
    const el = containerRef.current;
    if (!el) return false;
    return el.scrollTop <= 0;
  };

  const handleTouchStart = (e) => {
    if (disabled || isRefreshing) return;
    if (!e.touches || e.touches.length !== 1) return;
    startYRef.current = e.touches[0].clientY;
    pullingRef.current = false;
    setPullDistance(0);
  };

  const handleTouchMove = (e) => {
    if (disabled || isRefreshing) return;
    if (!e.touches || e.touches.length !== 1) return;

    const currentY = e.touches[0].clientY;
    const dy = currentY - startYRef.current;

    if (dy <= 0) {
      if (pullingRef.current) {
        pullingRef.current = false;
        setPullDistance(0);
      }
      return;
    }

    if (!pullingRef.current) {
      if (!canStartPull()) return;
      pullingRef.current = true;
    }

    e.preventDefault();

    const eased = Math.min(maxPull, dy * 0.55);
    setPullDistance(eased);
  };

  const handleTouchEnd = async () => {
    if (disabled || isRefreshing) {
      setPullDistance(0);
      pullingRef.current = false;
      return;
    }

    const shouldRefresh = pullingRef.current && pullDistance >= threshold;
    pullingRef.current = false;

    if (!shouldRefresh || typeof onRefresh !== 'function') {
      setPullDistance(0);
      return;
    }

    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setIsRefreshing(true);
    setPullDistance(threshold);

    try {
      await onRefresh();
    } finally {
      refreshingRef.current = false;
      setIsRefreshing(false);
      setPullDistance(0);
    }
  };

  const indicatorText = isRefreshing
    ? 'Refreshing...'
    : pullDistance >= threshold
      ? 'Release to refresh'
      : 'Pull to refresh';

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-y-auto"
      style={{ WebkitOverflowScrolling: 'touch' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex items-end justify-center"
        style={{ height: pullDistance }}
      >
        <div className="pb-2 text-[11px] font-medium text-gray-500">
          {indicatorText}
        </div>
      </div>
      {children}
    </div>
  );
};

const RetailContent = ({ activeTab, initialProductId, productSearchTerm, setProductSearchTerm, isProductDetailOpen, setIsProductDetailOpen, productsViewKey, setProductsViewKey, setActiveInitialProductId, onContinueShopping, onViewOrders, onProductIdChange }) => {
  const { fetchProducts, refreshCart, fetchOrders, refreshCustomerProfile } = useRetail();

  const onRefresh = useCallback(async () => {
    if (activeTab === 'cart') {
      await refreshCart();
      return;
    }
    if (activeTab === 'orders') {
      await fetchOrders();
      return;
    }
    if (activeTab === 'profile') {
      await refreshCustomerProfile();
      return;
    }
    await fetchProducts();
  }, [activeTab, fetchProducts, refreshCart, fetchOrders, refreshCustomerProfile]);

  const pullDisabled = useMemo(() => {
    return activeTab === 'products' && isProductDetailOpen;
  }, [activeTab, isProductDetailOpen]);

  return (
    <PullToRefresh onRefresh={onRefresh} disabled={pullDisabled}>
      {activeTab === 'products' && (
        <ProductList
          key={productsViewKey}
          initialProductId={initialProductId}
          searchTerm={productSearchTerm}
          setSearchTerm={setProductSearchTerm}
          onDetailOpenChange={setIsProductDetailOpen}
          onProductIdChange={onProductIdChange}
        />
      )}
      {activeTab === 'cart' && (
        <Cart
          onContinueShopping={onContinueShopping}
          onViewOrders={onViewOrders}
        />
      )}
      {activeTab === 'orders' && <Orders />}
      {activeTab === 'profile' && <Profile />}
    </PullToRefresh>
  );
};

const RetailShell = ({
  activeTab,
  setTabWithUrl,
  productSearchTerm,
  setProductSearchTerm,
  isProductDetailOpen,
  setProductsViewKey,
  setProductIdWithUrl,
  activeInitialProductId,
  productsViewKey,
  setIsProductDetailOpen,
  setActiveInitialProductId,
}) => {
  const { paymentRecovery } = useRetail();

  if (paymentRecovery?.active) {
    return (
      <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.14),_transparent_42%),linear-gradient(180deg,_#f8fffc_0%,_#effcf6_100%)]">
        <RetailToast />
        <RetailToastTestTrigger />
        <PaymentRecoveryScreen />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-slate-950">
      <RetailToast />
      <RetailToastTestTrigger />
      <Header
        activeTab={activeTab}
        setActiveTab={setTabWithUrl}
        productSearchTerm={productSearchTerm}
        setProductSearchTerm={setProductSearchTerm}
        showProductSearch={activeTab === 'products' && !isProductDetailOpen}
        onProductsTabClick={() => {
          setTabWithUrl('products');
          setIsProductDetailOpen(false);
          setProductsViewKey((key) => key + 1);
          setProductIdWithUrl(null);
        }}
      />
      <main className="container mx-auto flex-1 px-4 pt-4 pb-24 md:pb-8">
        <RetailContent
          activeTab={activeTab}
          initialProductId={activeInitialProductId}
          productSearchTerm={productSearchTerm}
          setProductSearchTerm={setProductSearchTerm}
          isProductDetailOpen={isProductDetailOpen}
          setIsProductDetailOpen={setIsProductDetailOpen}
          productsViewKey={productsViewKey}
          setProductsViewKey={setProductsViewKey}
          setActiveInitialProductId={setActiveInitialProductId}
          onProductIdChange={setProductIdWithUrl}
          onContinueShopping={() => {
            setTabWithUrl('products');
          }}
          onViewOrders={() => {
            setTabWithUrl('orders');
          }}
        />
      </main>
    </div>
  );
};

const RetailMain = ({ initialProductId, initialTab = 'products' }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isProductDetailOpen, setIsProductDetailOpen] = useState(false);
  const [productsViewKey, setProductsViewKey] = useState(0);
  const [activeInitialProductId, setActiveInitialProductId] = useState(initialProductId || null);

  const syncUrl = useCallback(
    ({ tab, productId }, { replace = false } = {}) => {
      const params = new URLSearchParams(location.search);

      const nextTab = tab || 'products';
      params.set('tab', nextTab);

      if (productId) {
        params.set('productId', productId);
      } else {
        params.delete('productId');
      }

      const nextSearch = params.toString();
      const nextUrl = `${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
      const currentUrl = `${location.pathname}${location.search || ''}`;

      if (nextUrl !== currentUrl) {
        navigate(nextUrl, { replace });
      }
    },
    [location.pathname, location.search, navigate],
  );

  const setTabWithUrl = useCallback(
    (nextTab) => {
      const normalized = nextTab || 'products';
      setActiveTab(normalized);

      // Leaving products should close any product detail in URL/history.
      if (normalized !== 'products') {
        setIsProductDetailOpen(false);
        setActiveInitialProductId(null);
        syncUrl({ tab: normalized, productId: null });
        return;
      }

      syncUrl({ tab: normalized, productId: activeInitialProductId });
    },
    [activeInitialProductId, syncUrl],
  );

  const setProductIdWithUrl = useCallback(
    (productId) => {
      const id = productId || null;
      setActiveInitialProductId(id);
      syncUrl({ tab: 'products', productId: id });
    },
    [syncUrl],
  );

  // When user hits browser/mobile back/forward, restore Retail state from URL.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlTab = params.get('tab') || initialTab || 'products';
    const urlProductId = params.get('productId') || null;

    if (urlTab !== activeTab) {
      setActiveTab(urlTab);
    }

    // Only allow productId when on products tab.
    const desiredProductId = urlTab === 'products' ? urlProductId : null;
    if (desiredProductId !== activeInitialProductId) {
      setActiveInitialProductId(desiredProductId);
    }

    const desiredDetailOpen = urlTab === 'products' && !!desiredProductId;
    if (desiredDetailOpen !== isProductDetailOpen) {
      setIsProductDetailOpen(desiredDetailOpen);
    }
  }, [location.search, initialTab, activeTab, activeInitialProductId, isProductDetailOpen]);

  return (
    <RetailProvider>
      <RetailShell
        activeTab={activeTab}
        setTabWithUrl={setTabWithUrl}
        productSearchTerm={productSearchTerm}
        setProductSearchTerm={setProductSearchTerm}
        isProductDetailOpen={isProductDetailOpen}
        setProductsViewKey={setProductsViewKey}
        setProductIdWithUrl={setProductIdWithUrl}
        activeInitialProductId={activeInitialProductId}
        productsViewKey={productsViewKey}
        setIsProductDetailOpen={setIsProductDetailOpen}
        setActiveInitialProductId={setActiveInitialProductId}
      />
    </RetailProvider>
  );
};

export default RetailMain;
