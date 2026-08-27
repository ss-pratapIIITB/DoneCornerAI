"use client";

import { useEffect, useState } from "react";
import type {
  AssembledPrompt,
  PromptGuidance,
  PromptSection,
} from "@/lib/prompts/assembly";

type PromptPayload = {
  guidance: PromptGuidance;
  versions: PromptGuidance[];
  assembled: AssembledPrompt;
  model: string;
  agent: string;
};

export function PromptWorkspace({ canEdit }: { canEdit: boolean }) {
  const [data, setData] = useState<PromptPayload | null>(null);
  const [objective, setObjective] = useState("");
  const [businessContext, setBusinessContext] = useState("");
  const [materiality, setMateriality] = useState("");
  const [dashboardPreferences, setDashboardPreferences] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function apply(next: PromptPayload) {
    setData(next);
    setObjective(next.guidance.objective);
    setBusinessContext(next.guidance.businessContext);
    setMateriality(next.guidance.materiality);
    setDashboardPreferences(next.guidance.dashboardPreferences);
  }

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/prompts");
      if (!response.ok) {
        setError("Could not load prompt guidance.");
        return;
      }
      apply((await response.json()) as PromptPayload);
    })();
  }, []);

  async function post(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/prompts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const next = (await response.json()) as PromptPayload & { error?: string };
      if (!response.ok) {
        throw new Error(next.error ?? "Could not save guidance.");
      }
      apply(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save guidance.");
    } finally {
      setSaving(false);
    }
  }

  const readonly = data?.assembled.sections.filter((section) => !section.editable) ?? [];

  return (
    <section className="prompt-workspace" aria-label="Prompt workspace">
      <header className="prompt-workspace-head">
        <h3>Prompt control</h3>
        <p>
          {data
            ? `${data.agent} · ${data.model}`
            : "Loading agent configuration…"}
        </p>
      </header>
      {error ? <p className="error">{error}</p> : null}
      <div className="prompt-fields">
        <label>
          Objective
          <textarea
            value={objective}
            onChange={(event) => setObjective(event.target.value)}
            disabled={!canEdit || saving}
          />
        </label>
        <label>
          Business context
          <textarea
            value={businessContext}
            onChange={(event) => setBusinessContext(event.target.value)}
            disabled={!canEdit || saving}
          />
        </label>
        <label>
          Materiality
          <textarea
            value={materiality}
            onChange={(event) => setMateriality(event.target.value)}
            disabled={!canEdit || saving}
          />
        </label>
        <label>
          Dashboard preferences
          <textarea
            value={dashboardPreferences}
            onChange={(event) => setDashboardPreferences(event.target.value)}
            disabled={!canEdit || saving}
          />
        </label>
      </div>
      {canEdit ? (
        <div className="prompt-actions">
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              void post({
                action: "save",
                objective,
                businessContext,
                materiality,
                dashboardPreferences,
              })
            }
          >
            {saving ? "Saving…" : "Save new version"}
          </button>
          <label>
            Restore version
            <select
              value=""
              disabled={saving || (data?.versions.length ?? 0) < 2}
              onChange={(event) => {
                const versionId = event.target.value;
                if (versionId) void post({ action: "restore", versionId });
              }}
            >
              <option value="">Choose a prior version</option>
              {(data?.versions ?? []).map((version) => (
                <option key={version.id} value={version.id}>
                  {new Date(version.createdAt).toLocaleString()} · {version.objective}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <p className="prompt-hint">Switch to edit to change CFO guidance.</p>
      )}
      <div className="prompt-readonly">
        {readonly.map((section) => (
          <ReadOnlySection key={section.id} section={section} />
        ))}
        <ReadOnlySection
          section={{
            id: "user",
            title: "Assembled prompt",
            editable: false,
            text: data?.assembled.fullText ?? "",
          }}
        />
      </div>
    </section>
  );
}

function ReadOnlySection({ section }: { section: PromptSection }) {
  return (
    <details className="prompt-section">
      <summary>{section.title}</summary>
      <pre>{section.text}</pre>
    </details>
  );
}
