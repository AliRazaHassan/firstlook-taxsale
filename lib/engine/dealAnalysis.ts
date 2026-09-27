export type DealStrategy = "flip" | "rental" | "brrrr";

export type DealAnalysisInput = {
  purchasePrice: number;
  arv: number;
  rehab: number;
  monthlyRent: number;
  downPaymentPct: number;
  interestRate: number;
  loanYears: number;
  vacancyPct: number;
  managementPct: number;
  taxesMonthly: number;
  insuranceMonthly: number;
  otherMonthly: number;
  buyClosingPct: number;
  sellClosingPct: number;
  holdingMonths: number;
  monthlyHolding: number;
  contingencyPct: number;
  targetProfitPct: number;
  refiLtvPct: number;
  refiClosingPct: number;
  titleLegal: number;
  survivingLiens: number;
  evictionPossession: number;
  auctionFees: number;
  redemptionCarry: number;
};

function safePct(n: number) {
  return Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0)) / 100;
}
function safeMoney(n: number) {
  return Math.max(0, Number.isFinite(n) ? n : 0);
}

export function calculateDealAnalysis(raw: DealAnalysisInput, strategy: DealStrategy) {
  const d = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, safeMoney(value)]),
  ) as DealAnalysisInput;

  const down = d.purchasePrice * safePct(d.downPaymentPct);
  const loan = Math.max(0, d.purchasePrice - down);
  const monthlyRate = d.interestRate / 100 / 12;
  const payments = Math.max(1, Math.round(Math.max(1, d.loanYears) * 12));
  const mortgage = loan <= 0 ? 0 : monthlyRate === 0
    ? loan / payments
    : loan * monthlyRate * Math.pow(1 + monthlyRate, payments) / (Math.pow(1 + monthlyRate, payments) - 1);

  const refiGross = d.arv * safePct(d.refiLtvPct);
  const refiClosing = refiGross * safePct(d.refiClosingPct);
  const refiNet = Math.max(0, refiGross - refiClosing);
  // BRRRR operating returns describe the stabilized property after refinancing.
  const operatingLoan = strategy === "brrrr" ? refiGross : loan;
  const operatingMortgage = strategy === "brrrr"
    ? operatingLoan <= 0 ? 0 : monthlyRate === 0 ? operatingLoan / payments
      : operatingLoan * monthlyRate * Math.pow(1 + monthlyRate, payments) / (Math.pow(1 + monthlyRate, payments) - 1)
    : mortgage;

  const vacancy = d.monthlyRent * safePct(d.vacancyPct);
  const management = d.monthlyRent * safePct(d.managementPct);
  const monthlyOperating = vacancy + management + d.taxesMonthly + d.insuranceMonthly + d.otherMonthly;
  const monthlyExpenses = operatingMortgage + monthlyOperating;
  const cashFlow = d.monthlyRent - monthlyExpenses;
  const annualNoi = (d.monthlyRent - monthlyOperating) * 12;
  const annualDebtService = operatingMortgage * 12;
  const dscr = annualDebtService > 0 ? annualNoi / annualDebtService : 0;
  const loanToValue = d.arv > 0 ? operatingLoan / d.arv : 0;

  const buyClosing = d.purchasePrice * safePct(d.buyClosingPct);
  const rehabContingency = d.rehab * safePct(d.contingencyPct);
  const holding = d.holdingMonths * d.monthlyHolding;
  const riskReserves = d.titleLegal + d.survivingLiens + d.evictionPossession + d.auctionFees + d.redemptionCarry;
  const cashNeeded = down + buyClosing + d.rehab + rehabContingency + holding + riskReserves;
  const rentalBasis = d.purchasePrice + buyClosing + d.rehab + rehabContingency + riskReserves;
  const capRate = rentalBasis > 0 ? annualNoi / rentalBasis : 0;
  const cashOnCash = cashNeeded > 0 ? cashFlow * 12 / cashNeeded : 0;

  const sellClosing = d.arv * safePct(d.sellClosingPct);
  const flipProfit = d.arv - d.purchasePrice - buyClosing - d.rehab - rehabContingency - holding - sellClosing - riskReserves;
  const totalProjectCost = d.purchasePrice + buyClosing + d.rehab + rehabContingency + holding + sellClosing + riskReserves;
  const flipRoi = cashNeeded > 0 ? flipProfit / cashNeeded : 0;
  const targetProfit = d.arv * safePct(d.targetProfitPct);
  const beforeBuyClosing = d.arv - sellClosing - d.rehab - rehabContingency - holding - targetProfit - riskReserves;
  const mao = Math.max(0, beforeBuyClosing / (1 + safePct(d.buyClosingPct)));

  const elapsedPayments = Math.min(payments, Math.max(0, Math.round(d.holdingMonths)));
  const remainingLoan = loan <= 0 ? 0 : monthlyRate === 0
    ? Math.max(0, loan - mortgage * elapsedPayments)
    : Math.max(0, loan * Math.pow(1 + monthlyRate, elapsedPayments) - mortgage * (Math.pow(1 + monthlyRate, elapsedPayments) - 1) / monthlyRate);
  const cashBackFromRefi = Math.max(0, refiNet - remainingLoan);
  const cashLeftIn = Math.max(0, cashNeeded - cashBackFromRefi);

  const stressArv = d.arv * 0.9;
  const stressRehab = d.rehab * 1.2;
  const stressRehabContingency = stressRehab * safePct(d.contingencyPct);
  const stressSellClosing = stressArv * safePct(d.sellClosingPct);
  const stressFlipProfit = stressArv - d.purchasePrice - buyClosing - stressRehab - stressRehabContingency - holding - stressSellClosing - riskReserves;
  const stressAnnualRate = d.interestRate + 2;
  const stressRate = stressAnnualRate / 100 / 12;
  const stressMortgage = operatingLoan <= 0 ? 0 : stressRate === 0
    ? operatingLoan / payments
    : operatingLoan * stressRate * Math.pow(1 + stressRate, payments) / (Math.pow(1 + stressRate, payments) - 1);
  const stressRent = d.monthlyRent * 0.9;
  const stressVacancy = stressRent * safePct(d.vacancyPct);
  const stressManagement = stressRent * safePct(d.managementPct);
  const stressOperating = stressVacancy + stressManagement + d.taxesMonthly + d.insuranceMonthly + d.otherMonthly;
  const stressCashFlow = stressRent - stressMortgage - stressOperating;
  const stressNoi = (stressRent - stressOperating) * 12;
  const stressDscr = stressMortgage > 0 ? stressNoi / (stressMortgage * 12) : 0;

  const warnings = [
    d.arv <= 0 ? "Working ARV is missing." : null,
    d.monthlyRent <= 0 && strategy !== "flip" ? "Monthly rent is missing; rental returns are not decision-ready." : null,
    d.taxesMonthly <= 0 && strategy !== "flip" ? "Property tax assumption is missing." : null,
    d.insuranceMonthly <= 0 && strategy !== "flip" ? "Insurance assumption is missing." : null,
    strategy === "brrrr" && refiNet <= remainingLoan ? "Refinance proceeds do not exceed the estimated remaining acquisition loan, so no investor cash-out is modeled." : null,
    "Working ARV is an estimate until property-level sold comps are verified.",
  ].filter(Boolean) as string[];

  return {
    down, loan, mortgage: operatingMortgage, acquisitionMortgage: mortgage, monthlyExpenses, cashFlow, annualNoi, annualDebtService, dscr, loanToValue,
    cashNeeded, rentalBasis, capRate, cashOnCash, flipProfit, flipRoi, totalProjectCost, targetProfit,
    riskReserves, mao, refiGross, refiClosing, refiNet, remainingLoan, cashBackFromRefi, cashLeftIn,
    buyClosing, sellClosing, rehabContingency, holding, warnings,
    stress: { arv: stressArv, rehab: stressRehab, flipProfit: stressFlipProfit, interestRate: stressAnnualRate, rent: stressRent, cashFlow: stressCashFlow, dscr: stressDscr },
  };
}
