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

type Props = {
  children: React.ReactNode;
};

export function AppShell({ children }: Props) {
  const path = usePathname();
  const [mode, setMode] = useState<Mode>("view");
  const [board, setBoard] = useState<Dashboard | null>(null);
  const [agentStatus] = useState<AgentStatus>("idle");
  const [agentDetail] = useState("Load the sample pack or drop files.");
  const [queryDisabled] = useState(true);
  const [queryReason] = useState("Connect TrueForge to ask follow-ups.");

  const refreshBoard = useCallback(async () => {
    const stored =
      typeof window === "undefined"
        ? "org-close"
        : (localStorage.getItem("donecorner.board") ?? "org-close");
    const id = board?.id ?? stored;
    const res = await fetch(`/api/dashboards?id=${encodeURIComponent(id)}`);
    if (res.ok) {
      const next = (await res.json()) as Dashboard;
      setBoard(next);
      return;
    }
    const fallback = await fetch("/api/dashboards?id=org-close");
    if (fallback.ok) setBoard((await fallback.json()) as Dashboard);
  }, [board?.id]);

  useEffect(() => {
    void refreshBoard();
    // First paint only; later refreshes are explicit.
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

  const value = useMemo(
    () => ({ mode, board, enterEdit, saveBoard, refreshBoard }),
    [mode, board, enterEdit, saveBoard, refreshBoard],
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
              onSubmit={() => undefined}
            />
          </header>
          {mode === "edit" ? (
            <p className="edit-strip">
              Editing personal board. Publish to org waits for approval.
            </p>
          ) : null}
          <div className="canvas">{children}</div>
        </div>
        <AgentRail status={agentStatus} detail={agentDetail} />
      </div>
    </PortalContext.Provider>
  );
}
