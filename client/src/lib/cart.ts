import { useSyncExternalStore } from "react";

export type CartItem = {
  productId: string;
  slug: string;
  title: string;
  brand: string | null;
  priceCents: number;
  sellerId: string;
  imageUrl: string | null;
  quantity: number;
};

const KEY = "vyapari.cart.v1";
const listeners = new Set<() => void>();

let cache: CartItem[] = [];
let cacheRaw: string | null = null;
let initialized = false;

function read(): CartItem[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(KEY);
  if (raw === cacheRaw && initialized) return cache;
  cacheRaw = raw;
  initialized = true;
  try {
    cache = raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(items: CartItem[]) {
  cache = items;
  cacheRaw = JSON.stringify(items);
  initialized = true;
  localStorage.setItem(KEY, cacheRaw);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cacheRaw = null; // force re-read
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export const cart = {
  get: read,
  add(item: Omit<CartItem, "quantity">, qty = 1) {
    const items = read();
    const existing = items.find((i) => i.productId === item.productId);
    if (existing) existing.quantity += qty;
    else items.push({ ...item, quantity: qty });
    write(items);
  },
  setQuantity(productId: string, qty: number) {
    const items = read()
      .map((i) => (i.productId === productId ? { ...i, quantity: Math.max(1, qty) } : i))
      .filter((i) => i.quantity > 0);
    write(items);
  },
  remove(productId: string) {
    write(read().filter((i) => i.productId !== productId));
  },
  clear() {
    write([]);
  },
};

const EMPTY: CartItem[] = [];
export function useCart() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function cartTotals(items: CartItem[]) {
  const subtotal = items.reduce((s, i) => s + i.priceCents * i.quantity, 0);
  const shipping = items.length === 0 ? 0 : subtotal > 5000 ? 0 : 999;
  const tax = Math.round(subtotal * 0.08);
  const total = subtotal + shipping + tax;
  return { subtotal, shipping, tax, total };
}

export function formatCents(c: number) {
  return `$${(c / 100).toFixed(2)}`;
}
