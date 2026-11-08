"use client";

import { useEffect, useState } from "react";
import type { FedLoadResult } from "@/server/fed-client";

export function useFed() {
  const [result, setResult] = useState<FedLoadResult | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/fed")
      .then(async (response) => {
        const body = (await response.json()) as FedLoadResult;
        if (!cancelled) {
          setResult(body);
          setFailed(null);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed("The calendar request did not complete.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return { result, failed, loading, refresh: () => setNonce((value) => value + 1) };
}
