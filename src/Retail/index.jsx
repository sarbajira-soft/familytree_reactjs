import React, { useState } from 'react';
import { RetailProvider } from './context/RetailContext';
import Header from './components/Header';
import ProductList from './components/ProductList';
import Cart from './components/Cart';
import Orders from './components/Orders';
import Profile from './components/Profile';

const RetailMain = ({ initialProductId, initialTab = 'products' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isProductDetailOpen, setIsProductDetailOpen] = useState(false);
  const [productsViewKey, setProductsViewKey] = useState(0);
  const [activeInitialProductId, setActiveInitialProductId] = useState(initialProductId || null);

  return (
    <RetailProvider>
      <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-slate-950">
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          productSearchTerm={productSearchTerm}
          setProductSearchTerm={setProductSearchTerm}
          showProductSearch={activeTab === 'products' && !isProductDetailOpen}
          onProductsTabClick={() => {
            setActiveTab('products');
            setIsProductDetailOpen(false);
            setProductsViewKey((key) => key + 1);
            setActiveInitialProductId(null);
          }}
        />
        <main className="container mx-auto flex-1 px-4 pt-4 pb-24 md:pb-8">
          {activeTab === 'products' && (
            <ProductList
              key={productsViewKey}
              initialProductId={activeInitialProductId}
              searchTerm={productSearchTerm}
              setSearchTerm={setProductSearchTerm}
              onDetailOpenChange={setIsProductDetailOpen}
            />
          )}
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
