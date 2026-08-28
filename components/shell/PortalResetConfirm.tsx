"use client";

import { useState } from "react";

type Props = {
  busy?: boolean;
  confirming?: boolean;
  onStart: () => void;
  onCancel?: () => void;
};

export function PortalResetConfirm({
  busy = false,
  confirming,
  onStart,
  onCancel,
}: Props) {
  const [open, setOpen] = useState(false);
  const showPanel = confirming ?? open;

  if (showPanel) {
    return (
      <div
        className="lake-confirm-panel portal-reset-panel"
        data-portal-reset
        role="alertdialog"
        aria-labelledby="portal-reset-title"
        aria-describedby="portal-reset-copy"
      >
        <strong id="portal-reset-title">Reset this portal session?</strong>
        <p id="portal-reset-copy">
          Clears agent history, personal boards, and this browser session so you
          can walk the demo again. Warehouse facts stay until you Load sample
          pack and approve <code>load_lake</code>.
        </p>
        <div className="lake-confirm-actions">
          <button type="button" onClick={onStart} disabled={busy}>
            {busy ? "Resetting…" : "Reset portal"}
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
      disabled={busy}
    >
      Reset
    </button>
  );
}
