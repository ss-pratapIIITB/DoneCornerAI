"use client";

import { useEffect, useState } from "react";

type Props = {
  busy?: boolean;
  disabled?: boolean;
  confirming?: boolean;
  onStart: () => void;
  onCancel?: () => void;
};

export function LakeLoadConfirm({
  busy = false,
  disabled = false,
  confirming,
  onStart,
  onCancel,
}: Props) {
  const [open, setOpen] = useState(false);
  const showPanel = confirming ?? open;

  useEffect(() => {
    if (!busy) setOpen(false);
  }, [busy]);

  if (showPanel) {
    return (
        <div
          className="lake-confirm-panel"
          data-lake-confirm
          role="alertdialog"
        aria-labelledby="lake-confirm-title"
        aria-describedby="lake-confirm-copy"
      >
        <strong id="lake-confirm-title">Replace warehouse facts?</strong>
        <p id="lake-confirm-copy">
          This starts a TrueForge run. The rail will pause on{" "}
          <code>load_lake</code> before Postgres is truncated. Approve there to
          load the Northstar pack.
        </p>
        <div className="lake-confirm-actions">
          <button type="button" onClick={onStart} disabled={busy || disabled}>
            {busy ? "Starting…" : "Start load"}
          </button>
          <button
            type="button"
            className="deny"
            onClick={() => {
              setOpen(false);
              onCancel?.();
            }}
            disabled={busy}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="secondary-action"
      onClick={() => setOpen(true)}
      disabled={busy || disabled}
    >
      {busy ? "Loading…" : "Load sample pack"}
    </button>
  );
}
