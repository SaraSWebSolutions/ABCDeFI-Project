import React, { useState } from 'react';
import {
  Terminal,
  Play,
  RotateCcw,
  Copy,
  Check,
  CheckCircle2,
  Sliders,
  Sparkles,
  Coins,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';

export const DeployScriptRunner: React.FC = () => {
  type TerminalLog = {
    timestamp: string;
    type: 'info' | 'success' | 'error';
    message: string;
  };
  const [founderEnv, setFounderEnv] = useState<string>('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
  const [icoEnv, setIcoEnv] = useState<string>('0x3C44CdD05aB506C37364311022137D2883494C6c');
  const [marketingEnv, setMarketingEnv] = useState<string>('0x90F79bf6EB2c4f808065364a7372990d11516e81');
  const [financeEnv, setFinanceEnv] = useState<string>('0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65');
  const [advisorEnv, setAdvisorEnv] = useState<string>('0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc');
  const [reserveEnv, setReserveEnv] = useState<string>('0x976EA74026E726554dB657fA54763abd0C3a0aa9');
  const [contingencyEnv, setContingencyEnv] = useState<string>('0x14dC79964da2C08b23698B3D3cc7Ca32193d9955');

  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);

  const [logs, setLogs] = useState<TerminalLog[]>([
    { timestamp: '00:00:00', type: 'info', message: 'Hardhat deployment environment idle.' },
    { timestamp: '00:00:01', type: 'info', message: 'Ready to execute scripts/deploy.ts' },
  ]);

  const generateCLICommand = () => {
    return `FOUNDER_WALLET=${founderEnv} \\
ICO_WALLET=${icoEnv} \\
MARKETING_WALLET=${marketingEnv} \\
FINANCE_WALLET=${financeEnv} \\
ADVISOR_WALLET=${advisorEnv} \\
RESERVE_WALLET=${reserveEnv} \\
CONTINGENCY_WALLET=${contingencyEnv} \\
npx hardhat run scripts/deploy.ts --network localhost`;
  };

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(generateCLICommand());
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleRunDeployment = async () => {
    setIsDeploying(true);
    setDeployedAddress(null);
    setLogs([]);

    const time = () => new Date().toLocaleTimeString();

    const addL = (type: TerminalLog['type'], message: string) => {
      setLogs((prev) => [...prev, { timestamp: time(), type, message }]);
    };

    addL('info', '==================================================');
    addL('info', '  ABCDToken Deployment Script — ABCDeFi Ecosystem  ');
    addL('info', '==================================================');

    await new Promise((res) => setTimeout(res, 400));
    addL('info', 'Resolving deployer signer from Hardhat provider...');
    addL('info', 'Deployer account: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    addL('info', 'Deployer ETH balance: 10000.0 ETH');

    await new Promise((res) => setTimeout(res, 500));
    addL('info', 'Reading ecosystem wallet configuration environment variables...');
    addL('info', `Founder Wallet (55%):     ${founderEnv}`);
    addL('info', `ICO Wallet (20%):         ${icoEnv}`);
    addL('info', `Marketing Wallet (10%):   ${marketingEnv}`);
    addL('info', `Finance Wallet (9%):     ${financeEnv}`);
    addL('info', `Advisor Wallet (2%):       ${advisorEnv}`);
    addL('info', `Reserve Wallet (2%):       ${reserveEnv}`);
    addL('info', `Contingency Wallet (2%):   ${contingencyEnv}`);

    await new Promise((res) => setTimeout(res, 600));
    addL('info', 'Compiling Solidity artifacts with solc 0.8.20 (optimizer runs=200)...');
    addL('info', 'Deploying contract bytecode to EVM...');

    await new Promise((res) => setTimeout(res, 700));
    const randomAddress = '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    setDeployedAddress(randomAddress);

    addL('success', `🎉 ABCDToken successfully deployed at address: ${randomAddress}`);
    addL('info', 'Transaction Hash: 0x8a7f92b... (Block #1240801)');
    addL('info', 'Gas Used: 2,845,120 wei');

    await new Promise((res) => setTimeout(res, 400));
    addL('info', '--- Token Metadata Verified ---');
    addL('info', 'Token Name:   ABCDeFi Core Token');
    addL('info', 'Symbol:       ABCD');
    addL('info', 'Decimals:     18');
    addL('info', 'Total Supply: 1,000,000,000 ABCD');
    addL('info', `Treasury:     ${financeEnv}`);

    addL('success', '--- Initial Allocations Minted ---');
    addL('info', 'Founder:     550,000,000 ABCD (55%)');
    addL('info', 'ICO:         200,000,000 ABCD (20%)');
    addL('info', 'Marketing:   100,000,000 ABCD (10%)');
    addL('info', 'Finance:     90,000,000 ABCD (9%)');
    addL('info', 'Advisor:     20,000,000 ABCD (2%)');
    addL('info', 'Reserve:     20,000,000 ABCD (2%)');
    addL('info', 'Contingency: 20,000,000 ABCD (2%)');

    addL('info', '==================================================');
    addL('success', '  Deployment completed successfully!              ');
    addL('info', '==================================================');

    setIsDeploying(false);
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mt-0.5">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#F0F6FC] flex items-center gap-2">
                Hardhat Deployment Script Simulator
                <span className="text-xs font-mono bg-[#0D1117] text-[#3FB950] border border-[#238636] px-2.5 py-0.5 rounded-full">
                  scripts/deploy.ts
                </span>
              </h2>
              <p className="text-xs text-[#8B949E] mt-1 max-w-3xl leading-relaxed">
                Configure wallet environment variables, preview the CLI command string, and execute simulated deployments on local or remote EVM testnets.
              </p>
            </div>
          </div>

          <button
            onClick={handleRunDeployment}
            disabled={isDeploying}
            className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-500/20 flex items-center space-x-2 transition-all cursor-pointer shrink-0 font-mono"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{isDeploying ? 'Deploying...' : 'Run Deployment Script'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Environment Variable Configurator */}
        <div className="space-y-4">
          <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-[#F0F6FC] uppercase tracking-wider font-mono flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              Environment Variables (Wallet Addresses)
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#8B949E] text-[11px] font-mono block mb-1">FOUNDER_WALLET (55%)</label>
                <input
                  type="text"
                  value={founderEnv}
                  onChange={(e) => setFounderEnv(e.target.value)}
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl px-3 py-1.5 text-[#F0F6FC] font-mono text-[11px] outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[#8B949E] text-[11px] font-mono block mb-1">ICO_WALLET (20%)</label>
                <input
                  type="text"
                  value={icoEnv}
                  onChange={(e) => setIcoEnv(e.target.value)}
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl px-3 py-1.5 text-[#F0F6FC] font-mono text-[11px] outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[#8B949E] text-[11px] font-mono block mb-1">MARKETING_WALLET (10%)</label>
                <input
                  type="text"
                  value={marketingEnv}
                  onChange={(e) => setMarketingEnv(e.target.value)}
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl px-3 py-1.5 text-[#F0F6FC] font-mono text-[11px] outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[#8B949E] text-[11px] font-mono block mb-1">FINANCE_WALLET (9% Treasury)</label>
                <input
                  type="text"
                  value={financeEnv}
                  onChange={(e) => setFinanceEnv(e.target.value)}
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl px-3 py-1.5 text-[#F0F6FC] font-mono text-[11px] outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[#8B949E] text-[11px] font-mono block mb-1">ADVISOR_WALLET (2%)</label>
                <input
                  type="text"
                  value={advisorEnv}
                  onChange={(e) => setAdvisorEnv(e.target.value)}
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl px-3 py-1.5 text-[#F0F6FC] font-mono text-[11px] outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[#8B949E] text-[11px] font-mono block mb-1">RESERVE_WALLET (2%)</label>
                <input
                  type="text"
                  value={reserveEnv}
                  onChange={(e) => setReserveEnv(e.target.value)}
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl px-3 py-1.5 text-[#F0F6FC] font-mono text-[11px] outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[#8B949E] text-[11px] font-mono block mb-1">CONTINGENCY_WALLET (2%)</label>
                <input
                  type="text"
                  value={contingencyEnv}
                  onChange={(e) => setContingencyEnv(e.target.value)}
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl px-3 py-1.5 text-[#F0F6FC] font-mono text-[11px] outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Copyable CLI Command Box */}
          <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#F0F6FC] font-mono">CLI Command Line</span>
              <button
                onClick={handleCopyCommand}
                className="text-indigo-400 hover:text-indigo-300 text-[11px] flex items-center space-x-1 cursor-pointer font-mono"
              >
                {copiedCmd ? <Check className="w-3.5 h-3.5 text-[#3FB950]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCmd ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <pre className="bg-[#0D1117] p-3 rounded-xl border border-[#30363D] text-[10px] text-[#E2E8F0] font-mono overflow-x-auto leading-relaxed">
              {generateCLICommand()}
            </pre>
          </div>
        </div>

        {/* Live Terminal Output */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-semibold text-[#F0F6FC] flex items-center gap-2 font-mono">
              <Terminal className="w-4 h-4 text-indigo-400" />
              Hardhat CLI Deployment Output
            </span>

            {deployedAddress && (
              <span className="bg-[#23863622] text-[#3FB950] border border-[#238636] px-2.5 py-0.5 rounded-full font-mono text-[11px]">
                Deployed: {deployedAddress.slice(0, 10)}...
              </span>
            )}
          </div>

          <div className="bg-[#0D1117] border border-[#30363D] rounded-2xl p-4 font-mono text-xs h-[560px] overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-[#30363D] shadow-2xl">
            {logs.map((log, idx) => (
              <div
                key={idx}
                className={`leading-relaxed ${
                  log.type === 'success'
                    ? 'text-[#3FB950] font-semibold'
                    : log.message.includes('===')
                    ? 'text-indigo-300 font-bold'
                    : 'text-[#8B949E]'
                }`}
              >
                <span className="text-[#8B949E]/60 text-[10px] mr-2">[{log.timestamp}]</span>
                {log.message}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
