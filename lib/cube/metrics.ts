function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function grossMarginPct(revenue: number, cogs: number): number | null {
  if (revenue === 0) return null;
  return round2(((revenue - cogs) / revenue) * 100);
}

export function netBurn(cashIn: number, cashOut: number): number {
  return cashOut - cashIn;
}

export function runwayMonths(
  endingBalance: number,
  avgMonthlyBurn: number,
): number | null {
  if (avgMonthlyBurn <= 0) return null;
  return endingBalance / avgMonthlyBurn;
}

export function mrrFromArr(arr: number): number {
  return round2(arr / 12);
}

export function nrr(
  beginningArr: number,
  expansion: number,
  contraction: number,
  churn: number,
): number | null {
  if (beginningArr === 0) return null;
  return round2(
    ((beginningArr + expansion - contraction - churn) / beginningArr) * 100,
  );
}

export function grr(
  beginningArr: number,
  contraction: number,
  churn: number,
): number | null {
  if (beginningArr === 0) return null;
  return round2(((beginningArr - contraction - churn) / beginningArr) * 100);
}

export function ruleOf40(arrGrowthPct: number, ebitdaMarginPct: number): number {
  return arrGrowthPct + ebitdaMarginPct;
}

export function cacPaybackMonths(
  smSpend: number,
  newArr: number,
): number | null {
  if (newArr <= 0 || smSpend <= 0) return null;
  return smSpend / (newArr / 12);
}
