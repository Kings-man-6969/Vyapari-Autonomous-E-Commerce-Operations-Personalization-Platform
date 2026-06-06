import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Star } from "lucide-react";
import { toast } from "sonner";

import { deleteAddress, listAddresses, upsertAddress } from "@/lib/commerce.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListSkeleton } from "@/components/loading-states";
import { SectionHeader } from "@/components/page-header";
import { MapPin } from "lucide-react";

export const Route = createFileRoute("/account/addresses")({
  component: AddressesPage,
});

function AddressesPage() {
  const fetch = useServerFn(listAddresses);
  const save = useServerFn(upsertAddress);
  const remove = useServerFn(deleteAddress);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => fetch(),
  });

  const saveM = useMutation({
    mutationFn: save,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["addresses"] });
      setOpen(false);
      toast.success("Address saved");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const delM = useMutation({
    mutationFn: remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["addresses"] });
      toast.success("Address removed");
    },
  });

  if (isLoading) return <ListSkeleton />;
  const addresses = data?.addresses ?? [];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    saveM.mutate({
      data: {
        label: (fd.get("label") as string) || null,
        recipient: String(fd.get("recipient") ?? ""),
        line1: String(fd.get("line1") ?? ""),
        line2: (fd.get("line2") as string) || null,
        city: String(fd.get("city") ?? ""),
        region: (fd.get("region") as string) || null,
        postal_code: String(fd.get("postal_code") ?? ""),
        country: String(fd.get("country") ?? "US").toUpperCase(),
        phone: (fd.get("phone") as string) || null,
        is_default: fd.get("is_default") === "on",
      },
    });
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Addresses"
        icon={MapPin}
        title="Saved addresses"
        description="Manage shipping destinations for faster checkout."
        actions={
          !open ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add address
            </Button>
          ) : null
        }
      />



      {open && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 grid gap-4 rounded-2xl border border-border/60 bg-card p-5 sm:grid-cols-2"
        >
          <F name="label" label="Label (Home, Work…)" />
          <F name="recipient" label="Recipient" required />
          <F name="line1" label="Address line 1" required className="sm:col-span-2" />
          <F name="line2" label="Address line 2" className="sm:col-span-2" />
          <F name="city" label="City" required />
          <F name="region" label="State / region" />
          <F name="postal_code" label="Postal code" required />
          <F name="country" label="Country" defaultValue="US" required />
          <F name="phone" label="Phone" className="sm:col-span-2" />
          <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
            <input type="checkbox" name="is_default" /> Make default
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={saveM.isPending}>
              {saveM.isPending ? "Saving…" : "Save address"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {addresses.length === 0 ? (
        <p className="text-sm text-muted-foreground">No saved addresses yet.</p>
      ) : (
        <ul className="space-y-3">
          {addresses.map((a) => (
            <li
              key={a.id}
              className="flex justify-between gap-4 rounded-2xl border border-border/60 bg-card p-5 text-sm"
            >
              <div>
                <div className="flex items-center gap-2 font-medium">
                  {a.label ?? a.recipient}
                  {a.is_default && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      <Star className="h-3 w-3" /> Default
                    </span>
                  )}
                </div>
                <div className="mt-1 text-muted-foreground">
                  {a.recipient} — {a.line1}
                  {a.line2 ? `, ${a.line2}` : ""}, {a.city}
                  {a.region ? `, ${a.region}` : ""} {a.postal_code}, {a.country}
                </div>
              </div>
              <button
                onClick={() => delM.mutate({ data: { id: a.id } })}
                className="text-muted-foreground hover:text-destructive"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function F({
  name,
  label,
  required,
  className,
  defaultValue,
}: {
  name: string;
  label: string;
  required?: boolean;
  className?: string;
  defaultValue?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={name} className="text-xs">
        {label}
      </Label>
      <Input id={name} name={name} required={required} defaultValue={defaultValue} className="mt-1.5" />
    </div>
  );
}
