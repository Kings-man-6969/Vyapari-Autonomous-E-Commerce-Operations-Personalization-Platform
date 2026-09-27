/**
 * Interaction capture — section I7.
 *
 * `POST /api/ai/interactions` existed with four writers and zero frontend call
 * sites, so `user_interactions` was only ever populated by the product-detail
 * read on a cache hit and by nothing else. This is the client half.
 *
 * Three rules, and they are the whole design:
 *
 *  * **Nothing here is allowed to break a page.** Every call is fire-and-forget
 *    and every error is swallowed after a debug log. A shopper who cannot add to
 *    cart because an analytics endpoint is down is a much worse outcome than a
 *    missing row.
 *
 *  * **A view is counted once per product per session.** The PDP's tracking runs
 *    in an effect, and React 18's development build runs effects twice on
 *    purpose. Without a guard every view is doubled in dev and every refresh
 *    adds one in production, and the view count then describes page loads rather
 *    than interest — which is the denominator of the conversion figure in I4.
 *    The seller page already made this decision for its own view counter.
 *
 *  * **`purchase` is deliberately never sent.** The server refuses it: a
 *    purchase is something the platform knows from `order_items`, and a client
 *    that can post one can inflate a product's numbers. The rollup reads sales
 *    from the order, so this is not a missing event — it is a refused one.
 */
import api from '../services/api';

const SESSION_KEY = 'vyapari:interaction-session';
export const VIEW_KEY_PREFIX = 'vyapari:viewed:';

/** One session id per browser tab, reused for every event in it. */
export const sessionId = () => {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        (globalThis.crypto?.randomUUID?.() ||
          `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    // Private mode, or storage disabled. An interaction with no session is
    // refused by the server, so this is reported as "no session" rather than
    // silently sending a fresh id per event, which would make every event its
    // own session and destroy the thing the id is for.
    return null;
  }
};

export const viewKey = (productId) => `${VIEW_KEY_PREFIX}${productId}`;

/**
 * Whether this session has already opened this product.
 *
 * `storage` is a parameter rather than the global so the rule can be tested
 * without a DOM: this is the guard that decides whether the conversion figure in
 * I4 has a truthful denominator, and it is not something to leave unverified.
 */
export const shouldCountView = (storage, productId) => {
  if (!productId || !storage) return false;
  try {
    return storage.getItem(viewKey(productId)) !== '1';
  } catch {
    return true;
  }
};

export const markViewed = (storage, productId) => {
  try {
    storage.setItem(viewKey(productId), '1');
  } catch {
    /* the guard is best effort; a failure counts the view again */
  }
};

/**
 * Record one interaction. Resolves to whether it was sent, never rejects.
 *
 * @param {string|number} productId
 * @param {'view'|'click'|'add_to_cart'|'wishlist'} eventType
 * @param {object} [metadata]
 * @returns {Promise<boolean>}
 */
export async function trackInteraction(productId, eventType, metadata = {}) {
  if (!productId) return false;
  if (eventType === 'purchase') return false; // see the module comment

  const id = sessionId();
  if (!id) return false;

  try {
    await api.post('/ai/interactions', {
      product_id: String(productId),
      event_type: eventType,
      session_id: id,
      metadata
    });
    return true;
  } catch {
    // Deliberately quiet. This runs on the add-to-cart path, and a failure here
    // must not surface to a customer who has just done something that worked.
    return false;
  }
}

/** A view, counted at most once per product per session. */
export async function trackView(productId, metadata = {}) {
  if (!productId) return false;
  let storage = null;
  try {
    storage = sessionStorage;
  } catch {
    storage = null;
  }
  if (!shouldCountView(storage, productId)) return false;
  markViewed(storage, productId);
  return trackInteraction(productId, 'view', metadata);
}

/**
 * A click from a listing — a stronger signal than a view, and the one that says
 * which card earned the visit.
 */
export function trackClick(productId, metadata = {}) {
  return trackInteraction(productId, 'click', metadata);
}

export function trackAddToCart(productId, metadata = {}) {
  return trackInteraction(productId, 'add_to_cart', metadata);
}

export function trackWishlist(productId, metadata = {}) {
  return trackInteraction(productId, 'wishlist', metadata);
}
