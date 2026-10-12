export type CanonicalLegionApiSource = Readonly<{
  runtimeFamily?: string;
  chainId?: string;
  rpcUrl?: string;
  deploymentIdentity?: string;
  deploymentVersion?: string;
  contractAddress?: string;
}>;

export type CanonicalLegionRuntime = Readonly<{
  family: string;
  chainId: bigint;
  rpcUrl: string;
  deploymentIdentity: unknown;
  legionDeploymentVersion: unknown;
  contractAddress: unknown;
}>;

/**
 * Verifies an indexed Legion source against the active family and its
 * Legion-specific child manifest. The root deployment identity binds the
 * family; the child version binds the Legion projection.
 */
export function validateCanonicalLegionSource(
  available: boolean,
  reason: string | null | undefined,
  source: CanonicalLegionApiSource | null | undefined,
  runtime: CanonicalLegionRuntime,
) {
  if (!available) throw new Error(reason || 'Canonical LegionNFTV2 indexer is unavailable.');
  if (runtime.family !== '1Q_LOCAL'
    || runtime.chainId !== 31337n
    || runtime.rpcUrl !== 'http://127.0.0.1:8546'
    || typeof runtime.deploymentIdentity !== 'string' || !runtime.deploymentIdentity
    || typeof runtime.legionDeploymentVersion !== 'string' || !runtime.legionDeploymentVersion
    || typeof runtime.contractAddress !== 'string' || !runtime.contractAddress) {
    throw new Error('The canonical LegionNFTV2 child manifest is unavailable or malformed.');
  }
  if (!source
    || source.runtimeFamily !== runtime.family
    || source.chainId !== String(runtime.chainId)
    || source.rpcUrl !== runtime.rpcUrl
    || source.deploymentIdentity !== runtime.deploymentIdentity
    || source.deploymentVersion !== runtime.legionDeploymentVersion
    || source.contractAddress?.toLowerCase() !== runtime.contractAddress.toLowerCase()) {
    throw new Error('Canonical LegionNFTV2 API deployment identity does not match the strict active 1Q runtime.');
  }
  return source.contractAddress;
}
