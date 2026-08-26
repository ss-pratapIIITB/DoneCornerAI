"use client";

type Props = {
  mode: "view" | "edit";
  onChange: (mode: "view" | "edit") => void;
  canEdit: boolean;
};

export function ModeBar({ mode, onChange, canEdit }: Props) {
  return (
    <div className="mode-bar" role="group" aria-label="Portal mode">
      <button
        type="button"
        className={mode === "view" ? "is-on" : ""}
        aria-pressed={mode === "view"}
        onClick={() => onChange("view")}
      >
        View
      </button>
      {canEdit ? (
        <button
          type="button"
          className={mode === "edit" ? "is-on" : ""}
          aria-pressed={mode === "edit"}
          onClick={() => onChange("edit")}
        >
          Edit
        </button>
      ) : null}
    </div>
  );
}
