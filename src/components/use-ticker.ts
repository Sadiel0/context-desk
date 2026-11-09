"use client";

import { useEffect, useState } from "react";
import type { TickerLoad } from "@/domain/ticker-feed";

type Slot = {
  symbol: string;
  result: TickerLoad | null;
  failed: string | null;
  loading: boolean;
};

export function useTicker(symbol: string) {
  const [slot, setSlot] = useState<Slot>({ symbol, result: null, failed: null, loading: true });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setSlot({ symbol, result: null, failed: null, loading: true });
    const refresh = nonce > 0 ? "&refresh=1" : "";
    fetch(`/api/ticker?symbol=${encodeURIComponent(symbol)}${refresh}`)
      .then(async (response) => {
        const body = (await response.json()) as TickerLoad & { error?: string };
        if (cancelled) return;
        if (!response.ok) {
          setSlot({ symbol, result: null, failed: body.error ?? "The ticker feeds could not be read.", loading: false });
          return;
        }
        setSlot({ symbol, result: body, failed: null, loading: false });
      })
      .catch(() => {
        if (!cancelled) setSlot({ symbol, result: null, failed: "The ticker feed request did not complete.", loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, nonce]);

  const current = slot.symbol === symbol ? slot : { symbol, result: null, failed: null, loading: true };
  return {
    result: current.result,
    failed: current.failed,
    loading: current.loading,
    refresh: () => setNonce((value) => value + 1),
  };
}
