"use client";

import { useEffect, useState } from "react";

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

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const label = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  // Color-code urgency
  const colorClass =
    seconds < 300
      ? "text-emerald-500"
      : seconds < 600
        ? "text-amber-500"
        : "text-red-500 animate-pulse";

  return <span className={`font-mono text-xs font-bold tabular-nums ${colorClass}`}>{label}</span>;
}
