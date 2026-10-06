"use client";

import { useCallback, useEffect, useState } from "react";

// Keranjang disimpan di perangkat (hanya daftar id produk + kode voucher); harga selalu dihitung ulang server.
const KEY = "epta_cart";
type Cart = { ids: string[]; voucher: string };
const empty: Cart = { ids: [], voucher: "" };

function read(): Cart {
  try { return { ...empty, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return empty; }
}
function write(c: Cart) {
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* mode privat: abaikan */ }
  window.dispatchEvent(new Event("epta-cart"));
}

export function useCart() {
  const [cart, setCart] = useState<Cart>(empty);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => setCart(read());
    sync(); setReady(true);
    window.addEventListener("epta-cart", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("epta-cart", sync); window.removeEventListener("storage", sync); };
  }, []);
  const add = useCallback((id: string) => { const c = read(); if (!c.ids.includes(id)) write({ ...c, ids: [...c.ids, id] }); }, []);
  const remove = useCallback((id: string) => { const c = read(); write({ ...c, ids: c.ids.filter((x) => x !== id) }); }, []);
  const replace = useCallback((from: string, to: string) => { const c = read(); write({ ...c, ids: Array.from(new Set(c.ids.map((x) => (x === from ? to : x)))) }); }, []);
  const setVoucher = useCallback((voucher: string) => write({ ...read(), voucher }), []);
  const clear = useCallback(() => write(empty), []);
  return { ...cart, ready, add, remove, replace, setVoucher, clear, count: cart.ids.length };
}

export function cartCount() { return read().ids.length; }
