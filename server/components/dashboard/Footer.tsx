"use client";

import { useNow } from "@/hooks/useNow";
import { relativeTime } from "@/lib/format";
import styles from "./Footer.module.css";

const TICK_INTERVAL_MS = 30_000;

export function Footer({ refreshedAt }: { refreshedAt: Date }) {
  useNow(TICK_INTERVAL_MS);
  return (
    <div className={styles.footer}>
      <span>last synced: {relativeTime(refreshedAt)}</span>
      <span>source: ~/.claude/projects/*.jsonl → POST /api/usage</span>
    </div>
  );
}
