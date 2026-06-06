import { Link } from "@tanstack/react-router";
import { ArrowLeft, Home, Search } from "lucide-react";

export function NotFound() {
  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden bg-background px-4 py-16">
      {/* Ambient background blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-blob-float" />
        <div
          className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-accent/20 blur-3xl animate-blob-float"
          style={{ animationDelay: "-6s" }}
        />
      </div>

      <div className="mx-auto grid w-full max-w-5xl items-center gap-12 lg:grid-cols-2">
        {/* Animated illustration */}
        <div className="relative mx-auto aspect-square w-full max-w-md">
          <svg
            viewBox="0 0 400 400"
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="planet-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: "var(--primary)" }} />
                <stop offset="100%" style={{ stopColor: "var(--accent)" }} />
              </linearGradient>
              <radialGradient id="glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" style={{ stopColor: "var(--accent)", stopOpacity: 0.55 }} />
                <stop offset="100%" style={{ stopColor: "var(--accent)", stopOpacity: 0 }} />
              </radialGradient>
            </defs>

            {/* Glow halo */}
            <circle cx="200" cy="200" r="180" fill="url(#glow)" className="origin-center animate-pulse-soft" />

            {/* Dashed orbit */}
            <g className="origin-center animate-spin-slow" style={{ transformOrigin: "200px 200px" }}>
              <ellipse
                cx="200"
                cy="200"
                rx="170"
                ry="60"
                fill="none"
                style={{ stroke: "var(--accent)", strokeOpacity: 0.7 }}
                strokeWidth="1.5"
                strokeDasharray="4 8"
                transform="rotate(-20 200 200)"
              />
              <circle cx="370" cy="200" r="6" style={{ fill: "var(--accent)" }} transform="rotate(-20 200 200)" />
            </g>

            {/* Twinkling stars */}
            <g style={{ fill: "var(--foreground)" }}>
              <circle cx="60" cy="80" r="2" className="animate-twinkle" />
              <circle cx="340" cy="120" r="1.5" className="animate-twinkle" style={{ animationDelay: "0.4s" }} />
              <circle cx="80" cy="320" r="2" className="animate-twinkle" style={{ animationDelay: "0.8s" }} />
              <circle cx="320" cy="300" r="1.5" className="animate-twinkle" style={{ animationDelay: "1.2s" }} />
              <circle cx="200" cy="40" r="1.5" className="animate-twinkle" style={{ animationDelay: "1.6s" }} />
              <circle cx="40" cy="200" r="1.5" className="animate-twinkle" style={{ animationDelay: "0.2s" }} />
            </g>

            {/* Floating planet group */}
            <g className="animate-float" style={{ transformOrigin: "200px 200px" }}>
              <circle cx="200" cy="200" r="90" fill="url(#planet-grad)" />
              <ellipse cx="180" cy="180" rx="22" ry="14" style={{ fill: "var(--background)", fillOpacity: 0.22 }} />
              <ellipse cx="225" cy="215" rx="14" ry="9" style={{ fill: "var(--background)", fillOpacity: 0.18 }} />
              <ellipse cx="170" cy="225" rx="10" ry="6" style={{ fill: "var(--background)", fillOpacity: 0.16 }} />

              {/* 404 carved into planet */}
              <text
                x="200"
                y="220"
                textAnchor="middle"
                fontSize="64"
                fontWeight="800"
                fontFamily="'Space Grotesk', system-ui, sans-serif"
                style={{ fill: "var(--primary-foreground)" }}
                letterSpacing="-2"
              >
                404
              </text>
            </g>
          </svg>
        </div>

        {/* Copy + actions */}
        <div className="text-center lg:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Lost in orbit
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            This page drifted off the map
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            The link you followed may be broken, or the page may have been moved. Let's get
            you back to something useful.
          </p>

          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center lg:justify-start">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] hover:bg-primary/90"
            >
              <Home className="h-4 w-4" />
              Back to home
            </Link>
            <Link
              to="/shop"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-6 py-3 text-sm font-medium text-foreground transition-all hover:bg-muted"
            >
              <Search className="h-4 w-4" />
              Browse the shop
            </Link>
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Go back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
