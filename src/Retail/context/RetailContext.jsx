import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import {
  MEDUSA_TOKEN_KEY,
  MEDUSA_CART_ID_KEY,
  MEDUSA_REGION_ID_KEY,
  
} from '../utils/constants';
import {
  calculateCartCount,
  calculateCartTotals,
  getErrorMessage,
  isInsufficientInventoryError,
} from '../utils/helpers';
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
  regions: [],
  selectedRegionId: null,
  products: [],
  productCategories: [],
  selectedCategoryId: 'all',
  orders: [],
  loading: false,
  error: null,
  toast: null,
  paymentRecovery: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_TOAST':
      return { ...state, toast: action.payload };
    case 'CLEAR_TOAST':
      return { ...state, toast: null };
    case 'SET_PAYMENT_RECOVERY':
      return { ...state, paymentRecovery: action.payload };
    case 'CLEAR_PAYMENT_RECOVERY':
      return { ...state, paymentRecovery: null };
    case 'SET_TOKEN':
      return { ...state, token: action.payload };
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_CART':
      return { ...state, cart: action.payload, cartId: action.payload ? action.payload.id : null };
    case 'SET_CART_ID':
      return { ...state, cartId: action.payload };
    case 'SET_REGIONS':
      return { ...state, regions: action.payload };
    case 'SET_SELECTED_REGION_ID':
      return { ...state, selectedRegionId: action.payload };
    case 'SET_PRODUCTS':
      return { ...state, products: action.payload };
    case 'SET_PRODUCT_CATEGORIES':
      return { ...state, productCategories: action.payload };
    case 'SET_SELECTED_CATEGORY_ID':
      return { ...state, selectedCategoryId: action.payload };
    case 'SET_ORDERS':
      return { ...state, orders: action.payload };
    case 'APPEND_ORDERS':
      return { ...state, orders: [...(state.orders || []), ...(action.payload || [])] };
    case 'RESET':
      return { ...initialState };
    default:
      return state;
  }
}

export const RetailProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const showToast = useCallback((message, variant = 'error') => {
    dispatch({
      type: 'SET_TOAST',
      payload: {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        message: message || 'Something went wrong',
        variant,
      },
    });
  }, []);

  const clearToast = useCallback(() => {
    dispatch({ type: 'CLEAR_TOAST' });
  }, []);

  const setPaymentRecovery = useCallback((payload) => {
    dispatch({
      type: 'SET_PAYMENT_RECOVERY',
      payload: payload || null,
    });
  }, []);

  const clearPaymentRecovery = useCallback(() => {
    dispatch({ type: 'CLEAR_PAYMENT_RECOVERY' });
  }, []);

  const setToken = useCallback((token) => {
    if (token) {
      localStorage.setItem(MEDUSA_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(MEDUSA_TOKEN_KEY);
    }
    dispatch({ type: 'SET_TOKEN', payload: token || null });
  }, []);

  const setSelectedRegionPersistent = useCallback((regionId) => {
    const normalizedRegionId = regionId || null;

    if (normalizedRegionId) {
      localStorage.setItem(MEDUSA_REGION_ID_KEY, normalizedRegionId);
    } else {
      localStorage.removeItem(MEDUSA_REGION_ID_KEY);
    }

    dispatch({ type: 'SET_SELECTED_REGION_ID', payload: normalizedRegionId });
  }, []);

  const setCartPersistent = useCallback((cart) => {
    if (cart && cart.id) {
      localStorage.setItem(MEDUSA_CART_ID_KEY, cart.id);

      const regionId = cart?.region_id || cart?.region?.id || null;
      if (regionId) {
        localStorage.setItem(MEDUSA_REGION_ID_KEY, regionId);
        dispatch({ type: 'SET_SELECTED_REGION_ID', payload: regionId });
      }
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
      let storedToken = localStorage.getItem(MEDUSA_TOKEN_KEY);
      const storedCartId = localStorage.getItem(MEDUSA_CART_ID_KEY);
      const storedRegionId = localStorage.getItem(MEDUSA_REGION_ID_KEY);

      if (!storedToken) {
        const appAccessToken = localStorage.getItem('access_token');
        if (appAccessToken) {
          try {
            const { token, customer } = await authService.loginCustomerViaAppSso(appAccessToken);
            storedToken = token;
            setToken(token);
            dispatch({ type: 'SET_USER', payload: customer });
          } catch (err) {
            // Ignore SSO failures to avoid blocking retail loading.
          }
        }
      }

      if (storedToken) {
        dispatch({ type: 'SET_TOKEN', payload: storedToken });
        try {
          const { customer } = await authService.getCustomerProfile(storedToken);
          dispatch({ type: 'SET_USER', payload: customer });
        } catch (err) {
          setToken(null);
        }
      }

      let resolvedRegionId = storedRegionId || null;
      try {
        const regions = await productService.fetchRegions(storedToken || null);
        const normalizedRegions = Array.isArray(regions) ? regions : [];
        dispatch({ type: 'SET_REGIONS', payload: normalizedRegions });

        if (!resolvedRegionId && normalizedRegions.length > 0) {
          resolvedRegionId = normalizedRegions[0]?.id || null;
        }

        if (resolvedRegionId) {
          setSelectedRegionPersistent(resolvedRegionId);
        }
      } catch {
        dispatch({ type: 'SET_REGIONS', payload: [] });
      }

      if (storedCartId) {
        try {
          const cart = await cartService.getCart(storedCartId, storedToken || null);
          setCartPersistent(cart);

          try {
            const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
            const recoverCartPayment = async () => {
              let latestRecovery = null;

              setPaymentRecovery({
                active: true,
                cartId: cart.id,
                status: 'processing',
                message: 'Payment received. We are finalizing your order securely.',
              });

              for (let attempt = 0; attempt < 45; attempt += 1) {
                // eslint-disable-next-line no-await-in-loop
                latestRecovery = await cartService.getRazorpayRecovery({
                  cartId: cart.id,
                  token: storedToken || null,
                });

                const nextStatus = latestRecovery?.status || 'processing';
                const nextMessage =
                  latestRecovery?.message ||
                  (nextStatus === 'pending_capture'
                    ? 'Payment is authorized and waiting for capture confirmation.'
                    : 'Payment received. We are finalizing your order securely.');

                setPaymentRecovery({
                  active: !['completed', 'failed', 'expired', 'abandoned', 'not_started'].includes(
                    nextStatus,
                  ),
                  cartId: cart.id,
                  status: nextStatus,
                  message: nextMessage,
                });

                if (
                  nextStatus === 'completed' ||
                  nextStatus === 'failed' ||
                  nextStatus === 'expired' ||
                  nextStatus === 'abandoned' ||
                  nextStatus === 'not_started'
                ) {
                  return latestRecovery;
                }

                // eslint-disable-next-line no-await-in-loop
                await sleep(2000);
              }

              return latestRecovery;
            };

            const recovery = await recoverCartPayment();

            if (recovery?.status === 'completed' && recovery?.order) {
              const recoveredCart = await cartService.createCart(
                storedToken || null,
                cart?.region_id || cart?.region?.id || resolvedRegionId || null,
              );
              let nextCart = recoveredCart;

              if (storedToken) {
                try {
                  nextCart = await cartService.transferCart(recoveredCart.id, storedToken);
                } catch {
                  nextCart = recoveredCart;
                }
              }

              setCartPersistent(nextCart);
              clearPaymentRecovery();
              showToast('Your previous payment was confirmed and the order has been placed.', 'success');
              return;
            }

            clearPaymentRecovery();
          } catch {
            clearPaymentRecovery();
            // Ignore recovery polling failures during bootstrap.
          }

          return;
        } catch (err) {
          localStorage.removeItem(MEDUSA_CART_ID_KEY);
        }
      }

      const newCart = await cartService.createCart(storedToken || null, resolvedRegionId);
      setCartPersistent(newCart);
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: getErrorMessage(err) });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [
    clearPaymentRecovery,
    setCartPersistent,
    setPaymentRecovery,
    setSelectedRegionPersistent,
    setToken,
    showToast,
  ]);

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

        const createdCart = await cartService.createCart(token, state.selectedRegionId || null);
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
    [setToken, setCartPersistent, state.cartId, state.selectedRegionId],
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

    const createdCart = await cartService.createCart(
      storedToken || null,
      state.selectedRegionId || localStorage.getItem(MEDUSA_REGION_ID_KEY) || null,
    );
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
  }, [setCartPersistent, state.cart, state.cartId, state.selectedRegionId, state.token]);

  const createFreshCart = useCallback(async () => {
    const newCart = await cartService.createCart(
      state.token || null,
      state.selectedRegionId || null,
    );
    setCartPersistent(newCart);
    return newCart;
  }, [setCartPersistent, state.selectedRegionId, state.token]);

  const fetchProducts = useCallback(async ({ categoryId: categoryIdOverride } = {}) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const regionId =
        state.cart?.region_id ||
        state.cart?.region?.id ||
        state.selectedRegionId ||
        localStorage.getItem(MEDUSA_REGION_ID_KEY) ||
        null;
      const rawCategoryId = categoryIdOverride ?? state.selectedCategoryId;
      const categoryId = rawCategoryId && rawCategoryId !== 'all' ? rawCategoryId : null;
      const products = await productService.fetchProducts({
        token: state.token || null,
        regionId,
        query: categoryId ? { category_id: categoryId } : {},
      });
      dispatch({ type: 'SET_PRODUCTS', payload: products });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: getErrorMessage(err) });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.token, state.cart, state.selectedCategoryId, state.selectedRegionId]);

  const fetchProductCategories = useCallback(async () => {
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const categories = await productService.fetchProductCategories(state.token || null);
      dispatch({ type: 'SET_PRODUCT_CATEGORIES', payload: Array.isArray(categories) ? categories : [] });
      return categories;
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: getErrorMessage(err) });
      dispatch({ type: 'SET_PRODUCT_CATEGORIES', payload: [] });
      return [];
    }
  }, [state.token]);

  const fetchRegions = useCallback(async () => {
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const regions = await productService.fetchRegions(state.token || null);
      const normalizedRegions = Array.isArray(regions) ? regions : [];
      dispatch({ type: 'SET_REGIONS', payload: normalizedRegions });

      if (!state.selectedRegionId && normalizedRegions.length > 0) {
        setSelectedRegionPersistent(normalizedRegions[0]?.id || null);
      }

      return normalizedRegions;
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: getErrorMessage(err) });
      dispatch({ type: 'SET_REGIONS', payload: [] });
      return [];
    }
  }, [setSelectedRegionPersistent, state.selectedRegionId, state.token]);

  const changeRegion = useCallback(
    async (regionId) => {
      if (!regionId || regionId === state.selectedRegionId) {
        return state.selectedRegionId;
      }

      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      try {
        setSelectedRegionPersistent(regionId);
        const nextCart = await cartService.createCart(state.token || null, regionId);
        let persistedCart = nextCart;

        if (state.token) {
          try {
            persistedCart = await cartService.transferCart(nextCart.id, state.token);
          } catch {
            persistedCart = nextCart;
          }
        }

        setCartPersistent(persistedCart);
        await fetchProducts({ categoryId: state.selectedCategoryId });
        return regionId;
      } catch (err) {
        const message = getErrorMessage(err);
        dispatch({ type: 'SET_ERROR', payload: message });
        throw new Error(message);
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [
      fetchProducts,
      setCartPersistent,
      setSelectedRegionPersistent,
      state.selectedCategoryId,
      state.selectedRegionId,
      state.token,
    ],
  );

  const setSelectedCategoryId = useCallback((categoryId) => {
    dispatch({ type: 'SET_SELECTED_CATEGORY_ID', payload: categoryId || 'all' });
  }, []);

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

        const items = Array.isArray(cart?.items) ? cart.items : [];
        const existing = items.find(
          (i) => (i?.variant_id || i?.variant?.id) === variantId
        );

        try {
          const updatedCart = existing?.id
            ? await cartService.updateLineItemQuantity({
                cartId: cart.id,
                lineItemId: existing.id,
                quantity: (existing.quantity || 0) + quantity,
                token: storedToken,
              })
            : await cartService.addLineItem({
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
          const createdCart = await cartService.createCart(
            storedToken,
            state.selectedRegionId || localStorage.getItem(MEDUSA_REGION_ID_KEY) || null,
          );
          let newCart = createdCart;
          try {
            newCart = await cartService.transferCart(createdCart.id, storedToken);
          } catch (transferErr) {
          }
          setCartPersistent(newCart);

          const newItems = Array.isArray(newCart?.items) ? newCart.items : [];
          const newExisting = newItems.find(
            (i) => (i?.variant_id || i?.variant?.id) === variantId
          );

          const retriedCart = newExisting?.id
            ? await cartService.updateLineItemQuantity({
                cartId: newCart.id,
                lineItemId: newExisting.id,
                quantity: (newExisting.quantity || 0) + quantity,
                token: storedToken,
              })
            : await cartService.addLineItem({
                cartId: newCart.id,
                variantId,
                quantity,
                token: storedToken,
              });
          setCartPersistent(retriedCart);
        }
      } catch (err) {
        if (isInsufficientInventoryError(err)) {
          showToast('Out of stock');
          dispatch({ type: 'SET_ERROR', payload: null });
          throw err;
        }
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
        if (isInsufficientInventoryError(err)) {
          showToast('Out of stock');
          dispatch({ type: 'SET_ERROR', payload: null });
          return;
        }
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
      const orders = await orderService.fetchOrdersPaged(state.token, {
        limit: 50,
        offset: 0,
        order: '-created_at',
      });
      dispatch({ type: 'SET_ORDERS', payload: orders });
      return orders;
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: getErrorMessage(err) });
      return [];
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.token]);

  useEffect(() => {
    const recovery = state.paymentRecovery;

    if (!recovery?.active || recovery?.source !== 'checkout' || !recovery?.cartId) {
      return undefined;
    }

    let cancelled = false;

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const pollRecovery = async () => {
      for (let attempt = 0; attempt < 45; attempt += 1) {
        let latestRecovery = null;

        try {
          // eslint-disable-next-line no-await-in-loop
          latestRecovery = await cartService.getRazorpayRecovery({
            cartId: recovery.cartId,
            token: state.token || null,
          });
        } catch (err) {
          if (cancelled) {
            return;
          }

          const message = getErrorMessage(err) || 'Failed to verify payment status.';
          dispatch({ type: 'SET_ERROR', payload: message });
          showToast(message);
          clearPaymentRecovery();
          return;
        }

        if (cancelled) {
          return;
        }

        const nextStatus = latestRecovery?.status || 'processing';
        const nextMessage =
          latestRecovery?.message ||
          (nextStatus === 'pending_capture'
            ? 'Payment is authorized and waiting for capture confirmation.'
            : 'Payment received. We are finalizing your order securely.');

        if (nextStatus === 'completed' && latestRecovery?.order) {
          let recoveredCart = await cartService.createCart(
            state.token || null,
            state.selectedRegionId || localStorage.getItem(MEDUSA_REGION_ID_KEY) || null,
          );

          if (state.token) {
            try {
              recoveredCart = await cartService.transferCart(recoveredCart.id, state.token);
            } catch {
              // Keep anonymous fresh cart fallback.
            }
          }

          setCartPersistent(recoveredCart);

          if (state.token) {
            await fetchOrders();
          }

          clearPaymentRecovery();
          showToast('Payment successful! Your order has been placed.', 'success');
          return;
        }

        if (
          nextStatus === 'failed' ||
          nextStatus === 'expired' ||
          nextStatus === 'abandoned'
        ) {
          dispatch({ type: 'SET_ERROR', payload: nextMessage });
          showToast(nextMessage);
          clearPaymentRecovery();
          return;
        }

        setPaymentRecovery({
          active: true,
          source: 'checkout',
          cartId: recovery.cartId,
          status: nextStatus,
          message: nextMessage,
        });

        // eslint-disable-next-line no-await-in-loop
        await sleep(2000);
      }
    };

    pollRecovery();

    return () => {
      cancelled = true;
    };
  }, [
    clearPaymentRecovery,
    fetchOrders,
    setCartPersistent,
    setPaymentRecovery,
    showToast,
    state.paymentRecovery?.active,
    state.paymentRecovery?.cartId,
    state.paymentRecovery?.source,
    state.token,
  ]);

  const fetchOrdersPage = useCallback(
    async ({ limit = 50, offset = 0, append = false } = {}) => {
      if (!state.token) {
        if (!append) dispatch({ type: 'SET_ORDERS', payload: [] });
        return [];
      }

      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      try {
        const orders = await orderService.fetchOrdersPaged(state.token, {
          limit,
          offset,
          order: '-created_at',
        });

        if (append) {
          dispatch({ type: 'APPEND_ORDERS', payload: orders });
        } else {
          dispatch({ type: 'SET_ORDERS', payload: orders });
        }

        return orders;
      } catch (err) {
        dispatch({ type: 'SET_ERROR', payload: getErrorMessage(err) });
        return [];
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [state.token],
  );

  const retrieveOrder = useCallback(
    async (orderId) => {
      if (!orderId) return null;
      const order = await orderService.retrieveOrder(orderId, state.token || null);
      return order;
    },
    [state.token],
  );

  const createReturn = useCallback(
    async ({ orderId, items, note }) => {
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
          note,
          token: state.token,
        });
        await fetchOrders();
        return createdReturn;
      } catch (err) {
        if (isInsufficientInventoryError(err)) {
          showToast('Out of stock');
          dispatch({ type: 'SET_ERROR', payload: null });
          throw err;
        }
        const message = getErrorMessage(err);
        dispatch({ type: 'SET_ERROR', payload: message });
        throw new Error(message);
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [state.token, fetchOrders, showToast],
  );

  const createRefundRequest = useCallback(
    async ({ orderId, items, note }) => {
      if (!orderId) return null;

      if (!state.token) {
        throw new Error('Not authenticated');
      }

      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      try {
        const request = await orderService.createRefundRequest({
          orderId,
          items,
          note,
          token: state.token,
        });
        await fetchOrders();
        return request;
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

  const cancelOrder = useCallback(
    async (orderId) => {
      if (!orderId) return null;

      if (!state.token) {
        throw new Error('Not authenticated');
      }

      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      try {
        const cancelledOrder = await orderService.cancelOrder(orderId, state.token);
        await fetchOrders();
        return cancelledOrder;
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

  const fetchOrderTracking = useCallback(
    async (orderId) => {
      if (!orderId) return null;
      return await orderService.fetchOrderTracking(orderId, state.token || null);
    },
    [state.token],
  );

  const fetchOrderTimeline = useCallback(
    async (orderId) => {
      if (!orderId) return null;
      return await orderService.fetchOrderTimeline(orderId, state.token || null);
    },
    [state.token],
  );

  const fetchOrderInvoice = useCallback(
    async (orderId) => {
      if (!orderId) return '';
      return await orderService.fetchOrderInvoice(orderId, state.token || null);
    },
    [state.token],
  );

  const fetchReturnReasons = useCallback(
    async () => {
      return await orderService.fetchReturnReasons(state.token || null);
    },
    [state.token],
  );

  const getShippingOptionsForCart = useCallback(
    async (paymentMode) => {
      try {
        const cart = await ensureCart();

        // If the cart doesn't yet have a shipping postal_code, Shiprocket
        // can't calculate rates. This happens, for example, right after we
        // create a fresh cart following a successful order. In that case,
        // skip calling the backend rates endpoint to avoid spurious errors.
        const shippingAddress =
          (cart && (cart.shipping_address || cart.shippingAddress)) || null;

        if (!shippingAddress || !shippingAddress.postal_code) {
          return [];
        }

        const options = await cartService.getShippingOptions(
          cart.id,
          state.token || null,
          paymentMode,
        );
        return options;
      } catch (err) {
        dispatch({ type: 'SET_ERROR', payload: getErrorMessage(err) });
        return [];
      }
    },
    [ensureCart, state.token],
  );

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
    async (shippingAddress, billingAddress, shippingSelections) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      try {
        const cart = await ensureCart();

        // 1. Set shipping address on the cart
        const updatedWithShippingAddress = await cartService.updateCart({
          cartId: cart.id,
          body: {
            shipping_address: shippingAddress,
          },
          token: state.token || null,
        });

        // 2. Set billing address
        const updatedWithBilling = await cartService.updateCart({
          cartId: updatedWithShippingAddress.id,
          body: { billing_address: billingAddress },
          token: state.token || null,
        });

        // 3. Attach the selected shipping method directly. The backend
        // clears any previous shipping methods before adding a new one.
        const cartWithShipping = await cartService.addShippingMethods({
          cartId: updatedWithBilling.id,
          options: shippingSelections,
          token: state.token || null,
        });

        // 4. Create payment collection for this cart
        const paymentCollection = await cartService.createPaymentCollection(
          cartWithShipping.id,
          state.token || null,
        );

        // 5. Initialize payment session for default provider
        await cartService.initPaymentSession({
          paymentCollectionId: paymentCollection.id,
          providerId: 'pp_system_default',
          token: state.token || null,
        });

        // 6. Complete cart to create the order
        const order = await cartService.completeCart(cartWithShipping.id, state.token || null);

        await fetchOrders();

        // 7. Start a fresh cart for the next purchase
        await createFreshCart();

        return order;
      } catch (err) {
        if (isInsufficientInventoryError(err)) {
          showToast('Out of stock');
          dispatch({ type: 'SET_ERROR', payload: null });
          throw err;
        }
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
    async (shippingAddress, billingAddress, shippingSelections) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      try {
        const cart = await ensureCart();

        const updatedWithShippingAddress = await cartService.updateCart({
          cartId: cart.id,
          body: {
            shipping_address: shippingAddress,
          },
          token: state.token || null,
        });

        const updatedWithBilling = await cartService.updateCart({
          cartId: updatedWithShippingAddress.id,
          body: { billing_address: billingAddress },
          token: state.token || null,
        });

        // Attach the selected shipping method directly. The backend clears any
        // previous shipping methods before adding a new one.
        const cartWithShipping = await cartService.addShippingMethods({
          cartId: updatedWithBilling.id,
          options: shippingSelections,
          token: state.token || null,
        });

        setCartPersistent(cartWithShipping);

        const sessionResult = await cartService.createOrReuseRazorpaySession({
          cartId: cartWithShipping.id,
          token: state.token || null,
        });

        return {
          cartId: cartWithShipping.id,
          paymentCollectionId: sessionResult.paymentCollectionId || null,
          paymentAttempt: sessionResult.attempt || null,
          razorpaySession: sessionResult.razorpaySession || {},
        };
      } catch (err) {
        if (isInsufficientInventoryError(err)) {
          showToast('Out of stock');
          dispatch({ type: 'SET_ERROR', payload: null });
          throw err;
        }
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
      productCategories: state.productCategories,
      selectedCategoryId: state.selectedCategoryId,
    }),
    [state],
  );

  const value = useMemo(
    () => ({
      ...derived,
      toast: state.toast,
      showToast,
      clearToast,
      setPaymentRecovery,
      clearPaymentRecovery,
      login,
      logout,
      refreshCustomerProfile,
      updateCustomerProfile,
      addCustomerAddress,
      updateCustomerAddress,
      deleteCustomerAddress,
      fetchProducts,
      fetchProductCategories,
      fetchRegions,
      changeRegion,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      fetchOrders,
      fetchOrdersPage,
      retrieveOrder,
      createReturn,
      createRefundRequest,
      cancelOrder,
      fetchOrderTracking,
      fetchOrderTimeline,
      fetchOrderInvoice,
      fetchReturnReasons,
      refreshCart,
      createFreshCart,
      completeCheckout,
      getShippingOptionsForCart,
      updateCartAddressesForCheckout,
      startOnlinePayment,
      setSelectedCategoryId,
    }),
    [
      derived,
      state.toast,
      showToast,
      clearToast,
      setPaymentRecovery,
      clearPaymentRecovery,
      login,
      logout,
      fetchProducts,
      fetchProductCategories,
      fetchRegions,
      changeRegion,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      fetchOrders,
      fetchOrdersPage,
      retrieveOrder,
      createReturn,
      createRefundRequest,
      cancelOrder,
      fetchOrderTracking,
      fetchOrderTimeline,
      fetchOrderInvoice,
      fetchReturnReasons,
      refreshCart,
      createFreshCart,
      completeCheckout,
      getShippingOptionsForCart,
      updateCartAddressesForCheckout,
      startOnlinePayment,
      setSelectedCategoryId,
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
