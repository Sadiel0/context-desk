"use client";

import { useEffect, useState } from "react";
import { disconnectedX, type XDeskStatus } from "@/domain/x-snapshot";

export function useXStatus() {
  const [status, setStatus] = useState<XDeskStatus>(disconnectedX(null));
  useEffect(() => {
    let cancelled = false;
    fetch("/api/x")
      .then(async (response) => {
        const body = (await response.json()) as XDeskStatus;
        if (!cancelled) setStatus(body);
      })
      .catch(() => {
        if (!cancelled) setStatus(disconnectedX("The X status request did not complete."));
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return status;
}
