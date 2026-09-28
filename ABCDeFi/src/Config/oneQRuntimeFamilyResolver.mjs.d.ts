export const ONE_Q_LOCAL: '1Q_LOCAL';
export const ONE_Q_CHAIN_ID: number;
export const ONE_Q_RPC_URL: string;
export class OneQRuntimeFamilyError extends Error {}
export function configuredRuntimeFamily(environment: Record<string, string | undefined>): '1Q_LOCAL';
export function resolveRuntimeFamily(family: '1Q_LOCAL', loader: () => { unified: unknown; children: unknown }): { family: '1Q_LOCAL'; manifest: { deploymentIdentity: string; contracts: Record<string, { address: string; deploymentBlock?: number }> }; children: Record<string, { deploymentVersion: string; deploymentBlock?: number; contracts: Record<string, { address: string }> }> };
