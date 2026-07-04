import { FolderGit2 } from "lucide-react";
import type { ProjectUsageRow } from "@/lib/types";
import { fmtTokens } from "@/lib/format";
import styles from "./DataTable.module.css";

const COLUMNS = ["Project", "Tokens", "Cost", "Sessions"];

export function ProjectTable({ data }: { data: ProjectUsageRow[] }) {
  const max = data[0]?.tokens || 1;
  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr className={styles.headRow}>
            {COLUMNS.map((h) => (
              <th key={h} className={`${styles.th} ${h === "Project" ? styles.thLeft : styles.thRight}`}>
                {h.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.project} className={styles.row}>
              <td className={styles.cell}>
                <div className={styles.projectCell}>
                  <FolderGit2 size={13} color="var(--color-text-dim)" />
                  <span className={styles.projectName}>{p.project}</span>
                </div>
              </td>
              <td className={styles.cellRight}>
                <div className={styles.barGroup}>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{ width: `${(p.tokens / max) * 100}%`, background: "var(--color-success)" }}
                    />
                  </div>
                  <span className={styles.tokenValue}>{fmtTokens(p.tokens)}</span>
                </div>
              </td>
              <td className={styles.costValue}>${p.cost.toFixed(2)}</td>
              <td className={styles.plainValue}>{p.sessions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
