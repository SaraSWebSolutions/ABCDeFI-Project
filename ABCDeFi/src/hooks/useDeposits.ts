import { useState, useEffect } from 'react';
import { useWallet } from '../Context/WalletContext';

export interface Deposit {
  depositId: string;
  token: string;
  amount: string;
  usdValue: string;
  txHash: string;
  status: 'Created' | 'Pending' | 'Confirmed' | 'Locked' | 'Released';
  createdAt: string;
}

export function useDeposits() {
  const { jwtToken } = useWallet();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDeposits = async () => {
    if (!jwtToken) return;
    try {
      setLoading(true);
      const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiUrl}/api/deposits`, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setDeposits(data.data);
      } else {
        setError(data.message || 'Failed to fetch deposits');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeposits();
    
    // Poll every 10 seconds for status updates
    const interval = setInterval(() => {
      fetchDeposits();
    }, 10000);

    return () => clearInterval(interval);
  }, [jwtToken]);

  return { deposits, loading, error, refetch: fetchDeposits };
}
