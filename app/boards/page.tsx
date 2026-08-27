"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import type { Dashboard } from "@/lib/dashboards/widgets";

function BoardsList() {
  const router = useRouter();
  const [boards, setBoards] = useState<Dashboard[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/dashboards?mine=1");
      if (res.ok) setBoards((await res.json()) as Dashboard[]);
    })();
  }, []);

  function openBoard(id: string) {
    localStorage.setItem("donecorner.board", id);
    router.push("/");
  }

  if (!boards.length) {
    return (
      <p className="empty">
        Personal forks of Close appear here after you enter Edit. Pin an agent
        chart onto a named board and it will show up in this list.
      </p>
    );
  }

  return (
    <ul className="widget-list">
      {boards.map((b) => (
        <li key={b.id} className="widget-card">
          <button type="button" className="board-open" onClick={() => openBoard(b.id)}>
            <strong>{b.name}</strong>
            <span className="empty"> · {b.widgets.length} widgets</span>
          </button>
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
