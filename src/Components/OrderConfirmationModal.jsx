import React from 'react';
import { FiX, FiCheckCircle, FiPackage, FiTruck, FiMessageSquare, FiShoppingCart, FiDownload } from 'react-icons/fi';

const OrderConfirmationModal = ({ isOpen, onClose, orderDetails, onContinueShopping }) => {
  console.log('🎯 OrderConfirmationModal props:', { isOpen, orderDetails: !!orderDetails, orderDetailsContent: orderDetails });

  React.useEffect(() => {
    if (!isOpen) return;
    if (typeof onClose !== 'function') return;
    if (!window.__appModalBackStack) window.__appModalBackStack = [];

    const handler = () => {
      onClose();
    };

    window.__appModalBackStack.push(handler);

    return () => {
      const stack = window.__appModalBackStack;
      if (!Array.isArray(stack)) return;
      const idx = stack.lastIndexOf(handler);
      if (idx >= 0) stack.splice(idx, 1);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !orderDetails) {
    console.log('❌ OrderConfirmationModal not showing because:', { isOpen, hasOrderDetails: !!orderDetails });
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[80]">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-0 relative max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FiCheckCircle className="text-2xl" />
              <h2 className="text-2xl font-bold">Order Confirmed!</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white bg-opacity-20 text-white hover:bg-opacity-30 transition-all"
              aria-label="Close"
            >
              <FiX size={20} />
            </button>
          </div>
        </div>

        <div className="max-h-[calc(95vh-80px)] overflow-y-auto">
          <div className="p-6">
            {/* Success Header */}
            <div className="text-center mb-8">
              <div className="bg-green-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <FiCheckCircle className="text-green-600 text-4xl" />
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Order Confirmed!</h2>
              <p className="text-gray-600">Your gift order has been successfully placed</p>
            </div>

            {/* Order Details */}
            <div className="space-y-6">
              {/* Order Number */}
              <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">Order Number</h3>
                  <span className="text-xl font-bold text-primary-600">{orderDetails.orderNumber}</span>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  Placed on {orderDetails.orderDate} at {orderDetails.orderTime}
                </div>
              </div>

              {/* Product Details */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <FiPackage className="mr-3 text-primary-600" />
                  Product Details
                </h3>
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center">
                    <img
                      src={orderDetails.gift?.images && orderDetails.gift.images.length > 0 ? orderDetails.gift.images[0] : 'https://placehold.co/64x64?text=No+Image'}
                      alt={orderDetails.gift?.title || 'Product'}
                      className="w-full h-full object-cover rounded-lg"
                      onError={(e) => {
                        e.target.src = 'https://placehold.co/64x64?text=No+Image';
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800">{orderDetails.gift?.title || 'Product Name'}</h4>
                    <p className="text-sm text-gray-600">{orderDetails.gift?.category || 'Category'}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-gray-600">Quantity: {orderDetails.quantity || 1}</span>
                      <span className="font-semibold text-primary-600">₹{(orderDetails.gift?.price || 0).toLocaleString('en-IN')} each</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Delivery Details */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <FiTruck className="mr-3 text-primary-600" />
                  Delivery Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Receiver</label>
                    <p className="text-gray-800 font-medium">{orderDetails.receiverName || 'Not specified'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Delivery Address</label>
                    <p className="text-gray-800">{orderDetails.deliveryAddress || 'Not specified'}</p>
                  </div>
                  {orderDetails.deliveryInstructions && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Delivery Instructions</label>
                      <p className="text-gray-800">{orderDetails.deliveryInstructions}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">From</label>
                      <p className="text-gray-800">{orderDetails.from || 'Chennai'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">To</label>
                      <p className="text-gray-800">{orderDetails.toCity || 'Not specified'}</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Estimated Delivery</label>
                    <p className="text-gray-800">{orderDetails.deliveryDuration || 3} day{(orderDetails.deliveryDuration || 3) > 1 ? 's' : ''}</p>
                  </div>
                </div>
              </div>

              {/* Gift Message */}
              {orderDetails.giftMessage && (
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <FiMessageSquare className="mr-3 text-primary-600" />
                    Gift Message
                  </h3>
                  <p className="text-gray-800 italic">"{orderDetails.giftMessage}"</p>
                </div>
              )}

              {/* Order Summary */}
              <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <FiShoppingCart className="mr-3 text-green-600" />
                  Order Summary
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Product Price:</span>
                    <span className="font-medium">₹{(orderDetails.gift?.price || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Quantity:</span>
                    <span className="font-medium">{orderDetails.quantity || 1}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Delivery:</span>
                    <span className="font-medium text-green-600">Free</span>
                  </div>
                  <div className="border-t border-green-200 pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xl font-bold text-gray-800">Total Paid:</span>
                      <span className="text-2xl font-bold text-green-600">₹{(orderDetails.totalPrice || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-4">
                <button
                  onClick={onContinueShopping || onClose}
                  className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-semibold"
                >
                  Continue Shopping
                </button>
                {/* <button
                  onClick={() => {
                    // You can add functionality to download invoice or share order details
                    console.log('Download invoice for order:', orderDetails.orderNumber);
                  }}
                  className="flex-1 px-6 py-3 border border-primary-600 text-primary-600 rounded-xl hover:bg-primary-50 transition-colors font-semibold flex items-center justify-center space-x-2"
                >
                  <FiDownload size={16} />
                  <span>Download Invoice</span>
                </button> */}
              </div>

              {/* Additional Info */}
              <div className="text-center text-sm text-gray-500">
                <p>You'll receive a confirmation email shortly with tracking details.</p>
                <p className="mt-1">For any queries, please contact our support team.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmationModal; 