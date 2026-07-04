import type { ComponentType } from "react";
import styles from "./StatCard.module.css";

interface StatCardProps {
  icon: ComponentType<{ size: number; color: string }>;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}

export function StatCard({ icon: Icon, label, value, sub, accent = "var(--color-success)" }: StatCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <Icon size={15} color={accent} />
      </div>
      <div className={styles.value}>{value}</div>
      {sub && <div className={styles.sub}>{sub}</div>}
    </div>
  );
}
