import React, { useState } from 'react';
import { createMarketplaceLoan } from '../Services/lending';

interface CreateLoanModalProps {
  onClose: () => void;
}

const CreateLoanModal: React.FC<CreateLoanModalProps> = ({ onClose }) => {
  const [principal, setPrincipal] = useState('');
  const [collateral, setCollateral] = useState('');
  const [interestBps, setInterestBps] = useState('1000');
  const [durationDays, setDurationDays] = useState('30');
  const [purpose, setPurpose] = useState('ABCDeFi loan');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!principal || !collateral || Number(interestBps) < 0 || Number(durationDays) <= 0) {
      setError('Provide a positive principal, collateral, and duration.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createMarketplaceLoan(principal, collateral, Number(durationDays), Number(interestBps), purpose);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Loan request transaction failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4"><form onSubmit={submit} className="w-full max-w-md space-y-3 rounded-2xl bg-slate-900 p-6 text-slate-100"><h2 className="text-lg font-bold">Create loan request</h2><input required value={principal} onChange={(event) => setPrincipal(event.target.value)} placeholder="ABCD principal" className="w-full rounded border p-2 text-slate-950" /><input required value={collateral} onChange={(event) => setCollateral(event.target.value)} placeholder="ETH collateral" className="w-full rounded border p-2 text-slate-950" /><input required value={interestBps} onChange={(event) => setInterestBps(event.target.value)} placeholder="Interest (bps)" className="w-full rounded border p-2 text-slate-950" /><input required value={durationDays} onChange={(event) => setDurationDays(event.target.value)} placeholder="Duration (days)" className="w-full rounded border p-2 text-slate-950" /><input value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="Purpose" className="w-full rounded border p-2 text-slate-950" />{error ? <p className="text-sm text-rose-300">{error}</p> : null}<div className="flex justify-end gap-2"><button type="button" onClick={onClose}>Cancel</button><button disabled={submitting} className="rounded bg-violet-600 px-3 py-2">{submitting ? 'Submitting…' : 'Submit request'}</button></div></form></div>;
};

export default CreateLoanModal;
