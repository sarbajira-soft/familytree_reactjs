import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as cartService from '../Retail/services/cartService';
import {
  decodeHostedPaymentPayload,
  initiatePayment,
  pollRazorpayRecovery,
  type UnifiedPaymentOrder,
} from '../Retail/utils/initiatePayment';

type PaymentStage =
  | 'booting'
  | 'opening'
  | 'processing'
  | 'completed'
  | 'dismissed'
  | 'failed';

const pageShellStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background:
    'radial-gradient(circle at top, rgba(249, 115, 22, 0.16), transparent 38%), #fff7ed',
  padding: '24px',
};

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '480px',
  borderRadius: '24px',
  background: '#ffffff',
  boxShadow: '0 24px 60px rgba(15, 23, 42, 0.12)',
  padding: '32px',
  color: '#111827',
};

const titleMap: Record<PaymentStage, string> = {
  booting: 'Preparing payment',
  opening: 'Opening Razorpay',
  processing: 'Finalizing your order',
  completed: 'Payment successful',
  dismissed: 'Payment cancelled',
  failed: 'Payment could not be completed',
};

const messageMap: Record<PaymentStage, string> = {
  booting: 'We are preparing your secure checkout.',
  opening: 'Please complete the payment in the Razorpay window.',
  processing:
    'Payment was received. We are verifying it on the backend and creating your order.',
  completed: 'Your payment has been confirmed and the order is now placed.',
  dismissed:
    'The payment window was closed. If money was deducted, the backend will still verify and finalize or the amount will be auto-reversed.',
  failed:
    'We could not verify the payment yet. If money was deducted, the backend webhook and retry flow will continue to reconcile it.',
};

const RetailPaymentPage = () => {
  const [searchParams] = useSearchParams();
  const [stage, setStage] = useState<PaymentStage>('booting');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [displayOrderId, setDisplayOrderId] = useState('');
  const hasStartedRef = useRef(false);

  const decodedPayload = useMemo(() => {
    const encodedPayload = searchParams.get('payload') || '';
    if (!encodedPayload) {
      return {
        paymentOrder: null,
        payloadError: 'Missing payment payload.',
      };
    }

    try {
      return {
        paymentOrder: decodeHostedPaymentPayload(encodedPayload),
        payloadError: '',
      };
    } catch (error) {
      return {
        paymentOrder: null,
        payloadError:
          error instanceof Error ? error.message : 'Unable to read payment payload.',
      };
    }
  }, [searchParams]);

  const paymentOrder = decodedPayload.paymentOrder as UnifiedPaymentOrder | null;

  useEffect(() => {
    if (decodedPayload.payloadError) {
      setErrorMessage(decodedPayload.payloadError);
      setStage('failed');
    }
  }, [decodedPayload.payloadError]);

  useEffect(() => {
    if (!paymentOrder || hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;

    const run = async () => {
      setStage('opening');

      try {
        await initiatePayment(paymentOrder, {
          platformOverride: 'web',
          onSuccess: async () => {
            setStage('processing');
            const recovery = await pollRazorpayRecovery({
              getRecovery: () =>
                cartService.getRazorpayRecovery({
                  cartId: paymentOrder.cart_id || '',
                  token: null,
                }),
            });

            if (recovery?.status === 'completed' && recovery?.order) {
              const orderAny = recovery.order as Record<string, any>;
              setDisplayOrderId(
                String(
                  orderAny?.display_id ||
                    orderAny?.displayId ||
                    orderAny?.id ||
                    '',
                ),
              );
              setSuccessMessage(
                'You can now return to the app. Your order has been created successfully.',
              );
              setStage('completed');
              return;
            }

            setSuccessMessage(
              recovery?.message ||
                'Payment is being finalized on the backend. You can safely return to the app.',
            );
            setStage('processing');
          },
          onDismiss: async () => {
            setStage('dismissed');
          },
        });
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Unable to continue with payment.',
        );
        setStage('failed');
      }
    };

    void run();
  }, [paymentOrder]);

  return (
    <div style={pageShellStyle}>
      <div style={cardStyle}>
        <p style={{ color: '#f97316', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
          Familyss Retail
        </p>
        <h1 style={{ fontSize: '1.9rem', lineHeight: 1.15, margin: '12px 0 10px' }}>
          {titleMap[stage]}
        </h1>
        <p style={{ margin: 0, color: '#4b5563', lineHeight: 1.6 }}>
          {messageMap[stage]}
        </p>

        {paymentOrder?.order_id ? (
          <div
            style={{
              marginTop: '20px',
              padding: '14px 16px',
              borderRadius: '16px',
              background: '#fff7ed',
              border: '1px solid #fdba74',
              fontSize: '0.95rem',
              color: '#9a3412',
            }}
          >
            Razorpay order: <strong>{paymentOrder.order_id}</strong>
          </div>
        ) : null}

        {displayOrderId ? (
          <div
            style={{
              marginTop: '18px',
              padding: '14px 16px',
              borderRadius: '16px',
              background: '#ecfdf5',
              border: '1px solid #86efac',
              color: '#166534',
              fontWeight: 600,
            }}
          >
            Order #{displayOrderId} has been created.
          </div>
        ) : null}

        {successMessage ? (
          <div
            style={{
              marginTop: '18px',
              padding: '14px 16px',
              borderRadius: '16px',
              background: '#eff6ff',
              border: '1px solid #93c5fd',
              color: '#1d4ed8',
            }}
          >
            {successMessage}
          </div>
        ) : null}

        {errorMessage ? (
          <div
            style={{
              marginTop: '18px',
              padding: '14px 16px',
              borderRadius: '16px',
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              color: '#b91c1c',
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        <div style={{ marginTop: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Link
            to="/gifts?tab=orders"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '46px',
              padding: '0 18px',
              borderRadius: '999px',
              background: '#f97316',
              color: '#ffffff',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Back to orders
          </Link>
          <Link
            to="/gifts?tab=cart"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '46px',
              padding: '0 18px',
              borderRadius: '999px',
              border: '1px solid #fed7aa',
              color: '#9a3412',
              fontWeight: 700,
              textDecoration: 'none',
              background: '#ffffff',
            }}
          >
            Back to cart
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RetailPaymentPage;
