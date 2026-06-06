import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { listAllPosts, savePost, deletePost } from "@/lib/blog.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/blog")({
  component: AdminBlog,
});

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  cover_url: string | null;
  is_published: boolean;
  published_at: string | null;
};

function AdminBlog() {
  const fetchAll = useServerFn(listAllPosts);
  const save = useServerFn(savePost);
  const del = useServerFn(deletePost);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-blog"], queryFn: () => fetchAll() });

  const [editing, setEditing] = useState<Partial<Post> | null>(null);

  function reset() { setEditing(null); }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    try {
      await save({
        data: {
          id: editing.id,
          slug: (editing.slug ?? "").toLowerCase(),
          title: editing.title ?? "",
          excerpt: editing.excerpt || undefined,
          body: editing.body ?? "",
          cover_url: editing.cover_url || null,
          is_published: !!editing.is_published,
        },
      });
      toast.success("Saved");
      reset();
      qc.invalidateQueries({ queryKey: ["admin-blog"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Blog posts</h2>
          <p className="text-sm text-muted-foreground">Manage published articles.</p>
        </div>
        {!editing && (
          <Button onClick={() => setEditing({ is_published: false, slug: "", title: "", body: "" })}>
            <Plus className="mr-1.5 h-4 w-4" /> New post
          </Button>
        )}
      </div>

      {editing && (
        <form onSubmit={onSave} className="grid gap-4 rounded-2xl border border-border/60 bg-card p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Title</Label>
              <Input
                required
                value={editing.title ?? ""}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Slug</Label>
              <Input
                required
                pattern="[a-z0-9-]+"
                value={editing.slug ?? ""}
                onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                className="mt-1.5 font-mono"
              />
            </div>
          </div>
          <div>
            <Label>Cover image URL</Label>
            <Input
              type="url"
              value={editing.cover_url ?? ""}
              onChange={(e) => setEditing({ ...editing, cover_url: e.target.value })}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Excerpt</Label>
            <Textarea
              maxLength={400}
              value={editing.excerpt ?? ""}
              onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Body</Label>
            <Textarea
              required
              rows={12}
              value={editing.body ?? ""}
              onChange={(e) => setEditing({ ...editing, body: e.target.value })}
              className="mt-1.5 font-mono text-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={!!editing.is_published}
              onCheckedChange={(v) => setEditing({ ...editing, is_published: v })}
            />
            <Label className="!mt-0">Published</Label>
          </div>
          <div className="flex gap-2">
            <Button type="submit">Save</Button>
            <Button type="button" variant="ghost" onClick={reset}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {(data?.posts ?? []).map((p) => {
          const post = p as unknown as Post;
          return (
            <div key={post.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{post.title}</span>
                  <Badge variant={post.is_published ? "default" : "secondary"}>
                    {post.is_published ? "Live" : "Draft"}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">/{post.slug}</span>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setEditing(post)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={async () => {
                  if (!confirm(`Delete "${post.title}"?`)) return;
                  await del({ data: { id: post.id } });
                  toast.success("Deleted");
                  qc.invalidateQueries({ queryKey: ["admin-blog"] });
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
