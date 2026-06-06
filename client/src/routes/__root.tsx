import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { reportError } from "../lib/error-reporting";
import { SiteHeader } from "@/components/site-header";
import { BrandLogo } from "@/components/brand-logo";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { NotFound } from "@/components/not-found";
import { CommandPalette } from "@/components/command-palette";
import { CookieConsent } from "@/components/cookie-consent";
import { NewsletterSignup } from "@/components/newsletter-signup";

function NotFoundComponent() {
  return <NotFound />;
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function AuthSync() {
  const router = useRouter();
  const queryClient = useQueryClient();
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        router.invalidate();
        queryClient.invalidateQueries();
      }
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const pathname = router.state.location.pathname;
  return (
    <QueryClientProvider client={queryClient}>
      <AuthSync />
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main key={pathname} className="flex-1 animate-fade-in-soft">
          <Outlet />
        </main>
        <footer className="border-t border-border/60 bg-card/40">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
            <div className="mx-auto max-w-xl text-center">
              <h2 className="font-display text-lg font-semibold tracking-tight">
                Get the weekly Vyapari edit
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                New launches, AI tips for sellers, and curated deals. No spam.
              </p>
              <div className="mt-4">
                <NewsletterSignup />
              </div>
            </div>
            <div className="mt-8 flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <BrandLogo size={18} className="text-primary" />
                <span>© {new Date().getFullYear()} Vyapari — AI Commerce OS</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
      <CommandPalette />
      <CookieConsent />
      <Toaster richColors closeButton position="top-right" duration={4000} expand visibleToasts={4} />
    </QueryClientProvider>
  );
}
