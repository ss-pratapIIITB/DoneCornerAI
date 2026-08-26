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
import { AgentRail, type AgentStatus } from "@/components/shell/AgentRail";
import { ModeBar } from "@/components/shell/ModeBar";
import { QueryBar } from "@/components/shell/QueryBar";
import type { Dashboard } from "@/lib/dashboards/widgets";

type Mode = "view" | "edit";

type PortalValue = {
  mode: Mode;
  board: Dashboard | null;
  enterEdit: () => Promise<Dashboard>;
  saveBoard: (next: Dashboard) => Promise<Dashboard>;
  refreshBoard: () => Promise<void>;
  requestPublish: () => Promise<void>;
  setAgent: (status: AgentStatus, detail: string) => void;
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

const TF_SESSION = "donecorner.tf.session";

type Props = {
  children: React.ReactNode;
};

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
  const [pendingTf, setPendingTf] = useState<
    { threadId: string; toolCallId: string; name?: string }[]
  >([]);

  const setAgent = useCallback((status: AgentStatus, detail: string) => {
    setAgentStatus(status);
    setAgentDetail(detail);
  }, []);

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

  useEffect(() => {
    void refreshBoard();
    const rail = new URLSearchParams(window.location.search).get("rail");
    if (rail === "waiting_approval") {
      setAgentStatus("waiting_approval");
      setAgentDetail("Publish will overwrite org Close with this personal board.");
    }
    const storedSession = localStorage.getItem(TF_SESSION);
    if (storedSession) setTfSession(storedSession);
    void (async () => {
      const res = await fetch("/api/session");
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { reason?: string };
        setQueryDisabled(true);
        setQueryReason(body.reason ?? "TrueForge is not running.");
        return;
      }
      setQueryDisabled(false);
      setQueryReason("");
    })();
    // First paint only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function resolveRail(decision: "approved" | "denied") {
    if (tfSession && pendingTf.length) {
      await fetch("/api/session/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: tfSession,
          approvals: pendingTf.map((p) => ({
            threadId: p.threadId,
            toolCallId: p.toolCallId,
            allow: decision === "approved",
          })),
        }),
      });
      setPendingTf([]);
    }
    if (publishId) {
      await fetch("/api/dashboards/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "resolve", id: publishId, decision }),
      });
    }
    setPublishId(null);
    setAgent(
      decision === "approved" ? "done" : "idle",
      decision === "approved"
        ? "Org Close updated."
        : "Publish denied. Personal draft kept.",
    );
    await refreshBoard();
  }

  async function ask(q: string) {
    setAgent("running", "Asking Close Pack…");
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
      return;
    }
    const session = (await created.json()) as { id: string };
    localStorage.setItem(TF_SESSION, session.id);
    setTfSession(session.id);
    const turn = await fetch("/api/session/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, message: q }),
    });
    if (!turn.ok) {
      setAgent("error", "The query turn failed.");
      return;
    }
    const result = (await turn.json()) as {
      status: AgentStatus;
      output: string;
      pendingApprovals?: {
        threadId: string;
        toolCallId: string;
        name?: string;
      }[];
    };
    setPendingTf(result.pendingApprovals ?? []);
    setAgent(
      result.status === "waiting_approval" ? "waiting_approval" : result.status,
      result.output || "Turn finished.",
    );
  }

  const value = useMemo(
    () => ({
      mode,
      board,
      enterEdit,
      saveBoard,
      refreshBoard,
      requestPublish,
      setAgent,
    }),
    [mode, board, enterEdit, saveBoard, refreshBoard, requestPublish, setAgent],
  );

  return (
    <PortalContext.Provider value={value}>
      <div className="app-shell" data-mode={mode}>
        <nav className="rail" aria-label="Primary">
          <p className="brand">DoneCornerAI</p>
          <Link href="/" className={path === "/" ? "is-on" : ""}>
            Close
          </Link>
          <Link href="/boards" className={path === "/boards" ? "is-on" : ""}>
            My boards
          </Link>
          <Link href="/schema" className={path === "/schema" ? "is-on" : ""}>
            Schema
          </Link>
        </nav>
        <div className="main-col">
          <header className="topbar">
            <ModeBar
              mode={mode}
              onChange={(next) => {
                if (next === "edit") void enterEdit();
                else setMode("view");
              }}
              canEdit
            />
            <QueryBar
              disabled={queryDisabled}
              reason={queryReason}
              onSubmit={(q) => void ask(q)}
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
          onApprove={() => void resolveRail("approved")}
          onDeny={() => void resolveRail("denied")}
        />
      </div>
    </PortalContext.Provider>
  );
}
