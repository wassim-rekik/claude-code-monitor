import styles from "./Legend.module.css";

interface LegendEntry {
  key: string;
  name: string;
  color: string;
}

export function Legend({ entries }: { entries: readonly LegendEntry[] }) {
  return (
    <div className={styles.legend}>
      {entries.map((e) => (
        <div key={e.key} className={styles.item}>
          <div className={styles.swatch} style={{ background: e.color }} />
          <span className={styles.label}>{e.name}</span>
        </div>
      ))}
    </div>
  );
}
