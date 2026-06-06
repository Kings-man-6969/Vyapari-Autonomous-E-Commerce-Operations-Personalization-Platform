import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { getMyStore, updateStore } from "@/lib/seller.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/sell/settings")({
  component: StoreSettings,
});

function StoreSettings() {
  const fetchStore = useServerFn(getMyStore);
  const update = useServerFn(updateStore);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["my-store"], queryFn: () => fetchStore() });

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [logo, setLogo] = useState("");
  const [banner, setBanner] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (data?.store) {
      setName(data.store.store_name);
      setBio(data.store.bio ?? "");
      setLogo(data.store.logo_url ?? "");
      setBanner(data.store.banner_url ?? "");
    }
  }, [data]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await update({
        data: {
          store_name: name,
          bio: bio || null,
          logo_url: logo || null,
          banner_url: banner || null,
        },
      });
      toast.success("Store updated");
      qc.invalidateQueries({ queryKey: ["my-store"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5">
      <h2 className="text-xl font-semibold">Store settings</h2>
      <div>
        <Label htmlFor="name">Store name</Label>
        <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="bio">About</Label>
        <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={4} className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="logo">Logo URL</Label>
        <Input id="logo" type="url" value={logo} onChange={(e) => setLogo(e.target.value)} className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="banner">Banner URL</Label>
        <Input id="banner" type="url" value={banner} onChange={(e) => setBanner(e.target.value)} className="mt-1.5" />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
