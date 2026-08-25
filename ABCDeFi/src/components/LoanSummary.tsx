import React from 'react';
import type { LoanFormData } from './LoanForm';

interface LoanSummaryProps { data: Omit<LoanFormData, 'principal' | 'interestRate' | 'duration'> & { principal: string; interestRate: string; duration: string }; }

const LoanSummary: React.FC<LoanSummaryProps> = ({ data }) => <dl className="grid grid-cols-2 gap-2 rounded border p-3 text-sm"><dt>Principal</dt><dd>{data.principal} ABCD</dd><dt>Interest</dt><dd>{data.interestRate} bps</dd><dt>Duration</dt><dd>{data.duration} months</dd><dt>Collateral</dt><dd>{data.collateral.amount} {data.collateral.asset}</dd><dt>Purpose</dt><dd>{data.purpose || 'Not specified'}</dd></dl>;

export default LoanSummary;
