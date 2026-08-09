"use client";

import { useEffect, useState } from "react";
import { formatLongElapsed } from "@/lib/utils/formatting";

interface KdsTimerProps {
  startTime: string; // ISO string
}

function getElapsed(start: string) {
  return Math.floor((Date.now() - new Date(start).getTime()) / 1000);
}

export function KdsTimer({ startTime }: KdsTimerProps) {
  const [seconds, setSeconds] = useState(() => getElapsed(startTime));

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(getElapsed(startTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  // Past an hour, a live-ticking mm:ss counter stops being useful and
  // starts looking broken (e.g. "51482m 50s" on a stale/abandoned ticket) —
  // switch to a coarser human duration instead.
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const label =
    seconds >= 3600 ? formatLongElapsed(seconds) : mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  // Color-code urgency
  const colorClass =
    seconds < 300
      ? "text-emerald-500"
      : seconds < 600
        ? "text-amber-500"
        : "text-red-500 animate-pulse";

  return <span className={`font-mono text-xs font-bold tabular-nums ${colorClass}`}>{label}</span>;
}
