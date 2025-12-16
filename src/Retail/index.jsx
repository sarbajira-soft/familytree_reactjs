import React, { useState } from 'react';
import { RetailProvider } from './context/RetailContext';
import Header from './components/Header';
import ProductList from './components/ProductList';
import Cart from './components/Cart';
import Orders from './components/Orders';
import Profile from './components/Profile';

const RetailMain = () => {
  const [activeTab, setActiveTab] = useState('products');

  return (
    <RetailProvider>
      <div className="flex min-h-screen flex-col bg-gray-50">
        <Header activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="container mx-auto flex-1 px-4 py-4">
          {activeTab === 'products' && <ProductList />}
          {activeTab === 'cart' && (
            <Cart
              onContinueShopping={() => {
                setActiveTab('products');
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
