import { Activity } from "lucide-react";
import styles from "./EmptyChart.module.css";

const DEFAULT_HEIGHT = 200;
const DEFAULT_MESSAGE = "No data for this period";

interface EmptyChartProps {
  height?: number;
  message?: string;
}

export function EmptyChart({ height = DEFAULT_HEIGHT, message = DEFAULT_MESSAGE }: EmptyChartProps) {
  return (
    <div className={styles.empty} style={{ height }}>
      <Activity size={24} color="var(--color-border)" />
      <span className={styles.message}>{message}</span>
    </div>
  );
}
