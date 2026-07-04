import { Activity, RefreshCw } from "lucide-react";
import type { DashboardUser } from "@/lib/types";
import { UserMenu } from "./UserMenu";
import styles from "./Header.module.css";

export const RANGES = [1, 7, 14, 30] as const;
export type RangeDays = (typeof RANGES)[number];

interface HeaderProps {
  range: RangeDays;
  onRangeChange: (range: RangeDays) => void;
  users: DashboardUser[];
  activeUser: DashboardUser;
  onUserChange: (userId: string) => void;
  loading: boolean;
  onRefresh: () => void;
}

export function Header({ range, onRangeChange, users, activeUser, onUserChange, loading, onRefresh }: HeaderProps) {
  return (
    <div className={styles.bar}>
      <div className={styles.brand}>
        <div className={styles.logo}>
          <Activity size={14} color="#fff" />
        </div>
        <span className={styles.title}>Claude Monitor</span>
      </div>

      <div className={styles.controls}>
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => onRangeChange(r)}
            className={r === range ? styles.rangeButtonActive : styles.rangeButton}
          >
            {r === 1 ? "Today" : `${r}d`}
          </button>
        ))}

        <div className={styles.divider} />

        <UserMenu users={users} activeUser={activeUser} onSelect={onUserChange} />

        <button onClick={onRefresh} className={styles.refreshButton} style={{ color: loading ? "var(--color-accent)" : "var(--color-text-dim)" }}>
          <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
        </button>
      </div>
    </div>
  );
}
