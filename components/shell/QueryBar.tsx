"use client";

type Props = {
  disabled: boolean;
  reason?: string;
  onSubmit: (q: string) => void;
};

export function QueryBar({ disabled, reason, onSubmit }: Props) {
  return (
    <form
      className="query-bar"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const q = String(data.get("q") ?? "").trim();
        if (q) onSubmit(q);
      }}
    >
      <label htmlFor="close-query" className="sr-only">
        Ask the close pack
      </label>
      <input
        id="close-query"
        name="q"
        disabled={disabled}
        placeholder={
          disabled
            ? (reason ?? "Query unavailable")
            : "Ask why S&M is over budget…"
        }
      />
      <button type="submit" className="ask-submit" disabled={disabled}>
        Ask
      </button>
    </form>
  );
}
