import { Contract, formatEther } from "ethers";
import { CONTRACTS } from "../Config/contracts";
import TokenVestingABI from "../abi/TokenVesting.json";
import { getProvider, getSigner, getWalletAddress } from "./wallet";

export async function getVestingContract(withSigner: boolean = false) {
  const providerOrSigner = withSigner ? await getSigner() : await getProvider();
  return new Contract(CONTRACTS.vesting, TokenVestingABI, providerOrSigner);
}

// Read Functions
export async function getVestingSchedule(userAddress?: string) {
  const address = userAddress || (await getWalletAddress());
  const contract = await getVestingContract(false);
  const count = Number(await contract.getVestingSchedulesCountByBeneficiary(address));
  const schedules = await Promise.all(Array.from({ length: count }, async (_, index) => {
    const [schedule, scheduleId] = await Promise.all([
      contract.getVestingScheduleByAddressAndIndex(address, index),
      contract.computeVestingScheduleIdForAddressAndIndex(address, index),
    ]);
    const releasable = await contract.computeReleasableAmount(scheduleId);
    return { schedule, releasable: releasable as bigint };
  }));

  const totals = schedules.reduce((result, { schedule, releasable }) => ({
    totalAmount: result.totalAmount + (schedule.amountTotal as bigint),
    released: result.released + (schedule.released as bigint),
    releasable: result.releasable + releasable,
  }), { totalAmount: 0n, released: 0n, releasable: 0n });

  return {
    totalAmount: formatEther(totals.totalAmount),
    released: formatEther(totals.released),
    releasable: formatEther(totals.releasable),
  };
}

// Write Functions: Claim Vested Tokens
export async function claimVestedTokens(scheduleId?: string) {
  const contract = await getVestingContract(true);
  const tx = await contract.release(scheduleId || "0x0000000000000000000000000000000000000000000000000000000000000001");
  return await tx.wait();
}
