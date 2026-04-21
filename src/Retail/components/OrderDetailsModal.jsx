import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiDownload,
  FiLoader,
  FiMapPin,
  FiPackage,
  FiRotateCcw,
  FiSlash,
  FiTruck,
  FiX,
} from 'react-icons/fi';
import { useRetail } from '../context/RetailContext';
import { formatAmount, getErrorMessage } from '../utils/helpers';

const formatDateTime = (value) => {
  if (!value) return 'Not available';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Not available';
  }

  return date.toLocaleString('en-IN');
};

const toReadableLabel = (value) =>
  String(value || 'unknown')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getTrackingActivities = (tracking) => {
  const shipmentTrack =
    tracking?.shiprocket_tracking?.tracking_data?.shipment_track_activities ||
    tracking?.shiprocket_tracking?.tracking_data?.shipment_track ||
    [];

  return Array.isArray(shipmentTrack) ? shipmentTrack : [];
};

const SHOW_AFTER_SALES_UI = false;
const RETURN_WINDOW_DAYS = 7;
const RETURN_WINDOW_MS = RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;

const toDateOrNull = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getDeliveredAt = ({ order, timeline, trackingActivities, isDelivered }) => {
  if (!isDelivered) return null;

  const metadata = order?.metadata || {};
  const deliveredTrackingDate = trackingActivities
    .map((activity) =>
      /delivered/i.test(
        String(
          activity?.['sr-status-label'] ||
            activity?.activity ||
            activity?.['sr-status'] ||
            '',
        ),
      )
        ? toDateOrNull(activity?.date || activity?.activity_date)
        : null,
    )
    .filter(Boolean)
    .sort((left, right) => right.getTime() - left.getTime())[0] || null;

  const deliveredTimelineDate = (Array.isArray(timeline) ? timeline : [])
    .map((entry) =>
      /delivered/i.test(String(entry?.label || entry?.type || '')) ? toDateOrNull(entry?.at) : null,
    )
    .filter(Boolean)
    .sort((left, right) => right.getTime() - left.getTime())[0] || null;

  return (
    deliveredTrackingDate ||
    deliveredTimelineDate ||
    toDateOrNull(metadata?.shiprocket_delivered_at) ||
    toDateOrNull(metadata?.delivered_at) ||
    toDateOrNull(order?.updated_at || order?.updatedAt) ||
    toDateOrNull(order?.created_at || order?.createdAt)
  );
};

const buildDefaultReturnSelections = (items) => {
  const next = {};

  (Array.isArray(items) ? items : []).forEach((item) => {
    next[item.id] = {
      selected: false,
      quantity: 1,
      reason_id: '',
      note: '',
      maxQuantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1,
    };
  });

  return next;
};

const OrderDetailsModal = ({ open, orderId, onClose }) => {
  const {
    retrieveOrder,
    createReturn,
    createRefundRequest,
    cancelOrder,
    fetchOrderTracking,
    fetchOrderTimeline,
    fetchOrderInvoice,
    fetchReturnReasons,
  } = useRetail();

  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [order, setOrder] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [returnReasons, setReturnReasons] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnSelections, setReturnSelections] = useState({});
  const [returnNote, setReturnNote] = useState('');
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundSelections, setRefundSelections] = useState({});
  const [refundNote, setRefundNote] = useState('');

  useEffect(() => {
    if (!open || !orderId) return;

    let mounted = true;
    setLoading(true);
    setError(null);
    setActionError(null);
    setActionSuccess(null);

    Promise.allSettled([
      retrieveOrder(orderId),
      fetchOrderTracking(orderId),
      fetchOrderTimeline(orderId),
      fetchReturnReasons(),
    ])
      .then(([orderResult, trackingResult, timelineResult, reasonsResult]) => {
        if (!mounted) return;

        if (orderResult.status === 'fulfilled') {
          setOrder(orderResult.value);
          const defaultSelections = buildDefaultReturnSelections(
            Array.isArray(orderResult.value?.items) ? orderResult.value.items : [],
          );
          setReturnSelections(defaultSelections);
          setRefundSelections(defaultSelections);
        } else {
          throw orderResult.reason;
        }

        if (trackingResult.status === 'fulfilled') {
          setTracking(trackingResult.value);
        } else {
          setTracking(null);
        }

        if (timelineResult.status === 'fulfilled') {
          setTimelineData(timelineResult.value);
        } else {
          setTimelineData(null);
        }

        if (reasonsResult.status === 'fulfilled') {
          setReturnReasons(Array.isArray(reasonsResult.value) ? reasonsResult.value : []);
        } else {
          setReturnReasons([]);
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [open, orderId, retrieveOrder, fetchOrderTracking, fetchOrderTimeline, fetchReturnReasons]);

  useEffect(() => {
    if (!open) {
      setOrder(null);
      setTracking(null);
      setTimelineData(null);
      setReturnReasons([]);
      setError(null);
      setLoading(false);
      setActionError(null);
      setActionSuccess(null);
      setShowReturnForm(false);
      setReturnSelections({});
      setReturnNote('');
      setShowRefundForm(false);
      setRefundSelections({});
      setRefundNote('');
    }
  }, [open]);

  const items = useMemo(() => (Array.isArray(order?.items) ? order.items : []), [order]);
  const primaryTitle = items[0]?.title || 'Order details';
  const headerTitle = items.length > 1 ? `${primaryTitle} + ${items.length - 1} more` : primaryTitle;

  const returns = useMemo(
    () => (Array.isArray(timelineData?.returns) ? timelineData.returns : []),
    [timelineData],
  );
  const refunds = useMemo(
    () => (Array.isArray(timelineData?.refunds) ? timelineData.refunds : []),
    [timelineData],
  );
  const returnRequests = useMemo(
    () => (Array.isArray(timelineData?.return_requests) ? timelineData.return_requests : []),
    [timelineData],
  );
  const refundRequests = useMemo(
    () => (Array.isArray(timelineData?.refund_requests) ? timelineData.refund_requests : []),
    [timelineData],
  );
  const timeline = useMemo(
    () => (Array.isArray(timelineData?.timeline) ? timelineData.timeline : []),
    [timelineData],
  );
  const trackingActivities = useMemo(() => getTrackingActivities(tracking), [tracking]);

  if (!open) return null;

  const createdAt = order?.created_at || order?.createdAt;
  const dateLabel = createdAt ? formatDateTime(createdAt) : '';

  const total = typeof order?.total === 'number' ? order.total : 0;
  const subtotal = typeof order?.subtotal === 'number' ? order.subtotal : null;
  const taxTotal = typeof order?.tax_total === 'number' ? order.tax_total : null;
  const shippingTotal = typeof order?.shipping_total === 'number' ? order.shipping_total : null;

  const paymentStatus = order?.payment_status || order?.paymentStatus;
  const fulfillmentStatus = order?.fulfillment_status || order?.fulfillmentStatus || order?.status;

  const shippingAddress = order?.shipping_address;
  const billingAddress = order?.billing_address;
  const orderContext = order?.context || order?.cart?.context || {};

  const orderStatusRaw = order?.status || '';
  const orderStatusLower = String(orderStatusRaw || '').toLowerCase();
  const fulfillmentLower = String(fulfillmentStatus || '').toLowerCase();

  const shiprocketStatusRaw =
    tracking?.shiprocket_status ||
    order?.metadata?.shiprocket_status_normalized ||
    order?.metadata?.shiprocketStatusNormalized ||
    '';
  const shiprocketStatusLower = String(shiprocketStatusRaw || '').toLowerCase();

  const isCancelled =
    orderStatusLower === 'canceled' ||
    orderStatusLower === 'cancelled' ||
    fulfillmentLower === 'canceled' ||
    fulfillmentLower === 'cancelled';

  const isDelivered =
    fulfillmentLower === 'delivered' || fulfillmentLower === 'partially_delivered';

  const hasOpenReturn = returns.some((entry) => {
    const status = String(entry?.status || '').toLowerCase();
    return status && !['cancelled', 'canceled', 'received'].includes(status);
  });
  const hasOpenReturnRequest = returnRequests.some((entry) => {
    const status = String(entry?.status || '').toLowerCase();
    return status && !['cancelled', 'canceled', 'rejected', 'resolved', 'processed'].includes(status);
  });
  const hasOpenRefundRequest = refundRequests.some((entry) => {
    const status = String(entry?.status || '').toLowerCase();
    return status && !['cancelled', 'canceled', 'rejected', 'resolved', 'processed'].includes(status);
  });
  const deliveredAt = getDeliveredAt({
    order,
    timeline,
    trackingActivities,
    isDelivered,
  });
  const returnWindowEndsAt = deliveredAt
    ? new Date(deliveredAt.getTime() + RETURN_WINDOW_MS)
    : null;
  const isWithinReturnWindow = returnWindowEndsAt ? returnWindowEndsAt.getTime() >= Date.now() : false;
  const hasReturnWindowExpired = Boolean(isDelivered && returnWindowEndsAt && !isWithinReturnWindow);

  const canCancel =
    !isCancelled &&
    !hasOpenReturn &&
    !hasOpenReturnRequest &&
    ![
      'fulfilled',
      'partially_fulfilled',
      'shipped',
      'partially_shipped',
      'delivered',
      'partially_delivered',
      'returned',
      'partially_returned',
    ].includes(fulfillmentLower) &&
    !order?.metadata?.shiprocket_awb_code &&
    !order?.metadata?.shiprocket_pickup_scheduled;

  const canRequestReturn =
    SHOW_AFTER_SALES_UI &&
    isDelivered &&
    !isCancelled &&
    !hasOpenReturnRequest &&
    isWithinReturnWindow;

  let progressStage = 0;
  if (['fulfilled', 'confirmed'].includes(fulfillmentLower)) {
    progressStage = 1;
  } else if (['shipped', 'partially_shipped'].includes(fulfillmentLower)) {
    progressStage = 2;
  } else if (['in_transit', 'out_for_delivery'].includes(fulfillmentLower)) {
    progressStage = 3;
  } else if (['delivered', 'partially_delivered'].includes(fulfillmentLower)) {
    progressStage = 4;
  }

  if (!isCancelled && shiprocketStatusLower) {
    if (['in_transit', 'out_for_delivery'].includes(shiprocketStatusLower)) {
      progressStage = Math.max(progressStage, 3);
    } else if (shiprocketStatusLower === 'delivered') {
      progressStage = Math.max(progressStage, 4);
    }
  }

  const hasShipmentIssue =
    !isCancelled &&
    ['undelivered', 'rto_initiated', 'cancelled', 'canceled'].includes(shiprocketStatusLower);

  const paymentCollection =
    order?.payment_collection ||
    (Array.isArray(order?.payment_collections) ? order.payment_collections[0] : null) ||
    (Array.isArray(order?.paymentCollections) ? order.paymentCollections[0] : null);

  const paymentSessions = Array.isArray(paymentCollection?.payment_sessions)
    ? paymentCollection.payment_sessions
    : Array.isArray(paymentCollection?.paymentSessions)
    ? paymentCollection.paymentSessions
    : [];

  const primarySession = paymentSessions[0] || null;
  const payments = Array.isArray(order?.payments) ? order.payments : [];
  const primaryPayment = payments[0] || null;

  const providerIdRaw =
    primarySession?.provider_id ||
    primarySession?.providerId ||
    primaryPayment?.provider_id ||
    primaryPayment?.providerId ||
    '';

  const sessionData = primarySession?.data || {};
  const providerIdLower = providerIdRaw.toLowerCase();

  const contextPaymentRaw =
    (typeof orderContext.payment_type === 'string' && orderContext.payment_type) ||
    (typeof orderContext.payment_mode === 'string' && orderContext.payment_mode) ||
    (typeof orderContext.payment_method === 'string' && orderContext.payment_method) ||
    '';

  const contextPaymentLower = contextPaymentRaw.toLowerCase();
  const paymentStatusLower = (paymentStatus || '').toLowerCase();

  let paymentMethodLabel = 'Cash on delivery';

  if (
    providerIdLower.includes('razorpay') ||
    sessionData.razorpay_order_id ||
    sessionData.razorpay_payment_id
  ) {
    paymentMethodLabel = 'Online (Razorpay)';
  } else if (
    contextPaymentLower.includes('online') ||
    contextPaymentLower.includes('razorpay') ||
    contextPaymentLower.includes('prepaid') ||
    contextPaymentLower.includes('card') ||
    contextPaymentLower.includes('upi')
  ) {
    paymentMethodLabel = 'Online payment';
  } else if (
    paymentStatusLower === 'captured' ||
    paymentStatusLower === 'paid' ||
    paymentStatusLower === 'completed' ||
    paymentStatusLower === 'succeeded'
  ) {
    paymentMethodLabel = 'Online payment';
  }

  const razorpayOrderId =
    sessionData.razorpay_order_id ||
    sessionData.order_id ||
    sessionData.razorpayOrderId ||
    null;
  const razorpayPaymentId =
    sessionData.razorpay_payment_id ||
    sessionData.payment_id ||
    sessionData.razorpayPaymentId ||
    null;

  const refundTotalMinor = refunds.reduce(
    (sum, refund) => sum + Number(refund?.refund_amount_minor || 0),
    0,
  );

  const hasPaidAmount =
    ['captured', 'paid', 'partially_refunded', 'refunded', 'completed'].includes(paymentStatusLower) ||
    paymentMethodLabel.toLowerCase().includes('online');

  const canRequestRefund =
    SHOW_AFTER_SALES_UI &&
    hasPaidAmount &&
    refundTotalMinor < total &&
    (isDelivered || isCancelled) &&
    !hasOpenRefundRequest;

  const paymentStatusClass =
    paymentStatusLower === 'captured' || paymentStatusLower === 'paid'
      ? 'text-sm font-semibold text-green-600'
      : 'text-sm font-semibold text-gray-900';

  const refreshSupplementalData = async (activeOrderId) => {
    const [freshOrder, freshTracking, freshTimeline] = await Promise.allSettled([
      retrieveOrder(activeOrderId),
      fetchOrderTracking(activeOrderId),
      fetchOrderTimeline(activeOrderId),
    ]);

    if (freshOrder.status === 'fulfilled') {
      setOrder(freshOrder.value);
      const defaultSelections = buildDefaultReturnSelections(
        Array.isArray(freshOrder.value?.items) ? freshOrder.value.items : [],
      );
      setReturnSelections(defaultSelections);
      setRefundSelections(defaultSelections);
    }

    if (freshTracking.status === 'fulfilled') {
      setTracking(freshTracking.value);
    }

    if (freshTimeline.status === 'fulfilled') {
      setTimelineData(freshTimeline.value);
    }
  };

  const updateReturnSelection = (itemId, patch) => {
    setReturnSelections((current) => {
      const existing = current[itemId] || {
        selected: false,
        quantity: 1,
        reason_id: '',
        note: '',
        maxQuantity: 1,
      };

      return {
        ...current,
        [itemId]: {
          ...existing,
          ...patch,
        },
      };
    });
  };

  const updateRefundSelection = (itemId, patch) => {
    setRefundSelections((current) => {
      const existing = current[itemId] || {
        selected: false,
        quantity: 1,
        reason_id: '',
        note: '',
        maxQuantity: 1,
      };

      return {
        ...current,
        [itemId]: {
          ...existing,
          ...patch,
        },
      };
    });
  };

  const handleCancelOrder = async () => {
    if (!order || actionLoading || !canCancel) return;

    const confirmed = window.confirm('Do you want to cancel this order?');
    if (!confirmed) return;

    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const cancelled = await cancelOrder(order.id);
      setOrder(cancelled?.order || cancelled || order);
      await refreshSupplementalData(order.id);
      setActionSuccess('Order cancelled successfully.');
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateReturn = async () => {
    if (!order || actionLoading || !canRequestReturn) return;

    const selectedItems = items
      .map((item) => {
        const selection = returnSelections[item.id];
        if (!selection?.selected) return null;

        return {
          id: item.id,
          quantity: Math.max(
            1,
            Math.min(Number(selection.quantity || 1), Number(selection.maxQuantity || item.quantity || 1)),
          ),
          reason_id: selection.reason_id || null,
          note: selection.note || null,
        };
      })
      .filter(Boolean);

    if (!selectedItems.length) {
      setActionError('Select at least one item to request a return.');
      return;
    }

    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const createdReturn = await createReturn({
        orderId: order.id,
        items: selectedItems,
        note: returnNote || null,
      });

      await refreshSupplementalData(order.id);
      setShowReturnForm(false);
      setReturnSelections(buildDefaultReturnSelections(items));
      setReturnNote('');
      setActionSuccess(
        createdReturn?.id
          ? `Return request ${createdReturn.display_id || createdReturn.id} submitted successfully.`
          : 'Return request submitted successfully.',
      );
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateRefundRequest = async () => {
    if (!order || actionLoading || !canRequestRefund) return;

    const selectedItems = items
      .map((item) => {
        const selection = refundSelections[item.id];
        if (!selection?.selected) return null;

        return {
          id: item.id,
          quantity: Math.max(
            1,
            Math.min(Number(selection.quantity || 1), Number(selection.maxQuantity || item.quantity || 1)),
          ),
          reason_id: selection.reason_id || null,
          note: selection.note || null,
        };
      })
      .filter(Boolean);

    if (!selectedItems.length) {
      setActionError('Select at least one item to request a refund review.');
      return;
    }

    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const request = await createRefundRequest({
        orderId: order.id,
        items: selectedItems,
        note: refundNote || null,
      });

      await refreshSupplementalData(order.id);
      setShowRefundForm(false);
      setRefundSelections(buildDefaultReturnSelections(items));
      setRefundNote('');
      setActionSuccess(
        request?.id
          ? `Refund request ${request.id} submitted successfully.`
          : 'Refund request submitted successfully.',
      );
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadInvoice = async () => {
    if (!order) return;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      setActionError('Unable to open invoice window. Please allow popups in your browser.');
      return;
    }

    setActionLoading(true);
    setActionError(null);

    try {
      const html = await fetchOrderInvoice(order.id);

      if (!html || typeof html !== 'string') {
        throw new Error('Invoice is not available yet.');
      }

      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (err) {
      win.close();
      setActionError(getErrorMessage(err) || 'Unable to load invoice right now.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{headerTitle}</h3>
            <p className="text-[11px] text-gray-500">
              {order ? 'Order details' : 'Loading order'}
              {dateLabel ? ` · ${dateLabel}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white p-2 text-gray-600 hover:bg-gray-100"
            aria-label="Close"
          >
            <FiX />
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center py-10 text-sm text-gray-600">
              <FiLoader className="mr-2 animate-spin" /> Loading order details...
            </div>
          )}

          {!loading && error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {!loading && order && (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-100 bg-white p-3">
                <p className="mb-2 text-[11px] font-semibold text-gray-900">Order progress</p>
                {isCancelled ? (
                  <p className="text-xs font-semibold text-red-600">This order has been cancelled.</p>
                ) : hasShipmentIssue ? (
                  <p className="text-xs font-semibold text-red-600">
                    Shipment update: {toReadableLabel(shiprocketStatusLower)}
                  </p>
                ) : (
                  <div className="flex items-center gap-2 overflow-x-auto">
                    {[
                      { done: true, label: 'Placed', icon: <FiPackage className="text-xs" /> },
                      { done: progressStage >= 1, label: 'Fulfilled', icon: <FiCheckCircle className="text-xs" /> },
                      { done: progressStage >= 2, label: 'Shipped', icon: <FiTruck className="text-xs" /> },
                      { done: progressStage >= 3, label: 'Out for delivery', icon: <FiTruck className="text-xs" /> },
                      { done: progressStage >= 4, label: 'Delivered', icon: <FiCheckCircle className="text-xs" /> },
                    ].map((step, index, list) => (
                      <React.Fragment key={step.label}>
                        <div className="flex min-w-[68px] flex-col items-center text-center">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full ${
                              step.done
                                ? 'bg-green-500 text-white'
                                : 'border border-gray-300 bg-white text-gray-400'
                            }`}
                          >
                            {step.icon}
                          </div>
                          <span className="mt-1 text-[10px] text-gray-600">{step.label}</span>
                        </div>
                        {index < list.length - 1 && (
                          <div className={`h-0.5 min-w-[30px] flex-1 ${step.done ? 'bg-green-500' : 'bg-gray-200'}`} />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-[11px] text-gray-500">Payment status</p>
                  <p className={paymentStatusClass}>{toReadableLabel(paymentStatus)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-[11px] text-gray-500">Fulfillment status</p>
                  <p className="text-sm font-semibold text-gray-900">{toReadableLabel(fulfillmentStatus)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-[11px] text-gray-500">Payment method</p>
                  <p className="text-sm font-semibold text-gray-900">{paymentMethodLabel}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-[11px] text-gray-500">Total</p>
                  <p className="text-sm font-semibold text-gray-900">{formatAmount(total)}</p>
                </div>
              </div>

              {SHOW_AFTER_SALES_UI && (
                <>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-gray-100 bg-white p-3">
                  <h4 className="text-xs font-semibold text-gray-900">Payment details</h4>
                  <div className="mt-2 space-y-1 text-[11px] text-gray-600">
                    <p>
                      <span className="font-medium text-gray-800">Provider:</span> {providerIdRaw || 'Not available'}
                    </p>
                    {razorpayOrderId && (
                      <p>
                        <span className="font-medium text-gray-800">Razorpay order ID:</span> {razorpayOrderId}
                      </p>
                    )}
                    {razorpayPaymentId && (
                      <p>
                        <span className="font-medium text-gray-800">Razorpay payment ID:</span> {razorpayPaymentId}
                      </p>
                    )}
                    <p>
                      <span className="font-medium text-gray-800">Email:</span> {order?.email || 'Not available'}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-100 bg-white p-3">
                  <h4 className="text-xs font-semibold text-gray-900">Shipping & tracking</h4>
                  <div className="mt-2 space-y-1 text-[11px] text-gray-600">
                    <p>
                      <span className="font-medium text-gray-800">AWB:</span> {tracking?.awb_code || 'Pending'}
                    </p>
                    <p>
                      <span className="font-medium text-gray-800">Courier:</span> {tracking?.courier_name || 'Pending'}
                    </p>
                    <p>
                      <span className="font-medium text-gray-800">Status:</span>{' '}
                      {shiprocketStatusLower ? toReadableLabel(shiprocketStatusLower) : 'Pending'}
                    </p>
                    {timelineData?.invoice?.shiprocket_tracking_url && (
                      <a
                        href={timelineData.invoice.shiprocket_tracking_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center text-blue-600 hover:underline"
                      >
                        Open tracking link
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 bg-white p-3">
                <h4 className="text-xs font-semibold text-gray-900">Items</h4>
                <div className="mt-2 space-y-2">
                  {items.length === 0 && <p className="text-[11px] text-gray-500">No items found on this order.</p>}
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 border-t border-gray-100 pt-2 first:border-t-0 first:pt-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-gray-900">{item.title}</p>
                        {item.variant?.title && (
                          <p className="truncate text-[11px] text-gray-500">Variant: {item.variant.title}</p>
                        )}
                        {item.sku && <p className="truncate text-[11px] text-gray-500">SKU: {item.sku}</p>}
                        {(item.product_id || item.product?.id) && (
                          <button
                            type="button"
                            onClick={() => {
                              const productId = item.product_id || item.product?.id;
                              if (!productId) return;
                              onClose();
                              navigate(`/gifts-memories?productId=${productId}`);
                            }}
                            className="mt-1 inline-flex items-center bg-white text-[11px] font-medium text-blue-600 hover:underline"
                          >
                            View item
                          </button>
                        )}
                      </div>
                      <div className="text-right text-[11px] text-gray-600">
                        <p>Qty: {item.quantity}</p>
                        <p>{formatAmount(item.total || (item.unit_price || 0) * (item.quantity || 0))}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-gray-100 bg-white p-3">
                  <h4 className="text-xs font-semibold text-gray-900">Shipping address</h4>
                  <div className="mt-2 space-y-0.5 text-[11px] text-gray-600">
                    {shippingAddress ? (
                      <>
                        <p className="font-medium text-gray-900">
                          {shippingAddress.first_name || ''} {shippingAddress.last_name || ''}
                        </p>
                        <p>{shippingAddress.address_1}</p>
                        {shippingAddress.address_2 && <p>{shippingAddress.address_2}</p>}
                        <p>
                          {[shippingAddress.city, shippingAddress.province, shippingAddress.postal_code]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                        {shippingAddress.phone && <p>{shippingAddress.phone}</p>}
                      </>
                    ) : (
                      <p className="text-gray-500">Not available</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-100 bg-white p-3">
                  <h4 className="text-xs font-semibold text-gray-900">Billing address</h4>
                  <div className="mt-2 space-y-0.5 text-[11px] text-gray-600">
                    {billingAddress ? (
                      <>
                        <p className="font-medium text-gray-900">
                          {billingAddress.first_name || ''} {billingAddress.last_name || ''}
                        </p>
                        <p>{billingAddress.address_1}</p>
                        {billingAddress.address_2 && <p>{billingAddress.address_2}</p>}
                        <p>
                          {[billingAddress.city, billingAddress.province, billingAddress.postal_code]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                        {billingAddress.phone && <p>{billingAddress.phone}</p>}
                      </>
                    ) : (
                      <p className="text-gray-500">Not available</p>
                    )}
                  </div>
                </div>
              </div>

              {(subtotal !== null || taxTotal !== null || shippingTotal !== null) && (
                <div className="rounded-xl border border-gray-100 bg-white p-3">
                  <h4 className="text-xs font-semibold text-gray-900">Summary</h4>
                  <div className="mt-2 space-y-1 text-[11px] text-gray-600">
                    {subtotal !== null && (
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span className="font-medium">{formatAmount(subtotal)}</span>
                      </div>
                    )}
                    {taxTotal !== null && (
                      <div className="flex justify-between">
                        <span>Tax</span>
                        <span className="font-medium">{formatAmount(taxTotal)}</span>
                      </div>
                    )}
                    {shippingTotal !== null && (
                      <div className="flex justify-between">
                        <span>Shipping</span>
                        <span className="font-medium">{formatAmount(shippingTotal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-gray-100 pt-2">
                      <span className="font-semibold text-gray-900">Total</span>
                      <span className="font-semibold text-gray-900">{formatAmount(total)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-gray-100 bg-white p-3">
                  <h4 className="text-xs font-semibold text-gray-900">Refund status</h4>
                  <div className="mt-2 space-y-2">
                    {refunds.length === 0 && (
                      <p className="text-[11px] text-gray-500">No refunds have been processed for this order.</p>
                    )}
                    {refunds.map((refund) => (
                      <div key={refund.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-[11px] font-semibold text-gray-900">
                              {refund.razorpay_refund_id || refund.medusa_refund_id || refund.id}
                            </p>
                            <p className="text-[11px] text-gray-500">
                              {formatDateTime(refund.processed_at || refund.created_at)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] font-semibold text-gray-900">
                              {formatAmount(refund.refund_amount_minor || 0)}
                            </p>
                            <p className="text-[10px] uppercase text-gray-500">{toReadableLabel(refund.status)}</p>
                          </div>
                        </div>
                        {refund.note && <p className="mt-1 text-[11px] text-gray-600">{refund.note}</p>}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-100 bg-white p-3">
                  <h4 className="text-xs font-semibold text-gray-900">Customer requests</h4>
                  <div className="mt-2 space-y-2">
                    {returnRequests.length === 0 && refundRequests.length === 0 && (
                      <p className="text-[11px] text-gray-500">No return or refund requests have been created for this order.</p>
                    )}
                    {returnRequests.map((entry) => (
                      <div key={entry.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-[11px] font-semibold text-gray-900">Return request {entry.id}</p>
                            <p className="text-[11px] text-gray-500">
                              Requested: {formatDateTime(entry.requested_at || entry.created_at)}
                            </p>
                          </div>
                          <p className="text-[10px] uppercase text-gray-500">{toReadableLabel(entry.status)}</p>
                        </div>
                        {Array.isArray(entry.items) && entry.items.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {entry.items.map((item) => (
                              <div key={item.id} className="text-[11px] text-gray-600">
                                <span className="font-medium text-gray-800">Qty {item.quantity}</span>
                                {item.reason?.label ? ` · ${item.reason.label}` : ''}
                                {item.note ? ` · ${item.note}` : ''}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {refundRequests.map((entry) => (
                      <div key={entry.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-[11px] font-semibold text-gray-900">Refund request {entry.id}</p>
                            <p className="text-[11px] text-gray-500">
                              Requested: {formatDateTime(entry.requested_at || entry.created_at)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase text-gray-500">{toReadableLabel(entry.status)}</p>
                            {typeof entry.amount === 'number' && entry.amount > 0 && (
                              <p className="text-[11px] font-semibold text-gray-900">{formatAmount(entry.amount)}</p>
                            )}
                          </div>
                        </div>
                        {Array.isArray(entry.items) && entry.items.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {entry.items.map((item) => (
                              <div key={item.id} className="text-[11px] text-gray-600">
                                <span className="font-medium text-gray-800">Qty {item.quantity}</span>
                                {item.reason?.label ? ` - ${item.reason.label}` : ''}
                                {item.note ? ` - ${item.note}` : ''}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {returns.length > 0 && (
                <div className="rounded-xl border border-gray-100 bg-white p-3">
                  <h4 className="text-xs font-semibold text-gray-900">Processed returns</h4>
                  <div className="mt-2 space-y-2">
                    {returns.map((entry) => (
                      <div key={entry.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-[11px] font-semibold text-gray-900">
                              {entry.display_id || entry.id}
                            </p>
                            <p className="text-[11px] text-gray-500">
                              Requested: {formatDateTime(entry.requested_at || entry.created_at)}
                            </p>
                          </div>
                          <p className="text-[10px] uppercase text-gray-500">{toReadableLabel(entry.status)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
                </>
              )}

              <div className="rounded-xl border border-gray-100 bg-white p-3">
                <h4 className="text-xs font-semibold text-gray-900">Tracking timeline</h4>
                <div className="mt-2 space-y-2">
                  {trackingActivities.length === 0 && (
                    <p className="text-[11px] text-gray-500">Tracking updates will appear here once the courier scans your shipment.</p>
                  )}
                  {trackingActivities.slice(0, 6).map((activity, index) => (
                    <div key={`${activity.date || activity.sr-status || index}`} className="flex gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="pt-0.5 text-gray-400">
                        <FiMapPin />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-gray-900">
                          {activity['sr-status-label'] || activity.activity || activity['sr-status'] || 'Update'}
                        </p>
                        <p className="text-[11px] text-gray-600">
                          {activity.location || activity['sr-status'] || 'Location pending'}
                        </p>
                        <p className="text-[10px] text-gray-500">{formatDateTime(activity.date || activity['activity_date'])}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 bg-white p-3">
                <h4 className="text-xs font-semibold text-gray-900">Order timeline</h4>
                <div className="mt-2 space-y-2">
                  {timeline.length === 0 && (
                    <p className="text-[11px] text-gray-500">No additional timeline events yet.</p>
                  )}
                  {timeline.map((entry) => (
                    <div key={entry.id} className="flex gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="pt-0.5 text-gray-400">
                        <FiClock />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-gray-900">{entry.label}</p>
                        <p className="text-[11px] text-gray-600">{entry.description || 'Status updated.'}</p>
                        <p className="text-[10px] text-gray-500">{formatDateTime(entry.at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {showReturnForm && canRequestReturn && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <h4 className="text-xs font-semibold text-gray-900">Request return</h4>
                  <p className="mt-1 text-[11px] text-gray-600">
                    Select the delivered items you want to return, choose a reason, and add any helpful notes.
                  </p>
                  <div className="mt-3 space-y-3">
                    {items.map((item) => {
                      const selection = returnSelections[item.id] || {
                        selected: false,
                        quantity: 1,
                        reason_id: '',
                        note: '',
                        maxQuantity: item.quantity || 1,
                      };

                      return (
                        <div key={item.id} className="rounded-lg border border-amber-200 bg-white px-3 py-3">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={Boolean(selection.selected)}
                              onChange={(event) =>
                                updateReturnSelection(item.id, { selected: event.target.checked })
                              }
                              className="mt-1"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-gray-900">{item.title}</p>
                              <p className="text-[11px] text-gray-500">
                                Ordered quantity: {item.quantity}
                              </p>
                              {selection.selected && (
                                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                                  <label className="text-[11px] text-gray-600">
                                    Quantity
                                    <input
                                      type="number"
                                      min="1"
                                      max={selection.maxQuantity}
                                      value={selection.quantity}
                                      onChange={(event) =>
                                        updateReturnSelection(item.id, {
                                          quantity: Math.max(
                                            1,
                                            Math.min(
                                              Number(event.target.value || 1),
                                              Number(selection.maxQuantity || 1),
                                            ),
                                          ),
                                        })
                                      }
                                      className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-[11px]"
                                    />
                                  </label>
                                  <label className="text-[11px] text-gray-600 md:col-span-2">
                                    Reason
                                    <select
                                      value={selection.reason_id}
                                      onChange={(event) =>
                                        updateReturnSelection(item.id, { reason_id: event.target.value })
                                      }
                                      className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-[11px]"
                                    >
                                      <option value="">Select a reason</option>
                                      {returnReasons.map((reason) => (
                                        <option key={reason.id} value={reason.id}>
                                          {reason.label || reason.value || reason.id}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="text-[11px] text-gray-600 md:col-span-3">
                                    Note
                                    <textarea
                                      rows={2}
                                      value={selection.note}
                                      onChange={(event) =>
                                        updateReturnSelection(item.id, { note: event.target.value })
                                      }
                                      className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-[11px]"
                                      placeholder="Tell us what happened with this item"
                                    />
                                  </label>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <label className="text-[11px] text-gray-600">
                      Overall note
                      <textarea
                        rows={3}
                        value={returnNote}
                        onChange={(event) => setReturnNote(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-[11px]"
                        placeholder="Add anything else that will help us review your request"
                      />
                    </label>

                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowReturnForm(false);
                          setReturnSelections(buildDefaultReturnSelections(items));
                          setReturnNote('');
                        }}
                        className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1.5 text-[11px] font-semibold text-gray-700 hover:border-gray-300"
                      >
                        Close return form
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateReturn}
                        disabled={actionLoading}
                        className="inline-flex items-center rounded-full bg-amber-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <FiRotateCcw className="mr-1" />
                        Submit return request
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {showRefundForm && canRequestRefund && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <h4 className="text-xs font-semibold text-gray-900">Request refund review</h4>
                  <p className="mt-1 text-[11px] text-gray-600">
                    Select the items that need a refund review and share the reason so our team can verify it.
                  </p>
                  <div className="mt-3 space-y-3">
                    {items.map((item) => {
                      const selection = refundSelections[item.id] || {
                        selected: false,
                        quantity: 1,
                        reason_id: '',
                        note: '',
                        maxQuantity: item.quantity || 1,
                      };

                      return (
                        <div key={item.id} className="rounded-lg border border-blue-200 bg-white px-3 py-3">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={Boolean(selection.selected)}
                              onChange={(event) =>
                                updateRefundSelection(item.id, { selected: event.target.checked })
                              }
                              className="mt-1"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-gray-900">{item.title}</p>
                              <p className="text-[11px] text-gray-500">Ordered quantity: {item.quantity}</p>
                              {selection.selected && (
                                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                                  <label className="text-[11px] text-gray-600">
                                    Quantity
                                    <input
                                      type="number"
                                      min="1"
                                      max={selection.maxQuantity}
                                      value={selection.quantity}
                                      onChange={(event) =>
                                        updateRefundSelection(item.id, {
                                          quantity: Math.max(
                                            1,
                                            Math.min(
                                              Number(event.target.value || 1),
                                              Number(selection.maxQuantity || 1),
                                            ),
                                          ),
                                        })
                                      }
                                      className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-[11px]"
                                    />
                                  </label>
                                  <label className="text-[11px] text-gray-600 md:col-span-2">
                                    Reason
                                    <select
                                      value={selection.reason_id}
                                      onChange={(event) =>
                                        updateRefundSelection(item.id, { reason_id: event.target.value })
                                      }
                                      className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-[11px]"
                                    >
                                      <option value="">Select a reason</option>
                                      {returnReasons.map((reason) => (
                                        <option key={reason.id} value={reason.id}>
                                          {reason.label || reason.value || reason.id}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="text-[11px] text-gray-600 md:col-span-3">
                                    Note
                                    <textarea
                                      rows={2}
                                      value={selection.note}
                                      onChange={(event) =>
                                        updateRefundSelection(item.id, { note: event.target.value })
                                      }
                                      className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-[11px]"
                                      placeholder="Tell us why this item needs a refund review"
                                    />
                                  </label>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <label className="text-[11px] text-gray-600">
                      Overall note
                      <textarea
                        rows={3}
                        value={refundNote}
                        onChange={(event) => setRefundNote(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-[11px]"
                        placeholder="Add anything else that will help us review your refund request"
                      />
                    </label>

                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowRefundForm(false);
                          setRefundSelections(buildDefaultReturnSelections(items));
                          setRefundNote('');
                        }}
                        className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1.5 text-[11px] font-semibold text-gray-700 hover:border-gray-300"
                      >
                        Close refund form
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateRefundRequest}
                        disabled={actionLoading}
                        className="inline-flex items-center rounded-full bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <FiRotateCcw className="mr-1" />
                        Submit refund request
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {SHOW_AFTER_SALES_UI && isDelivered && !isCancelled && !hasOpenReturnRequest && (
                <div
                  className={`rounded-lg border px-3 py-2 text-[11px] ${
                    hasReturnWindowExpired
                      ? 'border-gray-200 bg-gray-50 text-gray-600'
                      : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}
                >
                  {hasReturnWindowExpired ? (
                    <span>
                      The 7-day return window closed on {formatDateTime(returnWindowEndsAt)}.
                    </span>
                  ) : returnWindowEndsAt ? (
                    <span>
                      Return requests are available until {formatDateTime(returnWindowEndsAt)}.
                    </span>
                  ) : (
                    <span>Return requests are available for 7 days after delivery.</span>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="flex-1 space-y-1">
                  {actionError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] text-red-700">
                      {actionError}
                    </div>
                  )}
                  {actionSuccess && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] text-emerald-700">
                      {actionSuccess}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {canCancel && (
                    <button
                      type="button"
                      onClick={handleCancelOrder}
                      disabled={actionLoading}
                      className="inline-flex items-center rounded-full border border-red-200 px-3 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FiSlash className="mr-1" />
                      Cancel order
                    </button>
                  )}
                  {canRequestReturn && !hasOpenReturn && (
                    <button
                      type="button"
                      onClick={() => {
                        setActionError(null);
                        setActionSuccess(null);
                        setShowRefundForm(false);
                        setShowReturnForm((current) => !current);
                      }}
                      disabled={actionLoading}
                      className="inline-flex items-center rounded-full border border-amber-300 px-3 py-1.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FiRotateCcw className="mr-1" />
                      {showReturnForm ? 'Hide return form' : 'Request return'}
                    </button>
                  )}
                  {canRequestRefund && (
                    <button
                      type="button"
                      onClick={() => {
                        setActionError(null);
                        setActionSuccess(null);
                        setShowReturnForm(false);
                        setShowRefundForm((current) => !current);
                      }}
                      disabled={actionLoading}
                      className="inline-flex items-center rounded-full border border-blue-300 px-3 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FiRotateCcw className="mr-1" />
                      {showRefundForm ? 'Hide refund form' : 'Request refund'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleDownloadInvoice}
                    disabled={actionLoading}
                    className="inline-flex items-center rounded-full bg-gray-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FiDownload className="mr-1" />
                    Invoice PDF
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center rounded-full bg-orange-400 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-orange-500"
                  >
                    Close
                  </button>
                </div>
              </div>

              {!canCancel && !isCancelled && (
                <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
                  <FiAlertCircle className="mt-0.5 text-gray-400" />
                  <span>
                    This order is no longer eligible for cancellation from the storefront.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderDetailsModal;
