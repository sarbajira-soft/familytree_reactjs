import React, { useState } from 'react';
import {
  FiShoppingBag,
  FiShoppingCart,
  FiPackage,
  FiList,
  FiUser,
  FiLogOut,
  FiLogIn,
} from 'react-icons/fi';
import { useRetail } from '../context/RetailContext';
import { formatAmount } from '../utils/helpers';
import * as authService from '../services/authService';

const Header = ({ activeTab, setActiveTab }) => {
  const { cart, cartCount, user, logout, loading, login } = useRetail();

  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
  });
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [showMiniCart, setShowMiniCart] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setAuthForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      await login(authForm.email, authForm.password);
      setShowAuthPanel(false);
    } catch (err) {
      setAuthError(err.message || 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      const { email, password, first_name, last_name, phone } = authForm;

      const { token } = await authService.registerCustomer({ email, password });

      await authService.completeCustomerProfile(token, {
        email,
        first_name,
        last_name,
        phone,
      });

      await login(email, password);
      setShowAuthPanel(false);
    } catch (err) {
      setAuthError(err.message || 'Registration failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const miniCartItems = cart?.items?.slice(0, 3) || [];

  const renderAuthForm = () => {
    if (!showAuthPanel) return null;

    return (
      <div className="absolute right-0  w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-40">
        <div className="p-4">
          <div className="flex mb-4 border-b border-gray-200">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setAuthError(null);
              }}
              className={`flex-1 py-2 text-sm font-semibold border-b-2 transition-colors ${
                authMode === 'login'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('register');
                setAuthError(null);
              }}
              className={`flex-1 py-2 text-sm font-semibold border-b-2 transition-colors ${
                authMode === 'register'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Register
            </button>
          </div>

          {authError && (
            <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {authError}
            </div>
          )}

          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={authForm.email}
                  onChange={handleChange}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  name="password"
                  value={authForm.password}
                  onChange={handleChange}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={authLoading || loading}
                className="w-full inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {authLoading || loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">First name</label>
                  <input
                    type="text"
                    name="first_name"
                    value={authForm.first_name}
                    onChange={handleChange}
                    required
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Last name</label>
                  <input
                    type="text"
                    name="last_name"
                    value={authForm.last_name}
                    onChange={handleChange}
                    required
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={authForm.email}
                  onChange={handleChange}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={authForm.phone}
                  onChange={handleChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  name="password"
                  value={authForm.password}
                  onChange={handleChange}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <button
                type="submit"
                disabled={authLoading || loading}
                className="w-full inline-flex items-center justify-center rounded-md bg-orange-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 disabled:opacity-50"
              >
                {authLoading || loading ? 'Creating account...' : 'Create account'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  };

  const renderMiniCart = () => {
    if (!showMiniCart || miniCartItems.length === 0) return null;

    return (
      <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-40">
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1">
              <FiShoppingCart className="text-blue-500" /> Mini Cart
            </h3>
            <button
              type="button"
              onClick={() => setActiveTab('cart')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
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
            <p className="text-xs text-gray-500">Powered by Medusa</p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 transition-colors ${
              activeTab === 'products'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FiList className="text-sm" /> Products
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cart')}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 transition-colors ${
              activeTab === 'cart'
                ? 'bg-orange-50 text-orange-700'
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
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 transition-colors ${
              activeTab === 'orders'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FiPackage className="text-sm" /> Orders
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 transition-colors ${
              activeTab === 'profile'
                ? 'bg-blue-50 text-blue-700'
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
                  onClick={logout}
                  className="inline-flex h-9 items-center justify-center rounded-full bg-gray-100 px-3 text-xs font-medium text-gray-700 hover:bg-gray-200"
                >
                  <FiLogOut className="mr-1" /> Logout
                </button>
              </div>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowAuthPanel((prev) => !prev)}
                  className="inline-flex h-9 items-center justify-center rounded-full bg-blue-600 px-3 text-xs font-medium text-white shadow-sm hover:bg-blue-700"
                >
                  <FiLogIn className="mr-1" />
                  <span className="hidden sm:inline">Login / Register</span>
                  <span className="sm:hidden">Sign in</span>
                </button>
                {renderAuthForm()}
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
