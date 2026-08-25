import React, { useState } from 'react';
import {
  Layers,
  Copy,
  Check,
  Code2,
  FileJson,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Coins
} from 'lucide-react';

const ABCD_TOKEN_ABI = [
  {
    "type": "constructor",
    "inputs": [
      { "name": "founderWallet_", "type": "address", "internalType": "address" },
      { "name": "icoWallet_", "type": "address", "internalType": "address" },
      { "name": "marketingWallet_", "type": "address", "internalType": "address" },
      { "name": "financeWallet_", "type": "address", "internalType": "address" },
      { "name": "advisorWallet_", "type": "address", "internalType": "address" },
      { "name": "reserveWallet_", "type": "address", "internalType": "address" },
      { "name": "contingencyWallet_", "type": "address", "internalType": "address" }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "mint",
    "inputs": [
      { "name": "to", "type": "address", "internalType": "address" },
      { "name": "amount", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "burnFromTreasury",
    "inputs": [
      { "name": "amount", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "pause",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "unpause",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setTreasury",
    "inputs": [
      { "name": "newTreasury", "type": "address", "internalType": "address" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "updateWallets",
    "inputs": [
      { "name": "founderWallet_", "type": "address", "internalType": "address" },
      { "name": "icoWallet_", "type": "address", "internalType": "address" },
      { "name": "marketingWallet_", "type": "address", "internalType": "address" },
      { "name": "financeWallet_", "type": "address", "internalType": "address" },
      { "name": "advisorWallet_", "type": "address", "internalType": "address" },
      { "name": "reserveWallet_", "type": "address", "internalType": "address" },
      { "name": "contingencyWallet_", "type": "address", "internalType": "address" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "rescueERC20",
    "inputs": [
      { "name": "token", "type": "address", "internalType": "address" },
      { "name": "to", "type": "address", "internalType": "address" },
      { "name": "amount", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "rescueETH",
    "inputs": [
      { "name": "to", "type": "address", "internalType": "address" },
      { "name": "amount", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "treasury",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "maxSupply",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  }
];

const EXAMPLE_ICO_INTEGRATION_CODE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IABCDToken.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ABCDeFi ICO Contract Example
 * @notice Demonstrates how ecosystem contracts import and interact with IABCDToken.
 */
contract ICO is Ownable {
    IABCDToken public immutable abcdToken;
    uint256 public constant TOKEN_PRICE = 0.001 ether; // 1 ABCD = 0.001 ETH

    event TokensPurchased(address indexed buyer, uint256 ethAmount, uint256 tokenAmount);

    constructor(address abcdTokenAddress_) Ownable(msg.sender) {
        require(abcdTokenAddress_ != address(0), "Invalid token address");
        abcdToken = IABCDToken(abcdTokenAddress_);
    }

    /**
     * @notice Allows users to buy pre-minted ABCD tokens allocated to the ICO wallet.
     */
    function buyTokens(uint256 tokenAmount) external payable {
        uint256 requiredETH = (tokenAmount * TOKEN_PRICE) / 10**18;
        require(msg.value >= requiredETH, "Insufficient ETH sent");

        // Option A: Transfer from pre-minted ICO wallet balance (requires allowance)
        // abcdToken.transferFrom(icoWallet, msg.sender, tokenAmount);

        // Option B: If ICO contract holds MINTER_ROLE on ABCDToken
        abcdToken.mint(msg.sender, tokenAmount);

        emit TokensPurchased(msg.sender, msg.value, tokenAmount);
    }
}`;

export const EcosystemIntegration: React.FC = () => {
  const [copiedAbi, setCopiedAbi] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const handleCopyAbi = () => {
    navigator.clipboard.writeText(JSON.stringify(ABCD_TOKEN_ABI, null, 2));
    setCopiedAbi(true);
    setTimeout(() => setCopiedAbi(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(EXAMPLE_ICO_INTEGRATION_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mt-0.5">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#F0F6FC] flex items-center gap-2">
                Ecosystem Integration Hub & Interface Contract Rules
              </h2>
              <p className="text-xs text-[#8B949E] mt-1 max-w-3xl leading-relaxed">
                Other ABCDeFi contracts (ICO, VestingVault, Referral, LendingPool, Staking) depend strictly on <code className="text-indigo-300 bg-[#0D1117] border border-[#30363D] px-1 py-0.5 rounded font-mono">IABCDToken.sol</code>.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Integration Workflow Steps */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-[#F0F6FC] uppercase tracking-wider font-mono flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-400" />
          Standard Integration Workflow (For Next Modules)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-[#0D1117] p-4 rounded-xl border border-[#30363D] space-y-2">
            <div className="flex items-center space-x-2 text-indigo-400 font-bold font-mono">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-[10px]">1</span>
              <span>Deploy New Contract</span>
            </div>
            <p className="text-[#8B949E] text-[11px] leading-relaxed">
              Deploy <code className="text-[#F0F6FC]">ICO.sol</code> or <code className="text-[#F0F6FC]">VestingVault.sol</code> passing the deployed <code className="text-indigo-300">ABCDToken</code> contract address to constructor.
            </p>
          </div>

          <div className="bg-[#0D1117] p-4 rounded-xl border border-[#30363D] space-y-2">
            <div className="flex items-center space-x-2 text-purple-400 font-bold font-mono">
              <span className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-[10px]">2</span>
              <span>Grant Role Privileges</span>
            </div>
            <p className="text-[#8B949E] text-[11px] leading-relaxed">
              Call <code className="text-purple-300">grantRole(MINTER_ROLE, newContractAddress)</code> from an admin account if that contract needs minting power.
            </p>
          </div>

          <div className="bg-[#0D1117] p-4 rounded-xl border border-[#30363D] space-y-2">
            <div className="flex items-center space-x-2 text-[#3FB950] font-bold font-mono">
              <span className="w-5 h-5 rounded-full bg-[#23863622] border border-[#238636] flex items-center justify-center text-[10px]">3</span>
              <span>Interact via IABCDToken</span>
            </div>
            <p className="text-[#8B949E] text-[11px] leading-relaxed">
              Call mint(), transferFrom(), or burnFromTreasury() using clean interface abstractions.
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Solidity Integration Example */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#F0F6FC] uppercase tracking-wider font-mono flex items-center gap-2">
              <Code2 className="w-4 h-4 text-indigo-400" />
              Example: ICO.sol Integration Code
            </h3>

            <button
              onClick={handleCopyCode}
              className="bg-[#0D1117] hover:bg-[#21262d] border border-[#30363D] text-[#F0F6FC] text-xs px-2.5 py-1 rounded-lg flex items-center space-x-1 transition-colors cursor-pointer font-mono"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-[#3FB950]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
            </button>
          </div>

          <pre className="bg-[#0D1117] p-4 rounded-xl border border-[#30363D] text-[11px] text-[#E2E8F0] font-mono overflow-x-auto h-[380px] leading-relaxed scrollbar-thin scrollbar-thumb-[#30363D]">
            {EXAMPLE_ICO_INTEGRATION_CODE}
          </pre>
        </div>

        {/* Contract ABI Inspector */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#F0F6FC] uppercase tracking-wider font-mono flex items-center gap-2">
              <FileJson className="w-4 h-4 text-[#3FB950]" />
              ABCDToken.json ABI Interface
            </h3>

            <button
              onClick={handleCopyAbi}
              className="bg-[#0D1117] hover:bg-[#21262d] border border-[#30363D] text-[#F0F6FC] text-xs px-2.5 py-1 rounded-lg flex items-center space-x-1 transition-colors cursor-pointer font-mono"
            >
              {copiedAbi ? <Check className="w-3.5 h-3.5 text-[#3FB950]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAbi ? 'Copied' : 'Copy ABI'}</span>
            </button>
          </div>

          <pre className="bg-[#0D1117] p-4 rounded-xl border border-[#30363D] text-[11px] text-[#E2E8F0] font-mono overflow-x-auto h-[380px] leading-relaxed scrollbar-thin scrollbar-thumb-[#30363D]">
            {JSON.stringify(ABCD_TOKEN_ABI, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};
