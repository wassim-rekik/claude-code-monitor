import type { ReactNode } from "react";
import styles from "./Panel.module.css";

interface PanelProps {
  label: string;
  meta?: ReactNode;
  children: ReactNode;
}

export function Panel({ label, meta, children }: PanelProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.headerRow}>
        <div className={styles.label}>{label}</div>
        {meta}
      </div>
      {children}
    </div>
  );
}
