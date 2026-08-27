"use client";

import { useRef, useState, type FormEvent, type ReactElement } from "react";

export type AgentComposerProps = {
  disabled?: boolean;
  reason?: string;
  onSubmit: (message: string, files: File[]) => Promise<void>;
};

export function AgentComposer({
  disabled,
  reason,
  onSubmit,
}: AgentComposerProps): ReactElement {
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || submitting || (!message.trim() && files.length === 0)) return;
    setSubmitting(true);
    setError("");
    try {
      await onSubmit(message.trim(), files);
      setMessage("");
      setFiles([]);
      if (fileInput.current) fileInput.current.value = "";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start the agent.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="agent-composer" onSubmit={submit}>
      {files.length ? (
        <ul className="composer-files" aria-label="Attached files">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.lastModified}`}>
              <span>{file.name}</span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() =>
                  setFiles((current) =>
                    current.filter((_, currentIndex) => currentIndex !== index),
                  )
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <label className="composer-label" htmlFor="agent-message">
        Ask the agent
      </label>
      <textarea
        id="agent-message"
        value={message}
        rows={3}
        disabled={disabled || submitting}
        aria-describedby={reason || error ? "agent-composer-note" : undefined}
        placeholder={
          disabled
            ? reason || "TrueForge is unavailable."
            : "Ask about the close, or attach finance CSVs…"
        }
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <div className="composer-actions">
        <button
          type="button"
          className="attach-action"
          disabled={disabled || submitting}
          onClick={() => fileInput.current?.click()}
        >
          Attach CSV
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          multiple
          hidden
          disabled={disabled || submitting}
          onChange={(event) =>
            setFiles((current) => [
              ...current,
              ...Array.from(event.target.files ?? []),
            ])
          }
        />
        <kbd>Cmd/Ctrl + Enter</kbd>
        <button
          type="submit"
          disabled={
            disabled || submitting || (!message.trim() && files.length === 0)
          }
        >
          {submitting ? "Starting…" : files.length ? "Inspect files" : "Run"}
        </button>
      </div>
      {reason || error ? (
        <p
          id="agent-composer-note"
          className={error ? "composer-error" : "composer-note"}
        >
          {error || reason}
        </p>
      ) : null}
    </form>
  );
}
