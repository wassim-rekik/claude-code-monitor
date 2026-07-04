import type { TeamMemberStats } from "@/lib/types";
import { fmtTokens } from "@/lib/format";
import styles from "./DataTable.module.css";

const AVATAR_COLORS = ["var(--color-accent)", "var(--color-success)", "var(--color-warning)", "var(--color-danger)"];
const GOOD_CACHE_HIT_PCT = 30;
const COLUMNS = ["Developer", "Tokens", "Cost", "Sessions", "Cache hit"];

export function TeamTable({ data }: { data: TeamMemberStats[] }) {
  const max = data[0]?.totalTokens || 1;
  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr className={styles.headRow}>
            {COLUMNS.map((h) => (
              <th key={h} className={`${styles.th} ${h === "Developer" ? styles.thLeft : styles.thRight}`}>
                {h.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((u, i) => (
            <tr key={u.id} className={styles.row}>
              <td className={styles.cell}>
                <div className={styles.nameCell}>
                  <div className={styles.avatar} style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                    {u.avatar}
                  </div>
                  <span className={styles.name}>{u.label}</span>
                </div>
              </td>
              <td className={styles.cellRight}>
                <div className={styles.barGroup}>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{ width: `${(u.totalTokens / max) * 100}%`, background: "var(--color-accent)" }}
                    />
                  </div>
                  <span className={styles.tokenValue}>{fmtTokens(u.totalTokens)}</span>
                </div>
              </td>
              <td className={styles.costValue}>${u.cost.toFixed(2)}</td>
              <td className={styles.plainValue}>{u.sessions}</td>
              <td className={styles.cellRight}>
                <span style={{ color: u.cacheHit > GOOD_CACHE_HIT_PCT ? "var(--color-success)" : "var(--color-warning)", fontFamily: "var(--font-mono)" }}>
                  {u.cacheHit}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
