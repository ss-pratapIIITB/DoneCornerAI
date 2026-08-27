"use client";

import { useEffect, useState } from "react";
import type { Dashboard } from "@/lib/dashboards/widgets";

type Props = {
  onPin: (boardId?: string) => Promise<void>;
};

export function PinChartMenu({ onPin }: Props) {
  const [open, setOpen] = useState(false);
  const [boards, setBoards] = useState<Dashboard[]>([]);
  const [boardId, setBoardId] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void fetch("/api/dashboards?mine=1")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Dashboard[]) => {
        setBoards(list);
        setBoardId((current) => current || list[0]?.id || "");
      });
  }, [open]);

  async function pin() {
    setBusy(true);
    try {
      if (newName.trim()) {
        const created = await fetch("/api/dashboards", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "create", name: newName.trim() }),
        });
        if (!created.ok) return;
        const board = (await created.json()) as Dashboard;
        await onPin(board.id);
      } else {
        await onPin(boardId || undefined);
      }
      setOpen(false);
      setNewName("");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}>
        Pin to dashboard
      </button>
    );
  }

  return (
    <div className="pin-menu">
      <label>
        Board
        <select value={boardId} onChange={(e) => setBoardId(e.target.value)}>
          <option value="">Current board</option>
          {boards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Or new
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Board name"
        />
      </label>
      <button type="button" onClick={() => void pin()} disabled={busy}>
        {busy ? "Pinning…" : "Pin"}
      </button>
      <button type="button" className="ghost" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}
