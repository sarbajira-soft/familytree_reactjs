import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiShoppingCart,
  FiPackage,
  FiList,
  FiUser,
  FiSearch,
} from 'react-icons/fi';
import { useRetail } from '../context/RetailContext';
import { useUser } from '../../Contexts/UserContext';
import { formatAmount } from '../utils/helpers';

const Header = ({
  activeTab,
  setActiveTab,
  productSearchTerm,
  setProductSearchTerm,
  onProductsTabClick,
  showProductSearch,
}) => {
  const navigate = useNavigate();
  const { logout: appLogout } = useUser();
  const { cart, cartCount, user, logout } = useRetail();

  const [showMiniCart, setShowMiniCart] = useState(false);

  const handleProductsClick = () => {
    if (onProductsTabClick) {
      onProductsTabClick();
    } else {
      setActiveTab('products');
    }
  };

  const shouldShowSearch =
    typeof showProductSearch === 'boolean' ? showProductSearch : activeTab === 'products';

  const handleLogout = () => {
    logout();
    appLogout();
    navigate('/login');
  };

  const miniCartItems = cart?.items?.slice(0, 3) || [];

  const renderMiniCart = () => {
    if (!showMiniCart || miniCartItems.length === 0) return null;

    return (
      <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-40 dark:bg-slate-900 dark:border-slate-800">
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100 flex items-center gap-1">
              <FiShoppingCart className="text-blue-500" /> Cart
            </h3>
            <button
              type="button"
              onClick={() => setActiveTab('cart')}
              className="text-xs bg-white text-blue-600 hover:text-blue-700 font-medium dark:bg-slate-900"
            >
              View full cart
            </button>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
            {miniCartItems.map((item) => {
              const unitPrice = item.unit_price || 0;
              const total = item.total || unitPrice * (item.quantity || 0);
              const image =
                item.thumbnail ||
                item.variant?.product?.thumbnail ||
                'https://placehold.co/64x64?text=Item';

              return (
                <div key={item.id} className="flex py-2 gap-3">
                  <div className="w-12 h-12 rounded-md bg-gray-100 dark:bg-slate-800 overflow-hidden flex-shrink-0">
                    <img
                      src={image}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = 'https://placehold.co/64x64?text=Item';
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 dark:text-slate-100 truncate">{item.title}</p>
                    {item.variant?.title && (
                      <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate">{item.variant.title}</p>
                    )}
                    <p className="text-xs text-gray-600 dark:text-slate-300 mt-1">
                      {item.quantity} × {formatAmount(unitPrice)}
                    </p>
                  </div>
                  <div className="text-xs font-semibold text-gray-900 dark:text-slate-100">
                    {formatAmount(total)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-gray-600 dark:text-slate-300">Items: {cartCount}</span>
            <span className="font-semibold text-gray-900 dark:text-slate-100">
              Total: {formatAmount(cart?.total || 0)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur dark:bg-slate-900/90 dark:border-slate-800">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex-1 max-w-xs">
          {shouldShowSearch && (
            <div className="relative w-full">
              <FiSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={productSearchTerm || ''}
                onChange={(e) => setProductSearchTerm && setProductSearchTerm(e.target.value)}
                placeholder="Search products..."
                className="w-full rounded-full border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-xs text-gray-900 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          )}
        </div>

        <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
          <button
            type="button"
            onClick={handleProductsClick}
            className={`inline-flex  items-center bg-white dark:bg-slate-900 gap-1 rounded-full px-3 py-1.5 transition-colors ${
              activeTab === 'products'
                ? 'bg-orange-50 text-orange-600'
                : 'text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <FiList className="text-sm" /> Products
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cart')}
            className={`inline-flex bg-white dark:bg-slate-900 items-center gap-1 rounded-full px-3 py-1.5 transition-colors ${
              activeTab === 'cart'
                ? 'bg-orange-50 text-orange-600'
                : 'text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <FiShoppingCart className="text-sm" />
            <span>Cart</span>
            {cartCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold text-white">
                {cartCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`inline-flex bg-white dark:bg-slate-900 items-center gap-1 rounded-full px-3 py-1.5 transition-colors ${
              activeTab === 'orders'
                ? 'bg-orange-50 text-orange-600'
                : 'text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <FiPackage className="text-sm" /> Orders
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`inline-flex bg-white dark:bg-slate-900 items-center gap-1 rounded-full px-3 py-1.5 transition-colors ${
              activeTab === 'profile'
                ? 'bg-orange-50 text-orange-600'
                : 'text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <FiUser className="text-sm" /> Address
          </button>
        </nav>

        <div className="hidden md:flex items-center gap-3 relative">
          <div
            className="relative"
            onMouseEnter={() => setShowMiniCart(true)}
            onMouseLeave={() => setShowMiniCart(false)}
          >
            <button
              type="button"
              onClick={() => setActiveTab('cart')}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-700 hover:border-orange-400 hover:text-orange-600 bg-white shadow-sm dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
            >
              <FiShoppingCart className="text-lg" />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold text-white">
                  {cartCount}
                </span>
              )}
            </button>
            {renderMiniCart()}
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 bg-gradient-to-r from-blue-50 via-white to-orange-50 md:hidden dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between text-xs">
          <nav className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleProductsClick}
              className={`inline-flex items-center bg-white gap-1 rounded-full px-2 py-1 ${
                activeTab === 'products' ? 'bg-secondary-100 text-secondary-600' : 'text-gray-600'
              }`}
            >
              <FiList className="text-sm" /> Products
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cart')}
              className={`inline-flex items-center bg-white gap-1 rounded-full px-2 py-1 ${
                activeTab === 'cart' ? 'bg-secondary-100 text-secondary-600' : 'text-gray-600'
              }`}
            >
              <FiShoppingCart className="text-sm" /> Cart
              {cartCount > 0 && (
                <span className="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold text-white">
                  {cartCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`inline-flex items-center gap-1 bg-white rounded-full px-2 py-1 ${
                activeTab === 'orders' ? 'bg-secondary-100 text-secondary-600' : 'text-gray-600'
              }`}
            >
              <FiPackage className="text-sm" /> Orders
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`inline-flex items-center bg-white  gap-1 rounded-full px-2 py-1 ${
                activeTab === 'profile' ? 'bg-secondary-100 text-secondary-600' : 'text-gray-600'
              }`}
            >
              <FiUser className="text-sm" /> Address
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
