/**
 * Google Analytics 4 — section I6.
 *
 * ## Why this is not the snippet from Google's docs
 *
 * The canonical GA4 snippet is *two* pieces: a `<script async src=...>` tag and
 * an **inline** `<script>` that defines `gtag` and queues the config call. This
 * application's Content-Security-Policy is `script-src 'self'` plus a named list
 * of third parties (see `vite.config.js` and `app/main.py`), and it deliberately
 * does not carry `'unsafe-inline'`. So the second half of the snippet is blocked
 * by the browser, silently — no exception, no failed request, no console error
 * the page can read — and the tag loads and reports nothing.
 *
 * The fix is to do the inline half from this module instead. `gtag.js` does not
 * require the inline script to exist; it reads `window.dataLayer`, which is an
 * ordinary global we can create from a bundled file that `script-src 'self'`
 * already allows. Same tag, same data, no inline script.
 *
 * ## Why the tag is injected rather than in `index.html`
 *
 * The measurement id comes from the build environment. A `<script src=...>`
 * hardcoded in `index.html` cannot read `import.meta.env`, so it would either
 * ship a placeholder id to production or need the id committed — and a committed
 * id means every local run and every preview deploys pollutes the property's
 * data. Injecting it here means an unset variable produces *no tag at all*,
 * which is the honest default: a tag pointed at nothing still reports page views
 * into somewhere.
 *
 * ## What is tracked, and what is not
 *
 * Page views on route change, plus the interaction events section I7 sends to
 * our own API. Nothing else. No user id, no email, no product contents beyond a
 * slug and a title — GA4 is a third party, and shipping a customer's cart to it
 * because the event name was convenient is not a trade this makes.
 */

const SCRIPT_ID = 'vyapari-ga4';
const GTAG_SRC = 'https://www.googletagmanager.com/gtag/js';

/** The measurement id, or `null` when analytics is not configured. */
export const measurementId = (env) => {
  // `env` is a parameter so the render suite can exercise both the configured
  // and the unconfigured path. `import.meta.env` is a build-time constant, and a
  // function that can only ever see one value cannot be tested for the branch
  // that matters -- the one where the tag must not load at all.
  const source = env !== undefined ? env : import.meta.env;
  const id = source?.VITE_GA4_MEASUREMENT_ID;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
};

export const isConfigured = (env) => measurementId(env) !== null;

/**
 * The origin list that has to be in the CSP for this to work at all.
 *
 * Exported so the check is a test rather than a comment: `script-src` needs the
 * tag's origin, `connect-src` needs the beacon's, and getting one of the two
 * wrong produces the silent no-report described above.
 */
export const REQUIRED_CSP_ORIGINS = {
  script: ['https://www.googletagmanager.com'],
  connect: [
    'https://www.google-analytics.com',
    'https://region1.google-analytics.com'
  ]
};

/**
 * Create the `dataLayer` queue and the `gtag` shim.
 *
 * Exported separately from `initAnalytics` so it can be called before the tag
 * has loaded -- which is the point of a queue -- and so the render suite can
 * exercise it with no network.
 */
export function installGtag(target = globalThis.window) {
  if (!target) return null;
  target.dataLayer = target.dataLayer || [];
  if (typeof target.gtag !== 'function') {
    // The shim pushes `arguments`, not an array, because gtag.js inspects the
    // arguments object. Pushing `[...args]` is a subtle break that reports
    // nothing and looks correct.
    target.gtag = function gtag() {
      target.dataLayer.push(arguments);
    };
  }
  return target.gtag;
}

let initialised = false;

/**
 * Load the tag, once.
 *
 * Returns the `gtag` function, or `null` when no measurement id is configured.
 * Idempotent, and safe to call from a module that renders more than once.
 */
export function initAnalytics(env) {
  if (initialised) return globalThis.window?.gtag ?? null;
  const id = measurementId(env);
  if (!id || typeof document === 'undefined') return null;

  const gtag = installGtag();
  if (!gtag) return null;

  if (!document.getElementById(SCRIPT_ID)) {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `${GTAG_SRC}?id=${encodeURIComponent(id)}`;
    document.head.appendChild(script);
  }

  gtag('js', new Date());
  // `send_page_view: false` because the SPA reports its own page views on route
  // change. Letting GA4 send its own too would double every one, and the two
  // would disagree about client-side navigations.
  gtag('config', id, { send_page_view: false });

  initialised = true;
  return gtag;
}

/** One page view. A no-op when analytics is not configured. */
export function trackPageView(path, title) {
  const gtag = globalThis.window?.gtag;
  if (!gtag || !isConfigured()) return false;
  gtag('event', 'page_view', {
    page_path: path,
    page_title: title || (typeof document !== 'undefined' ? document.title : undefined),
    page_location: typeof location !== 'undefined' ? location.href : undefined
  });
  return true;
}

/** A custom event. A no-op when analytics is not configured. */
export function trackEvent(name, params = {}) {
  const gtag = globalThis.window?.gtag;
  if (!gtag || !isConfigured()) return false;
  gtag('event', name, params);
  return true;
}
