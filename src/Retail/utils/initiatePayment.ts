import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

export type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

export type UnifiedPaymentOrder = {
  amount: number;
  order_id: string;
  payment_collection_id?: string;
  payment_url?: string;
  razorpay_key_id?: string;
  currency?: string;
  name?: string;
  description?: string;
  cart_id?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string | undefined>;
  theme?: {
    color?: string;
  };
};

export type RecoveryPayload = {
  status?: string;
  message?: string;
  order?: unknown;
};

type HostedPaymentPayload = UnifiedPaymentOrder;

export type InitiatePaymentOptions = {
  platformOverride?: 'native' | 'web';
  appBaseUrl?: string;
  onSuccess?: (response: RazorpaySuccessResponse) => Promise<void> | void;
  onDismiss?: () => Promise<void> | void;
  onPending?: () => Promise<void> | void;
};

export type InitiatePaymentResult =
  | {
      flow: 'native';
      status: 'pending';
    }
  | {
      flow: 'web';
      status: 'success' | 'dismissed';
      response?: RazorpaySuccessResponse;
    };

type RazorpayCheckoutInstance = {
  open: () => void;
};

type RazorpayCheckoutConstructor = new (options: Record<string, any>) => RazorpayCheckoutInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayCheckoutConstructor;
  }
}

const SCRIPT_ID = 'razorpay-checkout-sdk';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const encodeBase64Url = (value: string) =>
  window
    .btoa(unescape(encodeURIComponent(value)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return decodeURIComponent(escape(window.atob(`${normalized}${padding}`)));
};

export function buildHostedPaymentUrl(
  order: UnifiedPaymentOrder,
  appBaseUrl?: string,
): string {
  const baseUrl =
    (appBaseUrl || '').trim().replace(/\/$/, '') ||
    (typeof window !== 'undefined' && window.location?.origin
      ? String(window.location.origin).replace(/\/$/, '')
      : '');

  if (!baseUrl) {
    throw new Error('A storefront base URL is required for native payment redirection.');
  }

  const payload = encodeBase64Url(JSON.stringify(order as HostedPaymentPayload));
  return `${baseUrl}/retail/payment?payload=${encodeURIComponent(payload)}`;
}

export function decodeHostedPaymentPayload(encodedPayload: string): UnifiedPaymentOrder {
  if (!encodedPayload) {
    throw new Error('Missing hosted payment payload.');
  }

  try {
    return JSON.parse(decodeBase64Url(encodedPayload)) as UnifiedPaymentOrder;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Unable to decode payment payload.',
    );
  }
}

async function loadRazorpayCheckout(): Promise<RazorpayCheckoutConstructor> {
  if (typeof window === 'undefined') {
    throw new Error('Razorpay checkout is only available in the browser.');
  }

  if (window.Razorpay) {
    return window.Razorpay;
  }

  const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existingScript?.dataset.ready === 'true' && window.Razorpay) {
    return window.Razorpay;
  }

  await new Promise<void>((resolve, reject) => {
    const script = existingScript || document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;

    script.onload = () => {
      script.dataset.ready = 'true';
      if (window.Razorpay) {
        resolve();
        return;
      }
      reject(new Error('Razorpay SDK loaded but window.Razorpay is unavailable.'));
    };

    script.onerror = () => reject(new Error('Failed to load Razorpay Checkout SDK.'));

    if (!existingScript) {
      document.body.appendChild(script);
    }
  });

  if (!window.Razorpay) {
    throw new Error('Razorpay checkout is unavailable.');
  }

  return window.Razorpay;
}

export async function initiatePayment(
  order: UnifiedPaymentOrder,
  options: InitiatePaymentOptions = {},
): Promise<InitiatePaymentResult> {
  const platform = options.platformOverride
    ? options.platformOverride
    : Capacitor.isNativePlatform()
    ? 'native'
    : 'web';

  if (platform === 'native') {
    const paymentUrl =
      order.payment_url || buildHostedPaymentUrl(order, options.appBaseUrl);

    let finishedHandled = false;
    const finishedListener =
      typeof Browser?.addListener === 'function'
        ? await Browser.addListener('browserFinished', async () => {
            if (finishedHandled) {
              return;
            }
            finishedHandled = true;
            await options.onPending?.();
            await finishedListener.remove();
          })
        : null;

    await Browser.open({ url: paymentUrl });

    return {
      flow: 'native',
      status: 'pending',
    };
  }

  if (!order.razorpay_key_id) {
    throw new Error('Missing Razorpay key for web checkout.');
  }

  const RazorpayCheckout = await loadRazorpayCheckout();

  return await new Promise<InitiatePaymentResult>((resolve, reject) => {
    const checkout = new RazorpayCheckout({
      key: order.razorpay_key_id,
      amount: order.amount,
      currency: (order.currency || 'INR').toUpperCase(),
      name: order.name || 'Familyss Store',
      description: order.description || 'Order payment',
      order_id: order.order_id,
      prefill: order.prefill || {},
      notes: order.notes || {},
      theme: order.theme || { color: '#F97316' },
      handler: async (response: RazorpaySuccessResponse) => {
        try {
          await options.onSuccess?.(response);
          resolve({
            flow: 'web',
            status: 'success',
            response,
          });
        } catch (error) {
          reject(error);
        }
      },
      modal: {
        ondismiss: async () => {
          try {
            await options.onDismiss?.();
            resolve({
              flow: 'web',
              status: 'dismissed',
            });
          } catch (error) {
            reject(error);
          }
        },
      },
    });

    checkout.open();
  });
}

export async function pollRazorpayRecovery<T extends RecoveryPayload>({
  getRecovery,
  maxAttempts = 45,
  delayMs = 2000,
}: {
  getRecovery: () => Promise<T>;
  maxAttempts?: number;
  delayMs?: number;
}): Promise<T> {
  let lastRecovery: T | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    lastRecovery = await getRecovery();

    if (lastRecovery?.status === 'completed' && lastRecovery?.order) {
      return lastRecovery;
    }

    if (
      lastRecovery?.status === 'failed' ||
      lastRecovery?.status === 'expired' ||
      lastRecovery?.status === 'abandoned'
    ) {
      throw new Error(
        lastRecovery?.message ||
          'Payment could not be completed. If the amount was deducted, it will be auto-refunded or reversed by your bank.',
      );
    }

    await sleep(delayMs);
  }

  return (lastRecovery || {}) as T;
}
