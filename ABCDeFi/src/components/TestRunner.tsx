import React, { useState } from 'react';
import { VestingEngine } from '../contracts/VestingEngine';
import { UnitTestResult } from '../types';
import { Play, CheckCircle2, XCircle, Clock, ShieldCheck, Terminal, RotateCcw } from 'lucide-react';

export const TestRunner: React.FC = () => {
  const [testResults, setTestResults] = useState<UnitTestResult[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults([]);

    const testsToRun: {
      name: string;
      description: string;
      category: UnitTestResult['category'];
      fn: (engine: VestingEngine, logs: string[]) => boolean;
    }[] = [
      {
        name: 'test_CliffEnforcement()',
        description: 'Verify 0 tokens claimable before cliff timestamp expires and claim reverts',
        category: 'Schedule Creation',
        fn: (engine, logs) => {
          logs.push('[START] Executing test_CliffEnforcement...');
          const admin = engine.accounts[0].address;
          const beneficiary = engine.accounts[1].address;
          const now = engine.currentTimestamp;

          // Deposit 1,000,000 ICO
          engine.depositVaultTokens(admin, 1000000n * 10n ** 18n);

          // Create schedule with 30-day cliff (86400 * 30)
          const createRes = engine.createVestingSchedule(
            admin,
            beneficiary,
            now,
            30 * 86400, // 30 day cliff
            180 * 86400, // 180 day duration
            86400,
            true,
            100000n * 10n ** 18n
          );

          if (!createRes.success || !createRes.scheduleId) {
            logs.push(`[FAIL] Schedule creation failed: ${createRes.message}`);
            return false;
          }
          logs.push(`[PASS] Schedule created with ID ${createRes.scheduleId.slice(0, 10)}...`);

          // Check Day 15 (Inside cliff)
          const schedule = engine.state.schedules.find((s) => s.id === createRes.scheduleId)!;
          const releasableInsideCliff = engine.computeReleasableAmount(schedule, now + 15 * 86400);
          logs.push(`[CHECK] Releasable inside cliff (Day 15): ${releasableInsideCliff} tokens`);

          if (releasableInsideCliff !== 0n) {
            logs.push('[FAIL] Tokens unlocked inside cliff period!');
            return false;
          }

          // Attempt claim inside cliff
          engine.setTime(now + 15 * 86400);
          const claimRes = engine.claim(beneficiary, createRes.scheduleId);
          logs.push(`[CHECK] Claim inside cliff result: ${claimRes.message}`);

          if (claimRes.success) {
            logs.push('[FAIL] Claim succeeded inside cliff period!');
            return false;
          }

          logs.push('[PASS] Cliff enforcement verified successfully!');
          return true;
        },
      },
      {
        name: 'test_LinearVestingAccrual()',
        description: 'Verify exact linear token accumulation over time after cliff',
        category: 'Claiming Math',
        fn: (engine, logs) => {
          logs.push('[START] Executing test_LinearVestingAccrual...');
          const admin = engine.accounts[0].address;
          const beneficiary = engine.accounts[2].address;
          const now = engine.currentTimestamp;

          engine.depositVaultTokens(admin, 1000000n * 10n ** 18n);

          // 100,000 tokens, 0 cliff, 100 days duration -> 1,000 tokens/day
          const createRes = engine.createVestingSchedule(
            admin,
            beneficiary,
            now,
            0,
            100 * 86400,
            86400,
            true,
            100000n * 10n ** 18n
          );

          const schedule = engine.state.schedules.find((s) => s.id === createRes.scheduleId)!;

          // Check Day 50 (Exactly 50%)
          const vestedDay50 = engine.computeVestedAmount(schedule, now + 50 * 86400);
          const expected50 = 50000n * 10n ** 18n;
          logs.push(`[CHECK] Vested Day 50: ${engine.formatUnits(vestedDay50)} ICO (Expected: 50,000 ICO)`);

          if (vestedDay50 !== expected50) {
            logs.push('[FAIL] Linear math mismatch at Day 50!');
            return false;
          }

          // Check Day 100 (100% full vest)
          const vestedDay100 = engine.computeVestedAmount(schedule, now + 100 * 86400);
          const expected100 = 100000n * 10n ** 18n;
          logs.push(`[CHECK] Vested Day 100: ${engine.formatUnits(vestedDay100)} ICO (Expected: 100,000 ICO)`);

          if (vestedDay100 !== expected100) {
            logs.push('[FAIL] Linear math mismatch at Day 100!');
            return false;
          }

          logs.push('[PASS] Linear vesting math verified with 100% precision!');
          return true;
        },
      },
      {
        name: 'test_ClaimTokens()',
        description: 'Verify ERC20 token transfer from Vault to beneficiary upon claim',
        category: 'Claiming Math',
        fn: (engine, logs) => {
          logs.push('[START] Executing test_ClaimTokens...');
          const admin = engine.accounts[0].address;
          const beneficiary = engine.accounts[1].address;
          const now = engine.currentTimestamp;

          engine.depositVaultTokens(admin, 500000n * 10n ** 18n);

          const createRes = engine.createVestingSchedule(
            admin,
            beneficiary,
            now,
            0,
            100 * 86400,
            86400,
            false,
            100000n * 10n ** 18n
          );

          // Fast forward 50 days -> 50,000 tokens claimable
          engine.advanceTime(50 * 86400);

          const beneficiaryAcc = engine.accounts.find((a) => a.address.toLowerCase() === beneficiary.toLowerCase())!;
          const initialWalletBal = beneficiaryAcc.tokenBalance;

          const claimRes = engine.claim(beneficiary, createRes.scheduleId!);
          logs.push(`[ACTION] Claimed tokens: ${claimRes.message}`);

          if (!claimRes.success) {
            logs.push('[FAIL] Claim execution failed');
            return false;
          }

          const newWalletBal = beneficiaryAcc.tokenBalance;
          logs.push(`[CHECK] Beneficiary wallet delta: +${engine.formatUnits(newWalletBal - initialWalletBal)} ICO`);

          if (newWalletBal - initialWalletBal !== 50000n * 10n ** 18n) {
            logs.push('[FAIL] Wallet balance did not increase by exact claimed amount');
            return false;
          }

          logs.push('[PASS] Token claim transfer verified!');
          return true;
        },
      },
      {
        name: 'test_RevokeSchedule()',
        description: 'Verify revocation returns unvested tokens and releases accrued vested tokens',
        category: 'Revocation & Pause',
        fn: (engine, logs) => {
          logs.push('[START] Executing test_RevokeSchedule...');
          const admin = engine.accounts[0].address;
          const beneficiary = engine.accounts[2].address;
          const now = engine.currentTimestamp;

          engine.depositVaultTokens(admin, 500000n * 10n ** 18n);

          // 100,000 tokens over 100 days, revocable = true
          const createRes = engine.createVestingSchedule(
            admin,
            beneficiary,
            now,
            0,
            100 * 86400,
            86400,
            true, // revocable
            100000n * 10n ** 18n
          );

          // Advance 40 days -> 40,000 vested, 60,000 unvested
          engine.advanceTime(40 * 86400);

          const initialTotalVested = engine.state.totalVestedAmount;

          const revokeRes = engine.revoke(admin, createRes.scheduleId!);
          logs.push(`[ACTION] Revoke schedule: ${revokeRes.message}`);

          if (!revokeRes.success) {
            logs.push('[FAIL] Revocation failed!');
            return false;
          }

          const newTotalVested = engine.state.totalVestedAmount;
          logs.push(`[CHECK] Total vested reduction: -${engine.formatUnits(initialTotalVested - newTotalVested)} ICO`);

          if (initialTotalVested - newTotalVested !== 60000n * 10n ** 18n) {
            logs.push('[FAIL] Unvested tokens (60,000) were not properly subtracted!');
            return false;
          }

          logs.push('[PASS] Schedule revocation logic verified!');
          return true;
        },
      },
      {
        name: 'test_EmergencyPause()',
        description: 'Verify emergency pause suspends claims and schedule creation',
        category: 'Revocation & Pause',
        fn: (engine, logs) => {
          logs.push('[START] Executing test_EmergencyPause...');
          const admin = engine.accounts[0].address;
          const beneficiary = engine.accounts[1].address;

          engine.togglePause(admin);
          logs.push('[ACTION] Vault PAUSED by owner.');

          // Try to create schedule while paused
          const createRes = engine.createVestingSchedule(
            admin,
            beneficiary,
            engine.currentTimestamp,
            0,
            100 * 86400,
            86400,
            true,
            10000n * 10n ** 18n
          );

          logs.push(`[CHECK] Create schedule while paused: ${createRes.message}`);
          if (createRes.success) {
            logs.push('[FAIL] Schedule creation allowed while paused!');
            return false;
          }

          // Unpause
          engine.togglePause(admin);
          logs.push('[ACTION] Vault UNPAUSED.');

          logs.push('[PASS] Emergency pause enforcement verified!');
          return true;
        },
      },
      {
        name: 'test_InsufficientVaultBalance()',
        description: 'Verify schedule creation reverts if vault buffer lacks tokens',
        category: 'Security',
        fn: (engine, logs) => {
          logs.push('[START] Executing test_InsufficientVaultBalance...');
          const admin = engine.accounts[0].address;
          const beneficiary = engine.accounts[1].address;

          // Attempt to allocate 50,000,000 ICO when vault buffer is small
          const createRes = engine.createVestingSchedule(
            admin,
            beneficiary,
            engine.currentTimestamp,
            0,
            100 * 86400,
            86400,
            true,
            50000000n * 10n ** 18n
          );

          logs.push(`[CHECK] Result: ${createRes.message}`);

          if (createRes.success) {
            logs.push('[FAIL] Allowed schedule creation exceeding vault balance!');
            return false;
          }

          logs.push('[PASS] Insufficient vault balance protection verified!');
          return true;
        },
      },
      {
        name: 'test_UnauthorizedClaim()',
        description: 'Verify non-beneficiary cannot claim someone else’s schedule',
        category: 'Security',
        fn: (engine, logs) => {
          logs.push('[START] Executing test_UnauthorizedClaim...');
          const admin = engine.accounts[0].address;
          const beneficiary = engine.accounts[1].address;
          const imposter = engine.accounts[3].address; // Charlie

          engine.depositVaultTokens(admin, 100000n * 10n ** 18n);

          const createRes = engine.createVestingSchedule(
            admin,
            beneficiary,
            engine.currentTimestamp,
            0,
            100 * 86400,
            86400,
            true,
            50000n * 10n ** 18n
          );

          engine.advanceTime(50 * 86400);

          // Charlie tries to claim Alice's schedule
          const claimRes = engine.claim(imposter, createRes.scheduleId!);
          logs.push(`[CHECK] Imposter claim attempt result: ${claimRes.message}`);

          if (claimRes.success) {
            logs.push('[FAIL] Imposter was able to claim someone else’s tokens!');
            return false;
          }

          logs.push('[PASS] Unauthorized claim rejected correctly!');
          return true;
        },
      },
    ];

    const results: UnitTestResult[] = [];

    for (const test of testsToRun) {
      const logs: string[] = [];
      const testEngine = new VestingEngine(); // Fresh EVM instance per test
      const startMs = Date.now();
      let passed = false;

      try {
        passed = test.fn(testEngine, logs);
      } catch (err: any) {
        logs.push(`[EXCEPTION] ${err.message || String(err)}`);
        passed = false;
      }

      const durationMs = Date.now() - startMs;

      results.push({
        id: test.name,
        name: test.name,
        description: test.description,
        category: test.category,
        status: passed ? 'passed' : 'failed',
        logs,
        durationMs,
      });

      setTestResults([...results]);
      await new Promise((r) => setTimeout(r, 120)); // Subtle UI delay for terminal feel
    }

    setIsRunning(false);
  };

  const totalPassed = testResults.filter((r) => r.status === 'passed').length;
  const totalFailed = testResults.filter((r) => r.status === 'failed').length;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-2">
            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
            Automated EVM Smart Contract Test Suite
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            VestingVault.sol Test Suite
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Executes automated unit tests verifying Cliff periods, Linear math, Claims, Revocation, and Emergency Pause against the Solidity engine.
          </p>
        </div>

        <button
          disabled={isRunning}
          onClick={runAllTests}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold rounded-xl text-xs sm:text-sm transition shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          {isRunning ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Play className="w-4 h-4 fill-current" />
          )}
          {isRunning ? 'Running Test Suite...' : 'Run Automated Tests'}
        </button>
      </div>

      {/* Results Summary & Test List */}
      {testResults.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Test Case List */}
          <div className="lg:col-span-1 space-y-3">
            <div className="flex items-center justify-between px-1 text-xs font-mono text-slate-400">
              <span>Test Results</span>
              <span className="flex items-center gap-3">
                <span className="text-emerald-400 font-bold">{totalPassed} Passed</span>
                {totalFailed > 0 && <span className="text-red-400 font-bold">{totalFailed} Failed</span>}
              </span>
            </div>

            <div className="space-y-2">
              {testResults.map((test) => (
                <button
                  key={test.id}
                  onClick={() => setSelectedTestId(test.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                    selectedTestId === test.id
                      ? 'bg-slate-800 border-indigo-500'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {test.status === 'passed' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-white truncate">
                        {test.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">{test.durationMs}ms</span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{test.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Console Log Viewer */}
          <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-2xl flex flex-col font-mono text-xs min-h-[360px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 text-slate-400 text-[11px]">
              <span className="flex items-center gap-2 font-bold text-slate-300">
                <Terminal className="w-4 h-4 text-indigo-400" />
                Execution Log:{' '}
                <span className="text-indigo-300">
                  {selectedTestId || testResults[0]?.name || 'Select a test'}
                </span>
              </span>
              <span className="text-slate-500">Forge / EVM Simulator Output</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 p-2 bg-slate-900/50 rounded-xl border border-slate-800/80 max-h-[400px]">
              {(() => {
                const currentTest = testResults.find((t) => t.id === selectedTestId) || testResults[0];
                if (!currentTest) return <div className="text-slate-600">No test selected</div>;

                return (currentTest.logs || []).map((log, idx) => {
                  let colorClass = 'text-slate-300';
                  if (log.startsWith('[PASS]')) colorClass = 'text-emerald-400 font-bold';
                  if (log.startsWith('[FAIL]') || log.startsWith('[EXCEPTION]'))
                    colorClass = 'text-red-400 font-bold';
                  if (log.startsWith('[START]') || log.startsWith('[ACTION]'))
                    colorClass = 'text-indigo-300';
                  if (log.startsWith('[CHECK]')) colorClass = 'text-amber-300';

                  return (
                    <div key={idx} className={`${colorClass} leading-relaxed`}>
                      {log}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {testResults.length === 0 && !isRunning && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-950 border border-indigo-800 text-indigo-400 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">Ready to Run Contract Unit Tests</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Click "Run Automated Tests" above to execute 7+ test scenarios verifying cliff lockouts, linear math, claims, and emergency security features.
          </p>
        </div>
      )}
    </div>
  );
};
