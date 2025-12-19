import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import {
  MEDUSA_TOKEN_KEY,
  MEDUSA_CART_ID_KEY,
} from '../utils/constants';
import { calculateCartCount, calculateCartTotals, getErrorMessage } from '../utils/helpers';
import * as authService from '../services/authService';
import * as productService from '../services/productService';
import * as cartService from '../services/cartService';
import * as orderService from '../services/orderService';

const RetailContext = createContext(null);

const initialState = {
  user: null,
  token: null,
  cart: null,
  cartId: null,
  products: [],
  orders: [],
  loading: false,
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_TOKEN':
      return { ...state, token: action.payload };
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_CART':
      return { ...state, cart: action.payload, cartId: action.payload ? action.payload.id : null };
    case 'SET_CART_ID':
      return { ...state, cartId: action.payload };
    case 'SET_PRODUCTS':
      return { ...state, products: action.payload };
    case 'SET_ORDERS':
      return { ...state, orders: action.payload };
    case 'RESET':
      return { ...initialState };
    default:
      return state;
  }
}

export const RetailProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setToken = useCallback((token) => {
    if (token) {
      localStorage.setItem(MEDUSA_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(MEDUSA_TOKEN_KEY);
    }
    dispatch({ type: 'SET_TOKEN', payload: token || null });
  }, []);

  const setCartPersistent = useCallback((cart) => {
    if (cart && cart.id) {
      localStorage.setItem(MEDUSA_CART_ID_KEY, cart.id);
      dispatch({ type: 'SET_CART', payload: cart });
    } else {
      localStorage.removeItem(MEDUSA_CART_ID_KEY);
      dispatch({ type: 'SET_CART', payload: null });
    }
  }, []);

  const bootstrap = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const storedToken = localStorage.getItem(MEDUSA_TOKEN_KEY);
      const storedCartId = localStorage.getItem(MEDUSA_CART_ID_KEY);

      if (storedToken) {
        dispatch({ type: 'SET_TOKEN', payload: storedToken });
        try {
          const { customer } = await authService.getCustomerProfile(storedToken);
          dispatch({ type: 'SET_USER', payload: customer });
        } catch (err) {
          setToken(null);
        }
      }

      if (storedCartId) {
        try {
          const cart = await cartService.getCart(storedCartId, storedToken || null);
          setCartPersistent(cart);
          return;
        } catch (err) {
          localStorage.removeItem(MEDUSA_CART_ID_KEY);
        }
      }

      const newCart = await cartService.createCart(storedToken || null);
      setCartPersistent(newCart);
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: getErrorMessage(err) });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [setCartPersistent, setToken]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = useCallback(
    async (email, password) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      try {
        const { token, customer } = await authService.loginCustomer({ email, password });
        setToken(token);
        dispatch({ type: 'SET_USER', payload: customer });

        const candidateCartId = state.cartId || localStorage.getItem(MEDUSA_CART_ID_KEY);
        if (candidateCartId) {
          try {
            const cart = await cartService.getCart(candidateCartId, token);
            try {
              const transferredCart = await cartService.transferCart(cart.id, token);
              setCartPersistent(transferredCart);
              return;
            } catch (err) {
              setCartPersistent(cart);
              return;
            }
          } catch (err) {
            localStorage.removeItem(MEDUSA_CART_ID_KEY);
          }
        }

        const createdCart = await cartService.createCart(token);
        try {
          const transferredCart = await cartService.transferCart(createdCart.id, token);
          setCartPersistent(transferredCart);
        } catch (err) {
          setCartPersistent(createdCart);
        }
      } catch (err) {
        const message = getErrorMessage(err);
        dispatch({ type: 'SET_ERROR', payload: message });
        throw new Error(message);
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [setToken, setCartPersistent, state.cartId],
  );

  const logout = useCallback(() => {
    setToken(null);
    setCartPersistent(null);
    dispatch({ type: 'RESET' });
  }, [setToken, setCartPersistent]);

  const refreshCustomerProfile = useCallback(async () => {
    if (!state.token) return null;

    try {
      const { customer } = await authService.getCustomerProfile(state.token);
      dispatch({ type: 'SET_USER', payload: customer });
      return customer;
    } catch (err) {
      const message = getErrorMessage(err);
      dispatch({ type: 'SET_ERROR', payload: message });
      throw new Error(message);
    }
  }, [state.token]);

  const updateCustomerProfile = useCallback(
    async (body) => {
      if (!state.token) {
        throw new Error('Not authenticated');
      }

      try {
        const { customer } = await authService.updateCustomerProfile(state.token, body);
        dispatch({ type: 'SET_USER', payload: customer });
        return customer;
      } catch (err) {
        const message = getErrorMessage(err);
        dispatch({ type: 'SET_ERROR', payload: message });
        throw new Error(message);
      }
    },
    [state.token],
  );

  const addCustomerAddress = useCallback(
    async (address) => {
      if (!state.token) {
        throw new Error('Not authenticated');
      }

      try {
        const { customer } = await authService.addCustomerAddress(state.token, address);
        dispatch({ type: 'SET_USER', payload: customer });
        return customer.addresses || [];
      } catch (err) {
        const message = getErrorMessage(err);
        dispatch({ type: 'SET_ERROR', payload: message });
        throw new Error(message);
      }
    },
    [state.token],
  );

  const updateCustomerAddress = useCallback(
    async (addressId, address) => {
      if (!state.token) {
        throw new Error('Not authenticated');
      }

      try {
        const { customer } = await authService.updateCustomerAddress(state.token, addressId, address);
        dispatch({ type: 'SET_USER', payload: customer });
        return customer.addresses || [];
      } catch (err) {
        const message = getErrorMessage(err);
        dispatch({ type: 'SET_ERROR', payload: message });
        throw new Error(message);
      }
    },
    [state.token],
  );

  const deleteCustomerAddress = useCallback(
    async (addressId) => {
      if (!state.token) {
        throw new Error('Not authenticated');
      }

      try {
        const { customer } = await authService.deleteCustomerAddress(state.token, addressId);
        dispatch({ type: 'SET_USER', payload: customer });
        return customer.addresses || [];
      } catch (err) {
        const message = getErrorMessage(err);
        dispatch({ type: 'SET_ERROR', payload: message });
        throw new Error(message);
      }
    },
    [state.token],
  );

  const ensureCart = useCallback(async () => {
    // If we already have a cart object in state, reuse it without hitting the API again
    if (state.cart && state.cart.id) {
      return state.cart;
    }

    const storedToken = state.token || localStorage.getItem(MEDUSA_TOKEN_KEY);
    const candidateCartId = state.cartId || localStorage.getItem(MEDUSA_CART_ID_KEY);

    if (candidateCartId) {
      try {
        const cart = await cartService.getCart(candidateCartId, storedToken || null);
        let nextCart = cart;
        if (storedToken) {
          try {
            nextCart = await cartService.transferCart(cart.id, storedToken);
          } catch (err) {
            nextCart = cart;
          }
        }
        setCartPersistent(nextCart);
        return nextCart;
      } catch (err) {
        // Stale or missing cart id, clear and fall through to create a new cart
        localStorage.removeItem(MEDUSA_CART_ID_KEY);
      }
    }

    const createdCart = await cartService.createCart(storedToken || null);
    let nextCart = createdCart;
    if (storedToken) {
      try {
        nextCart = await cartService.transferCart(createdCart.id, storedToken);
      } catch (err) {
        nextCart = createdCart;
      }
    }
    setCartPersistent(nextCart);
    return nextCart;
  }, [setCartPersistent, state.cart, state.cartId, state.token]);

  const createFreshCart = useCallback(async () => {
    const newCart = await cartService.createCart(state.token || null);
    setCartPersistent(newCart);
    return newCart;
  }, [setCartPersistent, state.token]);

  const fetchProducts = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const regionId = state.cart?.region_id || state.cart?.region?.id;
      const products = await productService.fetchProducts({
        token: state.token || null,
        regionId,
      });
      dispatch({ type: 'SET_PRODUCTS', payload: products });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: getErrorMessage(err) });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.token, state.cart]);

  const refreshCart = useCallback(async () => {
    try {
      const cart = await ensureCart();
      setCartPersistent(cart);
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: getErrorMessage(err) });
    }
  }, [ensureCart, setCartPersistent]);

  const addToCart = useCallback(
    async (variantId, quantity = 1) => {
      if (!variantId) return;

      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      try {
        const storedToken = state.token || localStorage.getItem(MEDUSA_TOKEN_KEY) || null;
        const cart = await ensureCart();

        try {
          const updatedCart = await cartService.addLineItem({
            cartId: cart.id,
            variantId,
            quantity,
            token: storedToken,
          });
          setCartPersistent(updatedCart);
        } catch (err) {
          const status = err?.response?.status;
          if (status !== 404) throw err;

          localStorage.removeItem(MEDUSA_CART_ID_KEY);
          const createdCart = await cartService.createCart(storedToken);
          let newCart = createdCart;
          try {
            newCart = await cartService.transferCart(createdCart.id, storedToken);
          } catch (transferErr) {
          }
          setCartPersistent(newCart);

          const retriedCart = await cartService.addLineItem({
            cartId: newCart.id,
            variantId,
            quantity,
            token: storedToken,
          });
          setCartPersistent(retriedCart);
        }
      } catch (err) {
        dispatch({ type: 'SET_ERROR', payload: getErrorMessage(err) });
        throw err;
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [ensureCart, setCartPersistent, state.token],
  );

  const updateCartQuantity = useCallback(
    async (lineItemId, quantity) => {
      if (!lineItemId || quantity <= 0) return;

      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      try {
        const cart = await ensureCart();
        const updatedCart = await cartService.updateLineItemQuantity({
          cartId: cart.id,
          lineItemId,
          quantity,
          token: state.token || null,
        });
        setCartPersistent(updatedCart);
      } catch (err) {
        dispatch({ type: 'SET_ERROR', payload: getErrorMessage(err) });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [ensureCart, setCartPersistent, state.token],
  );

  const removeFromCart = useCallback(
    async (payload) => {
      if (!payload) return;

      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      try {
        const cart = await ensureCart();

        const isObjectPayload = typeof payload === 'object' && payload !== null;
        const lineItemId =
          typeof payload === 'string'
            ? payload
            : isObjectPayload
            ? payload.lineItemId || payload.id
            : null;

        if (!lineItemId) return;

        let updatedCart;
        try {
          updatedCart = await cartService.removeLineItem({
            cartId: cart.id,
            lineItemId,
            token: state.token || null,
          });
        } catch (err) {
          const status = err?.response?.status;

          // If the cart or line item is stale (404), try a single refresh
          // but do not create a new cart implicitly.
          if (status === 404) {
            try {
              const refreshedCart = await cartService.getCart(cart.id, state.token || null);
              if (refreshedCart && refreshedCart.id) {
                setCartPersistent(refreshedCart);
              }
            } catch {
              // Ignore secondary errors here; keep existing cart state.
            }
            return;
          }

          throw err;
        }

        // Medusa may return 204 No Content for line-item deletion.
        // In that case, re-fetch the existing cart instead of creating a new one.
        if (updatedCart && updatedCart.id) {
          setCartPersistent(updatedCart);
          return;
        }

        try {
          const refreshedCart = await cartService.getCart(cart.id, state.token || null);
          if (refreshedCart && refreshedCart.id) {
            setCartPersistent(refreshedCart);
          }
        } catch {
          // Ignore; leave existing cart state as-is on delete.
        }
      } catch (err) {
        dispatch({ type: 'SET_ERROR', payload: getErrorMessage(err) });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [ensureCart, setCartPersistent, state.token],
  );

  const fetchOrders = useCallback(async () => {
    if (!state.token) {
      dispatch({ type: 'SET_ORDERS', payload: [] });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const orders = await orderService.fetchOrders(state.token);
      dispatch({ type: 'SET_ORDERS', payload: orders });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: getErrorMessage(err) });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.token]);

  const retrieveOrder = useCallback(
    async (orderId) => {
      if (!orderId) return null;
      const order = await orderService.retrieveOrder(orderId, state.token || null);
      return order;
    },
    [state.token],
  );

  const createReturn = useCallback(
    async ({ orderId, items, returnShipping }) => {
      if (!orderId) return null;

      if (!state.token) {
        throw new Error('Not authenticated');
      }

      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      try {
        const createdReturn = await orderService.createReturn({
          orderId,
          items,
          returnShipping,
          token: state.token,
        });
        await fetchOrders();
        return createdReturn;
      } catch (err) {
        const message = getErrorMessage(err);
        dispatch({ type: 'SET_ERROR', payload: message });
        throw new Error(message);
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [state.token, fetchOrders],
  );

  const getShippingOptionsForCart = useCallback(async () => {
    try {
      const cart = await ensureCart();
      const options = await cartService.getShippingOptions(cart.id, state.token || null);
      return options;
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: getErrorMessage(err) });
      return [];
    }
  }, [ensureCart, state.token]);

  const updateCartAddressesForCheckout = useCallback(
    async (shippingAddress, billingAddress) => {
      try {
        const cart = await ensureCart();
        const updatedCart = await cartService.updateCart({
          cartId: cart.id,
          body: {
            shipping_address: shippingAddress,
            billing_address: billingAddress,
          },
          token: state.token || null,
        });

        setCartPersistent(updatedCart);
        return updatedCart;
      } catch (err) {
        const message = getErrorMessage(err);
        dispatch({ type: 'SET_ERROR', payload: message });
        throw new Error(message);
      }
    },
    [ensureCart, setCartPersistent, state.token],
  );

  const completeCheckout = useCallback(
    async (shippingAddress, billingAddress, shippingMethodId) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      try {
        const cart = await ensureCart();

        // 1. Set shipping address on the cart
        const updatedWithShippingAddress = await cartService.updateCart({
          cartId: cart.id,
          body: { shipping_address: shippingAddress },
          token: state.token || null,
        });

        // 2. Set billing address
        const updatedWithBilling = await cartService.updateCart({
          cartId: updatedWithShippingAddress.id,
          body: { billing_address: billingAddress },
          token: state.token || null,
        });

        // 3. Attach the selected shipping method directly
        const updatedWithShippingMethod = await cartService.addShippingMethod({
          cartId: updatedWithBilling.id,
          optionId: shippingMethodId,
          data: {},
          token: state.token || null,
        });

        // 4. Create payment collection for this cart
        const paymentCollection = await cartService.createPaymentCollection(
          updatedWithShippingMethod.id,
          state.token || null,
        );

        // 5. Initialize payment session for default provider
        await cartService.initPaymentSession({
          paymentCollectionId: paymentCollection.id,
          providerId: 'pp_system_default',
          token: state.token || null,
        });

        // 6. Complete cart to create the order
        const order = await cartService.completeCart(updatedWithShippingMethod.id, state.token || null);

        await fetchOrders();

        // 7. Start a fresh cart for the next purchase
        await createFreshCart();

        return order;
      } catch (err) {
        const message = getErrorMessage(err);
        dispatch({ type: 'SET_ERROR', payload: message });
        throw new Error(message);
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [ensureCart, fetchOrders, createFreshCart, state.token],
  );

  const startOnlinePayment = useCallback(
    async (shippingAddress, billingAddress, shippingMethodId) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      try {
        const cart = await ensureCart();

        const updatedWithShippingAddress = await cartService.updateCart({
          cartId: cart.id,
          body: { shipping_address: shippingAddress },
          token: state.token || null,
        });

        const updatedWithBilling = await cartService.updateCart({
          cartId: updatedWithShippingAddress.id,
          body: { billing_address: billingAddress },
          token: state.token || null,
        });

        const updatedWithShippingMethod = await cartService.addShippingMethod({
          cartId: updatedWithBilling.id,
          optionId: shippingMethodId,
          data: {},
          token: state.token || null,
        });

        setCartPersistent(updatedWithShippingMethod);

        const paymentCollection = await cartService.createPaymentCollection(
          updatedWithShippingMethod.id,
          state.token || null,
        );

        const collectionWithSessions = await cartService.initPaymentSession({
          paymentCollectionId: paymentCollection.id,
          providerId: 'pp_razorpay_razorpay',
          token: state.token || null,
        });

        const collection =
          collectionWithSessions.payment_collection || collectionWithSessions;

        const sessionsArray = Array.isArray(collection.payment_sessions)
          ? collection.payment_sessions
          : Array.isArray(collection.paymentSessions)
          ? collection.paymentSessions
          : [];

        const primarySession = sessionsArray[0] || null;

        return {
          cartId: updatedWithShippingMethod.id,
          paymentCollectionId: collection.id,
          razorpaySession: primarySession?.data || {},
        };
      } catch (err) {
        const message = getErrorMessage(err);
        dispatch({ type: 'SET_ERROR', payload: message });
        throw new Error(message);
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [ensureCart, setCartPersistent, state.token],
  );

  const derived = useMemo(
    () => ({
      ...state,
      cartCount: calculateCartCount(state.cart),
      totals: calculateCartTotals(state.cart),
    }),
    [state],
  );

  const value = useMemo(
    () => ({
      ...derived,
      login,
      logout,
      refreshCustomerProfile,
      updateCustomerProfile,
      addCustomerAddress,
      updateCustomerAddress,
      deleteCustomerAddress,
      fetchProducts,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      fetchOrders,
      retrieveOrder,
      createReturn,
      refreshCart,
      createFreshCart,
      completeCheckout,
      getShippingOptionsForCart,
      updateCartAddressesForCheckout,
      startOnlinePayment,
    }),
    [
      derived,
      login,
      logout,
      fetchProducts,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      fetchOrders,
      retrieveOrder,
      refreshCart,
      createFreshCart,
      completeCheckout,
      getShippingOptionsForCart,
      updateCartAddressesForCheckout,
      startOnlinePayment,
    ],
  );

  return <RetailContext.Provider value={value}>{children}</RetailContext.Provider>;
};

export const useRetail = () => {
  const context = useContext(RetailContext);
  if (!context) {
    throw new Error('useRetail must be used within a RetailProvider');
  }
  return context;
};
