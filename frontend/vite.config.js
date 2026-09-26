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
  // checkout script is the only third party allowed to execute.
  "script-src 'self' https://checkout.razorpay.com",
  "style-src 'self' 'unsafe-inline' https://checkout.razorpay.com",
  "img-src 'self' https: data: blob:",
  "connect-src 'self' https://api.vyapari.live https://api.vyapari.com https://api.razorpay.com",
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
      }
    }
  }
});
