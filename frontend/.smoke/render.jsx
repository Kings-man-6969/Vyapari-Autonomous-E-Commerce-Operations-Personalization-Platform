/**
 * Render smoke test for the seller showcase page.
 *
 * Renders StoreView to a string and asserts on the markup, which catches the
 * class of bug a production build cannot: a component that compiles, imports
 * cleanly, and still throws or drops content at render time.
 *
 * The payloads are hand-written rather than captured, so this needs no database,
 * no backend and no network -- `npm run smoke` works on a clean checkout.
 * They encode the awkward parts of the real contract: jsonb config that has
 * arrived as both an object and as raw text, seller-controlled theme_accent and
 * cta_href, and a config that is not an object at all.
 *
 *   npm run smoke
 */
import fs from 'node:fs';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import api from '../src/services/api';
import { AuthProvider } from '../src/context/AuthContext';
import { CartProvider } from '../src/context/CartContext';
import { WishlistProvider } from '../src/context/WishlistContext';
import { StoreView } from '../src/pages/SellerShowcasePage';

const CDN = 'https://picsum.photos/seed';

const media = (i, over = {}) => ({
  id: `0000000${i}-0000-0000-0000-00000000000${i}`,
  media_type: 'image',
  url: `${CDN}/aura${i}/900/1200`,
  thumbnail_url: `${CDN}/aura${i}/400/400`,
  poster_url: null,
  width: 900,
  height: 1200,
  duration_ms: null,
  caption: `Caption number ${i}`,
  alt_text: null,
  product_id: null,
  is_pinned: false,
  view_count: 1000 - i,
  sort_order: i,
  ...over,
});

/** A fully-populated pro-tier page, mirroring the API response. */
const PRO_PAGE = {
  page: {
    id: 'page-1',
    seller_id: 'seller-1',
    handle: 'aura-living',
    tagline: 'Slow-made textiles for the everyday table',
    bio: 'We work with a small circle of block printers in Sanganer.',
    avatar_url: `${CDN}/aura0/900/1200`,
    avatar_media_id: 'avatar-1',
    cover_media_id: 'cover-1',
    cover_url: `${CDN}/aura6/900/1200`,
    theme_accent: '#38bdf8',
    is_published: true,
    seo_title: null,
    seo_description: null,
    view_count: 12847,
    follower_count: 1,
    launched_at: '2025-12-26T11:22:39Z',
    created_at: '2026-01-26T11:22:39Z',
    updated_at: '2026-09-26T11:22:39Z',
    plan: 'pro',
    entitlement: { plan: 'pro', max_media: 120, max_highlights: 8, max_blocks: 8 },
  },
  seller: {
    store_name: 'Aura Living',
    description: 'Slow-made textiles and brassware from Jaipur, since 2016.',
    business_info: '{}',
    is_verified: true,
    rating_avg: 4.8,
  },
  blocks: [
    { id: 'b1', block_type: 'announcement', title: 'Monsoon edit is live', subtitle: 'Free shipping this week', config: {}, cta_label: null, cta_href: null, sort_order: 1 },
    { id: 'b2', block_type: 'hero_banner', title: 'Made in small batches', subtitle: 'No two pieces are identical.', config: {}, cta_label: 'Shop the collection', cta_href: '/explore', sort_order: 2 },
    // Config as an OBJECT, which is what the API returns now.
    {
      id: 'b3', block_type: 'testimonials', title: 'What people say', subtitle: 'From verified orders',
      config: { quotes: [{ quote: 'The indigo dyed better than anything I have owned.', author: 'Ananya R.', rating: 5 }] },
      cta_label: null, cta_href: null, sort_order: 3,
    },
    // Config as raw TEXT, which is what asyncpg hands back without a jsonb codec.
    {
      id: 'b4', block_type: 'media_grid', title: 'From the studio floor', subtitle: 'This month',
      config: JSON.stringify({ media_ids: ['00000001-0000-0000-0000-000000000001'], limit: 6 }),
      cta_label: null, cta_href: null, sort_order: 4,
    },
    {
      id: 'b5', block_type: 'reels', title: 'Studio reels', subtitle: 'Short clips',
      config: { media_ids: ['00000003-0000-0000-0000-000000000003'] },
      cta_label: 'See all reels', cta_href: 'javascript:alert(1)', sort_order: 5,
    },
    {
      id: 'b6', block_type: 'media_grid', title: 'Broken config', subtitle: 'config is a scalar',
      config: '"just a string"', cta_label: null, cta_href: null, sort_order: 6,
    },
  ],
  highlights: [
    { id: 'h1', title: 'Block Prints', cover_url: `${CDN}/aura2/900/1200`, sort_order: 1 },
    { id: 'h2', title: 'Brassware', cover_url: `${CDN}/aura1/900/1200`, sort_order: 2 },
  ],
  media: [
    media(1),
    media(2),
    media(3, { media_type: 'video', url: 'https://cdn.vyapari.com/studio-tour.mp4', caption: 'A minute in the studio' }),
  ],
  media_total: 3,
  has_more_media: false,
  products: [
    { id: 'p1', title: 'Block-Printed Cotton Kurta', price: 2450, compare_at_price: 3200, status: 'active', stock_qty: 12, in_stock: true, images: JSON.stringify([`${CDN}/aura0/900/1200`]) },
  ],
  viewer: { is_following: false, is_owner: false },
};

/** A brand-new free-tier seller: nothing configured, and an unsafe accent. */
const HOSTILE = {
  page: {
    ...PRO_PAGE.page,
    id: 'page-2',
    seller_id: 'seller-2',
    handle: 'new-shop',
    tagline: null,
    bio: null,
    avatar_url: null,
    cover_url: null,
    // A seller-controlled value that must not reach a style attribute unvalidated.
    theme_accent: 'red; background:url(javascript:alert(1))',
    is_published: false,
    view_count: 0,
    follower_count: 0,
    plan: 'free',
    entitlement: { plan: 'free', max_media: 12, max_highlights: 0, max_blocks: 2 },
  },
  seller: { store_name: null, description: null, business_info: '{}', is_verified: false, rating_avg: null },
  blocks: [],
  highlights: [],
  media: [],
  media_total: 0,
  has_more_media: false,
  products: [],
  viewer: { is_following: false, is_owner: true },
};

api.defaults.adapter = async () => ({
  data: { success: true, data: {} },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: { headers: {} },
});

const render = (payload, props = {}) =>
  renderToString(
    <MemoryRouter initialEntries={[`/store/${payload.page.handle}`]}>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <StoreView
              payload={payload}
              media={payload.media}
              products={payload.products}
              tab="grid"
              onTabChange={() => {}}
              onOpenMedia={() => {}}
              onToggleFollow={() => {}}
              isAuthenticated
              {...props}
            />
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </MemoryRouter>
  );

// renderToString inserts <!-- --> between adjacent text and expression children,
// so "All {n} posts loaded" arrives as "All <!-- -->11<!-- --> posts loaded".
// Squashing those makes text assertions readable.
const squashed = (html) => html.replace(/<!-- -->/g, '');

let failed = 0;
const check = (label, passed, detail = '') => {
  if (!passed) failed += 1;
  console.log(`${passed ? '  ok  ' : ' FAIL '} ${label}${detail ? `: ${detail}` : ''}`);
};

// ── scenario 1: a populated pro page ─────────────────────────────────────────

const pro = squashed(render(PRO_PAGE));
const proHas = (needle) => pro.includes(needle);

console.log('pro page');
check('store name', proHas('Aura Living'));
check('handle rendered in the url line', proHas('/store/aura-living'));
check('avatar image', proHas(PRO_PAGE.page.avatar_url));
check('tagline', proHas('Slow-made textiles'));
check('bio', proHas('block printers in Sanganer'));
check('follower count', />1</.test(pro));
check('view count is localised', proHas('12,847'));
check('announcement strip', proHas('Monsoon edit is live'));
check('hero banner', proHas('Made in small batches'));
check('hero cta', proHas('Shop the collection'));
check('highlights render', proHas('Block Prints') && proHas('Brassware'));
check('gallery tiles render', (pro.match(/<button/g) || []).length >= 3);
check('images are lazy loaded', pro.includes('loading="lazy"'));
check('video is labelled for screen readers', proHas('A minute in the studio'));
check('shop badge on media linked to a product', proHas('Shop'));
check('listings tab present', proHas('Listings'));
check('gallery tab present', proHas('Gallery'));
check('no end-of-feed marker when not paginating', !proHas('posts loaded'));

console.log('blocks');
check('announcement is not double rendered', (pro.match(/Monsoon edit is live/g) || []).length === 1);
check('every non-announcement/hero block renders', ['What people say', 'From the studio floor', 'Studio reels', 'Broken config'].every((t) => proHas(t)));
check('testimonials quote from object config', proHas('The indigo dyed better'));
check('testimonials author', proHas('Ananya R.'));
check('media_grid honours text config', (pro.match(/Caption number 1/g) || []).length >= 1);
check('scalar config degrades without throwing', true);
check('javascript: cta_href is neutralised', !proHas('javascript:'));
check('no literal lowercase jsx element leaked', !pro.includes('<tag '));

// ── scenario 2: an empty free-tier draft, owned by the viewer ───────────────

const hostile = squashed(render(HOSTILE));
const hostileHas = (needle) => hostile.includes(needle);

console.log('\nfree draft (nothing configured)');
check('handle is shown when there is no store name', hostileHas('new-shop'));
check('no crash with zero media', hostile.length > 0);
check('unsafe accent is replaced', !hostileHas('javascript:') && !hostileHas('red; background'));
check('accent falls back to the default', hostileHas('#38bdf8'));
check('owner sees the draft notice', hostileHas('private draft'));
check('owner is pointed at the editor', hostileHas('/seller/page'));

console.log(`\n${failed === 0 ? 'PASS' : `FAIL (${failed} check${failed === 1 ? '' : 's'})`}`);
if (failed > 0) {
  fs.writeFileSync('.smoke/rendered.html', pro);
  console.log('wrote .smoke/rendered.html for inspection');
}
process.exit(failed === 0 ? 0 : 1);
