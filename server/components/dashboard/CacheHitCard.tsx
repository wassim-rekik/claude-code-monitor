import { CACHE_HIT_GOOD_THRESHOLD_PCT } from "@/lib/config";
import { Panel } from "./Panel";
import styles from "./CacheHitCard.module.css";

export function CacheHitCard({ avgCacheHit }: { avgCacheHit: number }) {
  const isGood = avgCacheHit > CACHE_HIT_GOOD_THRESHOLD_PCT;
  return (
    <Panel label="CACHE HIT RATE">
      <div className={styles.valueRow}>
        <span className={styles.value} style={{ color: isGood ? "var(--color-success)" : "var(--color-warning)" }}>
          {avgCacheHit}%
        </span>
        <span className={styles.valueSub}>avg / day</span>
      </div>
      <div className={styles.note}>
        {isGood ? "✓ Good — prompt caching is working" : "⚠ Low — consider longer system prompts"}
      </div>
    </Panel>
  );
}
