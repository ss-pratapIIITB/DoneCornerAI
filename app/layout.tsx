import { IBM_Plex_Sans } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";
import "./signal-room.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "DoneCornerAI",
  description: "Agentic CFO close signal room",
};

const DESIGN_CONTRACT = `<!--
DONECORNER-SIGNAL-ROOM dc021e11
THESIS: Exceptions dominate the first viewport; reject the generic card dashboard.
OWN-WORLD: Near-black operations field, signal orange, hard hairlines, dense numeric typography, compact instrument controls.
STORY: Scan the ranked exception, trace it through lake data, ask the visible agent, pin the result, and approve publication.
FIRST VIEWPORT: Compact nav, contextual query bar, full-width primary signal, revenue plot beside ranked queue, persistent agent rail.
FORM: Signal Room, top-ranked grounded direction selected by the user.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={sans.className}>
        <template
          data-design-contract="donecorner-signal-room"
          dangerouslySetInnerHTML={{ __html: DESIGN_CONTRACT }}
        />
        {children}
      </body>
    </html>
  );
}
