import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiShoppingBag,
  FiShoppingCart,
  FiPackage,
  FiList,
  FiUser,
  FiLogOut,
} from 'react-icons/fi';
import { useRetail } from '../context/RetailContext';
import { useUser } from '../../Contexts/UserContext';
import { formatAmount } from '../utils/helpers';

const Header = ({ activeTab, setActiveTab }) => {
  const navigate = useNavigate();
  const { logout: appLogout } = useUser();
  const { cart, cartCount, user, logout } = useRetail();

  const [showMiniCart, setShowMiniCart] = useState(false);

  const handleLogout = () => {
    logout();
    appLogout();
    navigate('/login');
  };

  const miniCartItems = cart?.items?.slice(0, 3) || [];

  const renderMiniCart = () => {
    if (!showMiniCart || miniCartItems.length === 0) return null;

    return (
      <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-40">
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1">
              <FiShoppingCart className="text-blue-500" /> Cart
            </h3>
            <button
              type="button"
              onClick={() => setActiveTab('cart')}
              className="text-xs bg-white text-blue-600 hover:text-blue-700 font-medium"
            >
              View full cart
            </button>
          </div>
          <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
            {miniCartItems.map((item) => {
              const unitPrice = item.unit_price || 0;
              const total = item.total || unitPrice * (item.quantity || 0);
              const image =
                item.thumbnail ||
                item.variant?.product?.thumbnail ||
                'https://placehold.co/64x64?text=Item';

              return (
                <div key={item.id} className="flex py-2 gap-3">
                  <div className="w-12 h-12 rounded-md bg-gray-100 overflow-hidden flex-shrink-0">
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
                    <p className="text-xs font-semibold text-gray-800 truncate">{item.title}</p>
                    {item.variant?.title && (
                      <p className="text-[11px] text-gray-500 truncate">{item.variant.title}</p>
                    )}
                    <p className="text-xs text-gray-600 mt-1">
                      {item.quantity} × {formatAmount(unitPrice)}
                    </p>
                  </div>
                  <div className="text-xs font-semibold text-gray-900">
                    {formatAmount(total)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-gray-600">Items: {cartCount}</span>
            <span className="font-semibold text-gray-900">
              Total: {formatAmount(cart?.total || 0)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md">
            <FiShoppingBag />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">FamilyTree Store</h1>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={`inline-flex  items-center bg-white gap-1 rounded-full px-3 py-1.5 transition-colors ${
              activeTab === 'products'
                ? 'bg-orange-50 text-orange-600'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FiList className="text-sm" /> Products
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cart')}
            className={`inline-flex bg-white items-center gap-1 rounded-full px-3 py-1.5 transition-colors ${
              activeTab === 'cart'
                ? 'bg-orange-50 text-orange-600'
                : 'text-gray-600 hover:bg-gray-100'
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
            className={`inline-flex bg-white items-center gap-1 rounded-full px-3 py-1.5 transition-colors ${
              activeTab === 'orders'
                ? 'bg-orange-50 text-orange-600'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FiPackage className="text-sm" /> Orders
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`inline-flex bg-white items-center gap-1 rounded-full px-3 py-1.5 transition-colors ${
              activeTab === 'profile'
                ? 'bg-orange-50 text-orange-600'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FiUser className="text-sm" /> Profile
          </button>
        </nav>

        <div className="flex items-center gap-3 relative">
          <div
            className="relative"
            onMouseEnter={() => setShowMiniCart(true)}
            onMouseLeave={() => setShowMiniCart(false)}
          >
            <button
              type="button"
              onClick={() => setActiveTab('cart')}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-700 hover:border-orange-400 hover:text-orange-600 bg-white shadow-sm"
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

          <div className="relative">
            {user ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs font-semibold text-gray-800 max-w-[10rem] truncate">
                    {user.first_name || user.first_name === ''
                      ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email
                      : user.email}
                  </span>
                  <span className="text-[11px] text-gray-500">Signed in</span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex h-9 items-center justify-center rounded-full bg-gray-100 px-3 text-xs font-medium text-gray-700 hover:bg-gray-200"
                >
                  <FiLogOut className="mr-1" /> Logout
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-semibold text-gray-800">Guest</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 bg-gradient-to-r from-blue-50 via-white to-orange-50 md:hidden">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between text-xs">
          <nav className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('products')}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${
                activeTab === 'products' ? 'bg-blue-100 text-blue-700' : 'text-gray-600'
              }`}
            >
              <FiList className="text-sm" /> Products
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cart')}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${
                activeTab === 'cart' ? 'bg-orange-100 text-orange-700' : 'text-gray-600'
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
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${
                activeTab === 'orders' ? 'bg-blue-100 text-blue-700' : 'text-gray-600'
              }`}
            >
              <FiPackage className="text-sm" /> Orders
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${
                activeTab === 'profile' ? 'bg-blue-100 text-blue-700' : 'text-gray-600'
              }`}
            >
              <FiUser className="text-sm" /> Profile
            </button>
          </nav>

          <div className="flex items-center gap-1 text-gray-500">
            <FiUser className="text-sm" />
            <span className="truncate max-w-[8rem]">
              {user ? user.email : 'Guest'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
