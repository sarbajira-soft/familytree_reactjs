import React, { useEffect, useState } from 'react';
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheckCircle,
  FiCreditCard,
  FiLoader,
  FiMapPin,
  FiShield,
  FiTruck,
  FiUser,
} from 'react-icons/fi';
import { useRetail } from '../context/RetailContext';
import { formatAmount, getErrorMessage } from '../utils/helpers';
import * as cartService from '../services/cartService';

const emptyAddress = {
  first_name: '',
  last_name: '',
  address_1: '',
  city: '',
  province: '',
  postal_code: '',
  country_code: 'in',
  phone: '',
};

const Checkout = ({ onBack, onContinueShopping, onViewOrders }) => {
  const {
    cart,
    totals,
    getShippingOptionsForCart,
    completeCheckout,
    updateCartAddressesForCheckout,
    loading,
    user,
    token,
    fetchOrders,
    refreshCart,
    createFreshCart,
    startOnlinePayment,
  } = useRetail();

  const [shippingAddress, setShippingAddress] = useState(emptyAddress);
  const [billingAddress, setBillingAddress] = useState(emptyAddress);
  const [sameAsShipping, setSameAsShipping] = useState(true);
  const [shippingOptions, setShippingOptions] = useState([]);
  const [selectedShippingId, setSelectedShippingId] = useState('');
  const [shippingLoading, setShippingLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [addressesUpdated, setAddressesUpdated] = useState(false);
  const [waitingForPayment, setWaitingForPayment] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);

  const savedAddresses = Array.isArray(user?.addresses) ? user.addresses : [];

  useEffect(() => {
    // No automatic shipping option fetch on mount; we now fetch after
    // setting both shipping and billing addresses on the cart.
  }, [cart && cart.id]);

  const handleChange = (setter) => (e) => {
    const { name, value } = e.target;
    setter((prev) => ({ ...prev, [name]: value }));
  };

  const applyAddressToShipping = (addr) => {
    if (!addr) return;
    setShippingAddress((prev) => ({
      ...prev,
      first_name: addr.first_name || '',
      last_name: addr.last_name || '',
      address_1: addr.address_1 || '',
      city: addr.city || '',
      province: addr.province || '',
      postal_code: addr.postal_code || '',
      country_code: addr.country_code || prev.country_code || 'in',
      phone: addr.phone || '',
    }));
  };

  const applyAddressToBilling = (addr) => {
    if (!addr) return;
    setBillingAddress((prev) => ({
      ...prev,
      first_name: addr.first_name || '',
      last_name: addr.last_name || '',
      address_1: addr.address_1 || '',
      city: addr.city || '',
      province: addr.province || '',
      postal_code: addr.postal_code || '',
      country_code: addr.country_code || prev.country_code || 'in',
      phone: addr.phone || '',
    }));
  };

  const validateAddress = (addr) => {
    return (
      addr.first_name.trim() &&
      addr.last_name.trim() &&
      addr.address_1.trim() &&
      addr.city.trim() &&
      addr.province.trim() &&
      addr.postal_code.trim() &&
      addr.country_code.trim() &&
      addr.phone.trim()
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const billing = sameAsShipping ? shippingAddress : billingAddress;

    if (!validateAddress(shippingAddress)) {
      setError('Please complete all required shipping address fields.');
      return;
    }

    if (!sameAsShipping && !validateAddress(billingAddress)) {
      setError('Please complete all required billing address fields.');
      return;
    }

    // If addresses not yet updated, update them and load shipping options
    if (!addressesUpdated) {
      setShippingLoading(true);
      try {
        // 1. Update cart with both shipping and billing addresses in a single PUT
        await updateCartAddressesForCheckout(shippingAddress, billing);

        // 2. Load shipping options after addresses are set
        const fetched = await getShippingOptionsForCart();
        setShippingOptions(fetched);
        setAddressesUpdated(true);

        if (fetched && fetched.length > 0) {
          setSelectedShippingId(fetched[0].id);
        }
      } catch (err) {
        setError(err.message || 'Failed to update address or load shipping options');
      } finally {
        setShippingLoading(false);
      }
      return;
    }

    // If addresses updated but no shipping option selected, show error
    if (!selectedShippingId) {
      setError('Please select a shipping method.');
      return;
    }

    // Now proceed with checkout
    setSubmitting(true);
    setWaitingForPayment(false);
    try {
      if (paymentMethod === 'cod') {
        const order = await completeCheckout(shippingAddress, billing, selectedShippingId);
        setCompletedOrder(order || null);
        setSuccess('Order completed successfully!');
        return;
      }

      // Online payment flow using Razorpay
      const { cartId, paymentCollectionId, razorpaySession } = await startOnlinePayment(
        shippingAddress,
        billing,
        selectedShippingId,
      );

      const loadRazorpayScript = () =>
        new Promise((resolve, reject) => {
          if (window.Razorpay) {
            resolve(window.Razorpay);
            return;
          }

          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.async = true;
          script.onload = () => {
            if (window.Razorpay) {
              resolve(window.Razorpay);
            } else {
              reject(new Error('Razorpay SDK failed to load'));
            }
          };
          script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
          document.body.appendChild(script);
        });

      const RazorpayConstructor = await loadRazorpayScript();

      await new Promise((resolve, reject) => {
        const cartItems = Array.isArray(cart?.items) ? cart.items : [];
        const notesItems = cartItems.slice(0, 10).map((item) => ({
          product_id: item.product_id || item.product?.id || '',
          title: item.title || '',
          variant_id: item.variant_id || item.variant?.id || '',
          quantity: item.quantity ?? 0,
          unit_price:
            item.unit_price ||
            item.unit_price_incl_tax ||
            item.original_item_price ||
            0,
        }));

        const options = {
          key: razorpaySession.razorpay_key_id,
          amount: razorpaySession.amount,
          currency: (razorpaySession.currency || 'INR').toUpperCase(),
          name: 'Familyss Store',
          description: 'Order payment',
          order_id: razorpaySession.order_id,
          prefill: {
            name: `${shippingAddress.first_name} ${shippingAddress.last_name}`.trim(),
            contact: shippingAddress.phone,
            email: user?.email || undefined,
          },
          notes: {
            customer_name: `${shippingAddress.first_name} ${shippingAddress.last_name}`.trim() || undefined,
            customer_phone: shippingAddress.phone || undefined,
            customer_email: user?.email || undefined,
            cart_id: cartId,
            cart_total: typeof totals?.total === 'number' ? String(totals.total) : undefined,
            items: notesItems.length ? JSON.stringify(notesItems) : undefined,
          },
          handler: async function () {
            try {
              // After successful payment in Razorpay, wait for backend webhook
              // to confirm the payment on the payment collection before
              // completing the cart.
              setWaitingForPayment(true);

              const maxAttempts = 20;
              const delayMs = 1500;

              const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

              let isSuccess = false;

              for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
                // eslint-disable-next-line no-await-in-loop
                const cartAfterPayment = await cartService.getCart(
                  cartId,
                  token || null,
                );

                const paymentCollection =
                  cartAfterPayment.payment_collection ||
                  cartAfterPayment.paymentCollection ||
                  null;

                const collectionStatusRaw =
                  paymentCollection?.status ||
                  paymentCollection?.payment_status ||
                  cartAfterPayment.payment_status ||
                  cartAfterPayment.paymentStatus;

                const collectionStatus = (collectionStatusRaw || '').toLowerCase();

                const sessions = Array.isArray(paymentCollection?.payment_sessions)
                  ? paymentCollection.payment_sessions
                  : Array.isArray(paymentCollection?.paymentSessions)
                  ? paymentCollection.paymentSessions
                  : [];

                const primarySession = sessions[0] || null;
                const sessionStatusRaw = primarySession?.status || '';
                const sessionStatus = sessionStatusRaw.toLowerCase();

                const sessionSuccess =
                  sessionStatus === 'authorized' || sessionStatus === 'captured';

                const collectionSuccess =
                  collectionStatus === 'authorized' ||
                  collectionStatus === 'captured' ||
                  collectionStatus === 'succeeded' ||
                  collectionStatus === 'paid';

                isSuccess = sessionSuccess || collectionSuccess;

                if (isSuccess) {
                  break;
                }

                const sessionFailure =
                  sessionStatus === 'canceled' ||
                  sessionStatus === 'failed' ||
                  sessionStatus === 'error';

                const collectionFailure =
                  collectionStatus === 'canceled' ||
                  collectionStatus === 'failed';

                if (sessionFailure || collectionFailure) {
                  throw new Error('Payment did not complete successfully.');
                }

                // eslint-disable-next-line no-await-in-loop
                await sleep(delayMs);
              }

              if (!isSuccess) {
                throw new Error('Timed out waiting for payment confirmation.');
              }

              // Webhook has confirmed payment, now complete the cart.
              const order = await cartService.completeCart(cartId, token || null);
              await fetchOrders();
              await createFreshCart();
              setCompletedOrder(order || null);
              setSuccess('Payment successful! Your order has been placed.');
              resolve();
            } catch (err) {
              setError(getErrorMessage(err));
              refreshCart();
              reject(err);
            } finally {
              setWaitingForPayment(false);
            }
          },
          modal: {
            ondismiss: function () {
              setError('Payment was cancelled before completion.');
              refreshCart();
              reject(new Error('Payment cancelled'));
            },
          },
          theme: {
            color: '#F97316',
          },
        };

        const rzp = new RazorpayConstructor(options);
        rzp.open();
      });
    } catch (err) {
      setError(err.message || 'Checkout failed');
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = submitting || loading || waitingForPayment;

  const completedOrderDisplayId =
    completedOrder?.display_id || completedOrder?.displayId || completedOrder?.id || '';

  const completedOrderPaymentMeta = (() => {
    if (!completedOrder) {
      return {
        label: '',
        className: 'text-xs font-semibold text-gray-900',
      };
    }

    const paymentCollection =
      completedOrder.payment_collection ||
      (Array.isArray(completedOrder.payment_collections)
        ? completedOrder.payment_collections[0]
        : null) ||
      (Array.isArray(completedOrder.paymentCollections)
        ? completedOrder.paymentCollections[0]
        : null);

    const paymentSessions = Array.isArray(paymentCollection?.payment_sessions)
      ? paymentCollection.payment_sessions
      : Array.isArray(paymentCollection?.paymentSessions)
      ? paymentCollection.paymentSessions
      : [];

    const primarySession = paymentSessions[0] || null;

    const rawStatus =
      completedOrder.payment_status ||
      completedOrder.paymentStatus ||
      primarySession?.status ||
      paymentCollection?.payment_status ||
      paymentCollection?.status ||
      null;

    const normalized = rawStatus ? String(rawStatus).toLowerCase() : '';

    let label = rawStatus ? String(rawStatus) : 'paid';
    let className = 'text-xs font-semibold text-gray-900';

    if (
      normalized === 'captured' ||
      normalized === 'succeeded' ||
      normalized === 'paid'
    ) {
      label = 'paid';
      className = 'text-xs font-semibold text-green-600';
    } else if (normalized === 'pending' || normalized === 'awaiting') {
      className = 'text-xs font-semibold text-amber-600';
    } else if (normalized === 'canceled' || normalized === 'failed') {
      className = 'text-xs font-semibold text-red-600';
    }

    return {
      label: label.replace(/_/g, ' '),
      className,
    };
  })();

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600"
            >
              <FiArrowLeft />
            </button>
          )}
          <div>
            <h2 className="text-base font-semibold text-gray-900">Checkout</h2>
            <p className="text-xs text-gray-500">Provide shipping and billing details to complete your order.</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <FiAlertCircle className="text-sm" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
          <FiCheckCircle className="text-sm" />
          <span className="flex-1">{success}</span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)]">
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2 text-sm font-semibold text-gray-900">
            <FiMapPin className="text-blue-500" />
            Shipping address
          </div>

          {savedAddresses.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-[11px] text-gray-500">Use a saved address:</p>
              <div className="flex flex-wrap gap-2">
                {savedAddresses.map((addr) => (
                  <button
                    key={addr.id}
                    type="button"
                    onClick={() => applyAddressToShipping(addr)}
                    className="max-w-[14rem] rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-left text-[11px] text-gray-700 hover:border-blue-400 hover:bg-white"
                    disabled={disabled}
                  >
                    <span className="block font-semibold text-gray-900 truncate">
                      {(addr.first_name || addr.last_name) && (
                        <>
                          {addr.first_name} {addr.last_name}
                        </>
                      )}
                    </span>
                    <span className="block truncate">{addr.address_1}</span>
                    <span className="block truncate">
                      {[addr.city, addr.province, addr.postal_code].filter(Boolean).join(', ')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-medium text-gray-700">First name</label>
              <input
                name="first_name"
                value={shippingAddress.first_name}
                onChange={handleChange(setShippingAddress)}
                disabled={disabled}
                required
                className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-700">Last name</label>
              <input
                name="last_name"
                value={shippingAddress.last_name}
                onChange={handleChange(setShippingAddress)}
                disabled={disabled}
                required
                className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-gray-700">Address</label>
              <input
                name="address_1"
                value={shippingAddress.address_1}
                onChange={handleChange(setShippingAddress)}
                disabled={disabled}
                required
                className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-700">City</label>
              <input
                name="city"
                value={shippingAddress.city}
                onChange={handleChange(setShippingAddress)}
                disabled={disabled}
                required
                className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-700">State / Province</label>
              <input
                name="province"
                value={shippingAddress.province}
                onChange={handleChange(setShippingAddress)}
                disabled={disabled}
                required
                className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-700">Postal code</label>
              <input
                name="postal_code"
                value={shippingAddress.postal_code}
                onChange={handleChange(setShippingAddress)}
                disabled={disabled}
                required
                className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-700">Country code</label>
              <input
                name="country_code"
                value={shippingAddress.country_code}
                onChange={handleChange(setShippingAddress)}
                disabled={disabled}
                required
                className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs uppercase focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-gray-700">Phone</label>
              <input
                name="phone"
                value={shippingAddress.phone}
                onChange={handleChange(setShippingAddress)}
                disabled={disabled}
                required
                className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 text-[11px] text-gray-600">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={sameAsShipping}
                onChange={(e) => setSameAsShipping(e.target.checked)}
                disabled={disabled}
                className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Billing address is same as shipping</span>
            </label>
          </div>

          {!sameAsShipping && (
            <div className="mt-3 space-y-3 rounded-lg bg-gray-50 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
                <FiUser className="text-gray-500" /> Billing address
              </div>
              {savedAddresses.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] text-gray-500">Use a saved address:</p>
                  <div className="flex flex-wrap gap-2">
                    {savedAddresses.map((addr) => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => applyAddressToBilling(addr)}
                        className="max-w-[14rem] rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-left text-[11px] text-gray-700 hover:border-blue-400"
                        disabled={disabled}
                      >
                        <span className="block font-semibold text-gray-900 truncate">
                          {(addr.first_name || addr.last_name) && (
                            <>
                              {addr.first_name} {addr.last_name}
                            </>
                          )}
                        </span>
                        <span className="block truncate">{addr.address_1}</span>
                        <span className="block truncate">
                          {[addr.city, addr.province, addr.postal_code].filter(Boolean).join(', ')}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-medium text-gray-700">First name</label>
                  <input
                    name="first_name"
                    value={billingAddress.first_name}
                    onChange={handleChange(setBillingAddress)}
                    disabled={disabled}
                    required
                    className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-700">Last name</label>
                  <input
                    name="last_name"
                    value={billingAddress.last_name}
                    onChange={handleChange(setBillingAddress)}
                    disabled={disabled}
                    required
                    className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-gray-700">Address</label>
                  <input
                    name="address_1"
                    value={billingAddress.address_1}
                    onChange={handleChange(setBillingAddress)}
                    disabled={disabled}
                    required
                    className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-700">City</label>
                  <input
                    name="city"
                    value={billingAddress.city}
                    onChange={handleChange(setBillingAddress)}
                    disabled={disabled}
                    required
                    className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-700">State / Province</label>
                  <input
                    name="province"
                    value={billingAddress.province}
                    onChange={handleChange(setBillingAddress)}
                    disabled={disabled}
                    required
                    className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-700">Postal code</label>
                  <input
                    name="postal_code"
                    value={billingAddress.postal_code}
                    onChange={handleChange(setBillingAddress)}
                    disabled={disabled}
                    required
                    className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-700">Country code</label>
                  <input
                    name="country_code"
                    value={billingAddress.country_code}
                    onChange={handleChange(setBillingAddress)}
                    disabled={disabled}
                    required
                    className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs uppercase focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-gray-700">Phone</label>
                  <input
                    name="phone"
                    value={billingAddress.phone}
                    onChange={handleChange(setBillingAddress)}
                    disabled={disabled}
                    required
                    className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
              </div>
            </div>
          )}

          {addressesUpdated && (
            <div className="mt-3 space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
                <FiTruck className="text-blue-500" /> Shipping method
              </div>

              {shippingLoading ? (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <FiLoader className="animate-spin" />
                  <span>Loading shipping options...</span>
                </div>
              ) : shippingOptions.length === 0 ? (
                <p className="text-[11px] text-gray-500">
                  No shipping options are available for this address.
                </p>
              ) : (
                <div className="space-y-2">
                  {shippingOptions.map((opt) => (
                    <label
                      key={opt.id}
                      className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs hover:border-blue-400"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="shipping_option"
                          value={opt.id}
                          checked={selectedShippingId === opt.id}
                          onChange={(e) => setSelectedShippingId(e.target.value)}
                          disabled={disabled}
                          className="h-3.5 w-3.5 border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <p className="font-semibold text-gray-800">{opt.name || opt.label || 'Shipping'}</p>
                          {opt.description && (
                            <p className="text-[11px] text-gray-500">{opt.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-xs font-semibold text-gray-900">
                        {formatAmount(opt.amount || 0)}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {addressesUpdated && (
            <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
                <FiCreditCard className="text-orange-500" /> Payment method
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 hover:border-blue-400">
                  <input
                    type="radio"
                    name="payment_method"
                    value="cod"
                    checked={paymentMethod === 'cod'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    disabled={disabled}
                    className="h-3.5 w-3.5 border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Cash on delivery</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 hover:border-blue-400">
                  <input
                    type="radio"
                    name="payment_method"
                    value="online"
                    checked={paymentMethod === 'online'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    disabled={disabled}
                    className="h-3.5 w-3.5 border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Online payment</span>
                </label>
              </div>
              <p className="flex items-center gap-1 text-[11px] text-gray-500">
                <FiShield className="text-green-500" /> Your payment information is processed securely.
              </p>
            </div>
          )}

          {addressesUpdated && (
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
              <input
                id="terms"
                type="checkbox"
                required
                disabled={disabled}
                className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="terms" className="cursor-pointer">
                I agree to the terms and conditions and privacy policy.
              </label>
            </div>
          )}

          {addressesUpdated && (
            <button
              type="submit"
              disabled={disabled || !selectedShippingId}
              className="mt-1 inline-flex w-full items-center justify-center rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 disabled:opacity-50"
            >
              {submitting || waitingForPayment ? (
                <>
                  <FiLoader className="mr-2 animate-spin" />
                  {waitingForPayment
                    ? 'Waiting for payment confirmation...'
                    : 'Processing order...'}
                </>
              ) : !selectedShippingId ? (
                <>Select a shipping method</>
              ) : (
                <>
                  {paymentMethod === 'online'
                    ? 'Pay and complete order'
                    : 'Complete order'}
                </>
              )}
            </button>
          )}

          {!addressesUpdated && (
            <button
              type="submit"
              disabled={disabled || shippingLoading}
              className="mt-1 inline-flex w-full items-center justify-center rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 disabled:opacity-50"
            >
              {shippingLoading ? (
                <>
                  <FiLoader className="mr-2 animate-spin" />
                  Updating address...
                </>
              ) : (
                <>
                  Update address & load shipping
                </>
              )}
            </button>
          )}
        </form>

        <aside className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Order summary</h3>
          <div className="space-y-1 text-xs text-gray-600">
            <div className="flex items-center justify-between">
              <span>Items total</span>
              <span className="font-medium text-gray-900">{formatAmount(totals.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>GST (included)</span>
              <span className="font-medium text-gray-900">{formatAmount(totals.tax)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Shipping</span>
              <span className="font-medium text-gray-900">
                {totals.shipping > 0 ? formatAmount(totals.shipping) : 'Calculated above'}
              </span>
            </div>
            <div className="mt-1 border-t border-gray-100 pt-2 text-sm font-semibold text-gray-900">
              <div className="flex items-center justify-between">
                <span>Total</span>
                <span>{formatAmount(totals.total)}</span>
              </div>
            </div>
          </div>

          <div className="mt-1 space-y-1 text-[11px] text-gray-500">
            <p>All prices are in INR. GST is included where applicable.</p>
            <p>
              Once completed, your order will appear in the order history tab where you can track its
              status.
            </p>
          </div>
        </aside>
      </div>

      {completedOrder && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 text-white shadow-lg">
              <FiCheckCircle className="text-3xl" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Thank you for ordering!</h3>
            <p className="mt-1 text-xs text-gray-500">
              {completedOrderDisplayId
                ? `Your order #${completedOrderDisplayId} has been placed successfully.`
                : 'Your order has been placed successfully.'}
            </p>

            <div className="mt-4 w-full rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-800">
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <p className="text-[11px] font-medium text-gray-500">Payment status</p>
                </div>
                <div className="text-right">
                  <p className={completedOrderPaymentMeta.className}>
                    {completedOrderPaymentMeta.label}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-[11px] font-medium text-gray-500">Order total</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatAmount(
                    typeof completedOrder.total === 'number' ? completedOrder.total : 0,
                  )}
                </p>
              </div>
            </div>

            <p className="mt-3 text-[11px] text-gray-500">
              You can view full order and transaction details anytime in the
              {' '}
              <span className="font-medium">Orders</span>
              {' '}
              tab.
            </p>

            <div className="mt-5 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => {
                  setCompletedOrder(null);
                  if (onBack) onBack();
                  if (typeof onViewOrders === 'function') {
                    onViewOrders();
                  }
                }}
                className="inline-flex flex-1 items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 sm:flex-none sm:px-5"
              >
                View order
              </button>
              <button
                type="button"
                onClick={() => {
                  setCompletedOrder(null);
                  if (typeof onContinueShopping === 'function') {
                    onContinueShopping();
                  } else if (onBack) {
                    onBack();
                  }
                }}
                className="inline-flex flex-1 items-center justify-center rounded-full bg-orange-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-orange-600 sm:flex-none sm:px-5"
              >
                Continue shopping
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Checkout;
