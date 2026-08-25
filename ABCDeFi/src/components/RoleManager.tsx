import React, { useState } from 'react';
import { RoleInfo } from '../types';
import {
  Lock,
  Shield,
  UserPlus,
  UserMinus,
  Flame,
  PauseCircle,
  PlayCircle,
  Building,
  CheckCircle2,
  AlertTriangle,
  Key,
  Info
} from 'lucide-react';

const INITIAL_ROLES: RoleInfo[] = [
  {
    name: 'MINTER_ROLE',
    roleHash: '0x9f2fd0159200610812269f5d657005a00119600408613b09101c453d938f47d1',
    description: 'Can call mint(to, amount) up to MAX_SUPPLY cap (1,000,000,000 ABCD). Assigned to ICO contract post-deploy.',
    holders: ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (Deployer)'],
  },
  {
    name: 'BURNER_ROLE',
    roleHash: '0x3c11d1632366031f8696b322e7240360824b2f2d93e1f0e21a8f921f9df88a29',
    description: 'Can call burnFromTreasury(amount) to burn tokens from active treasury wallet balance.',
    holders: ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (Deployer)'],
  },
  {
    name: 'TREASURY_ROLE',
    roleHash: '0xaf433989e24a7321e17d23d8c199580b85eb24a7139158428800e2632205e468',
    description: 'Held automatically by the active treasury address. Reassigned via setTreasury().',
    holders: ['0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 (Finance Wallet)'],
  },
  {
    name: 'PAUSER_ROLE',
    roleHash: '0x65d755e5eceac84826d3d7075c62d0577a412852eb889420dd0e515d01f919d3',
    description: 'Can call pause() and unpause() to halt or resume all token transfers in emergencies.',
    holders: ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (Deployer)'],
  },
  {
    name: 'DEFAULT_ADMIN_ROLE',
    roleHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    description: 'High-level admin role capable of granting and revoking operational roles.',
    holders: ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (Deployer)'],
  },
];

interface RoleManagerProps {
  isPaused: boolean;
  setIsPaused: (paused: boolean) => void;
  treasuryAddress: string;
  setTreasuryAddress: (addr: string) => void;
  onBurnFromTreasury: (amountM: number) => void;
}

export const RoleManager: React.FC<RoleManagerProps> = ({
  isPaused,
  setIsPaused,
  treasuryAddress,
  setTreasuryAddress,
  onBurnFromTreasury,
}) => {
  const [roles, setRoles] = useState<RoleInfo[]>(INITIAL_ROLES);
  const [targetRole, setTargetRole] = useState<string>('MINTER_ROLE');
  const [grantAddress, setGrantAddress] = useState<string>('');
  const [burnAmountM, setBurnAmountM] = useState<string>('5');
  const [newTreasuryInput, setNewTreasuryInput] = useState<string>('');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3500);
  };

  const handleGrantRole = () => {
    if (!grantAddress || !grantAddress.startsWith('0x') || grantAddress.length !== 42) {
      showFeedback('❌ Please enter a valid 42-character Ethereum address (0x...).');
      return;
    }

    setRoles((prev) =>
      prev.map((r) => {
        if (r.name === targetRole) {
          if (r.holders.includes(grantAddress)) return r;
          return { ...r, holders: [...r.holders, grantAddress] };
        }
        return r;
      })
    );

    showFeedback(`✔ Granted ${targetRole} to ${grantAddress.slice(0, 8)}...${grantAddress.slice(-6)}`);
    setGrantAddress('');
  };

  const handleRevokeRole = (roleName: string, address: string) => {
    setRoles((prev) =>
      prev.map((r) => {
        if (r.name === roleName) {
          return { ...r, holders: r.holders.filter((h) => h !== address) };
        }
        return r;
      })
    );
    showFeedback(`✔ Revoked ${roleName} from ${address.slice(0, 8)}...`);
  };

  const handleTogglePause = () => {
    setIsPaused(!isPaused);
    showFeedback(`✔ Contract pause status toggled to: ${!isPaused ? 'PAUSED' : 'UNPAUSED'}`);
  };

  const handleSetTreasury = () => {
    if (!newTreasuryInput || !newTreasuryInput.startsWith('0x') || newTreasuryInput.length !== 42) {
      showFeedback('❌ Please enter a valid 42-character treasury address.');
      return;
    }

    const oldTreasury = treasuryAddress;
    setTreasuryAddress(newTreasuryInput);

    // Update TREASURY_ROLE holder list
    setRoles((prev) =>
      prev.map((r) => {
        if (r.name === 'TREASURY_ROLE') {
          return {
            ...r,
            holders: [newTreasuryInput],
          };
        }
        return r;
      })
    );

    showFeedback(`✔ Treasury updated from ${oldTreasury.slice(0, 8)}... to ${newTreasuryInput.slice(0, 8)}...`);
    setNewTreasuryInput('');
  };

  const handleBurnTreasuryTokens = () => {
    const amount = parseFloat(burnAmountM);
    if (isNaN(amount) || amount <= 0) {
      showFeedback('❌ Invalid burn amount.');
      return;
    }

    onBurnFromTreasury(amount);
    showFeedback(`🔥 Successfully burned ${amount.toLocaleString()}M ABCD tokens from Treasury!`);
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mt-0.5">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#F0F6FC] flex items-center gap-2">
                AccessControl Role Management & Treasury Governance
              </h2>
              <p className="text-xs text-[#8B949E] mt-1 max-w-3xl leading-relaxed">
                ABCDToken separates administrative privileges into discrete role hashes. Assign MINTER_ROLE to the ICO contract, BURNER_ROLE for supply deflation, and PAUSER_ROLE for emergency halts.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleTogglePause}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all cursor-pointer shadow-lg font-mono ${
                isPaused
                  ? 'bg-[#23863622] text-[#3FB950] border border-[#238636]'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              }`}
            >
              {isPaused ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
              <span>{isPaused ? 'Unpause Contract' : 'Pause Contract (Emergency)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roles List */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-bold text-[#F0F6FC] uppercase tracking-wider font-mono flex items-center gap-2">
            <Key className="w-4 h-4 text-indigo-400" />
            Active Role Definitions & Holders
          </h3>

          <div className="space-y-3">
            {roles.map((role) => (
              <div
                key={role.name}
                className="bg-[#161B22] border border-[#30363D] rounded-2xl p-4 space-y-3 shadow-lg"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#30363D] pb-3">
                  <div>
                    <span className="text-xs font-bold text-indigo-300 font-mono">{role.name}</span>
                    <p className="text-[11px] text-[#8B949E] mt-0.5">{role.description}</p>
                  </div>
                  <span className="text-[10px] font-mono text-[#8B949E] bg-[#0D1117] px-2.5 py-1 rounded-lg border border-[#30363D] truncate max-w-[200px]">
                    {role.roleHash.slice(0, 16)}...
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-semibold text-[#8B949E] tracking-wider font-mono">
                    Role Holders ({role.holders.length})
                  </span>

                  {role.holders.length === 0 ? (
                    <div className="text-xs text-[#8B949E] italic">No active role holders assigned.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {role.holders.map((holder) => (
                        <div
                          key={holder}
                          className="bg-[#0D1117] px-3 py-2 rounded-xl border border-[#30363D] flex items-center justify-between text-xs font-mono"
                        >
                          <span className="text-[#E2E8F0] truncate max-w-[280px]">{holder}</span>
                          <button
                            onClick={() => handleRevokeRole(role.name, holder)}
                            className="text-red-400 hover:text-red-300 text-[11px] hover:bg-red-500/10 px-2 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <UserMinus className="w-3 h-3" />
                            <span>Revoke</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="space-y-6">
          {/* Grant Role Box */}
          <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 space-y-4 shadow-lg">
            <h3 className="text-xs font-bold text-[#F0F6FC] uppercase tracking-wider font-mono flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-indigo-400" />
              Grant AccessControl Role
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#8B949E] text-[11px] font-medium block mb-1">Target Role</label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl px-3 py-2 text-[#F0F6FC] outline-none focus:border-indigo-500 font-mono"
                >
                  <option value="MINTER_ROLE">MINTER_ROLE</option>
                  <option value="BURNER_ROLE">BURNER_ROLE</option>
                  <option value="PAUSER_ROLE">PAUSER_ROLE</option>
                  <option value="DEFAULT_ADMIN_ROLE">DEFAULT_ADMIN_ROLE</option>
                </select>
              </div>

              <div>
                <label className="text-[#8B949E] text-[11px] font-medium block mb-1">Ethereum Address</label>
                <input
                  type="text"
                  value={grantAddress}
                  onChange={(e) => setGrantAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl px-3 py-2 text-[#F0F6FC] outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <button
                onClick={handleGrantRole}
                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center space-x-2 transition-all cursor-pointer font-sans"
              >
                <UserPlus className="w-4 h-4" />
                <span>Grant Role</span>
              </button>
            </div>
          </div>

          {/* Reassign Treasury */}
          <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 space-y-4 shadow-lg">
            <h3 className="text-xs font-bold text-[#F0F6FC] uppercase tracking-wider font-mono flex items-center gap-2">
              <Building className="w-4 h-4 text-[#3FB950]" />
              Reassign Treasury Address
            </h3>

            <div className="bg-[#0D1117] p-2.5 rounded-xl border border-[#30363D] text-[11px] font-mono">
              <span className="text-[#8B949E]">Current Treasury:</span>
              <div className="text-[#3FB950] truncate mt-0.5 font-bold">{treasuryAddress}</div>
            </div>

            <div className="space-y-3 text-xs">
              <input
                type="text"
                value={newTreasuryInput}
                onChange={(e) => setNewTreasuryInput(e.target.value)}
                placeholder="New Treasury Address (0x...)"
                className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl px-3 py-2 text-[#F0F6FC] outline-none focus:border-indigo-500 font-mono"
              />

              <button
                onClick={handleSetTreasury}
                className="w-full bg-[#238636] hover:bg-[#2ea043] text-white font-semibold py-2 rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-2 transition-all cursor-pointer font-sans"
              >
                <Building className="w-4 h-4" />
                <span>Update setTreasury()</span>
              </button>
            </div>
          </div>

          {/* Burn From Treasury */}
          <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 space-y-4 shadow-lg">
            <h3 className="text-xs font-bold text-[#F0F6FC] uppercase tracking-wider font-mono flex items-center gap-2">
              <Flame className="w-4 h-4 text-red-400" />
              Burn Tokens From Treasury
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#8B949E] text-[11px] font-medium block mb-1">Burn Quantity (Millions ABCD)</label>
                <input
                  type="number"
                  value={burnAmountM}
                  onChange={(e) => setBurnAmountM(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl px-3 py-2 text-[#F0F6FC] outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <button
                onClick={handleBurnTreasuryTokens}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold py-2 rounded-xl shadow-lg shadow-red-600/20 flex items-center justify-center space-x-2 transition-all cursor-pointer font-sans"
              >
                <Flame className="w-4 h-4" />
                <span>Trigger burnFromTreasury()</span>
              </button>
            </div>
          </div>

          {/* Feedback message */}
          {actionFeedback && (
            <div
              className={`p-3 rounded-xl text-xs font-mono border ${
                actionFeedback.includes('✔') || actionFeedback.includes('🔥')
                  ? 'bg-[#23863622] border-[#238636] text-[#3FB950]'
                  : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}
            >
              {actionFeedback}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
