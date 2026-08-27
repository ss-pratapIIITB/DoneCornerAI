"use client";

import type { LakeFilters } from "@/lib/lake/types";

type Props = {
  periods: string[];
  accounts: string[];
  cells: Record<string, Record<string, number>>;
  onDrillPeriod: (period: string) => void;
  onDrillAccount: (account: string) => void;
  onDrillCell: (period: string, account: string) => void;
};

function fmt(n: number | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function PnlTable({
  periods,
  accounts,
  cells,
  onDrillPeriod,
  onDrillAccount,
  onDrillCell,
}: Props) {
  return (
    <div className="pnl-wrap">
      <table className="pnl-table">
        <thead>
          <tr>
            <th>Account</th>
            {periods.map((p) => (
              <th key={p}>
                <button type="button" onClick={() => onDrillPeriod(p)}>
                  {p}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a}>
              <th>
                <button type="button" onClick={() => onDrillAccount(a)}>
                  {a}
                </button>
              </th>
              {periods.map((p) => (
                <td key={p}>
                  <button type="button" onClick={() => onDrillCell(p, a)}>
                    {fmt(cells[a]?.[p])}
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="empty">Click a period, account, or cell to drill the tree.</p>
    </div>
  );
}

export type { LakeFilters };
