import React, { useState, useEffect } from 'react';
import {
  Code2,
  Terminal,
  Layers,
  Copy,
  CheckCircle2,
  ExternalLink,
  Activity,
  FileCode,
} from 'lucide-react';
import { PortfolioSummary, BlockchainEvent } from '../types';

interface SmartContractsViewProps {
  portfolio: PortfolioSummary | null;
}

const CONTRACT_SOURCES: Record<string, string> = {
  'ABCDToken.sol': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ABCDToken is ERC20, Ownable {
    constructor() ERC20("ABCDeFi Protocol Token", "ABCD") Ownable(msg.sender) {
        _mint(msg.sender, 10_000_000 * 10**decimals());
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}`,

  'CollateralVault.sol': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CollateralVault is Ownable {
    event CollateralLocked(address indexed borrower, address indexed token, uint256 amount, uint256 usdValue);
    event CollateralReleased(address indexed borrower, address indexed token, uint256 amount);

    mapping(address => mapping(address => uint256)) public lockedCollateral;

    function lockCollateral(address token, uint256 amount) external payable {
        require(amount > 0, "Amount must be > 0");
        lockedCollateral[msg.sender][token] += amount;
        emit CollateralLocked(msg.sender, token, amount, getUsdValue(token, amount));
    }

    function releaseCollateral(address borrower, address token, uint256 amount) external onlyOwner {
        require(lockedCollateral[borrower][token] >= amount, "Insufficient locked balance");
        lockedCollateral[borrower][token] -= amount;
        emit CollateralReleased(borrower, token, amount);
    }
}`,

  'LoanMarketplace.sol': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract LoanMarketplace {
    enum LoanStatus { Pending, Active, Completed, Defaulted }

    struct Loan {
        uint256 id;
        address borrower;
        address lender;
        uint256 amount;
        uint256 duration;
        uint256 interest;
        LoanStatus status;
    }

    event LoanCreated(uint256 indexed id, address indexed borrower, uint256 amount, uint256 interest);
    event LoanFunded(uint256 indexed id, address indexed lender, address indexed borrower, uint256 amount);

    mapping(uint256 => Loan) public loans;
    uint256 public loanCounter;

    function createLoan(uint256 amount, uint256 duration, uint256 interest) external returns (uint256) {
        loanCounter++;
        loans[loanCounter] = Loan(loanCounter, msg.sender, address(0), amount, duration, interest, LoanStatus.Pending);
        emit LoanCreated(loanCounter, msg.sender, amount, interest);
        return loanCounter;
    }

    function fundLoan(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.Pending, "Loan not pending");
        loan.lender = msg.sender;
        loan.status = LoanStatus.Active;
        emit LoanFunded(loanId, msg.sender, loan.borrower, loan.amount);
    }
}`,

  'EMIManager.sol': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract EMIManager {
    event EMIPaid(uint256 indexed loanId, address indexed borrower, uint256 amountPaid, uint256 paidEmis);

    function payEmi(uint256 loanId, uint256 amount) external {
        emit EMIPaid(loanId, msg.sender, amount, 1);
    }
}`,

  'LoanNFT.sol': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract LoanNFT is ERC721 {
    event NFTMinted(uint256 indexed tokenId, address indexed recipient, string badgeTitle);

    uint256 public tokenCounter;

    constructor() ERC721("ABCDeFi Repayer Badge", "CREDIT") {}

    function mintCreditBadge(address recipient, string memory badgeTitle) external returns (uint256) {
        tokenCounter++;
        _mint(recipient, tokenCounter);
        emit NFTMinted(tokenCounter, recipient, badgeTitle);
        return tokenCounter;
    }
}`,

  'Treasury.sol': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Treasury {
    event Withdrawn(address indexed recipient, address indexed token, uint256 amount);

    function withdraw(address token, uint256 amount, address to) external {
        emit Withdrawn(to, token, amount);
    }
}`,
};

export const SmartContractsView: React.FC<SmartContractsViewProps> = ({ portfolio }) => {
  const [selectedContract, setSelectedContract] = useState<string>('CollateralVault.sol');
  const [contractsInfo, setContractsInfo] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/blockchain/contracts')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setContractsInfo(data.contracts);
        }
      });
  }, []);

  const currentInfo = contractsInfo.find((c) => c.name === selectedContract);
  const sourceCode = CONTRACT_SOURCES[selectedContract] || '// Contract code loading...';
  const events = portfolio?.events || [];

  const copyCode = () => {
    navigator.clipboard.writeText(sourceCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
          <Code2 className="w-3.5 h-3.5" />
          <span>On-Chain Architecture</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Smart Contract Inspector & Event Logs</h1>
        <p className="text-sm text-slate-400 max-w-xl mx-auto">
          Examine the compiled Solidity smart contracts powering the ABCDeFi Lending Protocol.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left Contract Source Explorer */}
        <div className="md:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl">
          {/* Contract Selector Tabs */}
          <div className="flex flex-wrap gap-2 pb-3 border-b border-slate-800">
            {Object.keys(CONTRACT_SOURCES).map((name) => (
              <button
                key={name}
                id={`select-contract-${name}`}
                onClick={() => setSelectedContract(name)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                  selectedContract === name
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          {currentInfo && (
            <div className="flex items-center justify-between text-xs bg-slate-950 p-3 rounded-2xl border border-slate-850">
              <div>
                <div className="font-bold text-white">{currentInfo.name}</div>
                <div className="text-[11px] text-slate-400">{currentInfo.description}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-500">Address</div>
                <div className="font-mono text-amber-400 text-[11px]">{currentInfo.address}</div>
              </div>
            </div>
          )}

          {/* Code Container */}
          <div className="relative bg-slate-950 rounded-2xl p-4 border border-slate-800 font-mono text-xs text-amber-300/90 overflow-x-auto max-h-[380px]">
            <button
              onClick={copyCode}
              className="absolute top-3 right-3 p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-400 rounded-lg transition-colors"
              title="Copy Solidity Source"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <pre>{sourceCode}</pre>
          </div>
        </div>

        {/* Right Live On-Chain Event Stream */}
        <div className="md:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400 animate-pulse" /> Live Event Stream
            </h3>
            <span className="text-[10px] font-mono text-slate-500">{events.length} Events Logged</span>
          </div>

          <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
            {events.length > 0 ? (
              events.map((evt) => (
                <div
                  key={evt.id}
                  className="bg-slate-950 p-3 rounded-2xl border border-slate-850 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-amber-400 font-bold">{evt.contractName}</span>
                    <span className="text-[10px] text-emerald-400 font-semibold">{evt.eventName}</span>
                  </div>

                  <div className="bg-slate-900 p-2 rounded-xl text-[10px] font-mono text-slate-300 overflow-x-auto">
                    {JSON.stringify(evt.args)}
                  </div>

                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 pt-1">
                    <span>Block #{evt.blockNumber}</span>
                    <span>{evt.txHash.slice(0, 10)}...</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500 text-center py-8">No on-chain events logged yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
