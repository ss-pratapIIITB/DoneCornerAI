"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AgentRail,
  type AgentStatus,
  type AgentTurn,
} from "@/components/shell/AgentRail";
import { ModeBar } from "@/components/shell/ModeBar";
import type { Dashboard } from "@/lib/dashboards/widgets";
import type { LakeQuery } from "@/lib/lake/types";
import type { AgentRun, RunEvent } from "@/lib/runs/types";

type Mode = "view" | "edit";

export type AgentChart = { title: string; query: LakeQuery };

type PortalValue = {
  mode: Mode;
  board: Dashboard | null;
  enterEdit: () => Promise<Dashboard>;
  saveBoard: (next: Dashboard) => Promise<Dashboard>;
  refreshBoard: () => Promise<void>;
  requestPublish: () => Promise<void>;
  setAgent: (status: AgentStatus, detail: string) => void;
  lastCharts: AgentChart[];
  pinChart: (chart: AgentChart, boardId?: string) => Promise<void>;
};

const PortalContext = createContext<PortalValue | null>(null);

export function usePortal(): PortalValue {
  const value = useContext(PortalContext);
  if (!value) throw new Error("usePortal must be used inside AppShell");
  return value;
}

export function usePortalMode(): Mode {
  return usePortal().mode;
}

type UploadedArtifact = { id: string; name: string };

async function discardArtifacts(artifacts: UploadedArtifact[]): Promise<void> {
  await Promise.allSettled(
    artifacts.map((artifact) =>
      fetch("/api/artifacts", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ artifactId: artifact.id }),
      }),
    ),
  );
}

async function markRunFailed(runId: string, summary: string): Promise<void> {
  await fetch(`/api/runs/${encodeURIComponent(runId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ summary }),
  }).catch(() => undefined);
}

const TF_SESSION = "donecorner.tf.session";

type RunWithEvents = AgentRun & { events: RunEvent[] };

function answerFromEvents(events: RunEvent[]): string {
  const terminal = [...events]
    .reverse()
    .find((event) =>
      [
        "run.completed",
        "run.failed",
        "run.cancelled",
        "run.waiting_approval",
      ].includes(event.type),
    );
  if (terminal) return terminal.summary;
  const deltas = events
    .filter((event) => event.type === "message.delta")
    .map((event) => event.summary)
    .join("");
  if (deltas) return deltas;
  return (
    [...events]
      .reverse()
      .find((event) => event.type === "message.completed")?.summary ?? ""
  );
}

function questionFromEvents(events: RunEvent[]): string {
  return (
    events.find((event) => event.type === "user.message")?.summary ??
    "Agent run"
  );
}

function unresolvedApprovals(events: RunEvent[]) {
  const pending = new Map<
    string,
    { threadId: string; toolCallId: string; name?: string }
  >();
  for (const event of events) {
    const toolCallId = String(event.details.toolCallId ?? "");
    if (!toolCallId) continue;
    if (event.type === "approval.requested") {
      pending.set(toolCallId, {
        threadId: String(event.details.threadId ?? "main"),
        toolCallId,
        name: String(event.details.name ?? "Sensitive tool action"),
      });
    } else if (event.type === "approval.resolved") {
      pending.delete(toolCallId);
    }
  }
  return [...pending.values()];
}

function uiRunStatus(status: AgentRun["status"]): AgentStatus {
  if (status === "queued") return "running";
  if (status === "cancelled") return "error";
  return status;
}

type Props = {
  children: React.ReactNode;
};

function NavGlyph({
  kind,
}: {
  kind: "close" | "boards" | "lake" | "schema";
}) {
  const paths = {
    close: "M4 15V9m5 6V5m5 10v-3m5 3V7",
    boards: "M4 5h7v6H4zm9 0h7v6h-7zM4 13h7v6H4zm9 0h7v6h-7z",
    lake: "M4 7c2-2 4-2 6 0s4 2 6 0 4-2 4-2M4 12c2-2 4-2 6 0s4 2 6 0 4-2 4-2M4 17c2-2 4-2 6 0s4 2 6 0 4-2 4-2",
    schema: "M5 5h6v5H5zm8 0h6v5h-6zM5 14h6v5H5zm8 0h6v5h-6z",
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[kind]} fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function AppShell({ children }: Props) {
  const path = usePathname();
  const [mode, setMode] = useState<Mode>("view");
  const [board, setBoard] = useState<Dashboard | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("idle");
  const [agentDetail, setAgentDetail] = useState(
    "Load the sample pack or drop files.",
  );
  const [publishId, setPublishId] = useState<string | null>(null);
  const [queryDisabled, setQueryDisabled] = useState(true);
  const [queryReason, setQueryReason] = useState(
    "Connect TrueForge to ask follow-ups.",
  );
  const [tfSession, setTfSession] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [pendingTf, setPendingTf] = useState<
    { threadId: string; toolCallId: string; name?: string }[]
  >([]);
  const [lastCharts, setLastCharts] = useState<AgentChart[]>([]);
  const [turns, setTurns] = useState<AgentTurn[]>([]);

  const setAgent = useCallback((status: AgentStatus, detail: string) => {
    setAgentStatus(status);
    setAgentDetail(detail);
  }, []);

  const applyRunSnapshot = useCallback(
    (snapshot: { run: AgentRun; events: RunEvent[] }) => {
      const answer = answerFromEvents(snapshot.events);
      setTurns((current) =>
        current.map((turn) =>
          turn.id === snapshot.run.id
            ? {
                ...turn,
                a: answer,
                run: snapshot.run,
                events: snapshot.events,
              }
            : turn,
        ),
      );
      setPendingTf(
        snapshot.run.status === "waiting_approval"
          ? unresolvedApprovals(snapshot.events)
          : [],
      );
      const status = uiRunStatus(snapshot.run.status);
      setAgent(
        status,
        answer ||
          (status === "running" ? "Agent work is still running…" : "Ready."),
      );
    },
    [setAgent],
  );

  const refreshBoard = useCallback(async () => {
    const id =
      board?.id ?? localStorage.getItem("donecorner.board") ?? "org-close";
    const res = await fetch(`/api/dashboards?id=${encodeURIComponent(id)}`);
    if (res.ok) {
      setBoard((await res.json()) as Dashboard);
      return;
    }
    const fallback = await fetch("/api/dashboards?id=org-close");
    if (fallback.ok) setBoard((await fallback.json()) as Dashboard);
  }, [board?.id]);

  const hydrateRuns = useCallback(async (sessionId: string) => {
    const response = await fetch(
      `/api/runs?sessionId=${encodeURIComponent(sessionId)}`,
    );
    if (!response.ok) return;
    const body = (await response.json()) as { runs?: RunWithEvents[] };
    const runs = [...(body.runs ?? [])].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    );
    setTurns(
      runs.map((run) => ({
        id: run.id,
        q: questionFromEvents(run.events),
        a: answerFromEvents(run.events),
        run,
        events: run.events,
      })),
    );
    const latest = runs.at(-1);
    if (!latest) return;
    setActiveRunId(latest.id);
    const pending = unresolvedApprovals(latest.events);
    setPendingTf(latest.status === "waiting_approval" ? pending : []);
    const status = uiRunStatus(latest.status);
    setAgentStatus(status);
    setAgentDetail(
      answerFromEvents(latest.events) ||
        (status === "running" ? "Resuming live agent activity…" : "Ready."),
    );
  }, []);

  useEffect(() => {
    const hydrate = window.setTimeout(() => {
      void refreshBoard();
      const rail = new URLSearchParams(window.location.search).get("rail");
      if (rail === "waiting_approval") {
        setAgentStatus("waiting_approval");
        setAgentDetail("Publish will overwrite org Close with this personal board.");
      }
      const storedSession = localStorage.getItem(TF_SESSION);
      if (storedSession) {
        setTfSession(storedSession);
        void hydrateRuns(storedSession);
      }
      void (async () => {
        const res = await fetch("/api/session");
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            reason?: string;
          };
          setQueryDisabled(true);
          setQueryReason(body.reason ?? "TrueForge is not running.");
          return;
        }
        setQueryDisabled(false);
        setQueryReason("");
      })();
    }, 100);
    return () => window.clearTimeout(hydrate);
    // First paint only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeRunId || agentStatus !== "running") return;
    let cancelled = false;
    const poll = async () => {
      while (!cancelled) {
        const response = await fetch(`/api/runs/${activeRunId}/events`);
        if (!response.ok) return;
        const snapshot = (await response.json()) as {
          run: AgentRun;
          events: RunEvent[];
        };
        if (cancelled) return;
        applyRunSnapshot(snapshot);
        if (snapshot.run.status !== "running" && snapshot.run.status !== "queued") {
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 500));
      }
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [activeRunId, agentStatus, applyRunSnapshot]);

  const enterEdit = useCallback(async () => {
    const res = await fetch("/api/dashboards", { method: "POST" });
    if (!res.ok) throw new Error("Could not fork Close");
    const personal = (await res.json()) as Dashboard;
    localStorage.setItem("donecorner.board", personal.id);
    setBoard(personal);
    setMode("edit");
    return personal;
  }, []);

  const saveBoard = useCallback(async (next: Dashboard) => {
    const res = await fetch("/api/dashboards", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!res.ok) throw new Error("Could not save the personal board");
    const saved = (await res.json()) as Dashboard;
    localStorage.setItem("donecorner.board", saved.id);
    setBoard(saved);
    return saved;
  }, []);

  const requestPublish = useCallback(async () => {
    const personal = board?.owner === "org" ? await enterEdit() : board;
    if (!personal) throw new Error("No personal board to publish");
    setAgent("running", "Requesting publish approval…");
    const res = await fetch("/api/dashboards/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "request", personalId: personal.id }),
    });
    if (!res.ok) {
      setAgent("error", "Could not request publish.");
      return;
    }
    const body = (await res.json()) as { id: string };
    setPublishId(body.id);
    setAgent(
      "waiting_approval",
      "Publish will overwrite org Close with this personal board.",
    );
  }, [board, enterEdit, setAgent]);

  async function ask(q: string, files: File[] = []) {
    setAgent(
      "running",
      files.length ? "Quarantining attached files…" : "Starting agent run…",
    );
    setLastCharts([]);
    const created = await fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: tfSession }),
    });
    if (!created.ok) {
      const body = (await created.json().catch(() => ({}))) as { reason?: string };
      setQueryDisabled(true);
      setQueryReason(body.reason ?? "TrueForge is not running.");
      setAgent("error", body.reason ?? "TrueForge is not running.");
      throw new Error(body.reason ?? "TrueForge is not running.");
    }
    const session = (await created.json()) as { id: string };
    localStorage.setItem(TF_SESSION, session.id);
    setTfSession(session.id);
    const uploadResults = await Promise.allSettled(
      files.map(async (file) => {
        const form = new FormData();
        form.append("file", file);
        const uploaded = await fetch("/api/artifacts", {
          method: "POST",
          body: form,
        });
        if (!uploaded.ok) {
          const error = (await uploaded.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(error.error ?? `Could not upload ${file.name}.`);
        }
        const body = (await uploaded.json()) as {
          artifact: { id: string; filename: string };
        };
        return { id: body.artifact.id, name: body.artifact.filename };
      }),
    );
    const artifacts = uploadResults.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    const failedUpload = uploadResults.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failedUpload) {
      await discardArtifacts(artifacts);
      throw failedUpload.reason instanceof Error
        ? failedUpload.reason
        : new Error("Could not upload every attached file.");
    }
    const kind = artifacts.length ? "file_ingest" : "question";
    const started = await fetch("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, kind }),
    });
    if (!started.ok) {
      await discardArtifacts(artifacts);
      throw new Error("Could not create an observable agent run.");
    }
    const { run } = (await started.json()) as { run: AgentRun };
    const displayMessage =
      q || `Inspect ${artifacts.map((artifact) => artifact.name).join(", ")}`;
    setActiveRunId(run.id);
    setTurns((current) => [
      ...current,
      {
        id: run.id,
        q: displayMessage,
        a: "",
        attachments: artifacts,
        run,
        events: [],
      },
    ]);
    const prompt = board
      ? `${displayMessage}\n\nCurrent board id: ${board.id}. Use query_lake or query_sql and present_chart. userId is cfo.`
      : displayMessage;
    const artifactContext = artifacts.length
      ? `\n\nThis is file ingestion run ${run.id}. Process every quarantined artifact through inspect_file, sandbox validation, get_mapping_proposal, and approval-gated apply_mapping:\n${artifacts
          .map((artifact) => `- artifactId=${artifact.id} name=${artifact.name}`)
          .join("\n")}`
      : "";
    let turn: Response;
    try {
      turn = await fetch("/api/session/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          runId: run.id,
          kind,
          displayMessage,
          message: `${prompt}${artifactContext}`,
        }),
      });
    } catch (error) {
      await markRunFailed(run.id, "Agent turn request could not reach the server.");
      throw error;
    }
    if (!turn.ok) {
      await markRunFailed(run.id, "Agent turn failed before completion.");
      setAgent("error", "The query turn failed.");
      throw new Error("The agent turn failed.");
    }
    const result = (await turn.json()) as {
      status: AgentStatus;
      output: string;
      runId?: string;
      events?: RunEvent[];
      pendingApprovals?: {
        threadId: string;
        toolCallId: string;
        name?: string;
      }[];
      charts?: { title: string; query: Record<string, unknown> }[];
    };
    setPendingTf(result.pendingApprovals ?? []);
    const answer = result.output?.trim() || "Turn finished.";
    setTurns((current) =>
      current.map((item) =>
        item.id === run.id
          ? { ...item, a: answer, events: result.events ?? item.events }
          : item,
      ),
    );
    if (result.charts?.length) {
      setLastCharts(
        result.charts.map((c) => ({
          title: c.title,
          query: {
            metric: String(c.query.metric ?? "revenue"),
            grain: String(c.query.grain ?? "period") as LakeQuery["grain"],
            filters: (c.query.filters ?? { scenario: "actual" }) as LakeQuery["filters"],
          },
        })),
      );
    }
    setAgent(
      result.status === "waiting_approval" ? "waiting_approval" : result.status,
      answer,
    );
  }

  async function submitAgent(q: string, files: File[]) {
    try {
      await ask(q, files);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not start the agent.";
      setAgent("error", message);
      throw error;
    }
  }

  async function resolveRail(decision: "approved" | "denied") {
    const hadPublish = Boolean(publishId);
    const hadTfApproval = pendingTf.length > 0;
    if (tfSession && pendingTf.length) {
      const approved = await fetch("/api/session/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: tfSession,
          runId: activeRunId,
          approvals: pendingTf.map((p) => ({
            threadId: p.threadId,
            toolCallId: p.toolCallId,
            allow: decision === "approved",
          })),
        }),
      });
      const summary = (await approved.json().catch(() => ({}))) as {
        status?: AgentStatus;
        output?: string;
        pendingApprovals?: {
          threadId: string;
          toolCallId: string;
          name?: string;
        }[];
        runId?: string;
        events?: RunEvent[];
        charts?: { title: string; query: Record<string, unknown> }[];
        error?: string;
      };
      setPendingTf(summary.pendingApprovals ?? []);
      if (summary.runId && summary.events) {
        setTurns((current) =>
          current.map((turn) =>
            turn.id === summary.runId
              ? {
                  ...turn,
                  a: summary.output ?? answerFromEvents(summary.events ?? []),
                  events: summary.events,
                }
              : turn,
          ),
        );
      }
      if (summary.charts?.length) {
        setLastCharts(
          summary.charts.map((chart) => ({
            title: chart.title,
            query: {
              metric: String(chart.query.metric ?? "revenue"),
              grain: String(chart.query.grain ?? "period") as LakeQuery["grain"],
              filters: (chart.query.filters ?? {
                scenario: "actual",
              }) as LakeQuery["filters"],
            },
          })),
        );
      }
      if (!approved.ok || summary.status === "error") {
        setAgent("error", summary.output ?? summary.error ?? "Approval turn failed.");
        return;
      }
      if (summary.status === "waiting_approval") {
        await hydrateRuns(tfSession);
        setAgent(
          "waiting_approval",
          summary.output || "Still waiting for approval.",
        );
        return;
      }
    }
    if (publishId) {
      const resolved = await fetch("/api/dashboards/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "resolve", id: publishId, decision }),
      });
      if (!resolved.ok) {
        setAgent("error", "Could not apply the publish decision.");
        return;
      }
    }
    setPublishId(null);
    setAgent(
      decision === "approved" ? "done" : "idle",
      decision === "approved"
        ? hadPublish
          ? "Org Close updated."
          : "Approval sent."
        : "Publish denied. Personal draft kept.",
    );
    if (tfSession && hadTfApproval) await hydrateRuns(tfSession);
    await refreshBoard();
  }

  const pinChart = useCallback(
    async (chart: AgentChart, boardId?: string) => {
      if (mode !== "edit") {
        throw new Error("Switch to Edit before pinning a chart.");
      }
      let target = board;
      if (boardId) {
        const res = await fetch(`/api/dashboards?id=${encodeURIComponent(boardId)}`);
        if (res.ok) target = (await res.json()) as Dashboard;
      }
      if (!target || target.owner === "org") {
        throw new Error("Choose a personal dashboard before pinning.");
      }
      const next = {
        ...target,
        widgets: [
          ...target.widgets,
          {
            id: `w-agent-${crypto.randomUUID().slice(0, 8)}`,
            type: "bar" as const,
            title: chart.title,
            query: {
              metric: "revenue" as const,
              grain: "period" as const,
              filters: { scenario: "actual" as const },
            },
            note: "Pinned from agent",
            lake: chart.query,
          },
        ],
      };
      await saveBoard(next);
      setAgent("done", `Pinned “${chart.title}” to ${next.name}.`);
    },
    [board, mode, saveBoard, setAgent],
  );

  const value = useMemo(
    () => ({
      mode,
      board,
      enterEdit,
      saveBoard,
      refreshBoard,
      requestPublish,
      setAgent,
      lastCharts,
      pinChart,
    }),
    [mode, board, enterEdit, saveBoard, refreshBoard, requestPublish, setAgent, lastCharts, pinChart],
  );

  const routeLabel =
    path === "/boards" ? "My boards" : path === "/schema" ? "Schema" : "Close signal room";

  return (
    <PortalContext.Provider value={value}>
      <div className="app-shell" data-mode={mode}>
        <nav className="rail" aria-label="Primary">
          <p className="brand" aria-label="DoneCornerAI">
            DC
          </p>
          <Link href="/" className={path === "/" ? "is-on" : ""} title="Close">
            <NavGlyph kind="close" />
            <span>Close</span>
          </Link>
          <Link
            href="/boards"
            className={path === "/boards" ? "is-on" : ""}
            title="My boards"
          >
            <NavGlyph kind="boards" />
            <span>Boards</span>
          </Link>
          <Link href="/" title="Lake">
            <NavGlyph kind="lake" />
            <span>Lake</span>
          </Link>
          <Link
            href="/schema"
            className={path === "/schema" ? "is-on" : ""}
            title="Schema"
          >
            <NavGlyph kind="schema" />
            <span>Schema</span>
          </Link>
          <p className="rail-user">CFO</p>
        </nav>
        <div className="main-col">
          <header className="topbar">
            <div className="route-context">
              <span>Northstar Group</span>
              <strong>{routeLabel}</strong>
            </div>
            <ModeBar
              mode={mode}
              onChange={(next) => {
                if (next === "edit") void enterEdit();
                else setMode("view");
              }}
              canEdit
            />
          </header>
          {mode === "edit" ? (
            <p className="edit-strip">
              Editing personal board. Publish to org waits for approval.
            </p>
          ) : null}
          <div className="canvas">{children}</div>
        </div>
        <AgentRail
          status={agentStatus}
          detail={agentDetail}
          turns={turns}
          pendingActions={[
            ...(publishId ? ["Publish board"] : []),
            ...pendingTf.map((action) => action.name ?? "Sensitive tool action"),
          ]}
          disabled={queryDisabled}
          disabledReason={queryReason}
          onSubmit={submitAgent}
          onApprove={() => void resolveRail("approved")}
          onDeny={() => void resolveRail("denied")}
        />
      </div>
    </PortalContext.Provider>
  );
}
