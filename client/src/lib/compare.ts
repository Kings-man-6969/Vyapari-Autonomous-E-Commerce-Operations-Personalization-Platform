import { useSyncExternalStore } from "react";

export type CompareItem = {
  productId: string;
  slug: string;
  title: string;
  brand: string | null;
  priceCents: number;
  imageUrl: string | null;
};

const KEY = "vyapari.compare.v1";
const MAX = 4;
const listeners = new Set<() => void>();
let cache: CompareItem[] = [];
let hydrated = false;

function read(): CompareItem[] {
  if (typeof window === "undefined") return cache;
  if (!hydrated) {
    try {
      cache = JSON.parse(localStorage.getItem(KEY) ?? "[]") as CompareItem[];
    } catch {
      cache = [];
    }
    hydrated = true;
  }
  return cache;
}

function write(items: CompareItem[]) {
  if (typeof window === "undefined") return;
  cache = items.slice(0, MAX);
  hydrated = true;
  localStorage.setItem(KEY, JSON.stringify(cache));
  listeners.forEach((l) => l());
}

export const compare = {
  get: read,
  has(id: string) {
    return read().some((i) => i.productId === id);
  },
  toggle(item: CompareItem): { added: boolean; full: boolean } {
    const items = read();
    const existing = items.find((i) => i.productId === item.productId);
    if (existing) {
      write(items.filter((i) => i.productId !== item.productId));
      return { added: false, full: false };
    }
    if (items.length >= MAX) return { added: false, full: true };
    write([...items, item]);
    return { added: true, full: false };
  },
  remove(id: string) {
    write(read().filter((i) => i.productId !== id));
  },
  clear() {
    write([]);
  },
};

const EMPTY: CompareItem[] = [];
export function useCompare() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => EMPTY,
  );
}
