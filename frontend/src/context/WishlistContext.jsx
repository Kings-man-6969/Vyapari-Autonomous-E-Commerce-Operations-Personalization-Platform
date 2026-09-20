import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const WishlistContext = createContext();

export const WishlistProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [wishlistItems, setWishlistItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchWishlist = async () => {
    if (!isAuthenticated) {
      setWishlistItems([]);
      return;
    }
    try {
      setLoading(true);
      const res = await api.get('/wishlist');
      if (res.data?.success) {
        setWishlistItems(res.data.data.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch wishlist:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWishlist();
  }, [isAuthenticated]);

  const isInWishlist = (productId) => {
    return wishlistItems.some((item) => item.product_id === productId || item.id === productId);
  };

  const toggleWishlist = async (product) => {
    if (!isAuthenticated) {
      window.location.href = '/login';
      return false;
    }

    const productId = product.id;
    const exists = isInWishlist(productId);

    try {
      if (exists) {
        // Optimistic update
        setWishlistItems((prev) => prev.filter((i) => i.product_id !== productId && i.id !== productId));
        await api.delete(`/wishlist/${productId}`);
      } else {
        // Optimistic update
        setWishlistItems((prev) => [
          {
            id: productId,
            product_id: productId,
            title: product.title,
            price: product.price,
            images: product.images,
            category_id: product.category_id,
            inventory_count: product.inventory_count
          },
          ...prev
        ]);
        await api.post('/wishlist', { product_id: productId });
      }
      return !exists;
    } catch (err) {
      console.error('Error toggling wishlist:', err);
      // Revert on error
      fetchWishlist();
      return exists;
    }
  };

  return (
    <WishlistContext.Provider
      value={{
        wishlistItems,
        wishlistCount: wishlistItems.length,
        isInWishlist,
        toggleWishlist,
        refreshWishlist: fetchWishlist,
        loading
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};
