import styles from "./CustomTooltip.module.css";

interface TooltipPayloadEntry {
  dataKey: string;
  color: string;
  name: string;
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

export function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipLabel}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className={styles.tooltipRow} style={{ color: p.color }}>
          {p.name}: <strong>{p.dataKey === "cost" ? `$${p.value.toFixed(3)}` : p.value.toLocaleString()}</strong>
        </div>
      ))}
    </div>
  );
}
