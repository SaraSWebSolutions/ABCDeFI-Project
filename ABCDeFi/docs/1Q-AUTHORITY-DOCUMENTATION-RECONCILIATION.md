# ABCDeFi 1Q Authority and Documentation Reconciliation

**Status:** COMPLETE — active local authority reconciled; no protocol or deployment state changed.

**Scope:** This record resolves documentation authority for the active `1Q_LOCAL` family only. It does not replace, delete, or alter historical 1B evidence, production deployment requirements, or excluded Franchise/Geographic-NFT work.

## Active local authority

The controlling local deployment record is the deployment-scoped unified manifest:

- Unified manifest: `.e2e-runtime/oneq-persistence-v1/manifests/unified.json`
- Runtime family: `1Q_LOCAL`
- Chain ID / RPC: `31337` / `http://127.0.0.1:8546`
- Deployment identity: `08af1c8d48ebfb5a9424097780192c3d40b430205b59d0622079e6659504d34b`
- Recovered local checkpoint: block `109`
- Root deployment version: `abcd-1q-local-0x270eea416130e56dc723f199a7a593362a6e18b7450d0478e5c9d36bbe42145d`

For that family, the root manifest declares the owner-approved seven-allocation model:

1. ICO — 20% / 200,000,000,000,000 ABCD
2. Founder — 55% / 550,000,000,000,000 ABCD
3. Marketing — 10% / 100,000,000,000,000 ABCD
4. Advisors — 2% / 20,000,000,000,000 ABCD
5. Finance Resource — 9% / 90,000,000,000,000 ABCD
6. Contingency — 2% / 20,000,000,000,000 ABCD
7. Reserve — 2% / 20,000,000,000,000 ABCD

This is the authoritative local token-allocation description for the active 1Q family. It is not an instruction to alter a prior deployment, token balance, or historical record.

The active local ICO child is explicitly `OWNER_APPROVED_1Q_ICO_V3` with deployment version `ico-v3-1q-local-0x7b51ffc306cea28e3cb2414af6cc0059718043e86958c4d8d978c6660584260f`. Its live local identity is distinct from preserved ICO V2/1B history.

## Authority order for the active 1Q local family

When documents conflict, apply this order only to `1Q_LOCAL`:

1. Explicit, later Owner-approved 1Q decisions and the deployment-scoped 1Q unified/root/child manifests.
2. The recovered canonical local chain state and deployment-scoped checkpoint evidence.
3. Phase lock and reconciliation records that describe the same active implementation scope.
4. Earlier roadmap, reconciliation, 1B, and ICO V2 records as preserved historical evidence.

Historical evidence remains valuable for provenance and regression context. It is not silently deleted, rewritten, or treated as the active runtime selector.

## Reconciled documentation positions

| Documentation area | Active 1Q_LOCAL disposition | Historical disposition |
| --- | --- | --- |
| Root token allocation | Seven-allocation 1Q model in the active root manifest is controlling. | Earlier 1B allocation descriptions remain historical evidence only. |
| ICO | ICOManagerV3 / 1Q ICO V3 child manifest is controlling for the active local family. | `PHASE6-ICO-COMPLETION-LOCK.md` documents the prior ICO V2 local baseline; it is not overwritten or reclassified as the active 1Q runtime. |
| Lending, P2P, Referral, Reserve, LoanNFT | Their completed local lock/reconciliation evidence remains controlling for the corresponding active 1Q implementation. | Earlier wording that predates the 1Q family remains historical, not an active address or deployment selector. |
| Treasury, Legion, Phase 10A, Phase 10B | Their deployment-scoped 1Q manifests and local certification records are controlling. | Historic 1B deployment references must not be used as live configuration. |
| Franchise / Geographic NFTs | Excluded from this reconciliation and from the prospective Final Local Core Lock. | No Franchise or geographic business decision is inferred or changed. |

This record intentionally does not modify `docs/ABCDEFI-NEXT-IMPLEMENTATION-ROADMAP.md`, `docs/ABCDEFI-CURRENT-PROTOCOL-RECONCILIATION.md`, or any historic phase-lock document. Their 1B/ICO-V2 statements are preserved as historical context, while this reconciliation supplies the explicit authority boundary for the current 1Q local family.

## Final Local Core Lock gates

The authority/documentation conflict is now resolved for the active local family. The remaining local-core decisions are narrowly scoped:

1. **Referral Certificate metadata disposition — OWNER DECISION REQUIRED.** The core referral lifecycle for Loan #3 passed, but its optional/on-chain Referral Certificate cannot be minted without a distinct, validated referral-certificate URI/hash. See `docs/REFERRAL-CERTIFICATE-OWNER-DECISION-RECORD.md`.
2. **Positive authenticated Admin browser certification — ENVIRONMENT-BLOCKED.** Automated/API and role-read validation passed, but a pre-authenticated Admin-role browser session was not available during the final local certification. This is a browser-session gate, not a protocol defect.
3. **Final Local Core Lock scope decision — OWNER DECISION REQUIRED.** The Owner must either require the Referral Certificate mint path before locking the local core, or explicitly defer that certificate while retaining the already-passing referral accounting lifecycle as the locked local scope.

The following are not local implementation defects and are not prerequisites to a *local* core lock, but remain required before production use: independent security review, BSC Testnet deployment/operational validation, production custody and role procedures, monitoring/alerting, and production key management.

## Change boundary

This reconciliation is documentation only. It changes no Solidity, contract binding, tokenomics, deployment manifest, runtime, database, API projection, IPFS record, or blockchain state.
