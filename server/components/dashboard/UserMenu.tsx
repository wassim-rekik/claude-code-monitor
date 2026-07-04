"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { DashboardUser } from "@/lib/types";
import { ALL_USERS_ID } from "@/lib/config";
import styles from "./UserMenu.module.css";

interface UserMenuProps {
  users: DashboardUser[];
  activeUser: DashboardUser;
  onSelect: (userId: string) => void;
}

function avatarColor(userId: string): string {
  return userId === ALL_USERS_ID ? "var(--color-accent)" : "var(--color-success)";
}

export function UserMenu({ users, activeUser, onSelect }: UserMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.menuWrapper}>
      <button onClick={() => setOpen((v) => !v)} className={styles.trigger}>
        <div className={styles.avatarDot} style={{ background: avatarColor(activeUser.id) }}>
          {activeUser.avatar}
        </div>
        {activeUser.label}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className={styles.dropdown}>
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => {
                onSelect(u.id);
                setOpen(false);
              }}
              className={u.id === activeUser.id ? styles.optionActive : styles.option}
            >
              <div className={styles.optionAvatar} style={{ background: avatarColor(u.id) }}>
                {u.avatar}
              </div>
              {u.label}
              {u.id === activeUser.id && <span className={styles.checkmark}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
