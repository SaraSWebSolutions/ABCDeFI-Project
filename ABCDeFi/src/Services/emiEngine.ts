// ============================================================================
// Phase 3 – EMI (Installment) Engine (Steps 8, 9, 10)
// ============================================================================

export interface EMIScheduleItem {
  monthNumber: number;
  dueDate: string;
  emiAmountUSD: number;
  principalComponentUSD: number;
  interestComponentUSD: number;
  remainingBalanceUSD: number;
  status: 'Paid' | 'Due' | 'Upcoming';
}

export interface LoanEMIModel {
  loanId: string;
  borrowerAddress: string;
  principalUSD: number;
  annualInterestRatePct: number;
  durationMonths: number;
  monthlyEMIUSD: number;
  totalInterestUSD: number;
  totalRepaymentUSD: number;
  remainingBalanceUSD: number;
  nextDueDate: string;
  schedule: EMIScheduleItem[];
}

/**
 * Step 9 – EMI Calculator
 * Formula: EMI = P * r * (1+r)^n / ((1+r)^n - 1)
 */
export function calculateMonthlyEMI(
  principalUSD: number,
  annualRatePct: number,
  durationMonths: number
): { monthlyEMI: number; totalInterest: number; totalRepayment: number } {
  if (principalUSD <= 0 || durationMonths <= 0) {
    return { monthlyEMI: 0, totalInterest: 0, totalRepayment: 0 };
  }

  const r = annualRatePct / 12 / 100; // Monthly interest rate decimal
  const n = durationMonths;

  let monthlyEMI = 0;
  if (r === 0) {
    monthlyEMI = principalUSD / n;
  } else {
    monthlyEMI = (principalUSD * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }

  const totalRepayment = monthlyEMI * n;
  const totalInterest = totalRepayment - principalUSD;

  return {
    monthlyEMI: Math.round(monthlyEMI * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalRepayment: Math.round(totalRepayment * 100) / 100,
  };
}

/**
 * Step 10 – Installment Schedule Generator
 * Generates month-by-month repayment schedule (Month 1 to Month N)
 */
export function generateInstallmentSchedule(
  principalUSD: number,
  annualRatePct: number,
  durationMonths: number,
  startDateISO: string = new Date().toISOString()
): LoanEMIModel {
  const { monthlyEMI, totalInterest, totalRepayment } = calculateMonthlyEMI(
    principalUSD,
    annualRatePct,
    durationMonths
  );

  const r = annualRatePct / 12 / 100;
  let remainingBalance = principalUSD;
  const schedule: EMIScheduleItem[] = [];

  const baseDate = new Date(startDateISO);

  for (let i = 1; i <= durationMonths; i++) {
    const interestComp = r > 0 ? remainingBalance * r : 0;
    const principalComp = monthlyEMI - interestComp;
    remainingBalance = Math.max(0, remainingBalance - principalComp);

    // Calculate due date for Month i
    const dueDateObj = new Date(baseDate);
    dueDateObj.setMonth(dueDateObj.getMonth() + i);
    const dueDateStr = dueDateObj.toISOString().split('T')[0];

    const status: EMIScheduleItem['status'] =
      i === 1 ? 'Paid' : i === 2 ? 'Due' : 'Upcoming';

    schedule.push({
      monthNumber: i,
      dueDate: dueDateStr,
      emiAmountUSD: Math.round(monthlyEMI * 100) / 100,
      principalComponentUSD: Math.round(principalComp * 100) / 100,
      interestComponentUSD: Math.round(interestComp * 100) / 100,
      remainingBalanceUSD: Math.round(remainingBalance * 100) / 100,
      status,
    });
  }

  const nextDue = schedule.find((s) => s.status === 'Due') || schedule[0];

  return {
    loanId: 'LOAN-104',
    borrowerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    principalUSD,
    annualInterestRatePct: annualRatePct,
    durationMonths,
    monthlyEMIUSD: monthlyEMI,
    totalInterestUSD: totalInterest,
    totalRepaymentUSD: totalRepayment,
    remainingBalanceUSD: Math.round(principalUSD * 0.75),
    nextDueDate: nextDue.dueDate,
    schedule,
  };
}
