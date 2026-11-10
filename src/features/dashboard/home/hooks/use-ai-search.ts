"use client";

import { useEffect, useRef, useState } from "react";

export interface AiMatch {
  id: string;
  label: string;
  /** Relative to /store/{id}. */
  href: string;
}

export interface AiSearchState {
  status: "idle" | "loading" | "done" | "error";
  answer: string;
  matches: AiMatch[];
}

const IDLE: AiSearchState = { status: "idle", answer: "", matches: [] };
const cache = new Map<string, AiSearchState>();

/**
 * Asks the search assistant (/api/ai/search) what the person meant, once the dropdown has found
 * nothing. Waits for a pause in typing, asks once per distinct text, and remembers the answer.
 */
export function useAiSearch(query: string, locale: string, enabled: boolean): AiSearchState {
  const q = query.trim();
  const key = `${locale}:${q.toLowerCase()}`;
  const [state, setState] = useState<AiSearchState>(IDLE);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    abort.current?.abort();
    if (!enabled || q.length < 3) {
      setState(IDLE);
      return;
    }
    const hit = cache.get(key);
    if (hit) {
      setState(hit);
      return;
    }
    setState({ ...IDLE, status: "loading" });
    const controller = new AbortController();
    abort.current = controller;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/ai/search", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: q, locale }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { answer: string; matches: AiMatch[] };
        const next: AiSearchState = { status: "done", answer: data.answer, matches: data.matches };
        cache.set(key, next);
        setState(next);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setState({ ...IDLE, status: "error" });
      }
    }, 800);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, q, locale, enabled]);

  return state;
}
