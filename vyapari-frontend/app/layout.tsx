import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Vyapari — India's Marketplace",
    template: "%s | Vyapari",
  },
  description:
    "Vyapari is a dual-role e-commerce marketplace. Shop thousands of products or start selling today.",
  keywords: ["ecommerce", "marketplace", "buy", "sell", "india", "vyapari"],
  openGraph: {
    siteName: "Vyapari",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
