"use client";

import { useState } from "react";
import { usePortal, usePortalMode } from "@/components/shell/AppShell";
import { setWidgetNote, type Widget } from "@/lib/dashboards/widgets";

type Props = {
  widget: Widget;
};

export function WidgetNote({ widget }: Props) {
  const mode = usePortalMode();
  const { board, saveBoard } = usePortal();
  const [draft, setDraft] = useState(widget.note);
  const [saving, setSaving] = useState(false);

  if (mode !== "edit") {
    return widget.note ? (
      <p className="widget-note">{widget.note}</p>
    ) : null;
  }

  async function save() {
    if (!board) return;
    setSaving(true);
    try {
      await saveBoard(setWidgetNote(board, widget.id, draft));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="note-edit">
      <label htmlFor={`note-${widget.id}`}>Note for {widget.title}</label>
      <textarea
        id={`note-${widget.id}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
      />
      <button type="button" onClick={() => void save()} disabled={saving}>
        {saving ? "Saving…" : "Save note"}
      </button>
    </div>
  );
}
