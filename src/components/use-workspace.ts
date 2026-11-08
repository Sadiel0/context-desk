"use client";

import { useEffect, useState } from "react";
import type { ActionResult } from "@/domain/actions";
import { initialWorkspace, resolveSessionDate, type WorkspaceState } from "@/domain/state";
import { loadWorkspace, saveWorkspace } from "@/storage/local-workspace";

export function useWorkspace() {
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [ready, setReady] = useState(false);
  const [holdWrites, setHoldWrites] = useState(true);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const clock = new Date();
    setNow(clock);
    const loaded = loadWorkspace(window.localStorage);
    if (loaded.ok) {
      setState(loaded.state);
      setHoldWrites(false);
    } else {
      setState(initialWorkspace());
      setStorageMessage(loaded.message);
      setHoldWrites(true);
    }
    setReady(true);
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!ready || holdWrites || !state) return;
    saveWorkspace(window.localStorage, state);
  }, [ready, holdWrites, state]);

  function apply(result: ActionResult, success?: string) {
    setState(result.state);
    setNotice(result.error ?? success ?? null);
    return result;
  }

  function replaceStorage() {
    const fresh = initialWorkspace();
    saveWorkspace(window.localStorage, fresh);
    setState(fresh);
    setHoldWrites(false);
    setStorageMessage(null);
    setNotice("Started an empty workspace in this browser.");
  }

  const sessionDate = state && now ? resolveSessionDate(state, now) : null;

  return {
    state,
    ready,
    now,
    sessionDate,
    holdWrites,
    storageMessage,
    notice,
    setNotice,
    apply,
    replaceStorage,
    keepWithoutSaving: () => {
      setStorageMessage(null);
      setNotice("This tab is not writing over the unreadable save.");
    },
  };
}
