"use client";

import { useEffect, useState } from "react";

// Re-renders every `intervalMs` so callers can display fresh relative-time text.
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
