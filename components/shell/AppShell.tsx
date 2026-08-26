"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState } from "react";
import { AgentRail, type AgentStatus } from "@/components/shell/AgentRail";
import { ModeBar } from "@/components/shell/ModeBar";
import { QueryBar } from "@/components/shell/QueryBar";

type Mode = "view" | "edit";

const ModeContext = createContext<Mode>("view");

export function usePortalMode(): Mode {
  return useContext(ModeContext);
}

type Props = {
  children: React.ReactNode;
};

export function AppShell({ children }: Props) {
  const path = usePathname();
  const [mode, setMode] = useState<Mode>("view");
  const [agentStatus] = useState<AgentStatus>("idle");
  const [agentDetail] = useState("Load the sample pack or drop files.");
  const [queryDisabled] = useState(true);
  const [queryReason] = useState("Connect TrueForge to ask follow-ups.");

  return (
    <ModeContext.Provider value={mode}>
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
            <ModeBar mode={mode} onChange={setMode} canEdit />
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
    </ModeContext.Provider>
  );
}
