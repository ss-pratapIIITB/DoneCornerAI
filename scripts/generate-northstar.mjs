import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../data/northstar");
mkdirSync(dir, { recursive: true });

const periods = Array.from({ length: 12 }, (_, i) => `2025-${String(i + 1).padStart(2, "0")}`);
const entity = "northstar";

const pnl = ["period,entity,function,account,amount,currency,scenario,source"];
const cash = ["period,entity,cash_in,cash_out,ending_balance,scenario,source"];
const arr = ["period,entity,beginning_arr,new,expansion,contraction,churn,ending_arr,source"];
const hc = ["period,entity,function,fte,scenario,source"];

let mrr = 720_000;
let endingArr = mrr * 12;
let cashBal = 8_400_000;

for (const [i, period] of periods.entries()) {
  const newMrr = mrr * 0.05;
  const expansionMrr = mrr * 0.02;
  const contractionMrr = mrr * 0.008;
  const churnMrr = mrr * 0.012;
  const beginningArr = endingArr;
  const newArr = newMrr * 12;
  const expansion = expansionMrr * 12;
  const contraction = contractionMrr * 12;
  const churn = churnMrr * 12;
  endingArr = beginningArr + newArr + expansion - contraction - churn;
  mrr = endingArr / 12;

  const revenue = mrr;
  const cogsHost = revenue * 0.08;
  const cogsPay = revenue * 0.025;
  const cogsCs = revenue * 0.07;
  const smAds = revenue * 0.22;
  const smPayroll = 180_000 + i * 4_000;
  const rdPayroll = 240_000 + i * 5_000;
  const gaPayroll = 95_000 + i * 1_500;
  const gaOther = 28_000;

  const rows = [
    ["other", "subscription", revenue],
    ["cogs", "hosting", cogsHost],
    ["cogs", "payment_processing", cogsPay],
    ["cogs", "cs_delivery", cogsCs],
    ["sm", "paid_ads", smAds],
    ["sm", "sales_payroll", smPayroll],
    ["rd", "eng_payroll", rdPayroll],
    ["ga", "finance_payroll", gaPayroll],
    ["ga", "gna_other", gaOther],
  ];

  for (const [fn, account, actual] of rows) {
    const budget = actual * (fn === "sm" && i >= 5 ? 0.9 : 1.02);
    pnl.push(`${period},${entity},${fn},${account},${actual.toFixed(2)},USD,actual,sample`);
    pnl.push(`${period},${entity},${fn},${account},${budget.toFixed(2)},USD,budget,sample`);
  }

  const cashIn = revenue * 0.92;
  const cashOut =
    cogsHost + cogsPay + cogsCs + smAds + smPayroll + rdPayroll + gaPayroll + gaOther;
  cashBal = cashBal + cashIn - cashOut;
  const budgetIn = cashIn * 1.02;
  const budgetOut = cashOut * 0.97;
  cash.push(`${period},${entity},${cashIn.toFixed(2)},${cashOut.toFixed(2)},${cashBal.toFixed(2)},actual,sample`);
  cash.push(
    `${period},${entity},${budgetIn.toFixed(2)},${budgetOut.toFixed(2)},${(cashBal * 1.04).toFixed(2)},budget,sample`,
  );

  arr.push(
    `${period},${entity},${beginningArr.toFixed(2)},${newArr.toFixed(2)},${expansion.toFixed(2)},${contraction.toFixed(2)},${churn.toFixed(2)},${endingArr.toFixed(2)},sample`,
  );

  hc.push(`${period},${entity},cogs,${(12 + i * 0.2).toFixed(1)},actual,sample`);
  hc.push(`${period},${entity},sm,${(18 + i * 0.4).toFixed(1)},actual,sample`);
  hc.push(`${period},${entity},rd,${(28 + i * 0.5).toFixed(1)},actual,sample`);
  hc.push(`${period},${entity},ga,${(8 + i * 0.1).toFixed(1)},actual,sample`);
  hc.push(`${period},${entity},cogs,${(12 + i * 0.15).toFixed(1)},budget,sample`);
  hc.push(`${period},${entity},sm,${(17 + i * 0.3).toFixed(1)},budget,sample`);
  hc.push(`${period},${entity},rd,${(27 + i * 0.4).toFixed(1)},budget,sample`);
  hc.push(`${period},${entity},ga,${(8 + i * 0.1).toFixed(1)},budget,sample`);
}

writeFileSync(join(dir, "facts_pnl.csv"), pnl.join("\n") + "\n");
writeFileSync(join(dir, "facts_cash.csv"), cash.join("\n") + "\n");
writeFileSync(join(dir, "facts_arr.csv"), arr.join("\n") + "\n");
writeFileSync(join(dir, "facts_headcount.csv"), hc.join("\n") + "\n");
console.log("wrote", dir);
