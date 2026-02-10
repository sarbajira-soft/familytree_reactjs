import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
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
  FiGift,
} from 'react-icons/fi';
import { useRetail } from '../context/RetailContext';
import { useGiftEvent } from '../../Contexts/GiftEventContext';
import { formatAmount, getErrorMessage, calculateCartTotals } from '../utils/helpers';
import { MEDUSA_BASE_URL, MEDUSA_PUBLISHABLE_KEY } from '../utils/constants';
import * as cartService from '../services/cartService';

const emptyAddress = {
  first_name: '',
  last_name: '',
  address_1: '',
  address_2: '',
  city: '',
  province: '',
  postal_code: '',
  country_code: 'in',
  phone: '',
};

const normalizeCountryCode = (value) => (value || '').toString().trim().toLowerCase();

const digitsOnly = (value) => (value || '').toString().replace(/\D+/g, '');

const formatDeliveryEstimate = (opt) => {
  const rawDays = opt?.metadata?.eta_days;
  const eta = opt?.metadata?.eta;

  const days =
    typeof rawDays === 'number' && Number.isFinite(rawDays)
      ? rawDays
      : typeof eta === 'number' && Number.isFinite(eta)
      ? eta
      : typeof eta === 'string'
      ? Number(String(eta).trim())
      : null;

  if (typeof days === 'number' && Number.isFinite(days) && days > 0) {
    return `Delivers in ${days} day${days === 1 ? '' : 's'}`;
  }

  if (typeof eta === 'string' && eta.trim()) {
    return `Delivery estimate: ${eta.trim()}`;
  }

  return '';
};

const validateAddressFields = (addr) => {
  const errors = {};

  const firstName = (addr?.first_name || '').toString().trim();
  const lastName = (addr?.last_name || '').toString().trim();
  const address1 = (addr?.address_1 || '').toString().trim();
  const city = (addr?.city || '').toString().trim();
  const province = (addr?.province || '').toString().trim();
  const postal = (addr?.postal_code || '').toString().trim();
  const country = normalizeCountryCode(addr?.country_code);
  const phone = (addr?.phone || '').toString().trim();

  const nameRegex = /^[a-zA-Z\s.'-]{2,}$/;

  if (!firstName) errors.first_name = 'First name is required';
  else if (!nameRegex.test(firstName)) errors.first_name = 'Enter a valid first name';

  if (lastName && !nameRegex.test(lastName)) errors.last_name = 'Enter a valid last name';

  if (!address1) errors.address_1 = 'Address is required';
  if (!city) errors.city = 'City is required';
  if (!province) errors.province = 'State / Province is required';

  if (!postal) errors.postal_code = 'Postal code is required';
  else if (country === 'in') {
    if (!/^\d{6}$/.test(postal)) errors.postal_code = 'Enter a valid 6-digit pincode';
  } else if (!/^[a-zA-Z0-9\-\s]{3,10}$/.test(postal)) {
    errors.postal_code = 'Enter a valid postal code';
  }

  if (!country) errors.country_code = 'Country code is required';
  else if (!/^[a-z]{2}$/.test(country)) errors.country_code = 'Use 2-letter country code (e.g., IN)';

  if (!phone) errors.phone = 'Phone is required';
  else if (!/^\d{6,14}$/.test(phone)) errors.phone = 'Enter a valid phone number';

  return errors;
};

async function checkShiprocketServiceability(postalCode, token) {
  if (!postalCode || !postalCode.trim()) {
    return { serviceable: false, error: 'postal_code_missing' };
  }

  const res = await axios.post(
    `${MEDUSA_BASE_URL}/store/shiprocket/serviceability`,
    { postal_code: postalCode.trim() },
    {
      headers: {
        'x-publishable-api-key': MEDUSA_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );

  return res.data;
}

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

  const { selectedGiftEvent } = useGiftEvent();

  const [shippingAddress, setShippingAddress] = useState(emptyAddress);
  const [billingAddress, setBillingAddress] = useState(emptyAddress);
  const [sameAsShipping, setSameAsShipping] = useState(true);
  const [shippingOptions, setShippingOptions] = useState([]);
  const [selectedShippingId, setSelectedShippingId] = useState('');
  const [shippingLoading, setShippingLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [addressesUpdated, setAddressesUpdated] = useState(false);
  const [waitingForPayment, setWaitingForPayment] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [showGiftAddressConfirm, setShowGiftAddressConfirm] = useState(false);
  const [giftAddressSuggestion, setGiftAddressSuggestion] = useState(null);
  const [shippingErrors, setShippingErrors] = useState({});
  const [billingErrors, setBillingErrors] = useState({});
  const [shippingTouched, setShippingTouched] = useState({});
  const [billingTouched, setBillingTouched] = useState({});

  const displayTotals = completedOrder ? calculateCartTotals(completedOrder) : totals;
  const [giftAddressLoading, setGiftAddressLoading] = useState(false);

  const lastShippingPostalRef = useRef('');

  const savedAddresses = Array.isArray(user?.addresses) ? user.addresses : [];

  useEffect(() => {
    if (!selectedGiftEvent) {
      setGiftAddressSuggestion(null);
      return;
    }

    const recipientUserId =
      selectedGiftEvent.memberDetails?.userId ||
      selectedGiftEvent.createdBy ||
      selectedGiftEvent.userId;

    if (!recipientUserId) {
      setGiftAddressSuggestion(null);
      return;
    }

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
    if (!API_BASE_URL) {
      return;
    }

    const appToken = localStorage.getItem('access_token');
    if (!appToken) {
      return;
    }

    let cancelled = false;

    const loadGiftAddress = async () => {
      try {
        setGiftAddressLoading(true);

        const res = await axios.get(
          `${API_BASE_URL}/user/gift-address/${recipientUserId}`,
          {
            headers: {
              Authorization: `Bearer ${appToken}`,
            },
          },
        );

        if (cancelled) return;

        const addr = res.data?.data;
        if (!addr || !addr.address) {
          setGiftAddressSuggestion(null);
          return;
        }

        const rawAddress = addr.address || '';
        let addressLine1 = rawAddress;
        let city = '';
        let province = '';
        let postalCode = '';

        if (rawAddress) {
          const lines = rawAddress
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);

          const firstLine = lines[0] || '';
          const restLines = lines.slice(1).join(', ');
          let segments = restLines
            ? restLines.split(',').map((s) => s.trim()).filter(Boolean)
            : [];

          if (!segments.length && firstLine.includes(',')) {
            const parts = firstLine
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            addressLine1 = parts.shift() || '';
            segments = parts;
          } else {
            addressLine1 = firstLine || rawAddress;
          }

          if (segments.length) {
            const last = segments[segments.length - 1];
            if (/\d/.test(last)) {
              postalCode = last;
              const locationParts = segments.slice(0, -1);
              if (locationParts.length) {
                city = locationParts[0];
                province = locationParts.slice(1).join(', ');
              }
            } else {
              city = segments[0];
              province = segments.slice(1).join(', ');
            }
          }
        }

        const giftAddress = {
          first_name: addr.firstName || '',
          last_name: addr.lastName || '',
          address_1: addressLine1 || rawAddress,
          city,
          province,
          postal_code: postalCode,
          country_code: 'in',
          phone: addr.contactNumber || '',
        };

        setGiftAddressSuggestion(giftAddress);
      } catch (err) {
        console.error('Failed to load gifting address', err);
        setGiftAddressSuggestion(null);
      } finally {
        if (!cancelled) {
          setGiftAddressLoading(false);
        }
      }
    };

    loadGiftAddress();

    return () => {
      cancelled = true;
    };
  }, [selectedGiftEvent]);

  useEffect(() => {
    const currentPostal = (shippingAddress?.postal_code || '').toString().trim();

    if (!addressesUpdated) {
      lastShippingPostalRef.current = currentPostal;
      return;
    }

    const prevPostal = (lastShippingPostalRef.current || '').toString().trim();

    if (prevPostal && currentPostal && prevPostal !== currentPostal) {
      setAddressesUpdated(false);
      setPaymentMethod('');
      setShippingOptions([]);
      setSelectedShippingId('');
      setError(null);
      setSuccess(null);

      if (cart && cart.id) {
        Promise.resolve(cartService.clearShippingMethods(cart.id, token || null)).catch(
          () => {}
        );
      }
    }

    lastShippingPostalRef.current = currentPostal;
  }, [addressesUpdated, shippingAddress?.postal_code, cart && cart.id, token]);

  useEffect(() => {
    // No automatic shipping option fetch on mount; we now fetch after
    // setting both shipping and billing addresses on the cart.
  }, [cart && cart.id]);

  useEffect(() => {
    if (!addressesUpdated || !paymentMethod) {
      return;
    }

    let cancelled = false;
    const mode = paymentMethod || undefined;

    const loadShippingOptions = async () => {
      setShippingLoading(true);
      setError(null);
      try {
          const fetched = await getShippingOptionsForCart(mode);
        if (cancelled) return;
        setShippingOptions(fetched);
        if (fetched && fetched.length > 0) {
          setSelectedShippingId(fetched[0].id);
        } else {
          setSelectedShippingId('');
        }
      } catch (err) {
        if (cancelled) return;
        setError(getErrorMessage(err) || 'Failed to load shipping options');
      } finally {
        if (!cancelled) {
          setShippingLoading(false);
        }
      }
    };

    loadShippingOptions();

    return () => {
      cancelled = true;
    };
  }, [addressesUpdated, paymentMethod, getShippingOptionsForCart]);

  useEffect(() => {
    if (!completedOrder) return;
    setAddressesUpdated(false);
    setPaymentMethod('');
    setShippingOptions([]);
    setSelectedShippingId('');
  }, [completedOrder]);

  const handleChange = (setter) => (e) => {
    const { name, value } = e.target;
    setter((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddressInputChange = (setter, setErrors, setTouched) => (e) => {
    const { name, value } = e.target;
    const nextValue =
      name === 'country_code'
        ? normalizeCountryCode(value)
        : name === 'postal_code' || name === 'phone'
        ? digitsOnly(value)
        : value;

    setter((prev) => {
      const next = { ...prev, [name]: nextValue };
      setErrors((curr) => {
        const nextErrors = { ...curr };
        delete nextErrors[name];
        return nextErrors;
      });
      return next;
    });

    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleAddressInputBlur = (addr, setErrors, setTouched) => (e) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const nextErrors = validateAddressFields(addr);
    setErrors(nextErrors);
  };

  const handleClearShipping = () => {
    setShippingAddress(emptyAddress);
    if (sameAsShipping) {
      setBillingAddress(emptyAddress);
    }
  };

  const applyAddressToShipping = (addr) => {
    if (!addr) return;
    setShippingAddress((prev) => ({
      ...prev,
      first_name: addr.first_name || '',
      last_name: addr.last_name || '',
      address_1: addr.address_1 || '',
      address_2: addr.address_2 || '',
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
      address_2: addr.address_2 || '',
      city: addr.city || '',
      province: addr.province || '',
      postal_code: addr.postal_code || '',
      country_code: addr.country_code || prev.country_code || 'in',
      phone: addr.phone || '',
    }));
  };

  const validateAddress = (addr) => {
    const errs = validateAddressFields(addr);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const billing = sameAsShipping ? shippingAddress : billingAddress;

    const nextShippingErrors = validateAddressFields(shippingAddress);
    const nextBillingErrors = sameAsShipping ? {} : validateAddressFields(billingAddress);

    setShippingErrors(nextShippingErrors);
    setBillingErrors(nextBillingErrors);
    setShippingTouched({
      first_name: true,
      last_name: true,
      address_1: true,
      city: true,
      province: true,
      postal_code: true,
      country_code: true,
      phone: true,
    });
    if (!sameAsShipping) {
      setBillingTouched({
        first_name: true,
        last_name: true,
        address_1: true,
        city: true,
        province: true,
        postal_code: true,
        country_code: true,
        phone: true,
      });
    }

    if (Object.keys(nextShippingErrors).length > 0) {
      setError('Please complete all required shipping address fields.');
      return;
    }

    if (!sameAsShipping && Object.keys(nextBillingErrors).length > 0) {
      setError('Please complete all required billing address fields.');
      return;
    }

    // If addresses not yet updated, update them first. We will show payment
    // mode next, and only then load shipping options (so COD flag is correct).
    if (!addressesUpdated) {
      setShippingLoading(true);
      try {
        // Before updating cart and loading shipping options, check Shiprocket serviceability
        const svc = await checkShiprocketServiceability(
          shippingAddress.postal_code,
          token || null,
        );

        if (!svc || svc.serviceable === false) {
          const message =
            svc && svc.error
              ? 'We currently do not deliver to this pincode. Please use a different shipping address.'
              : 'We could not verify delivery availability for this pincode. Please try again or use a different address.';

          setError(message);
          return;
        }

        // 1. Update cart with both shipping and billing addresses in a single PUT
        await updateCartAddressesForCheckout(shippingAddress, billing);

        // 2. Mark that addresses are updated. We will fetch shipping options
        // after the user chooses a payment method (COD vs online), so that
        // the Shiprocket rate calculator can apply the correct COD flag.
        setAddressesUpdated(true);
      } catch (err) {
        setError(getErrorMessage(err) || 'Failed to update address or load shipping options');
      } finally {
        setShippingLoading(false);
      }
      return;
    }

    // If addresses updated but no payment method selected, show error
    if (!paymentMethod) {
      setError('Please select a payment method.');
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
      const selectedOption =
        shippingOptions && shippingOptions.length > 0
          ? shippingOptions.find((opt) => opt.id === selectedShippingId) || null
          : null;

      const shippingMeta = selectedOption
        ? {
            shipping_type: selectedOption.metadata?.shipping_type || null,
            shiprocket_eta: selectedOption.metadata?.eta || null,
            shiprocket_eta_days:
              typeof selectedOption.metadata?.eta_days === 'number'
                ? selectedOption.metadata.eta_days
                : null,
            // Forward payment mode so the Shiprocket provider can
            // distinguish COD vs online when the shipping method
            // is actually attached to the cart.
            payment_mode: paymentMethod || null,
          }
        : null;

      if (paymentMethod === 'cod') {
        const order = await completeCheckout(
          shippingAddress,
          billing,
          selectedShippingId,
          shippingMeta,
        );
        setCompletedOrder(order || null);
        setSuccess('Order completed successfully!');
        return;
      }

      // Online payment flow using Razorpay
      const { cartId, paymentCollectionId, razorpaySession } = await startOnlinePayment(
        shippingAddress,
        billing,
        selectedShippingId,
        shippingMeta,
      );

      // Fetch a fresh cart snapshot after applying shipping method so that
      // shipping_methods and totals are up-to-date for Razorpay notes.
      const cartForNotes = await cartService.getCart(cartId, token || null);
      const totalsForNotes = calculateCartTotals(cartForNotes);

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
        const cartItems = Array.isArray(cartForNotes?.items) ? cartForNotes.items : [];
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

        const shippingTotalFromTotals =
          typeof totalsForNotes?.shipping === 'number'
            ? totalsForNotes.shipping
            : null;

        const shippingMethods = Array.isArray(cartForNotes?.shipping_methods)
          ? cartForNotes.shipping_methods
          : Array.isArray(cartForNotes?.shippingMethods)
          ? cartForNotes.shippingMethods
          : [];

        const shippingTotalFromCart = shippingMethods.reduce((sum, sm) => {
          const amount =
            sm?.amount ?? sm?.price ?? sm?.total ?? sm?.original_total ?? null;
          const num = typeof amount === 'number' ? amount : Number(amount);
          return Number.isFinite(num) ? sum + num : sum;
        }, 0);

        const shippingTotalValue =
          typeof shippingTotalFromTotals === 'number'
            ? shippingTotalFromTotals
            : shippingTotalFromCart > 0
            ? shippingTotalFromCart
            : null;

        const totalFromTotals =
          typeof totalsForNotes?.total === 'number'
            ? totalsForNotes.total
            : null;

        const itemsTotal = cartItems.reduce((sum, item) => {
          const qty = typeof item?.quantity === 'number' ? item.quantity : Number(item?.quantity || 0);
          const unit =
            item?.unit_price ??
            item?.unit_price_incl_tax ??
            item?.original_item_price ??
            0;
          const unitNum = typeof unit === 'number' ? unit : Number(unit);
          if (!Number.isFinite(qty) || !Number.isFinite(unitNum)) {
            return sum;
          }
          return sum + qty * unitNum;
        }, 0);

        const totalAmountValue =
          typeof totalFromTotals === 'number'
            ? totalFromTotals
            : typeof shippingTotalValue === 'number'
            ? itemsTotal + shippingTotalValue
            : itemsTotal;

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
            cart_total:
              typeof totalsForNotes?.total === 'number' ? String(totalsForNotes.total) : undefined,
            shipping_total:
              typeof shippingTotalValue === 'number' ? String(shippingTotalValue) : undefined,
            items: notesItems.length ? JSON.stringify(notesItems) : undefined,
          },
          handler: async function () {
            try {
              // After successful payment in Razorpay, wait for backend webhook
              // to confirm the payment on the payment collection before
              // completing the cart.
              setWaitingForPayment(true);

              const paymentArgs = arguments && arguments.length ? arguments[0] : null;
              const razorpay_payment_id = paymentArgs?.razorpay_payment_id;
              const razorpay_order_id = paymentArgs?.razorpay_order_id;
              const razorpay_signature = paymentArgs?.razorpay_signature;

              if (razorpay_payment_id && razorpay_order_id && razorpay_signature && paymentCollectionId) {
                try {
                  await cartService.verifyRazorpayPayment({
                    paymentCollectionId,
                    razorpay_order_id,
                    razorpay_payment_id,
                    razorpay_signature,
                    token: token || null,
                  });
                } catch (e) {
                  // Ignore verify failures and fall back to polling.
                }
              }

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
              const isCartAlreadyCompletedError = (e) => {
                const msg =
                  e?.response?.data?.message ||
                  e?.response?.data?.error ||
                  e?.message ||
                  '';

                const status = e?.response?.status;

                const normalized = String(msg).toLowerCase();
                return (
                  status === 409 ||
                  normalized.includes('already completed') ||
                  normalized.includes('cart is completed') ||
                  normalized.includes('cart completed')
                );
              };

              try {
                const order = await cartService.completeCart(cartId, token || null);
                await fetchOrders();
                await createFreshCart();
                setCompletedOrder(order || null);
                setSuccess('Payment successful! Your order has been placed.');
                resolve();
              } catch (completeErr) {
                if (isCartAlreadyCompletedError(completeErr)) {
                  await fetchOrders();
                  await createFreshCart();
                  setCompletedOrder(null);
                  setSuccess('Payment successful! Your order has been placed.');
                  resolve();
                }

                throw completeErr;
              }
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

  if (selectedGiftEvent && giftAddressLoading) {
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

        <div className="flex items-center justify-center py-10 text-xs text-gray-600">
          <FiLoader className="mr-2 animate-spin" />
          Loading gifting address...
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="bg-white inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600"
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

      {selectedGiftEvent && user && giftAddressSuggestion && (
        <div className="rounded-2xl border border-purple-100 bg-purple-50 px-3 py-2 text-[11px] text-gray-800 flex items-start gap-2">
          <div className="mt-0.5 text-purple-500">
            <FiGift size={14} />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-purple-700 mb-1">
              You are sending a gift for:
            </p>
            <p className="text-[11px] font-semibold text-gray-900">
              {selectedGiftEvent.eventTitle || 'Family Event'}
            </p>
            <p className="text-[11px] text-gray-600">
              {selectedGiftEvent.eventDate}
              {selectedGiftEvent.eventTime ? ` • ${selectedGiftEvent.eventTime}` : ''}
            </p>
            {selectedGiftEvent.memberDetails?.firstName && (
              <p className="text-[11px] text-gray-600 mt-0.5">
                For {selectedGiftEvent.memberDetails.firstName}
                {selectedGiftEvent.memberDetails.lastName ? ` ${selectedGiftEvent.memberDetails.lastName}` : ''}
              </p>
            )}
            <p className="mt-1 text-[11px] text-gray-600">
              Shipping to: {giftAddressSuggestion.address_1}
              {giftAddressSuggestion.city || giftAddressSuggestion.province
                ? `, ${[giftAddressSuggestion.city, giftAddressSuggestion.province]
                    .filter(Boolean)
                    .join(', ')}`
                : ''}
              {giftAddressSuggestion.postal_code ? ` - ${giftAddressSuggestion.postal_code}` : ''}. Phone: {giftAddressSuggestion.phone}
            </p>
            <button
              type="button"
              onClick={() => setShowGiftAddressConfirm(true)}
              className="mt-1 inline-flex items-center gap-1 rounded-full border border-purple-300 bg-white px-3 py-1 text-[11px] font-semibold text-purple-700 hover:bg-purple-50"
            >
              Review address for this event
            </button>
          </div>
        </div>
      )}

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
        <form
          onSubmit={handleSubmit}
          className="order-2 md:order-1 space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-gray-100 pb-2 text-sm font-semibold text-gray-900">
            <div className="flex items-center gap-2">
              <FiMapPin className="text-blue-500" />
              Shipping address
            </div>
            <button
              type="button"
              onClick={handleClearShipping}
              disabled={disabled}
              className=" bg-white text-[11px] font-medium text-gray-500 hover:text-red-600 hover:underline"
            >
              Clear
            </button>
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
                    className="w-56 h-16 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-left text-[11px] leading-4 text-gray-700 hover:border-blue-400 hover:bg-white overflow-hidden flex flex-col justify-center"
                    disabled={disabled}
                  >
                    <span className="block font-semibold text-gray-900 truncate">
                      {addr.first_name} {addr.last_name}
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
                onChange={handleAddressInputChange(setShippingAddress, setShippingErrors, setShippingTouched)}
                onBlur={handleAddressInputBlur(shippingAddress, setShippingErrors, setShippingTouched)}
                disabled={disabled}
                required
                className={`mt-1 w-full rounded-md border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 ${
                  shippingTouched.first_name && shippingErrors.first_name
                    ? 'border-red-300 focus:border-red-400 focus:ring-red-300'
                    : 'border-gray-300 focus:border-blue-400 focus:ring-blue-400'
                }`}
              />
              {shippingTouched.first_name && shippingErrors.first_name && (
                <p className="mt-1 text-[11px] text-red-600">{shippingErrors.first_name}</p>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-700">Last name</label>
              <input
                name="last_name"
                value={shippingAddress.last_name}
                onChange={handleAddressInputChange(setShippingAddress, setShippingErrors, setShippingTouched)}
                onBlur={handleAddressInputBlur(shippingAddress, setShippingErrors, setShippingTouched)}
                disabled={disabled}
                className={`mt-1 w-full rounded-md border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 ${
                  shippingTouched.last_name && shippingErrors.last_name
                    ? 'border-red-300 focus:border-red-400 focus:ring-red-300'
                    : 'border-gray-300 focus:border-blue-400 focus:ring-blue-400'
                }`}
              />
              {shippingTouched.last_name && shippingErrors.last_name && (
                <p className="mt-1 text-[11px] text-red-600">{shippingErrors.last_name}</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-gray-700">Address Line 1</label>
              <input
                name="address_1"
                value={shippingAddress.address_1}
                onChange={handleAddressInputChange(setShippingAddress, setShippingErrors, setShippingTouched)}
                onBlur={handleAddressInputBlur(shippingAddress, setShippingErrors, setShippingTouched)}
                disabled={disabled}
                required
                className={`mt-1 w-full rounded-md border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 ${
                  shippingTouched.address_1 && shippingErrors.address_1
                    ? 'border-red-300 focus:border-red-400 focus:ring-red-300'
                    : 'border-gray-300 focus:border-blue-400 focus:ring-blue-400'
                }`}
              />
              {shippingTouched.address_1 && shippingErrors.address_1 && (
                <p className="mt-1 text-[11px] text-red-600">{shippingErrors.address_1}</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-gray-700">Address line 2</label>
              <input
                name="address_2"
                value={shippingAddress.address_2}
                onChange={handleAddressInputChange(setShippingAddress, setShippingErrors, setShippingTouched)}
                disabled={disabled}
                placeholder="Landmark / Apartment / Floor (optional)"
                className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-700">City</label>
              <input
                name="city"
                value={shippingAddress.city}
                onChange={handleAddressInputChange(setShippingAddress, setShippingErrors, setShippingTouched)}
                onBlur={handleAddressInputBlur(shippingAddress, setShippingErrors, setShippingTouched)}
                disabled={disabled}
                required
                className={`mt-1 w-full rounded-md border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 ${
                  shippingTouched.city && shippingErrors.city
                    ? 'border-red-300 focus:border-red-400 focus:ring-red-300'
                    : 'border-gray-300 focus:border-blue-400 focus:ring-blue-400'
                }`}
              />
              {shippingTouched.city && shippingErrors.city && (
                <p className="mt-1 text-[11px] text-red-600">{shippingErrors.city}</p>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-700">State / Province</label>
              <input
                name="province"
                value={shippingAddress.province}
                onChange={handleAddressInputChange(setShippingAddress, setShippingErrors, setShippingTouched)}
                onBlur={handleAddressInputBlur(shippingAddress, setShippingErrors, setShippingTouched)}
                disabled={disabled}
                required
                className={`mt-1 w-full rounded-md border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 ${
                  shippingTouched.province && shippingErrors.province
                    ? 'border-red-300 focus:border-red-400 focus:ring-red-300'
                    : 'border-gray-300 focus:border-blue-400 focus:ring-blue-400'
                }`}
              />
              {shippingTouched.province && shippingErrors.province && (
                <p className="mt-1 text-[11px] text-red-600">{shippingErrors.province}</p>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-700">Postal code</label>
              <input
                name="postal_code"
                value={shippingAddress.postal_code}
                onChange={handleAddressInputChange(setShippingAddress, setShippingErrors, setShippingTouched)}
                onBlur={handleAddressInputBlur(shippingAddress, setShippingErrors, setShippingTouched)}
                disabled={disabled}
                required
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={10}
                className={`mt-1 w-full rounded-md border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 ${
                  shippingTouched.postal_code && shippingErrors.postal_code
                    ? 'border-red-300 focus:border-red-400 focus:ring-red-300'
                    : 'border-gray-300 focus:border-blue-400 focus:ring-blue-400'
                }`}
              />
              {shippingTouched.postal_code && shippingErrors.postal_code && (
                <p className="mt-1 text-[11px] text-red-600">{shippingErrors.postal_code}</p>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-700">Country code</label>
              <input
                name="country_code"
                value={shippingAddress.country_code}
                onChange={handleAddressInputChange(setShippingAddress, setShippingErrors, setShippingTouched)}
                onBlur={handleAddressInputBlur(shippingAddress, setShippingErrors, setShippingTouched)}
                disabled={disabled}
                required
                className={`mt-1 w-full rounded-md border px-2.5 py-1.5 text-xs uppercase focus:outline-none focus:ring-1 ${
                  shippingTouched.country_code && shippingErrors.country_code
                    ? 'border-red-300 focus:border-red-400 focus:ring-red-300'
                    : 'border-gray-300 focus:border-blue-400 focus:ring-blue-400'
                }`}
              />
              {shippingTouched.country_code && shippingErrors.country_code && (
                <p className="mt-1 text-[11px] text-red-600">{shippingErrors.country_code}</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-gray-700">Phone</label>
              <input
                name="phone"
                value={shippingAddress.phone}
                onChange={handleAddressInputChange(setShippingAddress, setShippingErrors, setShippingTouched)}
                onBlur={handleAddressInputBlur(shippingAddress, setShippingErrors, setShippingTouched)}
                disabled={disabled}
                required
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={14}
                className={`mt-1 w-full rounded-md border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 ${
                  shippingTouched.phone && shippingErrors.phone
                    ? 'border-red-300 focus:border-red-400 focus:ring-red-300'
                    : 'border-gray-300 focus:border-blue-400 focus:ring-blue-400'
                }`}
              />
              {shippingTouched.phone && shippingErrors.phone && (
                <p className="mt-1 text-[11px] text-red-600">{shippingErrors.phone}</p>
              )}
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
                        className="w-56 h-16 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-left text-[11px] leading-4 text-gray-700 hover:border-blue-400 overflow-hidden flex flex-col justify-center"
                        disabled={disabled}
                      >
                        <span className="block font-semibold text-gray-900 truncate">
                          {addr.first_name} {addr.last_name}
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
                    onChange={handleAddressInputChange(setBillingAddress, setBillingErrors, setBillingTouched)}
                    onBlur={handleAddressInputBlur(billingAddress, setBillingErrors, setBillingTouched)}
                    disabled={disabled}
                    required
                    className={`mt-1 w-full rounded-md border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 ${
                      billingTouched.first_name && billingErrors.first_name
                        ? 'border-red-300 focus:border-red-400 focus:ring-red-300'
                        : 'border-gray-300 focus:border-blue-400 focus:ring-blue-400'
                    }`}
                  />
                  {billingTouched.first_name && billingErrors.first_name && (
                    <p className="mt-1 text-[11px] text-red-600">{billingErrors.first_name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-700">Last name</label>
                  <input
                    name="last_name"
                    value={billingAddress.last_name}
                    onChange={handleAddressInputChange(setBillingAddress, setBillingErrors, setBillingTouched)}
                    onBlur={handleAddressInputBlur(billingAddress, setBillingErrors, setBillingTouched)}
                    disabled={disabled}
                    className={`mt-1 w-full rounded-md border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 ${
                      billingTouched.last_name && billingErrors.last_name
                        ? 'border-red-300 focus:border-red-400 focus:ring-red-300'
                        : 'border-gray-300 focus:border-blue-400 focus:ring-blue-400'
                    }`}
                  />
                  {billingTouched.last_name && billingErrors.last_name && (
                    <p className="mt-1 text-[11px] text-red-600">{billingErrors.last_name}</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-gray-700">Address</label>
                  <input
                    name="address_1"
                    value={billingAddress.address_1}
                    onChange={handleAddressInputChange(setBillingAddress, setBillingErrors, setBillingTouched)}
                    onBlur={handleAddressInputBlur(billingAddress, setBillingErrors, setBillingTouched)}
                    disabled={disabled}
                    required
                    className={`mt-1 w-full rounded-md border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 ${
                      billingTouched.address_1 && billingErrors.address_1
                        ? 'border-red-300 focus:border-red-400 focus:ring-red-300'
                        : 'border-gray-300 focus:border-blue-400 focus:ring-blue-400'
                    }`}
                  />
                  {billingTouched.address_1 && billingErrors.address_1 && (
                    <p className="mt-1 text-[11px] text-red-600">{billingErrors.address_1}</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-gray-700">Address line 2</label>
                  <input
                    name="address_2"
                    value={billingAddress.address_2}
                    onChange={handleAddressInputChange(setBillingAddress, setBillingErrors, setBillingTouched)}
                    disabled={disabled}
                    placeholder="Landmark / Apartment / Floor (optional)"
                    className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-700">City</label>
                  <input
                    name="city"
                    value={billingAddress.city}
                    onChange={handleAddressInputChange(setBillingAddress, setBillingErrors, setBillingTouched)}
                    onBlur={handleAddressInputBlur(billingAddress, setBillingErrors, setBillingTouched)}
                    disabled={disabled}
                    required
                    className={`mt-1 w-full rounded-md border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 ${
                      billingTouched.city && billingErrors.city
                        ? 'border-red-300 focus:border-red-400 focus:ring-red-300'
                        : 'border-gray-300 focus:border-blue-400 focus:ring-blue-400'
                    }`}
                  />
                  {billingTouched.city && billingErrors.city && (
                    <p className="mt-1 text-[11px] text-red-600">{billingErrors.city}</p>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-700">State / Province</label>
                  <input
                    name="province"
                    value={billingAddress.province}
                    onChange={handleAddressInputChange(setBillingAddress, setBillingErrors, setBillingTouched)}
                    onBlur={handleAddressInputBlur(billingAddress, setBillingErrors, setBillingTouched)}
                    disabled={disabled}
                    required
                    className={`mt-1 w-full rounded-md border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 ${
                      billingTouched.province && billingErrors.province
                        ? 'border-red-300 focus:border-red-400 focus:ring-red-300'
                        : 'border-gray-300 focus:border-blue-400 focus:ring-blue-400'
                    }`}
                  />
                  {billingTouched.province && billingErrors.province && (
                    <p className="mt-1 text-[11px] text-red-600">{billingErrors.province}</p>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-700">Postal code</label>
                  <input
                    name="postal_code"
                    value={billingAddress.postal_code}
                    onChange={handleAddressInputChange(setBillingAddress, setBillingErrors, setBillingTouched)}
                    onBlur={handleAddressInputBlur(billingAddress, setBillingErrors, setBillingTouched)}
                    disabled={disabled}
                    required
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                    className={`mt-1 w-full rounded-md border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 ${
                      billingTouched.postal_code && billingErrors.postal_code
                        ? 'border-red-300 focus:border-red-400 focus:ring-red-300'
                        : 'border-gray-300 focus:border-blue-400 focus:ring-blue-400'
                    }`}
                  />
                  {billingTouched.postal_code && billingErrors.postal_code && (
                    <p className="mt-1 text-[11px] text-red-600">{billingErrors.postal_code}</p>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-700">Country code</label>
                  <input
                    name="country_code"
                    value={billingAddress.country_code}
                    onChange={handleAddressInputChange(setBillingAddress, setBillingErrors, setBillingTouched)}
                    onBlur={handleAddressInputBlur(billingAddress, setBillingErrors, setBillingTouched)}
                    disabled={disabled}
                    required
                    className={`mt-1 w-full rounded-md border px-2.5 py-1.5 text-xs uppercase focus:outline-none focus:ring-1 ${
                      billingTouched.country_code && billingErrors.country_code
                        ? 'border-red-300 focus:border-red-400 focus:ring-red-300'
                        : 'border-gray-300 focus:border-blue-400 focus:ring-blue-400'
                    }`}
                  />
                  {billingTouched.country_code && billingErrors.country_code && (
                    <p className="mt-1 text-[11px] text-red-600">{billingErrors.country_code}</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-gray-700">Phone</label>
                  <input
                    name="phone"
                    value={billingAddress.phone}
                    onChange={handleAddressInputChange(setBillingAddress, setBillingErrors, setBillingTouched)}
                    onBlur={handleAddressInputBlur(billingAddress, setBillingErrors, setBillingTouched)}
                    disabled={disabled}
                    required
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={14}
                    className={`mt-1 w-full rounded-md border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 ${
                      billingTouched.phone && billingErrors.phone
                        ? 'border-red-300 focus:border-red-400 focus:ring-red-300'
                        : 'border-gray-300 focus:border-blue-400 focus:ring-blue-400'
                    }`}
                  />
                  {billingTouched.phone && billingErrors.phone && (
                    <p className="mt-1 text-[11px] text-red-600">{billingErrors.phone}</p>
                  )}
                </div>
              </div>
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

          {addressesUpdated && paymentMethod && (
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
                          <p className="font-semibold text-gray-800">
                            {opt.label || opt.name || 'Shipping'}
                          </p>
                          {formatDeliveryEstimate(opt) ? (
                            <div className="mt-1 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                              {formatDeliveryEstimate(opt)}
                            </div>
                          ) : null}
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
                  Update address & choose payment
                </>
              )}
            </button>
          )}
        </form>

        <aside className="order-1 md:order-2 flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Order summary</h3>
          <div className="space-y-1 text-xs text-gray-600">
            <div className="flex items-center justify-between">
              <span>Items total</span>
              <span className="font-medium text-gray-900">{formatAmount(displayTotals.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>GST (included)</span>
              <span className="font-medium text-gray-900">{formatAmount(displayTotals.tax)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Shipping</span>
              <span className="font-medium text-gray-900">
                {displayTotals.shipping > 0 ? formatAmount(displayTotals.shipping) : 'Calculated above'}
              </span>
            </div>
            <div className="mt-1 border-t border-gray-100 pt-2 text-sm font-semibold text-gray-900">
              <div className="flex items-center justify-between">
                <span>Total</span>
                <span>{formatAmount(displayTotals.total)}</span>
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

      {showGiftAddressConfirm && selectedGiftEvent && user && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                <FiGift size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Confirm gift details</p>
                <p className="text-[11px] text-gray-500">Please confirm the event and address before placing your order.</p>
              </div>
            </div>

            <div className="mt-2 space-y-2 text-[11px] text-gray-700">
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-[11px] font-semibold text-gray-900 mb-0.5">
                  Event
                </p>
                <p>{selectedGiftEvent.eventTitle || 'Family Event'}</p>
                <p className="text-gray-600">
                  {selectedGiftEvent.eventDate}
                  {selectedGiftEvent.eventTime ? ` • ${selectedGiftEvent.eventTime}` : ''}
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-[11px] font-semibold text-gray-900 mb-0.5">Recipient</p>
                <p>
                  {selectedGiftEvent.memberDetails?.firstName || user.first_name || user.firstName || 'Family member'}
                  {selectedGiftEvent.memberDetails?.lastName
                    ? ` ${selectedGiftEvent.memberDetails.lastName}`
                    : ''}
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-[11px] font-semibold text-gray-900 mb-0.5">Address</p>
                <p>
                  {(giftAddressSuggestion?.first_name || shippingAddress.first_name)}{' '}
                  {(giftAddressSuggestion?.last_name || shippingAddress.last_name)}
                </p>
                <p>{giftAddressSuggestion?.address_1 || shippingAddress.address_1}</p>
                <p>
                  {[giftAddressSuggestion?.city || shippingAddress.city,
                    giftAddressSuggestion?.province || shippingAddress.province,
                    giftAddressSuggestion?.postal_code || shippingAddress.postal_code]
                    .filter(Boolean)
                    .join(', ')}
                </p>
                <p>Phone: {giftAddressSuggestion?.phone || shippingAddress.phone}</p>
              </div>
            </div>

            <div className="mt-3 flex gap-2 justify-end text-[11px]">
              <button
                type="button"
                onClick={() => setShowGiftAddressConfirm(false)}
                className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-3 py-1 font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (giftAddressSuggestion) {
                    applyAddressToShipping(giftAddressSuggestion);
                    if (sameAsShipping) {
                      applyAddressToBilling(giftAddressSuggestion);
                    }
                  }
                  setShowGiftAddressConfirm(false);
                }}
                className="inline-flex items-center justify-center rounded-full bg-purple-600 px-3 py-1 font-semibold text-white hover:bg-purple-700"
              >
                Looks good
              </button>
            </div>
          </div>
        </div>
      )}

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
