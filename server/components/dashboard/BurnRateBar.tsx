import { Clock } from "lucide-react";
import type { BurnWindow } from "@/lib/types";
import { fmtTokens } from "@/lib/format";
import styles from "./BurnRateBar.module.css";

const HIGH_PCT = 80;
const MEDIUM_PCT = 60;

function colorFor(pct: number): string {
  if (pct > HIGH_PCT) return "var(--color-danger)";
  if (pct > MEDIUM_PCT) return "var(--color-warning)";
  return "var(--color-success)";
}

export function BurnRateBar({ burn }: { burn: BurnWindow }) {
  const color = colorFor(burn.pct);
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.label}>5H WINDOW</span>
        <span className={styles.windowNote}>
          <Clock size={11} /> rolling window
        </span>
      </div>
      <div className={styles.usageRow}>
        <span className={styles.usedText} style={{ color }}>
          {fmtTokens(burn.used)} <span className={styles.limitText}>/ {fmtTokens(burn.limit)} tokens</span>
        </span>
        <span className={styles.pctText} style={{ color }}>
          {burn.pct}%
        </span>
      </div>
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{
            width: `${burn.pct}%`,
            background: `linear-gradient(90deg, color-mix(in srgb, ${color} 50%, transparent), ${color})`,
          }}
        />
      </div>
    </div>
  );
}
