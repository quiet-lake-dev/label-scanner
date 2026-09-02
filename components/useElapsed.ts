"use client";

import { useEffect, useState } from "react";

/** Seconds elapsed while `running` is true, ticking ten times a second. */
export function useElapsed(running: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - started) / 1000), 100);
    return () => clearInterval(id);
  }, [running]);
  return elapsed;
}
