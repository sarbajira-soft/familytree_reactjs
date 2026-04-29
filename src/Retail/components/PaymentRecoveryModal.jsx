import React from 'react';
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiLoader,
  FiShield,
  FiShoppingBag,
  FiX,
} from 'react-icons/fi';
import { useRetail } from '../context/RetailContext';

const terminalStatuses = new Set(['completed', 'failed', 'expired', 'abandoned', 'not_started']);
const failedStatuses = new Set(['failed', 'expired', 'abandoned']);

const PaymentRecoveryModal = () => {
  const { paymentRecovery, clearPaymentRecovery } = useRetail();

  if (!paymentRecovery?.active || paymentRecovery?.presentation !== 'modal') {
    return null;
  }

  const status = (paymentRecovery?.status || 'processing').toString().toLowerCase();
  const isCompleted = status === 'completed';
  const isPendingCapture = status === 'pending_capture';
  const isFailed = failedStatuses.has(status);
  const isTerminal = terminalStatuses.has(status);
  const orderDisplayId =
    paymentRecovery?.order?.display_id ||
    paymentRecovery?.order?.displayId ||
    paymentRecovery?.order?.id ||
    '';

  const paymentState = isCompleted
    ? 'Paid'
    : isPendingCapture
    ? 'Authorized'
    : isFailed
    ? 'Failed'
    : status === 'opening_browser'
    ? 'Opening browser'
    : 'Processing';

  const orderState = isCompleted
    ? orderDisplayId
      ? `Created (#${orderDisplayId})`
      : 'Created'
    : isPendingCapture
    ? 'Waiting for capture'
    : isFailed
    ? 'Not created'
    : 'Waiting for confirmation';

  const title = isCompleted
    ? 'Order created successfully'
    : isFailed
    ? 'Payment could not be completed'
    : isPendingCapture
    ? 'Payment authorized'
    : 'Processing your payment';

  const message =
    paymentRecovery?.message ||
    (isCompleted
      ? 'Your payment has been verified and your order is now ready in Familyss.'
      : isFailed
      ? 'We could not confirm this payment. If money was deducted, the bank or gateway may still auto-reverse it.'
      : isPendingCapture
      ? 'Your bank has authorized the payment. We are waiting for final capture before creating the order.'
      : 'Please complete the payment in the browser. Once the gateway confirms it, we will create your order here.');

  return (
    <div
      className="fixed left-0 right-0 z-[10020] overflow-y-auto bg-slate-950/45 px-4 py-4 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:px-6 sm:py-8"
      style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 5.75rem)',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)',
      }}
    >
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-[32px] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.28)] sm:max-h-[calc(100vh-4rem)] sm:overflow-y-auto">
        <div
          className={`px-5 py-5 text-white ${
            isCompleted
              ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500'
              : isFailed
              ? 'bg-gradient-to-r from-rose-500 via-red-500 to-orange-500'
              : 'bg-gradient-to-r from-amber-500 via-orange-500 to-orange-600'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/18">
                {isCompleted ? (
                  <FiCheckCircle className="text-2xl" />
                ) : isFailed ? (
                  <FiAlertCircle className="text-2xl" />
                ) : (
                  <FiLoader className="text-2xl animate-spin" />
                )}
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/80">
                  Familyss Checkout
                </p>
                <h2 className="text-lg font-semibold">{title}</h2>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (isTerminal) {
                  clearPaymentRecovery && clearPaymentRecovery();
                }
              }}
              disabled={!isTerminal}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Close payment status"
            >
              <FiX className="text-lg" />
            </button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div
            className={`rounded-2xl px-4 py-4 ${
              isCompleted
                ? 'bg-emerald-50 text-emerald-900'
                : isFailed
                ? 'bg-rose-50 text-rose-900'
                : 'bg-amber-50 text-amber-900'
            }`}
          >
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-1 text-sm leading-6 opacity-90">{message}</p>
          </div>

          <div className="grid gap-3">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <FiShield className={isFailed ? 'text-rose-500' : 'text-emerald-600'} />
                Payment status
              </div>
              <p
                className={`mt-2 text-sm font-semibold ${
                  isCompleted
                    ? 'text-emerald-600'
                    : isFailed
                    ? 'text-rose-600'
                    : 'text-amber-600'
                }`}
              >
                {paymentState}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <FiShoppingBag className={isCompleted ? 'text-emerald-600' : 'text-amber-600'} />
                Order status
              </div>
              <p
                className={`mt-2 text-sm font-semibold ${
                  isCompleted
                    ? 'text-emerald-600'
                    : isFailed
                    ? 'text-rose-600'
                    : 'text-amber-600'
                }`}
              >
                {orderState}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-4 text-gray-600">
            {isCompleted ? (
              <FiCheckCircle className="mt-0.5 text-lg text-emerald-600" />
            ) : isFailed ? (
              <FiAlertCircle className="mt-0.5 text-lg text-rose-500" />
            ) : (
              <FiClock className="mt-0.5 text-lg text-amber-500" />
            )}
            <p className="text-xs leading-5">
              {isTerminal
                ? 'You can close this window now. Your latest payment state has already been synced in the app.'
                : 'Keep this screen open in Familyss after you finish the gateway step. We will update payment and order status here automatically.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentRecoveryModal;
