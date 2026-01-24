import React, { useState } from 'react';
import { RetailProvider } from './context/RetailContext';
import Header from './components/Header';
import ProductList from './components/ProductList';
import Cart from './components/Cart';
import Orders from './components/Orders';
import Profile from './components/Profile';

const RetailMain = ({ initialProductId, initialTab = 'products' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <RetailProvider>
      <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-slate-950">
        <Header activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="container mx-auto flex-1 px-4 py-4">
          {activeTab === 'products' && <ProductList initialProductId={initialProductId} />}
          {activeTab === 'cart' && (
            <Cart
              onContinueShopping={() => {
                setActiveTab('products');
              }}
              onViewOrders={() => {
                setActiveTab('orders');
              }}
            />
          )}
          {activeTab === 'orders' && <Orders />}
          {activeTab === 'profile' && <Profile />}
        </main>
      </div>
    </RetailProvider>
  );
};

export default RetailMain;
