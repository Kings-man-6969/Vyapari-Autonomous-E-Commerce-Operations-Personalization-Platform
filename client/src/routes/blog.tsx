import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ArrowRight } from "lucide-react";

import { listPublishedPosts } from "@/lib/blog.functions";
import { CardGridSkeleton } from "@/components/loading-states";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: "Blog — Vyapari" },
      { name: "description", content: "Stories, guides, and updates from the Vyapari team." },
      { property: "og:title", content: "Blog — Vyapari" },
      { property: "og:description", content: "Stories, guides, and updates from the Vyapari team." },
      { property: "og:url", content: "/blog" },
    ],
    links: [{ rel: "canonical", href: "/blog" }],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  const fetch = useServerFn(listPublishedPosts);
  const { data, isLoading } = useQuery({ queryKey: ["blog-posts"], queryFn: () => fetch() });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeader
        eyebrow="Journal"
        icon={BookOpen}
        title="The Vyapari blog"
        description="Stories from sellers, product deep-dives, and the future of AI-native commerce."
      />

      {isLoading ? (
        <div className="mt-8">
          <CardGridSkeleton />
        </div>
      ) : (data?.posts ?? []).length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border/60 bg-card/40 p-16 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-4 font-display text-lg font-medium">No posts yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Check back soon — we're cooking up our first stories.
          </p>
        </div>
      ) : (
        <div className="mt-2 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data!.posts.map((p, i) => (
            <Link
              key={p.id}
              to="/blog/$slug"
              params={{ slug: p.slug }}
              className={`group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--shadow-elegant)] ${
                i === 0 ? "sm:col-span-2 lg:row-span-2" : ""
              }`}
            >
              {p.cover_url ? (
                <div className={`overflow-hidden bg-muted ${i === 0 ? "aspect-[16/10]" : "aspect-[16/9]"}`}>
                  <img
                    src={p.cover_url}
                    alt={p.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
              ) : (
                <div
                  className={`relative overflow-hidden ${i === 0 ? "aspect-[16/10]" : "aspect-[16/9]"}`}
                  style={{ background: "var(--gradient-brand)" }}
                >
                  <BookOpen className="absolute right-4 top-4 h-6 w-6 text-primary-foreground/30" />
                </div>
              )}
              <div className="flex flex-1 flex-col p-6">
                {p.published_at && (
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    {new Date(p.published_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                )}
                <h2
                  className={`mt-2 font-display font-semibold leading-tight tracking-tight group-hover:text-primary ${
                    i === 0 ? "text-2xl sm:text-3xl" : "text-lg"
                  }`}
                >
                  {p.title}
                </h2>
                {p.excerpt && (
                  <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{p.excerpt}</p>
                )}
                <div className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary">
                  Read story
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
