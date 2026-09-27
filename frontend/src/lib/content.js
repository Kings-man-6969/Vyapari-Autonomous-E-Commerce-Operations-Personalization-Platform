/**
 * Storefront content: CMS copy and banner slots.
 *
 * Every function here is best-effort by design. The API can be slow, can be
 * down, can answer 400 for a slot that does not exist, and can return a key
 * that has never been written -- and none of those may stop a page rendering.
 * So a failure resolves to the fallback in this file, which is the same copy
 * that is in the bundle anyway.
 *
 * That fallback is the reason `DEFAULT_COPY` exists and the reason it is a
 * verbatim copy of V11's seed: the database wins when it has an answer, and the
 * bundle wins when it does not, and a visitor sees the same words either way.
 * If you change one, change both -- `tests/test_content.py` asserts the seeded
 * hero still says what this file says.
 */
import api from '../services/api';

/** The five slots V8's CHECK constraint allows. Kept in sync with content.py. */
export const BANNER_PLACEMENTS = [
  'homepage_hero',
  'homepage_strip',
  'category_top',
  'pdp_promo',
  'seller_page'
];

/**
 * Compiled-in copy, identical to V11's seed.
 *
 * Deep-frozen so a component that merges API copy over this cannot mutate the
 * shared object and leak one render's data into the next -- which is the kind of
 * bug that only shows up on the second page load and never in a test.
 */
export const DEFAULT_COPY = Object.freeze({
  'home.hero': Object.freeze({
    eyebrow: 'Mega Savings • Limited Time Deals',
    headline: 'Great Deals on Everything You Love',
    subcopy:
      'Discover top-rated products from verified independent merchants. Enjoy free delivery on eligible orders, secure checkout, and easy 7-day returns.',
    primary_cta: Object.freeze({ label: 'Shop All Deals', to: '/explore' }),
    secondary_cta: Object.freeze({ label: 'Top Rated Products', to: '/explore?sort=rating' })
  }),
  'home.trust_bar': Object.freeze([
    Object.freeze({ icon: 'truck', title: 'Free Fast Delivery', body: 'On orders over ₹499' }),
    Object.freeze({ icon: 'rotate-ccw', title: '7-Day Easy Returns', body: 'Hassle-free replacement or refund' }),
    Object.freeze({ icon: 'shield', title: '100% Genuine Products', body: 'From verified sellers' }),
    Object.freeze({ icon: 'card', title: 'Secure Payments', body: 'Cards, UPI & Net Banking' })
  ]),
  'home.categories': Object.freeze({
    headline: 'Explore Popular Categories',
    cards: Object.freeze([
      Object.freeze({
        icon: 'tv',
        to: '/explore?category=1',
        title: 'Electronics & Audio',
        body: 'Headphones, speakers, smart watches and premium gadgets.',
        cta_label: 'Shop Electronics'
      }),
      Object.freeze({
        icon: 'shirt',
        to: '/explore?category=2',
        title: 'Fashion & Apparel',
        body: 'Designer apparel, handcrafted streetwear and accessories.',
        cta_label: 'Shop Fashion'
      }),
      Object.freeze({
        icon: 'home',
        to: '/explore?category=3',
        title: 'Home & Living',
        body: 'Minimalist ceramics, cookware and modern decor.',
        cta_label: 'Shop Home'
      }),
      Object.freeze({
        icon: 'sparkles',
        to: '/explore?sort=rating',
        title: 'Best Sellers',
        body: 'Highest-rated customer favorites and verified bestsellers.',
        cta_label: 'Explore Best Sellers'
      })
    ])
  }),
  'home.trending': Object.freeze({
    headline: 'Trending Deals of the Day',
    subcopy: 'Handpicked top offers with special price reductions',
    cta: Object.freeze({ label: 'See all deals', to: '/explore' })
  }),
  'home.seller_cta': Object.freeze({
    eyebrow: 'Merchant Marketplace',
    headline: 'Sell on Vyapari & Grow Your Business',
    subcopy:
      'Reach customers nationwide. List products with AI assistance, manage your orders seamlessly, and receive fast, guaranteed payouts.',
    cta: Object.freeze({ label: 'Become a Seller', to: '/seller/onboarding' })
  })
});

/**
 * One CMS key, with the compiled-in copy as the floor.
 *
 * A key the API has no row for comes back as `data: null` rather than a 404 --
 * that is a contract the API keeps so a rolling deploy cannot blank the
 * homepage -- so "no answer" and "no content" are the same shape here and both
 * fall back.
 */
export async function fetchCms(key) {
  try {
    const res = await api.get(`/content/cms/${encodeURIComponent(key)}`);
    const value = res.data?.data;
    if (value === null || value === undefined) return DEFAULT_COPY[key] ?? null;
    // A partial object must not erase the fields it does not mention: an admin
    // who edits only the headline should not accidentally delete the CTA by
    // omitting it from the JSON. Merging over the default is what makes a CMS
    // key safe to edit field by field.
    const fallback = DEFAULT_COPY[key];
    if (fallback && !Array.isArray(value) && typeof fallback === 'object' && !Array.isArray(fallback)) {
      return { ...fallback, ...value };
    }
    return value;
  } catch {
    return DEFAULT_COPY[key] ?? null;
  }
}

/** Every CMS key in one call. Returns `{key: value}` with fallbacks filled in. */
export async function fetchAllCms() {
  try {
    const res = await api.get('/content/cms');
    const data = res.data?.data;
    if (!data || typeof data !== 'object') return { ...DEFAULT_COPY };
    return { ...DEFAULT_COPY, ...data };
  } catch {
    return { ...DEFAULT_COPY };
  }
}

/** One banner slot. An empty slot is an empty array, not a throw. */
export async function fetchBanners(placement) {
  try {
    const res = await api.get(`/content/banners?placement=${encodeURIComponent(placement)}`);
    const rows = res.data?.data;
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/**
 * Every slot at once, for a page that mounts more than one.
 *
 * Empty slots come back as empty arrays rather than being omitted, so a caller
 * can read `slots[placement]` without a guard on every access.
 */
export async function fetchAllBanners() {
  const empty = Object.fromEntries(BANNER_PLACEMENTS.map((p) => [p, []]));
  try {
    const res = await api.get('/content/banners/homepage_hero/all');
    const data = res.data?.data;
    if (!data || typeof data !== 'object') return empty;
    return { ...empty, ...data };
  } catch {
    return empty;
  }
}
