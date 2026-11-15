"use client";
import { useSyncExternalStore } from "react";

/**
 * Valor de texto persistido en localStorage, sin setState dentro de efectos y sin desajuste de hidratación
 * (el servidor y el primer render usan `fallback`). Si el navegador bloquea el almacenamiento, se guarda en memoria.
 */
const memory = new Map<string, string>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => { listeners.delete(cb); window.removeEventListener("storage", cb); };
}

export function useStored(key: string, fallback: string) {
  const value = useSyncExternalStore(
    subscribe,
    () => { try { return localStorage.getItem(key) ?? memory.get(key) ?? fallback; } catch { return memory.get(key) ?? fallback; } },
    () => fallback,
  );
  const set = (v: string) => {
    memory.set(key, v);
    try { localStorage.setItem(key, v); } catch { /* navegador restringido: queda en memoria */ }
    notify();
  };
  return [value, set] as const;
}
