"use client";

import { useEffect, useState } from "react";
import type { DashboardUser } from "@/lib/types";
import { ALL_USERS_ID } from "@/lib/config";

export const ALL_TEAM: DashboardUser = { id: ALL_USERS_ID, label: "All Team", avatar: "TM" };

export function useUsers(): DashboardUser[] {
  const [users, setUsers] = useState<DashboardUser[]>([ALL_TEAM]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/users")
      .then((r) => r.json())
      .then((fetched: DashboardUser[]) => {
        if (!cancelled) setUsers([ALL_TEAM, ...fetched]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return users;
}
