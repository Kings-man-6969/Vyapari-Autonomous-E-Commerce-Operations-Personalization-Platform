import { useEffect, useRef, useState } from 'react';
import api from '../services/api';

/**
 * Polls GET /api/payments/status/{orderId} until the payment settles.
 *
 * This exists because the browser callback and the webhook are two different
 * clocks. Razorpay's callback has usually already arrived when the customer
 * lands back on our site, but the capture is confirmed asynchronously and the
 * webhook is what actually moves the order. The honest thing to show in the gap
 * is that the payment is being confirmed -- not a spinner that never resolves,
 * and certainly not a success page for an order nobody has paid for.
 *
 * Terminal states stop the loop. A network blip does not: it counts as an
 * attempt, backs off, and tries again, because a customer on mobile payment is
 * the case most likely to drop a connection and the one least likely to want to
 * be told their payment failed because of it.
 *
 * The interval widens because webhook delivery is fast when it is going to be
 * fast. Puzzling the server every 500ms for 40 seconds to be told the same
 * 'created' is how a checkout turns into a load test.
 */

/** effective_status values that will not change again on their own. */
export const SETTLED = new Set(['success', 'failed', 'cancelled', 'refunded', 'partially_refunded']);

const FIRST_INTERVAL_MS = 1200;
const LAST_INTERVAL_MS = 5000;
export const MAX_ATTEMPTS = 30;

/**
 * Whether a poll response is one the loop should stop on.
 *
 * 'pending_verification' is the whole reason this hook exists and is explicitly
 * not settled: it means the customer has paid and the capture has not been
 * confirmed, and stopping there is how an order that took money never gets
 * marked paid.
 */
export const isSettled = (effectiveStatus) => SETTLED.has(effectiveStatus);

/**
 * The wait before the next poll, widening with the attempt count.
 *
 * Webhook delivery is fast when it is going to be fast, so the first few checks
 * are close together and the rest hold -- and nothing waits longer than five
 * seconds, because a customer staring at a "confirming" message is waiting on
 * us, not on the bank.
 */
export const nextDelay = (attempt) =>
  Math.min(LAST_INTERVAL_MS, FIRST_INTERVAL_MS * Math.ceil(Math.max(1, attempt) / 3));

export function usePaymentStatus(orderId, { active = true } = {}) {
  const [state, setState] = useState({
    effectiveStatus: null,
    orderStatus: null,
    canRetry: false,
    expired: false,
    attempts: 0,
    networkError: false
  });

  const timer = useRef(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;

    if (!orderId || !active) {
      setState({
        effectiveStatus: null,
        orderStatus: null,
        canRetry: false,
        expired: false,
        attempts: 0,
        networkError: false
      });
      return undefined;
    }

    let attempt = 0;

    const poll = async () => {
      if (cancelled.current) return;
      attempt += 1;
      try {
        const res = await api.get(`/payments/status/${orderId}`);
        if (cancelled.current) return;

        const data = res.data?.data || {};
        const effectiveStatus = data.effective_status || null;

        setState({
          effectiveStatus,
          orderStatus: data.order_status || null,
          canRetry: Boolean(data.can_retry),
          expired: Boolean(data.expired),
          attempts: attempt,
          networkError: false
        });

        if (isSettled(effectiveStatus) || attempt >= MAX_ATTEMPTS) return;
      } catch {
        if (cancelled.current) return;
        setState((prev) => ({ ...prev, attempts: attempt, networkError: true }));
        if (attempt >= MAX_ATTEMPTS) return;
      }

      if (cancelled.current) return;
      timer.current = setTimeout(poll, nextDelay(attempt));
    };

    poll();

    return () => {
      cancelled.current = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [orderId, active]);

  return state;
}

export default usePaymentStatus;
