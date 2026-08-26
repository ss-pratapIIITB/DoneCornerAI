"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import type { Dashboard } from "@/lib/dashboards/widgets";

function BoardsList() {
  const [boards, setBoards] = useState<Dashboard[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/dashboards?mine=1");
      if (res.ok) setBoards((await res.json()) as Dashboard[]);
    })();
  }, []);

  if (!boards.length) {
    return (
      <p className="empty">
        Personal forks of Close appear here after you enter Edit.
      </p>
    );
  }

  return (
    <ul className="widget-list">
      {boards.map((b) => (
        <li key={b.id} className="widget-card">
          <strong>{b.name}</strong>
          <span className="empty"> · {b.widgets.length} widgets</span>
        </li>
      ))}
    </ul>
  );
}

export default function BoardsPage() {
  return (
    <AppShell>
      <h1>My boards</h1>
      <BoardsList />
    </AppShell>
  );
}
