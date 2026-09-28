import fs from 'node:fs';
import path from 'node:path';
import { network } from 'hardhat';
import { ethers } from 'ethers';

const mined = async (transaction: any, label: string) => {
  const receipt = await transaction.wait();
  if (!receipt || Number(receipt.status) !== 1) throw new Error(`${label} failed`);
  return receipt;
};

const mustRevert = async (operation: () => Promise<unknown>) => {
  try { await operation(); } catch (error: any) { return error.shortMessage || error.message; }
  throw new Error('Expected operation to revert');
};

async function main() {
  const manifestPath = path.resolve(process.env.TREASURY_V2_MANIFEST_PATH || 'deployments.treasury-v2-local.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const { ethers: hh } = await network.connect();
  const [admin, , , operator, , , , funder, recipient] = await hh.getSigners();
  if ((await hh.provider.getNetwork()).chainId !== 31337n) throw new Error('TreasuryV2 E2E requires Hardhat Local (31337).');
  const token = await hh.getContractAt('ABCDToken', manifest.contracts.ABCDToken.address);
  const treasury = await hh.getContractAt('TreasuryV2', manifest.contracts.TreasuryV2.address);
  const amount = ethers.parseUnits('25', 18);
  const fundingOperation = ethers.keccak256(ethers.toUtf8Bytes('treasury-e2e-fund'));
  const transferOperation = ethers.keccak256(ethers.toUtf8Bytes('treasury-e2e-transfer'));

  const provision = await mined(await token.connect(admin).transfer(funder.address, amount), 'Treasury test funding provision');
  const approval = await mined(await token.connect(funder).approve(await treasury.getAddress(), amount), 'Treasury funder approval');
  const funded = await mined(await treasury.connect(funder).fund(await token.getAddress(), amount, fundingOperation), 'Treasury funding');
  const recipientBefore = await token.balanceOf(recipient.address);
  const transferred = await mined(await treasury.connect(operator).executeTransfer(await token.getAddress(), recipient.address, amount, transferOperation), 'Treasury authorized transfer');
  const recipientAfter = await token.balanceOf(recipient.address);
  if (recipientAfter - recipientBefore !== amount) throw new Error('Recipient ABCD delta did not equal the authorized transfer amount.');
  if (await treasury.accountedBalance(await token.getAddress()) !== 0n) throw new Error('Treasury accounted balance did not reconcile after the authorized transfer.');
  const replay = await mustRevert(async () => treasury.connect(operator).executeTransfer.staticCall(await token.getAddress(), recipient.address, amount, transferOperation));

  console.log(JSON.stringify({
    chainId: 31337,
    treasury: await treasury.getAddress(),
    abcd: await token.getAddress(),
    amount: amount.toString(),
    checkpointBlock: Number(transferred.blockNumber),
    receipts: { provision: provision.hash, approval: approval.hash, funded: funded.hash, transferred: transferred.hash },
    balances: { recipient: recipientAfter.toString(), treasury: (await token.balanceOf(await treasury.getAddress())).toString() },
    negative: { replay }
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
