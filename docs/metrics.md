# Cube metric formulas

All amounts USD. Null means “do not display”, never a fake zero.

| Metric | Formula |
|---|---|
| revenue | sum of `facts_pnl.amount` where account group is revenue, scenario as filtered |
| cogs | sum of COGS function |
| gross_profit | revenue − cogs |
| gross_margin_pct | (revenue − cogs) / revenue × 100; null if revenue = 0 |
| opex | sm + rd + ga (+ other) |
| ebitda | gross_profit − opex |
| opex_ratio | opex / revenue × 100; null if revenue = 0 |
| net_burn | cash_out − cash_in |
| runway_months | ending_balance / avg monthly net_burn (last 3 months); null if not burning |
| burn_vs_budget | actual net_burn − budget net_burn |
| bva_amount | actual − budget for the selected P&L metric |
| bva_pct | bva_amount / budget × 100; null if budget = 0 |
| arr | `facts_arr.ending_arr` |
| mrr | arr / 12 |
| net_new_arr | new + expansion − contraction − churn |
| nrr | (beginning + expansion − contraction − churn) / beginning × 100 |
| grr | (beginning − contraction − churn) / beginning × 100 |
| rule_of_40 | YoY ARR growth % + EBITDA margin % |
| burn_multiple | net_burn / net_new_arr; null if net_new_arr ≤ 0 |
| magic_number | net_new_arr / prior period S&M; null if S&M ≤ 0 |
| rev_per_fte | revenue / sum FTE; null if FTE = 0 |
| CAC payback | S&M / (new ARR / 12); omit if either missing |

Do not invent CAC or LTV if the close pack has no S&M + new ARR pair.
