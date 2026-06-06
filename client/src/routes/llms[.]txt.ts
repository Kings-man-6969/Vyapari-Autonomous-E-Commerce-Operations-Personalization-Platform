import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async () => {
        const body = `# Vyapari

> AI-native commerce platform where independent sellers run smarter electronics storefronts and buyers shop with an AI assistant.

Vyapari blends a curated electronics marketplace with an AI shopping assistant for buyers and an intelligence layer for sellers. The site covers product discovery, store pages, an AI assistant, and editorial content.

## Pages

- [Home](/): Overview of the Vyapari AI commerce platform.
- [Shop](/shop): Browse electronics from independent sellers — phones, laptops, audio, cameras, wearables, accessories.
- [Assistant](/assistant): Chat with Vyapari AI for shopping recommendations.
- [Compare](/compare): Side-by-side comparison of saved products.
- [Blog](/blog): Stories, guides, and updates from the Vyapari team.

## Optional

- [Sign in](/login)
- [Create an account](/signup)
`;
        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
