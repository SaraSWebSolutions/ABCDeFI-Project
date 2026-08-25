import React from 'react';

/**
 * Legacy gallery intentionally disabled. Loan certificates are protocol
 * artifacts minted by LoanMarketplace during funding, never user-created UI
 * records. The active P2P view must read the deployed LoanNFT contract after
 * a confirmed marketplace receipt.
 */
export const LoanNFTGallery: React.FC = () => (
  <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 text-sm text-slate-400">
    LoanNFT certificates are issued only by the on-chain P2P marketplace. This legacy manual-mint gallery is disabled.
  </div>
);

export default LoanNFTGallery;
