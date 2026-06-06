import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Star, ShieldCheck, ImagePlus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { listReviewsForProduct, upsertReview } from "@/lib/commerce.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { subscribeToAuthIdentity } from "@/lib/auth-subscribe";

export function ReviewsSection({ productId }: { productId: string }) {
  const fetch = useServerFn(listReviewsForProduct);
  const save = useServerFn(upsertReview);
  const qc = useQueryClient();
  const [signedIn, setSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      setUserId(data.session?.user.id ?? null);
    });
    const unsub = subscribeToAuthIdentity((s) => {
      setSignedIn(!!s);
      setUserId(s?.user.id ?? null);
    });
    return () => unsub();
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["reviews", productId],
    queryFn: () => fetch({ data: { productId } }),
  });

  const saveM = useMutation({
    mutationFn: save,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews", productId] });
      qc.invalidateQueries({ queryKey: ["product"] });
      setPendingImages([]);
      toast.success("Thanks for your review!");
    },
    onError: (e, vars) =>
      toast.error((e as Error).message, {
        action: { label: "Retry", onClick: () => saveM.mutate(vars) },
      }),
  });

  const reviews = data?.reviews ?? [];

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !userId) return;
    if (pendingImages.length + files.length > 5) {
      toast.error("Up to 5 photos per review.");
      return;
    }
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} is over 5MB`);
          continue;
        }
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `${userId}/${productId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("review-photos").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (error) {
          toast.error(error.message);
          continue;
        }
        const { data: pub } = supabase.storage.from("review-photos").getPublicUrl(path);
        uploaded.push(pub.publicUrl);
      }
      setPendingImages((cur) => [...cur, ...uploaded]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    saveM.mutate({
      data: {
        productId,
        rating,
        title: (fd.get("title") as string) || undefined,
        body: (fd.get("body") as string) || undefined,
        imageUrls: pendingImages.length > 0 ? pendingImages : undefined,
      },
    });
    e.currentTarget.reset();
  }

  return (
    <section className="mt-20">
      <h2 className="mb-6 text-xl font-semibold tracking-tight">Reviews</h2>

      {signedIn ? (
        <form
          onSubmit={onSubmit}
          className="mb-8 rounded-2xl border border-border/60 bg-card p-5"
        >
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className="p-0.5"
                aria-label={`Rate ${n}`}
              >
                <Star
                  className={
                    n <= rating
                      ? "h-5 w-5 fill-primary text-primary"
                      : "h-5 w-5 text-muted-foreground"
                  }
                />
              </button>
            ))}
          </div>
          <label htmlFor="review-title" className="sr-only">
            Review headline
          </label>
          <Input
            id="review-title"
            name="title"
            placeholder="Headline (optional)"
            className="mt-3"
            aria-label="Review headline"
          />
          <label htmlFor="review-body" className="sr-only">
            Review body
          </label>
          <Textarea
            id="review-body"
            name="body"
            placeholder="Share your thoughts…"
            className="mt-3"
            rows={3}
            aria-label="Review body"
          />

          {pendingImages.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {pendingImages.map((url) => (
                <div key={url} className="relative h-16 w-16">
                  <img src={url} alt="" loading="lazy" decoding="async" className="h-16 w-16 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => setPendingImages((cur) => cur.filter((u) => u !== url))}
                    className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-foreground text-background"
                    aria-label="Remove photo"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || pendingImages.length >= 5}
            >
              {uploading ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="mr-1.5 h-4 w-4" />
              )}
              Add photos
            </Button>
            <Button type="submit" disabled={saveM.isPending || uploading}>
              {saveM.isPending ? "Posting…" : "Post review"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="mb-8 text-sm text-muted-foreground">
          Sign in to leave a review.
        </p>
      )}

      {isLoading ? (
        <ul className="space-y-4" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="ml-auto h-3 w-16" />
              </div>
              <Skeleton className="mt-3 h-4 w-1/3" />
              <Skeleton className="mt-2 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-5/6" />
            </li>
          ))}
        </ul>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reviews yet — be the first!</p>
      ) : (
        <ul className="space-y-4">
          {reviews.map((r) => {
            const profile = (r as { profiles?: { full_name?: string | null } }).profiles;
            return (
              <li key={r.id} className="rounded-2xl border border-border/60 bg-card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={
                          n <= r.rating
                            ? "h-4 w-4 fill-primary text-primary"
                            : "h-4 w-4 text-muted-foreground/50"
                        }
                      />
                    ))}
                  </div>
                  {profile?.full_name && (
                    <span className="text-xs font-medium">{profile.full_name}</span>
                  )}
                  {r.verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      <ShieldCheck className="h-3 w-3" /> Verified purchase
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                {r.title && <div className="mt-2 font-medium">{r.title}</div>}
                {r.body && <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>}
                {r.image_urls.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.image_urls.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt="" loading="lazy" decoding="async" className="h-20 w-20 rounded-lg object-cover" />
                      </a>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
