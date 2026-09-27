import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The Content-Security-Policy the built SPA ships with.
 *
 * Injected as a meta tag at build time rather than configured on the host,
 * for two reasons. It travels in the repository, so it cannot be forgotten on a
 * redeploy or left behind when the site moves between hosts. And the one it has
 * to be right about is Razorpay: without checkout.razorpay.com in script-src
 * the payment script is blocked, and the symptom is a checkout button that
 * quietly does nothing -- no exception, no failed request, nothing in our logs,
 * because the browser refuses to tell the page about a resource it never
 * fetched.
 *
 * It is a floor and not a ceiling. If the static host also sets a
 * Content-Security-Policy header, both apply and the stricter one wins, so the
 * host's copy has to include these origins too -- see the deployment notes in
 * BUILD_CHECKLIST.md.
 */
const CSP = [
  "default-src 'self'",
  // Vite's production bundle is a module script from our own origin. Razorpay's
  // checkout script and the GA4 tag are the only third parties allowed to
  // execute. Both are named rather than allowed via 'unsafe-inline' or a
  // wildcard, and `src/lib/analytics.js` explains why the GA4 snippet's inline
  // half had to be moved into the bundle to satisfy this.
  "script-src 'self' https://checkout.razorpay.com https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline' https://checkout.razorpay.com",
  // Product images come from three places: our own /media (served same-origin,
  // proxied from the API in dev), third-party catalogue CDNs over https, and
  // blob: for the local preview a seller sees before they finish uploading.
  // Narrowing this to a list of hosts would mean editing it every time a seller
  // pastes an external image URL, which is exactly the change nobody makes.
  // GA4's image-beacon fallback also rides on the https: wildcard.
  "img-src 'self' https: data: blob:",
  // GA4 posts its beacon to google-analytics.com; the regional host is what
  // Google actually resolves to in most of the world, and naming only the
  // unregionalised host produces a policy violation on every event with no
  // other symptom.
  "connect-src 'self' https://api.vyapari.live https://api.vyapari.com https://api.razorpay.com https://www.google-analytics.com https://region1.google-analytics.com",
  "font-src 'self' https: data:",
  // The payment form is an iframe from Razorpay. Without this it renders as a
  // blank box inside a modal that otherwise looks correct.
  "frame-src https://api.razorpay.com https://checkout.razorpay.com",
  "object-src 'none'",
  "base-uri 'self'"
].join('; ');

/** Adds the CSP meta tag to the built index.html, and only there. */
const cspForProduction = () => ({
  name: 'vyapari-csp-meta',
  // Build only. In dev, Vite's React-refresh preamble is an inline script and
  // HMR opens a websocket, so a policy strict enough for production would break
  // the dev server on load -- the wrong time to discover that.
  apply: 'build',
  transformIndexHtml(html) {
    return {
      html,
      tags: [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
          injectTo: 'head-prepend'
        }
      ]
    };
  }
});

export default defineConfig({
  plugins: [react(), cspForProduction()],
  build: {
    // The manifest is what `scripts/check-bundle.mjs` reads to work out which
    // chunks actually load on first paint. It lists each chunk's static
    // `imports` and its `dynamicImports` separately, so the budget check can
    // follow the real dependency graph instead of guessing from filenames --
    // guessing is how a budget check ends up measuring a chunk nobody requests.
    manifest: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        /**
         * Section J2's prerequisite: the vendor code is split out so it can be
         * cached across deploys.
         *
         * Without this, every change to any page changes the hash of the one
         * bundle, and a returning visitor re-downloads React, the router, axios
         * and lucide for a copy tweak. With it, an app-code change invalidates
         * only the app chunks.
         *
         * React and the router are one chunk on purpose: the router is a
         * dependency of React's render path, so splitting them produces two
         * chunks that are always requested together and can never be cached
         * apart.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|@remix-run)[\\/]/.test(id)) {
            return 'vendor-react';
          }
          return 'vendor';
        }
      }
    }
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/health': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      // Uploaded media, served by the API under the local storage provider.
      // Proxied so dev matches production, where the SPA and /media come from
      // one origin -- otherwise every <img> would need an absolute API URL,
      // and img-src would have to carry the API's origin through the CSP.
      '/media': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
});
