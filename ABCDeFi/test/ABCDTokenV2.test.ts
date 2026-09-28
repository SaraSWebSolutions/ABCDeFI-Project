import { expect } from 'chai';
import { network } from 'hardhat';

describe('ABCDTokenV2 owner-approved 1Q model', () => {
  it('mints exactly the seven approved allocations and enforces the fixed cap', async () => {
    const { ethers } = await network.connect(); const [, ico, founder, marketing, advisors, finance, contingency, reserve, other] = await ethers.getSigners();
    const token = await (await ethers.getContractFactory('ABCDTokenV2')).deploy(ico.address, founder.address, marketing.address, advisors.address, finance.address, contingency.address, reserve.address); await token.waitForDeployment();
    const unit = 10n ** 18n; const total = 1_000_000_000_000_000n * unit;
    expect(await token.decimals()).eq(18n); expect(await token.maxSupply()).eq(total); expect(await token.totalSupply()).eq(total);
    expect(await token.balanceOf(ico.address)).eq(200_000_000_000_000n*unit); expect(await token.balanceOf(founder.address)).eq(550_000_000_000_000n*unit); expect(await token.balanceOf(marketing.address)).eq(100_000_000_000_000n*unit); expect(await token.balanceOf(advisors.address)).eq(20_000_000_000_000n*unit); expect(await token.balanceOf(finance.address)).eq(90_000_000_000_000n*unit); expect(await token.balanceOf(contingency.address)).eq(20_000_000_000_000n*unit); expect(await token.balanceOf(reserve.address)).eq(20_000_000_000_000n*unit);
    await expect(token.connect(other).mint(other.address, 1n)).revertedWithCustomError(token, 'AccessControlUnauthorizedAccount'); await expect(token.mint(other.address,1n)).revertedWith('Max supply exceeded');
  });
});
