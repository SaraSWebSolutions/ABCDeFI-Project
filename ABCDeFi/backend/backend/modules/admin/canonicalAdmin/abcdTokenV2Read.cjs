const path = require('node:path');
const { Contract, JsonRpcProvider, isAddress, keccak256 } = require('ethers');
const { loadABCDTokenV2Manifest } = require('../../../config/abcdTokenV2Manifest.cjs');

const artifact = require(path.resolve(__dirname, '../../../../../artifacts/contracts/token/ABCDTokenV2.sol/ABCDTokenV2.json'));
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ROLE_NAMES = Object.freeze(['DEFAULT_ADMIN_ROLE', 'MINTER_ROLE', 'BURNER_ROLE', 'PAUSER_ROLE', 'TREASURY_ROLE']);

const lower = (value) => typeof value === 'string' ? value.toLowerCase() : value;
const decimal = (value) => typeof value === 'bigint' ? value.toString() : String(value);
const validAddress = (value) => isAddress(value) && lower(value) !== ZERO_ADDRESS;

function requireSnapshotBlock(block) {
  if (!block || !Number.isInteger(Number(block.number)) || Number(block.number) < 0 || typeof block.hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(block.hash)) {
    throw new Error('ABCDTokenV2 authoritative snapshot block is unavailable.');
  }
  return { number: Number(block.number), hash: lower(block.hash) };
}

function requireManifest(manifest) {
  if (!manifest || manifest.runtimeFamily !== '1Q_LOCAL' || Number(manifest.chainId) !== 31337
    || manifest.rpcUrl !== 'http://127.0.0.1:8546' || !manifest.deploymentIdentity
    || !validAddress(manifest.tokenAddress) || !Number.isInteger(Number(manifest.deploymentBlock))) {
    throw new Error('ABCDTokenV2 authoritative read manifest is invalid.');
  }
}

function createABCDTokenV2AdminRead({
  manifestLoader = loadABCDTokenV2Manifest,
  providerFactory = (rpcUrl) => new JsonRpcProvider(rpcUrl),
  contractFactory = (address, abi, provider) => new Contract(address, abi, provider),
  tokenArtifact = artifact,
} = {}) {
  return {
    async read({ walletAddress = null } = {}) {
      const manifest = manifestLoader();
      requireManifest(manifest);
      if (walletAddress !== null && walletAddress !== undefined && !validAddress(walletAddress)) {
        throw new Error('ABCDTokenV2 role query wallet is invalid.');
      }

      const provider = providerFactory(manifest.rpcUrl);
      const [network, latest] = await Promise.all([provider.getNetwork(), provider.getBlockNumber()]);
      if (Number(network?.chainId) !== manifest.chainId) throw new Error('ABCDTokenV2 authoritative read chain does not match 1Q_LOCAL.');
      const block = requireSnapshotBlock(await provider.getBlock(latest));
      const code = await provider.getCode(manifest.tokenAddress, block.number);
      if (!code || code === '0x') throw new Error('ABCDTokenV2 authoritative read has no live bytecode.');

      const contract = contractFactory(manifest.tokenAddress, tokenArtifact.abi, provider);
      const at = (name, ...args) => contract[name](...args, { blockTag: block.number });
      const [name, symbol, decimals, totalSupply, maxSupply, paused, owner, treasury, allocationWallets, roleIds] = await Promise.all([
        at('name'), at('symbol'), at('decimals'), at('totalSupply'), at('maxSupply'), at('paused'), at('owner'), at('treasury'),
        Promise.all(manifest.allocations.map((entry) => at(entry.getter))),
        Promise.all(ROLE_NAMES.map(async (role) => [role, await at(role)])),
      ]);

      if (name !== 'ABCDeFi Core Token' || symbol !== 'ABCD' || Number(decimals) !== 18 || BigInt(totalSupply) > BigInt(maxSupply) || BigInt(maxSupply) <= 0n || !validAddress(owner) || !validAddress(treasury)) {
        throw new Error('ABCDTokenV2 authoritative read does not match the canonical V2 interface.');
      }
      if (manifest.allocations.reduce((total, entry) => total + BigInt(entry.amount), 0n) !== BigInt(maxSupply)) {
        throw new Error('ABCDTokenV2 root allocation total does not match the fixed max supply.');
      }
      const allocations = await Promise.all(manifest.allocations.map(async (entry, index) => {
        const wallet = allocationWallets[index];
        if (!validAddress(wallet) || lower(wallet) !== entry.wallet) throw new Error(`ABCDTokenV2 ${entry.name} allocation wallet does not match the canonical root manifest.`);
        return {
          name: entry.name,
          wallet: lower(wallet),
          originalAllocation: entry.amount,
          bps: entry.bps,
          currentBalance: decimal(await at('balanceOf', wallet)),
        };
      }));
      const roles = await Promise.all(roleIds.map(async ([name, id]) => ({
        name,
        id: String(id),
        held: walletAddress ? Boolean(await at('hasRole', id, walletAddress)) : null,
      })));

      return {
        kind: 'AUTHORITATIVE_ON_CHAIN',
        runtimeFamily: manifest.runtimeFamily,
        chainId: manifest.chainId,
        rpcUrl: manifest.rpcUrl,
        deploymentIdentity: manifest.deploymentIdentity,
        deploymentVersion: manifest.deploymentVersion,
        deploymentBlock: manifest.deploymentBlock,
        tokenAddress: manifest.tokenAddress,
        snapshotBlock: block.number,
        snapshotBlockHash: block.hash,
        liveBytecode: { verified: true, codeHash: keccak256(code) },
        token: {
          name,
          symbol,
          decimals: Number(decimals),
          totalSupply: decimal(totalSupply),
          maxSupply: decimal(maxSupply),
          supplyHeadroom: decimal(BigInt(maxSupply) - BigInt(totalSupply)),
          paused: Boolean(paused),
          owner: lower(owner),
          treasury: lower(treasury),
        },
        allocations,
        roles,
        roleWallet: walletAddress ? lower(walletAddress) : null,
      };
    },
  };
}

module.exports = { ROLE_NAMES, createABCDTokenV2AdminRead };
