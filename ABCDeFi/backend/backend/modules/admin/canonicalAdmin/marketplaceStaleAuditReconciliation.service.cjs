const { Contract, Interface, JsonRpcProvider } = require('ethers');
const marketplaceArtifact = require('../../../../../artifacts/contracts/marketplace/ABCDNFTMarketplaceV2.sol/ABCDNFTMarketplaceV2.json');
const { loadABCDMarketplaceManifest } = require('../../../config/abcdMarketplaceManifest.cjs');
const { verifyBackendRuntimeFamilyLive } = require('../../../config/runtimeFamily.cjs');
const { projectionRuntimeFields } = require('../../../config/projectionRuntimeContext.cjs');
const { createMarketplaceAvailability } = require('../../abcdMarketplaceProjection/read.controller.cjs');

const lower = (value) => typeof value === 'string' ? value.toLowerCase() : value;
const expectedEventFor = (action) => action === 'pause' ? 'Paused' : action === 'unpause' ? 'Unpaused' : null;

function failed(message, status = 409) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/**
 * Verifies a submitted stale Marketplace emergency transaction exclusively
 * from canonical RPC and canonical projection evidence. It never writes a
 * contract or a projection; the controller performs the one conditional audit
 * update only after this verifier succeeds.
 */
function createMarketplaceStaleAuditReconciler({
  runtimeLoader,
  manifestLoader = loadABCDMarketplaceManifest,
  models,
  providerFactory = (rpcUrl) => new JsonRpcProvider(rpcUrl),
  artifact = marketplaceArtifact,
  interfaceFactory = (abi) => new Interface(abi),
  roleContractFactory = (address, provider) => new Contract(address, ['function PAUSER_ROLE() view returns (bytes32)', 'function hasRole(bytes32 role,address account) view returns (bool)'], provider),
  verifyRuntime = verifyBackendRuntimeFamilyLive,
  availabilityFactory = createMarketplaceAvailability,
}) {
  return async function reconcile(audit) {
    if (audit?.module !== 'Marketplace' || !expectedEventFor(audit?.action)) throw failed('Only submitted Marketplace pause/unpause audits can be reconciled.');
    if (audit.state !== 'STALE') throw failed('Only a stale submitted audit can be reconciled.');
    if (!/^0x[a-fA-F0-9]{64}$/.test(String(audit.transactionHash || ''))) throw failed('The stale audit does not contain a valid submitted transaction hash.');

    const runtime = runtimeLoader();
    if (audit.runtimeFamily !== runtime.family || audit.chainId !== String(runtime.chainId) || audit.rpcUrl !== runtime.rpcUrl || audit.deploymentIdentity !== runtime.deploymentIdentity) {
      throw failed('The audit runtime identity does not match the active canonical runtime.');
    }
    await verifyRuntime(runtime);
    const manifest = manifestLoader();
    if (manifest.runtimeFamily !== runtime.family || String(manifest.chainId) !== String(runtime.chainId) || manifest.rpcUrl !== runtime.rpcUrl || manifest.deploymentIdentity !== runtime.deploymentIdentity) {
      throw failed('The canonical Marketplace child manifest does not match the active runtime.');
    }

    const provider = providerFactory(manifest.rpcUrl);
    const [network, transaction, receipt, bytecode] = await Promise.all([
      provider.getNetwork(),
      provider.getTransaction(audit.transactionHash),
      provider.getTransactionReceipt(audit.transactionHash),
      provider.getCode(manifest.marketplaceAddress),
    ]);
    if (Number(network.chainId) !== Number(manifest.chainId)) throw failed('The canonical RPC chain does not match the Marketplace manifest.');
    if (!transaction || !receipt || Number(receipt.status) !== 1) throw failed('The submitted transaction does not have a successful canonical receipt.');
    if (!transaction.to || lower(transaction.to) !== lower(manifest.marketplaceAddress)) throw failed('The submitted transaction target does not match the canonical Marketplace contract.');
    if (!bytecode || bytecode === '0x' || bytecode === '0x0') throw failed('Canonical Marketplace bytecode is unavailable.');

    const expectedEvent = expectedEventFor(audit.action);
    const iface = interfaceFactory(artifact.abi);
    let matched = null;
    for (const log of receipt.logs || []) {
      if (lower(log.address) !== lower(manifest.marketplaceAddress)) continue;
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === expectedEvent) { matched = { log, parsed }; break; }
      } catch { /* unrelated or undecodable log */ }
    }
    if (!matched) throw failed(`The successful receipt does not contain the expected ${expectedEvent} event from the canonical Marketplace contract.`);

    const roleContract = roleContractFactory(manifest.marketplaceAddress, provider);
    const role = await roleContract.PAUSER_ROLE();
    const heldAtReceiptBlock = await roleContract.hasRole(role, transaction.from, { blockTag: Number(receipt.blockNumber) });
    if (!heldAtReceiptBlock) throw failed('The transaction sender did not hold Marketplace PAUSER_ROLE at the receipt block.');

    const identity = { chainId: String(manifest.chainId), deploymentVersion: manifest.deploymentVersion, ...projectionRuntimeFields(manifest), marketplaceAddress: manifest.marketplaceAddress };
    const indexed = await models.MarketplaceEvent.findOne({ ...identity, transactionHash: lower(audit.transactionHash), eventName: expectedEvent, removed: { $ne: true } }).lean();
    if (!indexed || String(indexed.blockNumber) !== String(receipt.blockNumber) || lower(indexed.blockHash) !== lower(receipt.blockHash)) {
      throw failed('The canonical Marketplace projection does not contain the exact expected transaction event.');
    }
    const available = await availabilityFactory({ models, manifest, providerFactory: () => provider, marketplaceFactory: (address, activeProvider) => new Contract(address, artifact.abi, activeProvider) })();
    if (!available.available || available.status !== 'AVAILABLE') throw failed(available.reason || 'The canonical Marketplace API projection is unavailable.');

    return {
      blockNumber: String(receipt.blockNumber),
      evidence: {
        receiptBlockHash: lower(receipt.blockHash),
        targetContract: lower(manifest.marketplaceAddress),
        sender: lower(transaction.from),
        expectedEvent,
        eventLogIndex: Number(matched.log.index ?? matched.log.logIndex),
        indexerTransactionHash: lower(indexed.transactionHash),
        indexerBlockHash: lower(indexed.blockHash),
        indexerLogIndex: Number(indexed.logIndex),
        reconciledAt: new Date(),
      },
    };
  };
}

module.exports = { createMarketplaceStaleAuditReconciler };
