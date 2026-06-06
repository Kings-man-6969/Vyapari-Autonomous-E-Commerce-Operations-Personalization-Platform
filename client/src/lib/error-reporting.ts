/**
 * Generic error reporting utility.
 * Replace with Sentry, LogRocket, or any other logger if required in production.
 */
export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  console.error("[Vyapari Error Reporter]:", error, {
    route: typeof window !== "undefined" ? window.location.pathname : undefined,
    ...context,
  });
}
