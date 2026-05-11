export async function createCart(token: any, regionId?: string | null): Promise<any>;

export async function getCart(cartId: string, token: any): Promise<any>;

export async function addLineItem(args: {
  cartId: string;
  variantId: string;
  quantity: number;
  token: any;
}): Promise<any>;

export async function updateLineItemQuantity(args: {
  cartId: string;
  lineItemId: string;
  quantity: number;
  token: any;
}): Promise<any>;

export async function removeLineItem(args: {
  cartId: string;
  lineItemId: string;
  token: any;
}): Promise<any>;

export async function transferCart(cartId: string, token: any): Promise<any>;

export async function updateCart(args: {
  cartId: string;
  body: any;
  token: any;
}): Promise<any>;

export async function getShippingOptions(
  cartId: string,
  token: any,
  paymentMode?: any,
): Promise<any[]>;

export async function clearShippingMethods(cartId: string, token: any): Promise<any>;

export async function addShippingMethod(args: {
  cartId: string;
  optionId: string;
  data?: Record<string, any>;
  token: any;
}): Promise<any>;

export async function addShippingMethods(args: {
  cartId: string;
  options?: Array<{ optionId?: string; option_id?: string; data?: Record<string, any> }>;
  token: any;
}): Promise<any>;

export async function getShippingCoverage(args: {
  cartId: string;
  token: any;
}): Promise<any>;

export async function createPaymentCollection(cartId: string, token: any): Promise<any>;

export async function initPaymentSession(args: {
  paymentCollectionId: string;
  providerId?: string;
  token: any;
}): Promise<any>;

export async function createOrReuseRazorpaySession(args: {
  cartId: string;
  token: any;
}): Promise<any>;

export async function getRazorpayRecovery(args: {
  cartId: string;
  token: any;
}): Promise<any>;

export async function completeCart(cartId: string, token: any): Promise<any>;

export async function verifyRazorpayPayment(args: {
  paymentCollectionId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  token: any;
}): Promise<any>;
