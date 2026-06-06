import { useSyncExternalStore } from "react";

export type ViewedItem = {
  productId: string;
  slug: string;
  title: string;
  brand: string | null;
  priceCents: number;
  imageUrl: string | null;
  viewedAt: number;
};

const KEY = "vyapari.recently_viewed.v1";
const MAX = 12;
const listeners = new Set<() => void>();
let cache: ViewedItem[] = [];
let hydrated = false;

function read(): ViewedItem[] {
  if (typeof window === "undefined") return cache;
  if (!hydrated) {
    try {
      cache = JSON.parse(localStorage.getItem(KEY) ?? "[]") as ViewedItem[];
    } catch {
      cache = [];
    }
    hydrated = true;
  }
  return cache;
}

function write(items: ViewedItem[]) {
  if (typeof window === "undefined") return;
  cache = items.slice(0, MAX);
  hydrated = true;
  localStorage.setItem(KEY, JSON.stringify(cache));
  listeners.forEach((l) => l());
}

export function trackView(item: Omit<ViewedItem, "viewedAt">) {
  const items = read().filter((i) => i.productId !== item.productId);
  items.unshift({ ...item, viewedAt: Date.now() });
  write(items);
}

export function clearRecentlyViewed() {
  write([]);
}

const EMPTY: ViewedItem[] = [];
export function useRecentlyViewed() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => EMPTY,
  );
}
