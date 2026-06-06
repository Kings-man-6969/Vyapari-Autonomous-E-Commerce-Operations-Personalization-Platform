import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { getPostBySlug } from "@/lib/blog.functions";
import { Button } from "@/components/ui/button";

const postQO = (slug: string) =>
  queryOptions({
    queryKey: ["blog-post", slug],
    queryFn: () => getPostBySlug({ data: { slug } }),
  });

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ context, params }) => {
    try {
      const data = await context.queryClient.ensureQueryData(postQO(params.slug));
      if (!data?.post) throw notFound();
      return { post: data.post };
    } catch {
      throw notFound();
    }
  },
  head: ({ params, loaderData }) => {
    const post = (loaderData as { post?: { title: string; excerpt?: string | null; cover_url?: string | null; published_at?: string | null } } | undefined)?.post;
    const title = post ? `${post.title} — Vyapari Blog` : "Article — Vyapari Blog";
    const desc =
      post?.excerpt?.slice(0, 155) ??
      "Read the latest from the Vyapari team on AI commerce, growth, and operations.";
    const img = post?.cover_url ?? undefined;
    const origin = typeof window !== "undefined"
      ? window.location.origin
      : (process.env.SITE_URL || "https://vyapari.shop");
    const url = `${origin}/blog/${params.slug}`;
    const jsonLd = post
      ? {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          description: post.excerpt ?? undefined,
          image: post.cover_url ?? undefined,
          datePublished: post.published_at ?? undefined,
          mainEntityOfPage: url,
        }
      : null;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        ...(img
          ? [
              { property: "og:image", content: img },
              { name: "twitter:image", content: img },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: jsonLd
        ? [{ type: "application/ld+json", children: JSON.stringify(jsonLd) }]
        : [],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold">Post not found</h1>
      <Button asChild variant="ghost" className="mt-4">
        <Link to="/blog">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to blog
        </Link>
      </Button>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold">Couldn't load this post</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <Button asChild variant="ghost" className="mt-4">
        <Link to="/blog">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to blog
        </Link>
      </Button>
    </div>
  ),
  component: BlogPost,
});

function BlogPost() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(postQO(slug));
  const post = data.post;

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="mb-6">
        <Link to="/blog">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> All posts
        </Link>
      </Button>
      {post.cover_url && (
        <div className="mb-8 aspect-[16/9] overflow-hidden rounded-2xl bg-muted">
          <img
            src={post.cover_url}
            alt={post.title}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <h1 className="text-4xl font-semibold tracking-tight">{post.title}</h1>
      {post.published_at && (
        <p className="mt-3 text-sm text-muted-foreground">
          {new Date(post.published_at).toLocaleDateString(undefined, { dateStyle: "long" })}
        </p>
      )}
      {post.excerpt && (
        <p className="mt-5 text-lg text-muted-foreground">{post.excerpt}</p>
      )}
      <div className="prose prose-invert mt-8 max-w-none whitespace-pre-wrap text-foreground/90">
        {post.body}
      </div>
    </article>
  );
}
