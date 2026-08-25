import { useState, useEffect } from 'react';
import { useWallet } from '../Context/WalletContext';

export interface Loan {
  loanId: string;
  depositId: string;
  loanAmount: string;
  collateralValue: string;
  interestRate: number;
  duration: number;
  ltv: number;
  status: 'Requested' | 'Funded' | 'Active' | 'Defaulted' | 'Repaid' | 'Cancelled';
  createdAt: string;
  fundedAt?: string;
}

export function useLoans() {
  const { jwtToken } = useWallet();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLoans = async () => {
    if (!jwtToken) return;
    try {
      setLoading(true);
      const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/loans`, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setLoans(data.data);
      } else {
        setError(data.message || 'Failed to fetch loans');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();

    // Poll every 15 seconds for status updates
    const interval = setInterval(() => {
      fetchLoans();
    }, 15000);

    return () => clearInterval(interval);
  }, [jwtToken]);

  return { loans, loading, error, refetch: fetchLoans };
}
