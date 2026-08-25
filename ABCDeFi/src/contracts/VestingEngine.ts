import { VestingSchedule, UserAccount, ContractState, TxLog } from '../types';

export const INITIAL_ACCOUNTS: UserAccount[] = [
  {
    address: '0x1111111111111111111111111111111111111111',
    label: 'Admin (Deployer / Vault Owner)',
    role: 'admin',
    tokenBalance: 8000000n * 10n ** 18n, // 8,000,000 ICO
  },
  {
    address: '0x2222222222222222222222222222222222222222',
    label: 'Alice (Seed Investor)',
    role: 'beneficiary',
    tokenBalance: 0n,
  },
  {
    address: '0x3333333333333333333333333333333333333333',
    label: 'Bob (Core Contributor)',
    role: 'beneficiary',
    tokenBalance: 0n,
  },
  {
    address: '0x4444444444444444444444444444444444444444',
    label: 'Charlie (Community Member)',
    role: 'user',
    tokenBalance: 1000n * 10n ** 18n,
  },
];

export class VestingEngine {
  public currentTimestamp: number;
  public state: ContractState;
  public accounts: UserAccount[];
  public txLogs: TxLog[];

  constructor() {
    // Current timestamp in seconds
    this.currentTimestamp = Math.floor(Date.now() / 1000);
    this.accounts = [...INITIAL_ACCOUNTS];
    this.txLogs = [];

    this.state = {
      vaultAddress: '0xVaultContract00000000000000000000000',
      tokenAddress: '0xICOTokenContract00000000000000000000',
      tokenSymbol: 'ICO',
      tokenName: 'ICO Token',
      tokenDecimals: 18,
      paused: false,
      owner: INITIAL_ACCOUNTS[0].address,
      vaultTokenBalance: 2000000n * 10n ** 18n, // 2,000,000 ICO deposited initially
      schedules: [],
      totalVestedAmount: 0n,
      totalReleasedAmount: 0n,
    };

    // Seed default sample vesting schedules
    this.seedDefaultSchedules();
  }

  private seedDefaultSchedules() {
    const now = this.currentTimestamp;
    const day = 86400;

    // Schedule 1 for Alice: 500,000 tokens, 30 day cliff, 180 day total duration, 1 day slice, revocable
    const schedule1: VestingSchedule = {
      id: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      beneficiary: INITIAL_ACCOUNTS[1].address,
      start: now - 45 * day, // Started 45 days ago
      cliff: 30 * day,       // 30 day cliff (already passed)
      duration: 180 * day,   // 180 days total
      slicePeriodSeconds: 1 * day,
      revocable: true,
      amountTotal: 500000n * 10n ** 18n,
      released: 0n,
      revoked: false,
    };

    // Schedule 2 for Bob: 250,000 tokens, 60 day cliff, 365 day total duration, 1 day slice, non-revocable
    const schedule2: VestingSchedule = {
      id: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      beneficiary: INITIAL_ACCOUNTS[2].address,
      start: now - 15 * day, // Started 15 days ago (still in cliff)
      cliff: 60 * day,       // 60 day cliff (15 < 60, not yet unlocked)
      duration: 365 * day,   // 365 days total
      slicePeriodSeconds: 1 * day,
      revocable: false,
      amountTotal: 250000n * 10n ** 18n,
      released: 0n,
      revoked: false,
    };

    this.state.schedules = [schedule1, schedule2];
    this.state.totalVestedAmount = schedule1.amountTotal + schedule2.amountTotal;
  }

  // --- Math Functions matching Solidity Contract ---

  public computeVestedAmount(schedule: VestingSchedule, timestamp: number): bigint {
    if (timestamp < schedule.start + schedule.cliff) {
      return 0n;
    } else if (timestamp >= schedule.start + schedule.duration) {
      return schedule.amountTotal;
    } else {
      const timeFromStart = BigInt(timestamp - schedule.start);
      const secondsPerSlice = BigInt(schedule.slicePeriodSeconds);
      const vestedSlices = timeFromStart / secondsPerSlice;
      const vestedSeconds = vestedSlices * secondsPerSlice;

      return (schedule.amountTotal * vestedSeconds) / BigInt(schedule.duration);
    }
  }

  public computeReleasableAmount(schedule: VestingSchedule, timestamp: number = this.currentTimestamp): bigint {
    if (schedule.revoked) return 0n;
    const vested = this.computeVestedAmount(schedule, timestamp);
    if (vested <= schedule.released) return 0n;
    return vested - schedule.released;
  }

  public getUnallocatedBalance(): bigint {
    const unreleasedVestedTotal = this.state.totalVestedAmount - this.state.totalReleasedAmount;
    if (this.state.vaultTokenBalance <= unreleasedVestedTotal) return 0n;
    return this.state.vaultTokenBalance - unreleasedVestedTotal;
  }

  // --- Contract Actions ---

  public depositVaultTokens(senderAddress: string, amount: bigint): { success: boolean; message: string } {
    const sender = this.accounts.find((a) => a.address.toLowerCase() === senderAddress.toLowerCase());
    if (!sender) return { success: false, message: 'Account not found' };
    if (sender.tokenBalance < amount) return { success: false, message: 'Insufficient ERC20 token balance in wallet' };

    sender.tokenBalance -= amount;
    this.state.vaultTokenBalance += amount;

    this.logTx({
      from: senderAddress,
      to: this.state.vaultAddress,
      functionName: 'depositTokens',
      args: [`${this.formatUnits(amount)} ICO`],
      status: 'success',
      eventsEmitted: [
        {
          name: 'Transfer',
          params: { from: senderAddress, to: this.state.vaultAddress, value: `${this.formatUnits(amount)} ICO` },
        },
      ],
    });

    return { success: true, message: `Successfully deposited ${this.formatUnits(amount)} ICO to Vault buffer.` };
  }

  public createVestingSchedule(
    senderAddress: string,
    beneficiary: string,
    start: number,
    cliff: number,
    duration: number,
    slicePeriodSeconds: number,
    revocable: boolean,
    amount: bigint
  ): { success: boolean; message: string; scheduleId?: string } {
    if (senderAddress.toLowerCase() !== this.state.owner.toLowerCase()) {
      this.logTx({
        from: senderAddress,
        to: this.state.vaultAddress,
        functionName: 'createVestingSchedule',
        args: [beneficiary, `${amount}`],
        status: 'reverted',
        errorReason: 'Ownable: caller is not the owner',
        eventsEmitted: [],
      });
      return { success: false, message: 'Only owner can create vesting schedules.' };
    }

    if (this.state.paused) {
      this.logTx({
        from: senderAddress,
        to: this.state.vaultAddress,
        functionName: 'createVestingSchedule',
        args: [beneficiary, `${amount}`],
        status: 'reverted',
        errorReason: 'Pausable: paused',
        eventsEmitted: [],
      });
      return { success: false, message: 'Vault is paused!' };
    }

    if (amount <= 0n) return { success: false, message: 'Amount must be greater than 0.' };
    if (duration <= 0 || duration < cliff) return { success: false, message: 'Duration must be >= cliff and > 0.' };
    if (slicePeriodSeconds <= 0) return { success: false, message: 'Slice period must be >= 1 second.' };

    const unallocated = this.getUnallocatedBalance();
    if (unallocated < amount) {
      this.logTx({
        from: senderAddress,
        to: this.state.vaultAddress,
        functionName: 'createVestingSchedule',
        args: [beneficiary, `${amount}`],
        status: 'reverted',
        errorReason: 'InsufficientVaultBalance()',
        eventsEmitted: [],
      });
      return {
        success: false,
        message: `Insufficient unallocated vault balance. Unallocated: ${this.formatUnits(unallocated)} ICO, requested: ${this.formatUnits(amount)} ICO. Deposit more ICO first.`,
      };
    }

    const newId = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    const newSchedule: VestingSchedule = {
      id: newId,
      beneficiary,
      start,
      cliff,
      duration,
      slicePeriodSeconds,
      revocable,
      amountTotal: amount,
      released: 0n,
      revoked: false,
    };

    this.state.schedules.push(newSchedule);
    this.state.totalVestedAmount += amount;

    this.logTx({
      from: senderAddress,
      to: this.state.vaultAddress,
      functionName: 'createVestingSchedule',
      args: [beneficiary, `Start: ${start}`, `Cliff: ${cliff}s`, `Duration: ${duration}s`, `Amount: ${this.formatUnits(amount)} ICO`],
      status: 'success',
      eventsEmitted: [
        {
          name: 'VestingScheduleCreated',
          params: {
            scheduleId: newId.slice(0, 10) + '...',
            beneficiary,
            amount: `${this.formatUnits(amount)} ICO`,
            revocable: revocable ? 'true' : 'false',
          },
        },
      ],
    });

    return { success: true, message: 'Vesting schedule created successfully!', scheduleId: newId };
  }

  public claim(senderAddress: string, scheduleId: string): { success: boolean; message: string; claimedAmount?: bigint } {
    const schedule = this.state.schedules.find((s) => s.id === scheduleId);
    if (!schedule) return { success: false, message: 'Vesting schedule not found.' };

    if (this.state.paused) {
      this.logTx({
        from: senderAddress,
        to: this.state.vaultAddress,
        functionName: 'claim',
        args: [scheduleId.slice(0, 10) + '...'],
        status: 'reverted',
        errorReason: 'Pausable: paused',
        eventsEmitted: [],
      });
      return { success: false, message: 'Vault is currently paused by admin!' };
    }

    if (schedule.revoked) {
      return { success: false, message: 'Schedule has been revoked.' };
    }

    if (
      senderAddress.toLowerCase() !== schedule.beneficiary.toLowerCase() &&
      senderAddress.toLowerCase() !== this.state.owner.toLowerCase()
    ) {
      this.logTx({
        from: senderAddress,
        to: this.state.vaultAddress,
        functionName: 'claim',
        args: [scheduleId.slice(0, 10) + '...'],
        status: 'reverted',
        errorReason: 'Unauthorized()',
        eventsEmitted: [],
      });
      return { success: false, message: 'Only beneficiary or admin can execute claim for this schedule.' };
    }

    const releasable = this.computeReleasableAmount(schedule, this.currentTimestamp);
    if (releasable <= 0n) {
      this.logTx({
        from: senderAddress,
        to: this.state.vaultAddress,
        functionName: 'claim',
        args: [scheduleId.slice(0, 10) + '...'],
        status: 'reverted',
        errorReason: 'NothingToClaim()',
        eventsEmitted: [],
      });
      return { success: false, message: 'No releasable tokens available right now (still in cliff or fully claimed).' };
    }

    // Process transfer
    schedule.released += releasable;
    this.state.totalReleasedAmount += releasable;
    this.state.vaultTokenBalance -= releasable;

    // Credit beneficiary
    const beneficiaryAccount = this.accounts.find((a) => a.address.toLowerCase() === schedule.beneficiary.toLowerCase());
    if (beneficiaryAccount) {
      beneficiaryAccount.tokenBalance += releasable;
    }

    this.logTx({
      from: senderAddress,
      to: this.state.vaultAddress,
      functionName: 'claim',
      args: [scheduleId.slice(0, 10) + '...'],
      status: 'success',
      eventsEmitted: [
        {
          name: 'TokensClaimed',
          params: {
            scheduleId: scheduleId.slice(0, 10) + '...',
            beneficiary: schedule.beneficiary,
            amount: `${this.formatUnits(releasable)} ICO`,
          },
        },
      ],
    });

    return {
      success: true,
      message: `Claimed ${this.formatUnits(releasable)} ICO tokens successfully!`,
      claimedAmount: releasable,
    };
  }

  public revoke(senderAddress: string, scheduleId: string): { success: boolean; message: string } {
    if (senderAddress.toLowerCase() !== this.state.owner.toLowerCase()) {
      return { success: false, message: 'Only contract owner can revoke schedules.' };
    }

    const schedule = this.state.schedules.find((s) => s.id === scheduleId);
    if (!schedule) return { success: false, message: 'Schedule not found.' };
    if (!schedule.revocable) return { success: false, message: 'Schedule is non-revocable.' };
    if (schedule.revoked) return { success: false, message: 'Schedule is already revoked.' };

    const vestedAmount = this.computeVestedAmount(schedule, this.currentTimestamp);
    const unreleasedVested = vestedAmount - schedule.released;

    // Release accrued vested tokens to beneficiary prior to revoking
    if (unreleasedVested > 0n) {
      schedule.released += unreleasedVested;
      this.state.totalReleasedAmount += unreleasedVested;
      this.state.vaultTokenBalance -= unreleasedVested;

      const beneficiaryAccount = this.accounts.find((a) => a.address.toLowerCase() === schedule.beneficiary.toLowerCase());
      if (beneficiaryAccount) {
        beneficiaryAccount.tokenBalance += unreleasedVested;
      }
    }

    const unvestedAmount = schedule.amountTotal - vestedAmount;
    schedule.revoked = true;
    this.state.totalVestedAmount -= unvestedAmount;

    this.logTx({
      from: senderAddress,
      to: this.state.vaultAddress,
      functionName: 'revoke',
      args: [scheduleId.slice(0, 10) + '...'],
      status: 'success',
      eventsEmitted: [
        {
          name: 'VestingScheduleRevoked',
          params: {
            scheduleId: scheduleId.slice(0, 10) + '...',
            beneficiary: schedule.beneficiary,
            unvestedReturned: `${this.formatUnits(unvestedAmount)} ICO`,
          },
        },
      ],
    });

    return {
      success: true,
      message: `Schedule revoked. Accrued ${this.formatUnits(unreleasedVested)} ICO released to beneficiary; ${this.formatUnits(unvestedAmount)} unvested ICO returned to vault balance.`,
    };
  }

  public togglePause(senderAddress: string): { success: boolean; message: string } {
    if (senderAddress.toLowerCase() !== this.state.owner.toLowerCase()) {
      return { success: false, message: 'Only contract owner can toggle emergency pause.' };
    }

    this.state.paused = !this.state.paused;

    this.logTx({
      from: senderAddress,
      to: this.state.vaultAddress,
      functionName: this.state.paused ? 'pause' : 'unpause',
      args: [],
      status: 'success',
      eventsEmitted: [{ name: this.state.paused ? 'Paused' : 'Unpaused', params: { account: senderAddress } }],
    });

    return {
      success: true,
      message: `Vault contract is now ${this.state.paused ? 'PAUSED' : 'UNPAUSED'}.`,
    };
  }

  public advanceTime(secondsToAdd: number): { success: boolean; message: string } {
    this.currentTimestamp += secondsToAdd;
    return {
      success: true,
      message: `Advanced block time by ${this.formatDuration(secondsToAdd)}. Current block time: ${new Date(this.currentTimestamp * 1000).toLocaleString()}`,
    };
  }

  public setTime(targetTimestamp: number): { success: boolean; message: string } {
    this.currentTimestamp = targetTimestamp;
    return {
      success: true,
      message: `Set block time to ${new Date(this.currentTimestamp * 1000).toLocaleString()}`,
    };
  }

  // Helper formatting methods
  public formatUnits(amount: bigint, decimals: number = 18): string {
    const scale = 10n ** BigInt(decimals);
    const integerPart = amount / scale;
    const fractionalPart = amount % scale;
    if (fractionalPart === 0n) return integerPart.toLocaleString();
    const fracStr = fractionalPart.toString().padStart(decimals, '0').replace(/0+$/, '');
    return `${integerPart.toLocaleString()}.${fracStr.slice(0, 4)}`;
  }

  public formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} mins`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    const days = Math.floor(seconds / 86400);
    return `${days} day${days > 1 ? 's' : ''}`;
  }

  private logTx(params: {
    from: string;
    to: string;
    functionName: string;
    args: string[];
    status: 'success' | 'reverted';
    errorReason?: string;
    eventsEmitted: { name: string; params: Record<string, string> }[];
  }) {
    const hash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const tx: TxLog = {
      id: Math.random().toString(36).slice(2),
      hash,
      timestamp: this.currentTimestamp,
      from: params.from,
      to: params.to,
      functionName: params.functionName,
      args: params.args,
      status: params.status,
      errorReason: params.errorReason,
      gasUsed: Math.floor(Math.random() * 30000) + 45000,
      eventsEmitted: params.eventsEmitted,
    };
    this.txLogs.unshift(tx);
  }
}
