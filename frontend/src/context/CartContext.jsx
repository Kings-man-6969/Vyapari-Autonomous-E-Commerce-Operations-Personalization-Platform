import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [items, setItems] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [itemCount, setItemCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchCart = async () => {
    if (!isAuthenticated) {
      setItems([]);
      setTotalAmount(0);
      setItemCount(0);
      return;
    }

    try {
      setLoading(true);
      const res = await api.get('/cart');
      if (res.data?.success) {
        setItems(res.data.data.items || []);
        setTotalAmount(res.data.data.total_amount || 0);
        setItemCount(res.data.data.item_count || 0);
      }
    } catch (err) {
      console.error('Failed to fetch cart:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
  }, [user, isAuthenticated]);

  /**
   * Adds a line to the bag.
   *
   * `variantId` is the option the customer chose on the PDP. It is optional and
   * it is not merely a passthrough: a product with options will fall back to its
   * default server-side, which is what keeps a buy button working for a client
   * that has no picker yet. A picker that sends the wrong id is rejected rather
   * than silently corrected, so the bag cannot end up holding a size nobody
   * picked.
   */
  const addToCart = async (productId, quantity = 1, variantId = null) => {
    const resolvedId = typeof productId === 'object' && productId !== null 
      ? (productId.id || productId.product_id) 
      : productId;
    const body = { product_id: resolvedId, quantity };
    if (variantId) body.variant_id = variantId;
    await api.post('/cart/items', body);
    await fetchCart();
  };

  const updateQuantity = async (cartItemId, quantity) => {
    await api.put(`/cart/items/${cartItemId}`, { quantity });
    await fetchCart();
  };

  const removeFromCart = async (cartItemId) => {
    await api.delete(`/cart/items/${cartItemId}`);
    await fetchCart();
  };

  const clearCart = async () => {
    await api.delete('/cart');
    setItems([]);
    setTotalAmount(0);
    setItemCount(0);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        totalAmount,
        itemCount,
        loading,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        refreshCart: fetchCart
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
