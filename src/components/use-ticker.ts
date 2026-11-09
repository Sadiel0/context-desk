"use client";

import { useEffect, useState } from "react";
import type { TickerLoad } from "@/domain/ticker-feed";

export function useTicker(symbol: string) {
  const [result, setResult] = useState<TickerLoad | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setResult(null);
    const refresh = nonce > 0 ? "&refresh=1" : "";
    fetch(`/api/ticker?symbol=${encodeURIComponent(symbol)}${refresh}`)
      .then(async (response) => {
        const body = (await response.json()) as TickerLoad & { error?: string };
        if (cancelled) return;
        if (!response.ok) {
          setResult(null);
          setFailed(body.error ?? "The ticker feeds could not be read.");
          return;
        }
        setResult(body);
        setFailed(null);
      })
      .catch(() => {
        if (!cancelled) setFailed("The ticker feed request did not complete.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, nonce]);

  return { result, failed, loading, refresh: () => setNonce((value) => value + 1) };
}
