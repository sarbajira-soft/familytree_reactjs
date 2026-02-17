import React, { useState, useEffect } from 'react';
import { useUser } from '../Contexts/UserContext';
import { FiPackage, FiTruck, FiCreditCard, FiCalendar, FiUser, FiMapPin, FiMessageSquare, FiEdit3, FiCheck, FiX, FiChevronDown, FiSearch } from 'react-icons/fi';
import Swal from 'sweetalert2';

import { getToken } from '../utils/auth';
import { authFetchResponse } from '../utils/authFetch';

const DELIVERY_STATUSES = [
  '', 'pending', 'confirmed', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled', 'returned'
];
const PAYMENT_STATUSES = [
  '', 'unpaid', 'pending', 'paid', 'failed', 'refunded', 'partial_refund'
];

const OrderManagementPage = () => {
  const { userInfo } = useUser();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  // Search/filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  const token = getToken();

  // Fetch orders
  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await authFetchResponse('/order', {
        method: 'GET',
        skipThrow: true,
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.status}`);
      }
      const result = await response.json();

      if (result.success && result.data) {
        setOrders(result.data);
      } else {
        setOrders([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchOrders();
    }
  }, [token]);

  // Handle status update
  const handleStatusUpdate = async (orderId, deliveryStatus, paymentStatus) => {
    try {
      setUpdating(true);
      const response = await authFetchResponse(`/order/${orderId}/status`, {
        method: 'PATCH',
        skipThrow: true,
        body: JSON.stringify({ deliveryStatus, paymentStatus }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to update order: ${response.status}`);
      }
      setOrders(prevOrders => prevOrders.map(order => order.id === orderId ? { ...order, deliveryStatus, paymentStatus, updatedAt: new Date().toISOString() } : order));

      Swal.fire({ icon: 'success', title: 'Order Updated!', text: 'Order status has been updated successfully.', timer: 2000, showConfirmButton: false });
      setIsUpdateModalOpen(false);
      setSelectedOrder(null);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Update Failed', text: err.message || 'Failed to update order status' });
    } finally {
      setUpdating(false);
    }
  };

  // Status badge component
  const StatusBadge = ({ status, type }) => {
    const getStatusColor = (status, type) => {
      const colors = {
        delivery: {
          pending: 'bg-yellow-100 text-yellow-800',
          confirmed: 'bg-blue-100 text-blue-800',
          shipped: 'bg-indigo-100 text-indigo-800',
          in_transit: 'bg-purple-100 text-purple-800',
          out_for_delivery: 'bg-orange-100 text-orange-800',
          delivered: 'bg-green-100 text-green-800',
          cancelled: 'bg-red-100 text-red-800',
          returned: 'bg-gray-100 text-gray-800'
        },
        payment: {
          unpaid: 'bg-red-100 text-red-800',
          pending: 'bg-yellow-100 text-yellow-800',
          paid: 'bg-green-100 text-green-800',
          failed: 'bg-red-100 text-red-800',
          refunded: 'bg-gray-100 text-gray-800',
          partial_refund: 'bg-orange-100 text-orange-800'
        }
      };
      return colors[type][status] || 'bg-gray-100 text-gray-800';
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status, type)}`}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Update modal component
  const UpdateStatusModal = ({ order, isOpen, onClose, onUpdate }) => {
    const [deliveryStatus, setDeliveryStatus] = useState(order?.deliveryStatus || 'pending');
    const [paymentStatus, setPaymentStatus] = useState(order?.paymentStatus || 'unpaid');
    useEffect(() => {
      if (order) {
        setDeliveryStatus(order.deliveryStatus);
        setPaymentStatus(order.paymentStatus);
      }
    }, [order]);
    if (!isOpen || !order) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">Update Order Status</h3>
            <button onClick={onClose} className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200" disabled={updating}>
              <FiX size={20} />
            </button>
          </div>
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Order: {order.orderNumber}</p>
            <p className="text-sm text-gray-600">Product: {order.product?.name || 'N/A'}</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Status</label>
              <select value={deliveryStatus} onChange={(e) => setDeliveryStatus(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" disabled={updating}>
                {DELIVERY_STATUSES.filter(Boolean).map(status => (
                  <option key={status} value={status}>{status.replace('_', ' ').toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Status</label>
              <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" disabled={updating}>
                {PAYMENT_STATUSES.filter(Boolean).map(status => (
                  <option key={status} value={status}>{status.replace('_', ' ').toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button onClick={onClose} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50" disabled={updating}>Cancel</button>
            <button onClick={() => onUpdate(order.id, deliveryStatus, paymentStatus)} disabled={updating} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center">
              {updating ? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Updating...</>) : (<><FiCheck className="mr-2" />Update Status</>)}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Filtered orders
  const filteredOrders = orders.filter(order => {
    // Text search (order number, product name, receiver name)
    const search = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !search ||
      (order.orderNumber && order.orderNumber.toLowerCase().includes(search)) ||
      (order.product?.name && order.product.name.toLowerCase().includes(search)) ||
      (order.receiverName && order.receiverName.toLowerCase().includes(search));
    // Delivery status filter
    const matchesDelivery = !deliveryStatusFilter || order.deliveryStatus === deliveryStatusFilter;
    // Payment status filter
    const matchesPayment = !paymentStatusFilter || order.paymentStatus === paymentStatusFilter;
    return matchesSearch && matchesDelivery && matchesPayment;
  });

  if (loading) {
    return (
      <>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600 border-solid"></div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Management</h1>
          <p className="text-gray-600">Manage and update order delivery and payment status</p>
        </div>
        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6 items-center">
          <div className="relative w-full md:w-1/3">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Search by order number, product, or receiver..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="w-full md:w-48 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={deliveryStatusFilter}
            onChange={e => setDeliveryStatusFilter(e.target.value)}
          >
            <option value="">All Delivery Status</option>
            {DELIVERY_STATUSES.filter(Boolean).map(status => (
              <option key={status} value={status}>{status.replace('_', ' ').toUpperCase()}</option>
            ))}
          </select>
          <select
            className="w-full md:w-48 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={paymentStatusFilter}
            onChange={e => setPaymentStatusFilter(e.target.value)}
          >
            <option value="">All Payment Status</option>
            {PAYMENT_STATUSES.filter(Boolean).map(status => (
              <option key={status} value={status}>{status.replace('_', ' ').toUpperCase()}</option>
            ))}
          </select>
        </div>
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>
        )}
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <FiPackage className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Orders Found</h3>
            <p className="text-gray-500">There are no orders to display at the moment.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const isExpanded = expandedOrderId === order.id;
              return (
                <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-200">
                  {/* Compact Row */}
                  <div className="flex items-center justify-between px-6 py-4 cursor-pointer" onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}>
                    <div className="flex items-center gap-4">
                      <FiPackage className="text-xl text-primary-500" />
                      <div>
                        <div className="font-semibold text-lg">Order #{order.orderNumber}</div>
                        <div className="text-gray-600 text-sm">{order.product?.name || 'Product Name N/A'}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={order.deliveryStatus} type="delivery" />
                      <StatusBadge status={order.paymentStatus} type="payment" />
                      <button className="ml-2 p-2 rounded-full hover:bg-gray-100 transition-colors bg-green-600">
                        <FiChevronDown className={`transition-transform text-white ${isExpanded ? 'rotate-180' : ''}`} size={20} />
                      </button>
                    </div>
                  </div>
                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-8 pb-6 pt-2 animate-fade-in">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4 mt-2">
                        <div className="flex items-center text-sm text-gray-600"><FiUser className="mr-2 text-gray-400" /><span>Receiver: {order.receiverName}</span></div>
                        <div className="flex items-center text-sm text-gray-600"><FiMapPin className="mr-2 text-gray-400" /><span>To: {order.to}</span></div>
                        <div className="flex items-center text-sm text-gray-600"><FiTruck className="mr-2 text-gray-400" /><span>Duration: {order.duration} days</span></div>
                        <div className="flex items-center text-sm text-gray-600"><FiCreditCard className="mr-2 text-gray-400" /><span>Price: ₹{parseFloat(order.price).toLocaleString('en-IN')}</span></div>
                        <div className="flex items-center text-sm text-gray-600"><FiPackage className="mr-2 text-gray-400" /><span>Quantity: {order.quantity}</span></div>
                        <div className="flex items-center text-sm text-gray-600"><FiCalendar className="mr-2 text-gray-400" /><span>Created: {formatDate(order.createdAt)}</span></div>
                      </div>
                      {(order.deliveryInstructions || order.giftMessage) && (
                        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                          {order.deliveryInstructions && (<div className="flex items-start text-sm text-gray-600 mb-2"><FiTruck className="mr-2 text-gray-400 mt-0.5" /><span><strong>Instructions:</strong> {order.deliveryInstructions}</span></div>)}
                          {order.giftMessage && (<div className="flex items-start text-sm text-gray-600"><FiMessageSquare className="mr-2 text-gray-400 mt-0.5" /><span><strong>Message:</strong> {order.giftMessage}</span></div>)}
                        </div>
                      )}
                      <div className="flex justify-end items-center pt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); setIsUpdateModalOpen(true); }}
                          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <FiEdit3 className="mr-2" />Update Status
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <UpdateStatusModal
          order={selectedOrder}
          isOpen={isUpdateModalOpen}
          onClose={() => { setIsUpdateModalOpen(false); setSelectedOrder(null); }}
          onUpdate={handleStatusUpdate}
        />
      </div>
    </>
  );
};

export default OrderManagementPage; 