/**
 * Razorpay Checkout, wrapped in a promise.
 *
 * The gateway's script is loaded from Razorpay's own domain and talks to their
 * iframe, so this is the one place in the app that genuinely needs a third party
 * on the page. Everything it is allowed to see is decided by what is passed in
 * here, and the values come from POST /api/payments/create rather than being
 * assembled in the browser -- a client that can choose its own amount is a client
 * that can choose to pay one rupee.
 *
 * What comes back is only the browser's claim. It is a signature-verified
 * statement that a checkout of *this* account completed, and the server still
 * asks Razorpay what actually happened before it marks anything paid. Treat the
 * resolved value as "the customer came back", never as "the money arrived".
 *
 * Rejections carry a `reason` of 'dismissed' or 'failed' rather than being
 * indistinguishable: a customer who closed the modal has not declined anything,
 * and the page offers them a retry for that and a different message for a bank
 * that said no.
 */

const CHECKOUT_JS = 'https://checkout.razorpay.com/v1/checkout.js';

let scriptPromise = null;

/**
 * Loads checkout.js once per page and reuses the result.
 *
 * The memo matters more than it looks: without it, a customer who dismisses the
 * modal and presses Pay again downloads the script a second time, and the
 * browser re-executes it -- a visible flash and a second round trip on the one
 * page where a stall is most expensive.
 */
export function loadCheckoutScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Checkout is only available in a browser.'));
  }
  if (window.Razorpay) {
    return Promise.resolve(window.Razorpay);
  }
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_JS;
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error('Razorpay checkout loaded but did not register.'));
    };
    script.onerror = () => {
      // Cleared so a retry re-attempts the load instead of resolving a promise
      // that can never settle. A permanently-failed script promise is the kind of
      // bug that makes checkout dead until a full page refresh.
      scriptPromise = null;
      reject(new Error('Could not reach Razorpay checkout. Check your connection and try again.'));
    };
    document.body.appendChild(script);
  });

  return scriptPromise;
}

/** Test seam: forget the memoised script and the global, so each test starts clean. */
export function __resetCheckoutScript() {
  scriptPromise = null;
  if (typeof window !== 'undefined') delete window.Razorpay;
}

export class CheckoutDismissed extends Error {
  constructor() {
    super('Checkout was closed.');
    this.name = 'CheckoutDismissed';
    this.reason = 'dismissed';
  }
}

export class CheckoutFailed extends Error {
  constructor(message, description) {
    super(message || 'The payment did not go through.');
    this.name = 'CheckoutFailed';
    this.reason = 'failed';
    this.description = description;
  }
}

/**
 * Opens the Razorpay modal and resolves with the gateway's three fields.
 *
 * @param {object} params  straight from POST /api/payments/create's `data`:
 *                         key_id, razorpay_order_id, amount (rupees), currency,
 *                         receipt, name, prefill.
 * @param {object} handlers
 * @param {(r: object) => void} [handlers.onDismiss]  the modal was closed.
 * @returns {Promise<{razorpay_payment_id: string, razorpay_order_id: string, razorpay_signature: string}>}
 */
export async function openCheckout(params, handlers = {}) {
  const Razorpay = await loadCheckoutScript();

  return new Promise((resolve, reject) => {
    const checkout = new Razorpay({
      key: params.key_id,
      amount: Math.round(Number(params.amount) * 100),
      currency: params.currency || 'INR',
      name: params.name || 'Vyapari',
      // Echoed back on the webhook and visible in Razorpay's dashboard, so a
      // support agent can match a screenshot to an order without being told to.
      order_id: params.razorpay_order_id,
      description: `Order ${String(params.receipt || '').slice(0, 8)}`,
      prefill: params.prefill || {},
      notes: { order_id: params.order_id },
      // The modal must not collect a card number on a page that is not the
      // gateway's. Razorpay's own wording is deliberate and includes the
      // alternatives, which is the part that keeps this usable on a phone.
      theme: { color: '#2C7BE5' }
    });

    checkout.on('payment.success', (response) => {
      if (!response || !response.razorpay_payment_id || !response.razorpay_signature) {
        // A 'success' with nothing in it cannot be confirmed, so it is not
        // treated as one. Falling through to the caller as pending_verification
        // is the honest outcome: the server will ask the gateway itself.
        reject(new CheckoutFailed('Razorpay returned an incomplete payment.', 'incomplete'));
        return;
      }
      resolve({
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_order_id: response.razorpay_order_id || params.razorpay_order_id,
        razorpay_signature: response.razorpay_signature
      });
    });

    checkout.on('payment.failed', (response) => {
      const source = (response && (response.error || response)) || {};
      reject(
        new CheckoutFailed(
          source.description || source.message || 'The payment did not go through.',
          source.code || source.step || 'failed'
        )
      );
    });

    checkout.on('payment.dismissed', () => {
      reject(new CheckoutDismissed());
    });

    if (typeof handlers.onDismiss === 'function') handlers.onDismiss();

    checkout.open();
  });
}
