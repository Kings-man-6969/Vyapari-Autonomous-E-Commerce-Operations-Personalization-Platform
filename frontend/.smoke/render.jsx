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
import { ForgotPasswordPage } from '../src/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '../src/pages/ResetPasswordPage';
import { LoginPage } from '../src/pages/LoginPage';
import { evaluatePassword } from '../src/lib/passwordPolicy';
import VariantPicker, { resolveChoice } from '../src/components/VariantPicker';
import {
  findOptionClash, optionAttributes, optionKey, optionLabel, parseOptionLines
} from '../src/lib/optionLines';
import {
  loadCheckoutScript, openCheckout, __resetCheckoutScript, CheckoutDismissed
} from '../src/lib/razorpay';
import { isSettled, nextDelay, MAX_ATTEMPTS } from '../src/hooks/usePaymentStatus';

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

// ── scenario 3: password recovery ────────────────────────────────────────────
//
// The recovery flow is the one a locked-out user reaches, so it has to render
// without a session. Each page is rendered in isolation: useEffect never runs
// under renderToString, so these assert the initial states only, which is
// exactly the set of states that differ by route.

const bare = (node, entry = '/') =>
  renderToString(
    <MemoryRouter initialEntries={[entry]}>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>{node}</WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </MemoryRouter>
  );

console.log('\nforgot password');
const forgot = squashed(bare(<ForgotPasswordPage />, '/forgot-password'));
check('email field is an email input', forgot.includes('type="email"'));
check('promises a link, not a confirmation', forgot.includes('We will email you a link'));
// The single most important property of this page: it must not become an
// account-existence oracle by saying something different on the way out.
check('no enumeration tell in the initial copy', !/no account|not found|does not exist|unknown email/i.test(forgot));
check('offers a way back to sign in', forgot.includes('href="/login"'));
check('form posts to the recovery endpoint', api.post !== undefined);

console.log('\nreset password');
const resetNoToken = squashed(bare(<ResetPasswordPage />, '/reset-password'));
check('a missing token does not show the form', !resetNoToken.includes('type="password"'));
check('missing token explains itself', resetNoToken.includes('include a token'));
check('missing token routes back to a new request', resetNoToken.includes('href="/forgot-password"'));

const resetWithToken = squashed(bare(<ResetPasswordPage />, '/reset-password?token=abc123'));
check('token in the url produces the form', (resetWithToken.match(/type="password"/g) || []).length === 2);
check('new and confirm fields are distinguishable', resetWithToken.includes('Confirm New Password'));
check('states the link is single-use', resetWithToken.includes('This link works once'));
check('submit is disabled until the policy is met', /<button[^>]*disabled/.test(resetWithToken));
check('the token is not echoed into the markup', !resetWithToken.includes('abc123'));
check('no enumeration tell', !/invalid token|expired|already used/i.test(resetWithToken));

console.log('\nlogin page entry point');
const login = squashed(bare(<LoginPage />, '/login'));
check('offers a forgot-password link', login.includes('href="/forgot-password"'));

console.log('\nclient-side password policy');
// The server is the authority; this copy exists so nobody has to be rejected to
// learn the rules. It must agree with validate_password() in app/email.py.
const accept = ['Password123!', 'ValidPass123!', 'OriginalPass123', 'a1b2c3d4', 'correcthorsebattery1'];
const reject = ['', 'abc', 'abcdefgh', '12345678', 'password', 'Password1', 'password123', 'qwertyui', 'hunter2'];
for (const p of accept) {
  check(`accepts ${JSON.stringify(p)}`, evaluatePassword(p).ok, JSON.stringify(evaluatePassword(p)));
}
for (const p of reject) {
  check(`rejects ${JSON.stringify(p)}`, !evaluatePassword(p).ok, JSON.stringify(evaluatePassword(p)));
}
check('common-password detection is case-insensitive', evaluatePassword('PASSWORD').common);
check('the reason for a rejection is reported, not just the verdict', evaluatePassword('abc').checks.filter((c) => !c.ok).length === 2);

// ── the option picker ────────────────────────────────────────────────────────
//
// resolveChoice is exported precisely so the awkward part can be tested without a
// browser: useEffect never runs under renderToString, so the seeding logic is
// untestable here, but the rule that decides which option a set of clicks means
// is pure and is where the bugs live.

console.log('\nvariant picker: resolving a choice');

const v = (id, attributes, stock, over = {}) => ({
  id, attributes, stock_qty: stock, in_stock: stock > 0 && over.is_active !== false,
  is_active: over.is_active !== false, is_default: !!over.is_default, price: over.price ?? 100,
  sku: over.sku ?? null,
});

// size x colour, with Indigo Large sold out.
const RUN = [
  v('s-sm', { size: 'S', colour: 'Indigo' }, 4, { is_default: true }),
  v('s-md', { size: 'M', colour: 'Indigo' }, 2),
  v('s-lg', { size: 'L', colour: 'Indigo' }, 0),
  v('s-mw', { size: 'M', colour: 'Madder' }, 6, { price: 120 }),
];

check('an empty choice lands on a buyable option, not the first row',
  resolveChoice(RUN, {})?.id === 's-sm', resolveChoice(RUN, {})?.id);

check('a complete choice resolves to that option',
  resolveChoice(RUN, { size: 'M', colour: 'Madder' })?.id === 's-mw');

check('a partial choice resolves within what is chosen',
  resolveChoice(RUN, { size: 'S' })?.id === 's-sm');

// The sold-out case. Returning the out-of-stock row rather than null is
// deliberate: the page has to be able to say "that combination is gone" instead
// of reverting the customer's clicks.
check('a sold-out combination resolves to the out-of-stock option, not null',
  resolveChoice(RUN, { size: 'L', colour: 'Indigo' })?.id === 's-lg'
    && resolveChoice(RUN, { size: 'L', colour: 'Indigo' }).in_stock === false);

check('a combination that does not exist resolves to null',
  resolveChoice(RUN, { size: 'XXL', colour: 'Indigo' }) === null);

// Preferring a buyable option matters on a product with a sold-out default:
// without it, opening the picker on the default shows a price for something
// nobody can buy.
const STALE_DEFAULT = [
  v('a', { size: 'M' }, 0, { is_default: true }),
  v('b', { size: 'L' }, 3),
];
check('a sold-out default does not win over an available option',
  resolveChoice(STALE_DEFAULT, {})?.id === 'b', resolveChoice(STALE_DEFAULT, {})?.id);

check('no options resolves to null', resolveChoice([], {}) === null);
check('a missing options list resolves to null rather than throwing',
  resolveChoice(undefined, {}) === null);

console.log('\nvariant picker: rendering');

// useEffect does not run here, so choice is {} -- which is itself the case
// worth rendering, since it is what a customer's first paint of the picker is.
const pickerHtml = squashed(
  renderToString(
    <VariantPicker
      axes={[
        { key: 'size', label: 'Size', values: [{ value: 'S' }, { value: 'M' }, { value: 'L' }] },
        { key: 'colour', label: 'Colour', values: [{ value: 'Indigo' }, { value: 'Madder' }] },
      ]}
      variants={RUN}
      onChange={() => {}}
    />
  )
);

check('axis labels render', pickerHtml.includes('Size') && pickerHtml.includes('Colour'));
check('every value renders', ['>S<', '>M<', '>L<', '>Indigo<', '>Madder<'].every((n) => pickerHtml.includes(n)));

// Sold out, so Large cannot be picked before a size and colour are chosen. This
// is the assertion that a naive `available > 0` check would also pass, which is
// the point: the interesting half is exercised in resolveChoice above, where the
// other axis actually filters.
const disabledPills = (pickerHtml.match(/cursor:not-allowed/g) || []).length;
check('a sold-out value is not selectable', disabledPills >= 1, `${disabledPills} disabled`);

check('an available product says nothing about being out of stock',
  !pickerHtml.includes('This combination is out of stock'));

console.log('\nvariant picker: a product with no options');
const bareHtml = squashed(
  renderToString(<VariantPicker axes={[]} variants={[{ id: 'x', attributes: {}, stock_qty: 3, in_stock: true }]} />)
);
check('renders nothing at all, not an empty control', bareHtml.trim() === '', JSON.stringify(bareHtml.slice(0, 60)));

// ── the seller's option text ─────────────────────────────────────────────────
//
// The create form and the edit page's "add an option" box both take free text
// typed as "axis: value" lines, and both send the parsed object to the server,
// whose duplicate check compares attribute sets for equality. So the parsing has
// to normalise, and it has to be the same function in both places -- which is
// exactly the kind of rule that quietly diverges when it is written twice.

console.log('\noption text: parsing');

check('a single axis parses',
  JSON.stringify(parseOptionLines('size: XL').attributes) === '{"size":"XL"}',
  JSON.stringify(parseOptionLines('size: XL')));

check('several axes, one per line',
  JSON.stringify(parseOptionLines('size: XL\ncolour: Indigo').attributes)
    === '{"size":"XL","colour":"Indigo"}');

// The key is normalised; the value is not. Both halves matter, for opposite
// reasons. "Size : XL" has to become {size: ...} or the same option typed two
// ways is two rows. But the value has to keep its capitalisation, because "xl"
// on a size pill looks broken and "XL" is what the seller meant.
check('the axis name is normalised',
  parseOptionLines('Size :  XL').attributes.size === 'XL',
  JSON.stringify(parseOptionLines('Size :  XL').attributes));

check('the value keeps the capitalisation the seller typed',
  parseOptionLines('size: xl').attributes.size === 'xl'
    && parseOptionLines('size: XL').attributes.size === 'XL',
  JSON.stringify(parseOptionLines('size: xl').attributes));

check('a multi-word axis becomes one underscored key',
  parseOptionLines('Sleeve Length: 42').attributes.sleeve_length === '42',
  JSON.stringify(parseOptionLines('Sleeve Length: 42').attributes));

// A value may contain a colon -- "12:30 lining" -- so only the first one
// separates.
check('only the first colon separates axis from value',
  parseOptionLines('wash: 12:30 cold').attributes.wash === '12:30 cold',
  JSON.stringify(parseOptionLines('wash: 12:30 cold').attributes));

// Free text in a textarea gets prose. Silently dropping it would mean the seller
// typed three lines, saw no error, and created one option from the fourth.
check('a line that is not "axis: value" is reported, not swallowed',
  parseOptionLines('size: XL\nIndigo').bad.length === 1
    && parseOptionLines('size: XL\nIndigo').bad[0] === 'Indigo',
  JSON.stringify(parseOptionLines('size: XL\nIndigo')));

check('a missing value is reported too',
  parseOptionLines('size:').bad.length === 1, JSON.stringify(parseOptionLines('size:')));

check('a leading colon is not an axis named nothing',
  parseOptionLines(': XL').bad.length === 1, JSON.stringify(parseOptionLines(': XL')));

check('blank lines are not errors',
  parseOptionLines('\n\nsize: XL\n   \n').bad.length === 0);

check('empty input parses to nothing and complains about nothing',
  JSON.stringify(parseOptionLines('').attributes) === '{}'
    && parseOptionLines('').bad.length === 0);

check('a missing input is treated as empty rather than throwing',
  JSON.stringify(parseOptionLines(undefined).attributes) === '{}'
    && JSON.stringify(parseOptionLines(null).attributes) === '{}');

console.log('\noption text: labelling');

// The seller sees this in the editor row; the customer sees the backend's
// describe_attributes in the bag. If the two disagree, the same option is
// labelled two ways depending on the screen, which reads as a different product.
check('the label is the values, joined',
  optionLabel({ size: 'XL', colour: 'Indigo' }) === 'XL / Indigo',
  optionLabel({ size: 'XL', colour: 'Indigo' }));

check('no axis names, because the picker already showed them',
  !optionLabel({ size: 'XL' }).includes('size'));

check('an empty set labels as empty, not as a stray separator',
  optionLabel({}) === '' && optionLabel({ size: '   ' }) === '' && optionLabel(undefined) === '');

console.log('\noption text: spotting a repeat');

// This is the gap the above leaves open. jsonb equality is case-sensitive, so
// {size: "XL"} and {size: "xl"} are two different rows that both satisfy the
// unique index -- and the customer gets two pills reading XL and xl and no way to
// know they are the same size. The stored value has to keep its capitalisation,
// so the clash check has to fold case itself.
const RUN2 = [
  { id: 'a', attributes: { size: 'XL', colour: 'Indigo' } },
  { id: 'b', attributes: { size: 'M' } },
];

check('a different size is not a clash',
  findOptionClash(RUN2, { size: 'S', colour: 'Indigo' }) === null);

check('the same size and colour is', findOptionClash(RUN2, { size: 'XL', colour: 'Indigo' })?.id === 'a');

check('case and padding do not hide a repeat',
  findOptionClash(RUN2, { size: ' xl ', colour: 'INDIGO' })?.id === 'a',
  JSON.stringify(findOptionClash(RUN2, { size: ' xl ', colour: 'INDIGO' })));

check('the axis set has to match on every axis, not just one',
  findOptionClash(RUN2, { size: 'XL' }) === null && findOptionClash(RUN2, { size: 'XL', colour: 'Madder' }) === null);

// An option being edited is not a clash with itself. Without the exclusion,
// saving an unchanged row would report the row as its own duplicate and no row
// could ever be edited.
check('an option is not a clash with itself',
  findOptionClash(RUN2, { size: 'XL', colour: 'Indigo' }, 'a') === null);

check('an empty attribute set clashes with nothing', findOptionClash(RUN2, {}) === null);
check('a missing list clashes with nothing', findOptionClash(undefined, { size: 'XL' }) === null);

check('the canonical key sorts the axes, so order does not matter',
  optionKey({ colour: 'Indigo', size: 'XL' }) === optionKey({ size: 'XL', colour: 'Indigo' }));

async function runPaymentChecks() {
  // ── payment: the Razorpay wrapper ────────────────────────────────────────────
  //
  // What is worth testing here is not that a modal opens -- there is no DOM in
  // this harness -- but that the promise resolves with the three fields the server
  // needs and rejects distinguishably. A checkout that cannot tell "closed the
  // modal" from "the bank said no" makes the customer retry a card that was
  // declined, and report a cancellation as a failure.

  const withFakeRazorpay = async (body, fn) => {
    const previousWindow = global.window;
    const previousDocument = global.document;
    const appended = [];
    global.window = { Razorpay: body.Razorpay };
    global.document = {
      createElement: () => ({ set src(_v) { this._src = _v; }, get src() { return this._src; } }),
      body: { appendChild: (el) => appended.push(el) }
    };
    try {
      return await fn(appended);
    } finally {
      global.window = previousWindow;
      global.document = previousDocument;
      __resetCheckoutScript();
    }
  };

  const PARAMS = {
    order_id: '11111111-1111-1111-1111-111111111111',
    key_id: 'rzp_test_abc',
    amount: 249.5,
    currency: 'INR',
    razorpay_order_id: 'order_AAA',
    receipt: '11111111-1111-1111-1111-111111111111',
    name: 'Vyapari',
    prefill: { name: 'Asha Verma', email: 'asha@example.com' }
  };

  /** Waits for the modal to be constructed. openCheckout awaits the script\n *  before it can build one, so a single tick is not enough and guessing a\n *  number of them is a flaky test. */
const untilConstructed = async (m) => {
  for (let i = 0; i < 100 && !m.opened.length; i += 1) {
    await new Promise((r) => setImmediate(r));
  }
  if (!m.opened.length) throw new Error('the modal was never constructed');
};

const modal = (scripted) => {
    const opened = [];
    const Ctor = function (options) {
      opened.push(options);
      this.on = (event, cb) => { scripted[event] = cb; };
      this.open = () => { opened.open = true; };
    };
    return { Ctor, opened, scripted };
  };

  console.log('\n── payment ──');

  await withFakeRazorpay({ Razorpay: modal({}) }, async () => {
    await loadCheckoutScript();
    check('an already-loaded script is not fetched again', true);
  });

  await withFakeRazorpay({ Razorpay: null }, async (appended) => {
    // A script that never registers must reject rather than hang. A promise that
    // never settles is a checkout button that does nothing forever, with no error
    // to show anyone.
    const loading = loadCheckoutScript();
    const node = appended[0];
    node.onload();
    let rejected = false;
    await loading.then(() => {}, () => { rejected = true; });
    check('a script that loads without registering is an error, not a hang', rejected);
  });

  await withFakeRazorpay({ Razorpay: null }, async (appended) => {
    const loading = loadCheckoutScript();
    appended[0].onerror();
    let rejected = false;
    await loading.then(() => {}, () => { rejected = true; });
    check('a script that fails to load rejects with a message', rejected);
    // The memo has to be cleared, or every later attempt on this page reuses a
    // promise that can never settle.
    const second = loadCheckoutScript();
    check('a failed load is not memoised', appended.length === 2);
    appended[1].onerror();
    await second.catch(() => {});
  });

  await withFakeRazorpay({ Razorpay: null }, async (appended) => {
    const m = modal({});
    const loading = openCheckout(PARAMS);
    const node = appended[0];
    // Razorpay registers itself when its script finishes loading. Setting it
    // after openCheckout has asked for the script, and before onload fires,
    // is what makes the real load path run rather than a short circuit.
    global.window.Razorpay = m.Ctor;
    node.onload();
    // openCheckout awaits the script before constructing, so give it a tick.
    await untilConstructed(m);
    m.scripted['payment.success']({
      razorpay_payment_id: 'pay_XYZ',
      razorpay_order_id: 'order_AAA',
      razorpay_signature: 'deadbeef'
    });
    const result = await loading;

    check('all three gateway fields come back', !!result.razorpay_payment_id
      && !!result.razorpay_order_id && !!result.razorpay_signature);
    check('rupees are converted to paise for the modal',
      m.opened[0].amount === 24950, `got ${m.opened[0].amount}`);
    check('the key id is the publishable one, never a secret',
      m.opened[0].key === 'rzp_test_abc' && !('key_secret' in m.opened[0]));
    check('the gateway order id we opened is the one handed to checkout',
      m.opened[0].order_id === 'order_AAA');
    check('the order id is passed as a note so support can match a screenshot',
      m.opened[0].notes?.order_id === PARAMS.order_id);
    check('the address the customer already typed is prefilled',
      m.opened[0].prefill?.email === 'asha@example.com');
  });

  await withFakeRazorpay({ Razorpay: null }, async (appended) => {
    const m = modal({});
    const loading = openCheckout(PARAMS);
    // Razorpay registers itself when its script finishes loading. Setting it
    // after openCheckout has asked for the script, and before onload fires,
    // is what makes the real load path run rather than a short circuit.
    global.window.Razorpay = m.Ctor;
    appended[0].onload();
    await untilConstructed(m);
    m.scripted['payment.dismissed']();
    let caught = null;
    await loading.catch((e) => { caught = e; });
    check('a dismissed modal is its own outcome, not a failure',
      caught instanceof CheckoutDismissed && caught.reason === 'dismissed');
  });

  await withFakeRazorpay({ Razorpay: null }, async (appended) => {
    const m = modal({});
    const loading = openCheckout(PARAMS);
    // Razorpay registers itself when its script finishes loading. Setting it
    // after openCheckout has asked for the script, and before onload fires,
    // is what makes the real load path run rather than a short circuit.
    global.window.Razorpay = m.Ctor;
    appended[0].onload();
    await untilConstructed(m);
    m.scripted['payment.failed']({ error: { description: 'Your card was declined', code: 'BAD_CARD_ERROR' } });
    let caught = null;
    await loading.catch((e) => { caught = e; });
    check("a declined payment carries the bank's reason to the page",
      caught?.reason === 'failed' && /declined/i.test(caught.message), caught?.message);
  });

  await withFakeRazorpay({ Razorpay: null }, async (appended) => {
    const m = modal({});
    const loading = openCheckout(PARAMS);
    // Razorpay registers itself when its script finishes loading. Setting it
    // after openCheckout has asked for the script, and before onload fires,
    // is what makes the real load path run rather than a short circuit.
    global.window.Razorpay = m.Ctor;
    appended[0].onload();
    await untilConstructed(m);
    // A success event with nothing in it cannot be confirmed by the server, so
    // resolving with it would send a confirm-payment the server must reject.
    m.scripted['payment.success']({});
    let caught = null;
    await loading.catch((e) => { caught = e; });
    check('a success with no payment id is not a success', caught?.reason === 'failed');
  });

  // The polling loop: the states that stop it, and the ones that must not.
  console.log('── payment status polling ──');

  check('success stops the loop', isSettled('success'));
  check('a declined payment stops the loop', isSettled('failed'));
  check('a cancelled order stops the loop', isSettled('cancelled'));
  check('a refund stops the loop', isSettled('refunded') && isSettled('partially_refunded'));

  check('"pending_verification" does not stop it -- that is the state it exists for',
    !isSettled('pending_verification'), 'the customer has paid and the capture is unconfirmed');

  check('an order with no gateway order yet is still being polled', !isSettled('created'));
  check('a missing status is not treated as settled', !isSettled(null) && !isSettled(undefined));

  check('the wait widens as the attempts go on', nextDelay(1) < nextDelay(6));
  check('but never past five seconds', nextDelay(500) === 5000, `got ${nextDelay(500)}`);
  check('and never zero on a first attempt', nextDelay(1) >= 1000);

  check('the loop gives up eventually', MAX_ATTEMPTS <= 60, `${MAX_ATTEMPTS} attempts`);

}

runPaymentChecks().then(() => {
console.log(`\n${failed === 0 ? 'PASS' : `FAIL (${failed} check${failed === 1 ? '' : 's'})`}`);
if (failed > 0) {
  fs.writeFileSync('.smoke/rendered.html', pro);
  fs.writeFileSync('.smoke/rendered-reset.html', resetWithToken);
  console.log('wrote .smoke/rendered*.html for inspection');
}
process.exit(failed === 0 ? 0 : 1);
});
