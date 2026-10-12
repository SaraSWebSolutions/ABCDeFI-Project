# ABCDeFi System Invariants and Economic Conservation Audit

**Audit type:** Read-only specification, contract, test, indexer/API, and live-read reconciliation.
**Recorded:** 2026-10-03
**Scope:** Completed canonical 1Q_LOCAL modules only. Franchise, Geographic NFTs, BSC Testnet, and deferred product families are excluded.

## Authority and evidence boundary

The live evidence boundary is chain 31337, RPC http://127.0.0.1:8546,
deployment identity 08af1c8d48ebfb5a9424097780192c3d40b430205b59d0622079e6659504d34b,
and block 125
(0xc6b28cec7ca766ead1fbcc6a47f70df18bfec7ffd58b514b5b5642cfadad101c).
The active manifest is .e2e-runtime/oneq-persistence-v1/manifests/unified.json.

- PASS: stated rule has relevant code, tests, or canonical live evidence.
- FAIL: implementation contradicts a governing approved source.
- BLOCKED: evidence cannot prove the assertion, or governing records conflict.
- UNSPECIFIED: neither the whitepaper nor an approved owner record defines the rule; it must not be invented.

The repository whitepaper PDF is image-only in this environment. Whitepaper
claims below are therefore traced through the approved phase and owner records
that operationalise them; this audit does not invent unextractable PDF text.

### Governing-document conflict

PHASE6-ICO-OWNER-PROTOCOL-SPECIFICATION.md describes an earlier
eight-allocation / one-billion-token authority. The active 1Q manifest,
ABCDTokenV2 constants, deployed token, and Final Local Core Lock describe a
seven-allocation fixed-cap model.

**INV-GOV-01 — allocation authority**

- **Module / invariant:** System governance; a single owner-approved allocation authority must govern ICO custody and supply conservation.
- **Source:** Conflicting Phase 6 record and active 1Q manifest.
- **Contract/function:** ABCDTokenV2 constructor, allocation(), maxSupply().
- **Existing test:** test/ABCDTokenV2.test.ts; test/ICOManagerV3.test.ts.
- **Cross-module dependency:** ABCDTokenV2 to ICO V3, Lending, Treasury, Reserve, Referral, and marketplaces.
- **Current evidence:** The manifest has seven allocations totaling 10,000 bps; at block 125 live total supply equals live max supply.
- **Result:** **BLOCKED**.
- **Reason / action:** This is a documentation-authority conflict, not proof of an on-chain cap breach. Owner must issue an explicit 1Q allocation-source reconciliation.

## 1. ABCD token

**INV-TOKEN-01 — fixed cap and allocation arithmetic**

- **Module / invariant:** ABCDTokenV2; 18 decimals, initial allocation mints equal MAX_SUPPLY, and active allocation bps total 10,000.
- **Source:** Implementation-derived active 1Q authority, qualified by INV-GOV-01.
- **Contract/function:** constructor, allocation(), maxSupply(), totalSupply().
- **Existing test:** test/ABCDTokenV2.test.ts.
- **Cross-module dependency:** every ABCD-denominated module.
- **Current evidence:** Live token 0x5FbDB2315678afecb367f032d93F642f64180aa3 reports symbol ABCD, decimals 18, and total supply/max supply both 1000000000000000000000000000000000.
- **Result:** **PASS** for deployed 1Q arithmetic; **BLOCKED** for the conflicting owner-document interpretation.
- **Recommended action:** Add pinned manifest-to-allocation-wallet balance regression.

**INV-TOKEN-02 — bounded supply mutation and pause**

- **Module / invariant:** ABCDTokenV2; mint cannot exceed cap, treasury burn is role-restricted, and pause blocks token updates.
- **Source:** Implementation-derived.
- **Contract/function:** mint(), burnFromTreasury(), setTreasury(), pause(), unpause(), _update().
- **Existing test:** test/ABCDTokenV2.test.ts and dependent lending/marketplace failure tests.
- **Cross-module dependency:** ICO claims, lending, Referral vault, Reserve, Treasury, marketplaces.
- **Current evidence:** Live token was unpaused; contract enforces cap and role checks.
- **Result:** **PASS**.
- **Recommended action:** A permanent no-mint/no-burn governance policy is **WHITEPAPER/OWNER SPEC UNSPECIFIED — DO NOT INVENT**. Add one cross-module failed-token-transfer atomicity property test.

## 2. ICO V3

**INV-ICO-01 — sale and stage inventory**

- **Module / invariant:** ICOManagerV3; 50M ABCD inventory, two 25M stages at USD 0.008 and 0.010, with no stage/global over-sale.
- **Source:** Approved Phase 6 owner specification and implementation constants.
- **Contract/function:** ICO_INVENTORY, stage constants, buy(), stage().
- **Existing test:** test/ICOManagerV3.test.ts fixed inventory/custody test.
- **Cross-module dependency:** ABCD ICO custody wallet and BNB/USD oracle.
- **Current evidence:** Contract constants and V3 tests agree; ICO API is AVAILABLE at checkpoint 125.
- **Result:** **PASS**.
- **Recommended action:** Add stateful two-buyer equation: stage sold total equals totalAllocated across refund paths.

**INV-ICO-02 — BNB payment, eligibility, and oracle conservation**

- **Module / invariant:** Valid price snapshot determines allocation; excess BNB refunds atomically; eligibility is required; minimum is 100 ABCD; cumulative cap is 500,000 ABCD; unavailable/stale/invalid/future/precision-invalid oracle data reverts.
- **Source:** Approved Phase 6 owner specification.
- **Contract/function:** setEligibility(), buy(), _bnbUsdWad(), _ceilDiv().
- **Existing test:** test/ICOManagerV3.test.ts purchase/minimum/cap/excess-refund and oracle cases.
- **Cross-module dependency:** native BNB, application eligibility, BNB/USD feed.
- **Current evidence:** IcoPurchase and ExcessBnbRefunded are canonical events; tests pass.
- **Result:** **PASS**.
- **Recommended action:** Add property: collected minus refunded minus withdrawn equals contract BNB balance. BSC feed selection and incident policy remain **OWNER/PRODUCTION DECISION REQUIRED**.

**INV-ICO-03 — TGE, vesting, cancellation, and unsold return**

- **Module / invariant:** 25% unlocks at TGE, 75% vests linearly for 90 days; pre-TGE cancellation enables one exact refund and reverses allocation; unsold inventory returns to icoWallet.
- **Source:** Approved Phase 6 owner specification and contract behavior.
- **Contract/function:** configureTge(), finalize(), cancel(), claimable(), claim(), claimRefund().
- **Existing test:** test/ICOManagerV3.test.ts.
- **Cross-module dependency:** ICO wallet and BNB proceeds recipient.
- **Current evidence:** Finalized-only withdrawal and once-only refund are enforced.
- **Result:** **PASS** for mechanics; **BLOCKED** for calling icoWallet a community allocation because active 1Q calls it ICO and INV-GOV-01 remains unresolved.
- **Recommended action:** Resolve allocation nomenclature; do not change custody destination without owner amendment.

## 3. Direct Lending

**INV-LEND-01 — debt and repayment conservation**

- **Module / invariant:** LendingPoolV2, LoanManagerV2, EMIManagerV2; approved capacity, fixed 9.25% ETH APR, canonical repayment ordering, and no debt on terminal closure.
- **Source:** Approved Lending V2 records and implementation-derived repayment ordering.
- **Contract/function:** LendingPool direct flow; LoanManagerV2.repay(), previewOutstanding(); EMI direct schedule paths.
- **Existing test:** test/LendingV2.test.ts: 35% LTV, APR, schedule, due timestamp, partial/full repayment, overpayment, and closure.
- **Cross-module dependency:** ABCDTokenV2, CollateralVaultV2, LoanNFTV2.
- **Current evidence:** Locked Direct Lending E2E; Lending API AVAILABLE at checkpoint 125.
- **Result:** **PASS**.
- **Recommended action:** Add accepted payment equals applied fees plus interest plus principal property regression.

**INV-LEND-02 — collateral, risk, cure, and liquidation atomicity**

- **Module / invariant:** Direct ETH begins at 35% LTV, has a 72-hour cure window, and partial liquidation sells only required collateral or reverts rather than unapproved full seizure.
- **Source:** Approved Lending V2 specification and contract behavior.
- **Contract/function:** activateMarginCall(), cureMarginCall(), previewLiquidationObligation(), LiquidationV2 preview/execute paths.
- **Existing test:** test/LendingV2.test.ts and local E2E scenarios A, C, D.
- **Cross-module dependency:** OracleAdapterV2, sale adapter, Reserve.
- **Current evidence:** Margin/cure, partial liquidation, and full-collateral-seizure atomic failure evidence are preserved.
- **Result:** **PASS** for canonical local Direct Lending.
- **Recommended action:** Production sale-route/liquidity validation is a **PRODUCTION-ONLY DEPENDENCY**.

**INV-LEND-03 — Reserve waterfall and residual debt**

- **Module / invariant:** Collateral recovers first, then bounded authorised Reserve coverage, then explicit residual bad debt; no silent forgiveness.
- **Source:** Approved Reserve/Lending behavior and implementation.
- **Contract/function:** InsuranceReserveV2.cover(), applyOverdueInstallmentRecoveryWithReserve(), applyLiquidationRecovery().
- **Existing test:** test/LendingV2.test.ts Reserve cap/pause/exhaustion/residual-debt cases.
- **Cross-module dependency:** token, Reserve balance, liquidation engine.
- **Current evidence:** Tests demonstrate no Reserve/bad-debt substitution on unauthorised paths.
- **Result:** **PASS**.
- **Recommended action:** Add property: lender recovery plus residual bad debt equals liquidation obligation.

## 4. P2P settlement

**INV-P2P-01 — funded request, schedule, and lender payment**

- **Module / invariant:** LoanMarketplaceV2, LoanManagerV2, EMIManagerV2; one funded request binds one loan/schedule and scheduled repayment credits lender rather than retaining borrower payment.
- **Source:** Locked Phase 1 scope and implementation-derived mechanics.
- **Contract/function:** createRequest(), fundRequest(), requestByLoanId, createSchedule(), payInstallment().
- **Existing test:** test/P2PLendingIntegration.test.ts and P2P cases in test/LendingV2.test.ts.
- **Cross-module dependency:** ABCDTokenV2, CollateralVaultV2, LoanNFTV2.
- **Current evidence:** Locked Request #1 / Loan #4 terminal state and P2P-only API history.
- **Result:** **PASS**.
- **Recommended action:** Add multi-installment lender-credit versus totalRepaid property coverage.

**INV-P2P-02 — terminal settlement, collateral, certificate triple**

- **Module / invariant:** Zero-debt terminal repayment settles request, releases only loan collateral, and mints one validated lender/borrower/platform certificate triple.
- **Source:** Locked P2P terminal owner-approved path.
- **Contract/function:** payOutstandingWithCompletionMetadata(), markLoanRepaid(), mintCompletionCertificates().
- **Existing test:** test/P2PLendingIntegration.test.ts; terminal metadata/replay tests in test/LendingV2.test.ts.
- **Cross-module dependency:** IPFS metadata, valuation oracle, request mapping.
- **Current evidence:** Request #1 settled; Loan #4 closed; certificates #7/#8/#9 and 0.1 ETH release are in the P2P lock.
- **Result:** **PASS**.
- **Recommended action:** Maintain public metadata read-back in every future production E2E.

**INV-P2P-03 — no unapproved P2P recovery economics**

- **Module / invariant:** P2P partial liquidation/default settlement cannot substitute Direct sale, Reserve, bad-debt, or terminal-close mechanics.
- **Source:** Implementation-derived fail-closed boundary.
- **Contract/function:** settlePartialLiquidation() and settleDefault() policy-required reverts.
- **Existing test:** test/LendingV2.test.ts overdue P2P, partial-settlement, margin-call cases.
- **Cross-module dependency:** Direct liquidation engine and Reserve.
- **Current evidence:** Tests show no P2P bad debt or substituted terminal close before policy approval.
- **Result:** **PASS** as a safety invariant; recovery economics are **UNSPECIFIED**.
- **Recommended action:** **WHITEPAPER/OWNER SPEC UNSPECIFIED — DO NOT INVENT** P2P sale, Reserve, residual-debt, or recovery policy.

## 5. Referral

**INV-REF-01 — reward arithmetic, cap, and funding**

- **Module / invariant:** LendingReferralManagerV2; 5 bps (0.05%) of originated principal per completed 30-day period, cap 12 periods, ABCD transfer from reward vault, never reward-token minting.
- **Source:** Approved Referral behavior and contract constants.
- **Contract/function:** MONTHLY_REWARD_BPS, MAX_REWARD_PERIODS, claimAccruedReward().
- **Existing test:** test/LendingReferralV2.test.ts.
- **Cross-module dependency:** LoanManager lifecycle and ABCD reward vault.
- **Current evidence:** Loan #3 records 0.035 ABCD paid and claimable false; code uses safeTransferFrom(rewardVault).
- **Result:** **PASS**.
- **Recommended action:** Add both-direction, 12-period aggregate-cap test.

**INV-REF-02 — lifecycle/default/duplicate protection**

- **Module / invariant:** Self/duplicate binding fails; registration follows actual disbursement/funding; default/liquidation/residual paths cannot create payout or replay claim.
- **Source:** Approved Referral behavior and implementation.
- **Contract/function:** bindReferrer(), registerLoan(), recordLoanCompletion(), claimAccruedReward().
- **Existing test:** test/LendingReferralV2.test.ts.
- **Cross-module dependency:** Direct/P2P loan status and authorised operator.
- **Current evidence:** Tests cover default, liquidation, residual debt, insufficient funding, and operator restriction.
- **Result:** **PASS**.
- **Recommended action:** Add indexer/API reconciliation for both lender and borrower referral directions.

**INV-REF-03 — 0.5% certificate and metadata boundary**

- **Module / invariant:** Post-close certificate records 50 bps of originated principal, has no redemption/payout, and requires URI/hash provenance.
- **Source:** Approved Referral specification and implementation.
- **Contract/function:** REFERRAL_NFT_VALUE_BPS, mintReferralCertificate().
- **Existing test:** test/LendingReferralV2.test.ts.
- **Cross-module dependency:** completion state and metadata source.
- **Current evidence:** Owner decision formally defers real certificate metadata/minting for Loan #3.
- **Result:** **BLOCKED** for canonical real-metadata E2E; **PASS** for calculation and contract eligibility.
- **Recommended action:** Requires future metadata/source authorization; do not fabricate or reuse LoanNFT metadata.

## 6. Insurance Reserve

**INV-RES-01 — ABCD-only bounded authorised cover**

- **Module / invariant:** InsuranceReserveV2; canonical ABCD asset is covered only once per eligible loan by configured liquidation engine within requested amount, actual balance, and cap.
- **Source:** Approved Reserve/Lending scope and implementation.
- **Contract/function:** asset, fund(), cover(), reserveUsedByLoan, reserveSettlementProcessed.
- **Existing test:** Reserve paths in test/LendingV2.test.ts.
- **Cross-module dependency:** LoanManagerV2, LiquidationV2, ABCDTokenV2.
- **Current evidence:** Manifest binds Reserve to canonical ABCD; contract rejects no engine/no cap/duplicate/incorrect recipient.
- **Result:** **PASS**.
- **Recommended action:** Add isolated Reserve property test across zero/partial/full balance and duplicate cover.

**INV-RES-02 — pause prevents partial cover mutation**

- **Module / invariant:** Pausing blocks funding/cover and cannot partially transfer collateral/funds or mutate debt.
- **Source:** Implementation-derived emergency behavior.
- **Contract/function:** pause(), unpause(), whenNotPaused.
- **Existing test:** test/LendingV2.test.ts paused Reserve settlement.
- **Cross-module dependency:** Direct liquidation atomicity.
- **Current evidence:** Existing test proves failure without partial mutation.
- **Result:** **PASS**.
- **Recommended action:** Assert no ReserveUsed event on each paused/reverted path.

## 7. Treasury

**INV-TREAS-01 — authorised exact replay-safe accounting**

- **Module / invariant:** TreasuryV2; supported asset, authorised funder/recipient, unique nonzero operation ID, and exact before/after accounting are required.
- **Source:** Owner-approved non-economic Treasury foundation.
- **Contract/function:** configureAsset(), configureFunder(), configureRecipient(), fund(), executeTransfer().
- **Existing test:** test/TreasuryV2.test.ts.
- **Cross-module dependency:** ABCDTokenV2 and operational custody.
- **Current evidence:** Treasury API AVAILABLE at checkpoint 125; tests cover roles, mismatch and replay.
- **Result:** **PASS**.
- **Recommended action:** Multisig/timelock, native custody, routing, and expanded economics are **UNSPECIFIED / OWNER DECISION REQUIRED**.

**INV-TREAS-02 — receipt-to-projection pause-event consistency**

- **Module / invariant:** Treasury indexer retains inherited OpenZeppelin pause events and domain Treasury pause events without rewinding a valid checkpoint.
- **Source:** Canonical indexer reconciliation behavior.
- **Contract/function:** pause(), unpause(), Treasury event allowlist.
- **Existing test:** backend/backend/__tests__/treasuryProjection.test.cjs, 3/3.
- **Cross-module dependency:** Admin audit/read-model freshness.
- **Current evidence:** Block 123 tx 0x98f9ff87368695f08c181284e0738c7efffef5691139b437a42c4b7b35a71700 records Paused log 0 then TreasuryPaused log 1 in receipt and Mongo projection; API available at 125.
- **Result:** **PASS**.
- **Recommended action:** Preserve checkpoint-continuity regression for indexer changes.

## 8. LoanNFT and other NFT state

**INV-NFT-01 — completion certificate triple**

- **Module / invariant:** LoanNFTV2; only zero-debt completed loans mint exactly lender, borrower, platform certificates once; URIs are nonempty/hash-matched and valuation provenance is stored.
- **Source:** Approved Lending/P2P completion workflow and implementation.
- **Contract/function:** mintCompletionCertificates(), _validateMetadata(), completionCreated, loanCertificates.
- **Existing test:** test/LendingV2.test.ts and P2P completion evidence.
- **Cross-module dependency:** LoanManagerV2, OracleAdapterV2, IPFS metadata.
- **Current evidence:** P2P #7/#8/#9 evidence; duplicate/debt/provenance rejection in tests.
- **Result:** **PASS**.
- **Recommended action:** Add terminal event order: repayment -> zero debt -> certificates -> collateral release.

**INV-NFT-02 — Legion hierarchy and transfer safety**

- **Module / invariant:** LegionNFTV2 preserves hierarchy/identifier validity, role-restricted minting/metadata, paused writes, and consumed approved transfer requests; it has no payable financial path.
- **Source:** Implementation-derived locked Legion scope.
- **Contract/function:** Legion hierarchy, transfer-request, invalidate, approval, and pause functions.
- **Existing test:** test/LegionNFTV2.test.ts.
- **Cross-module dependency:** Legion Marketplace Settlement Adapter.
- **Current evidence:** Legion API AVAILABLE at 125; suite covers hierarchy, uniqueness, batches, pause, and replay.
- **Result:** **PASS**.
- **Recommended action:** Geographic meaning/procurement/Franchise policy is excluded and **UNSPECIFIED / OWNER DECISION REQUIRED**.

## 9. Phase 10A NFT marketplace

**INV-MKT-10A-01 — non-custodial atomic ABCD/NFT exchange**

- **Module / invariant:** ABCDNFTMarketplaceV2; a seller-owned approved token lists once, exact ABCD reaches seller and NFT reaches buyer atomically, with no fee, royalty, native payment, Treasury balance, or withdrawal path.
- **Source:** Locked Phase 10A owner-approved scope and implementation.
- **Contract/function:** createListing(), cancelListing(), purchaseListing().
- **Existing test:** test/marketplace/ABCDNFTMarketplaceV2.test.ts.
- **Cross-module dependency:** ABCDTokenV2 and admitted ERC-721 ownership.
- **Current evidence:** Tests cover settlement, stale ownership/approval, balance/allowance, rollback, replay, and pause; API available at 125.
- **Result:** **PASS**.
- **Recommended action:** Fees, royalties, and auctions remain **UNSPECIFIED — DO NOT INVENT**.

## 10. Phase 10B Legion marketplace settlement

**INV-MKT-10B-01 — named-buyer atomic settlement**

- **Module / invariant:** LegionMarketplaceSettlementAdapterV2 settles exact ABCD and Legion ownership only for named buyer of seller-linked approved request; all terminal/unapproved/wrong-buyer/balance/allowance/pause/replay paths fail closed.
- **Source:** Owner-approved Phase 10B extension, not a public generic market.
- **Contract/function:** createSale(), linkTransferRequest(), markNotSettleable(), settleSale().
- **Existing test:** test/marketplace/LegionMarketplaceSettlementAdapterV2.test.ts.
- **Cross-module dependency:** LegionNFTV2 request and ABCDTokenV2.
- **Current evidence:** Suite covers exact buyer, terminal sale states, pause, role separation, reentrancy; API available at 125.
- **Result:** **PASS**.
- **Recommended action:** Broader listing/auction/fee mechanics are **UNSPECIFIED — DO NOT INVENT**.

## 11. Cross-module invariants

**INV-XMOD-01 — Lending to Reserve**

- **Module / invariant:** Reserve is not an originator, repayment pool, or P2P fallback; only canonical Direct collateral recovery can reach bounded cover.
- **Source:** Approved Lending/Reserve scope.
- **Contract/function:** LiquidationV2 and InsuranceReserveV2.cover().
- **Existing test:** test/LendingV2.test.ts Reserve and P2P policy cases.
- **Cross-module dependency:** LoanManagerV2 risk state.
- **Current evidence:** Direct waterfall tests pass; P2P substitution reverts.
- **Result:** **PASS**.
- **Recommended action:** Any P2P Reserve use requires owner decision.

**INV-XMOD-02 — Lending to Referral**

- **Module / invariant:** Referral attaches to actual originated/funded loan and lifecycle plus funded vault gate payout.
- **Source:** Approved Referral core lifecycle.
- **Contract/function:** registerLoan(), recordLoanCompletion(), claimAccruedReward().
- **Existing test:** test/LendingReferralV2.test.ts.
- **Cross-module dependency:** loan state and Marketing reward vault.
- **Current evidence:** Loan #3 and Referral tests.
- **Result:** **PASS**.
- **Recommended action:** Certificate scope remains deferred in INV-REF-03.

**INV-XMOD-03 — Lending to LoanNFT**

- **Module / invariant:** No certificate at origination; terminal zero-debt Direct/P2P path with metadata/valuation is mandatory.
- **Source:** Approved completion workflow.
- **Contract/function:** LoanNFTV2.mintCompletionCertificates() and terminal EMI path.
- **Existing test:** test/LendingV2.test.ts.
- **Cross-module dependency:** oracle and IPFS metadata.
- **Current evidence:** P2P #7/#8/#9 and Direct certificate tests.
- **Result:** **PASS**.
- **Recommended action:** See INV-NFT-01 event-order test.

**INV-XMOD-04 — Treasury isolation**

- **Module / invariant:** Treasury has no automatic allocation, distribution, yield, Reserve, lending, or native-custody routing.
- **Source:** Owner-approved Treasury foundation.
- **Contract/function:** TreasuryV2 public surface.
- **Existing test:** test/TreasuryV2.test.ts.
- **Cross-module dependency:** configured ERC-20 asset only.
- **Current evidence:** Contract has no automatic external module call.
- **Result:** **PASS**.
- **Recommended action:** Expanded economics remains **UNSPECIFIED / OWNER DECISION REQUIRED**.

**INV-XMOD-05 — marketplace payment/ownership conservation**

- **Module / invariant:** Every successful 10A/10B payment has one ownership transfer; failed/replayed settlement changes neither asset nor state.
- **Source:** Approved Phase 10A/10B mechanisms.
- **Contract/function:** purchaseListing(), settleSale().
- **Existing test:** both marketplace suites.
- **Cross-module dependency:** ABCDTokenV2 and ERC-721 state.
- **Current evidence:** Atomicity/reentrancy/failure tests pass.
- **Result:** **PASS**.
- **Recommended action:** Add production-indexer differential tests after Testnet authorisation.

## 12. Failure-state invariants

**INV-FAIL-01 — pause and unauthorised caller fail closed**

- **Module / invariant:** Token, ICO, Lending, Reserve, Treasury, Legion, 10A/10B; mutable paths require target-local role and pause policy, not application-admin identity.
- **Source:** Implementation-derived and Admin Control Plane architecture.
- **Contract/function:** module onlyRole and whenNotPaused guards.
- **Existing test:** contract suites and canonical Admin control-plane tests.
- **Cross-module dependency:** connected signer, live target role, indexer/API audit.
- **Current evidence:** Role-aware Admin UI and contract tests demonstrate fail-closed behavior.
- **Result:** **PASS**.
- **Recommended action:** Production role custody and incident procedure is a **PRODUCTION-ONLY DEPENDENCY**.

**INV-FAIL-02 — failed transfer, duplicate/replay, and terminal state are atomic**

- **Module / invariant:** ICO, Lending, Referral, Treasury, LoanNFT, marketplaces; a revert has no misleading success accounting/ownership/projection and duplicate paths fail.
- **Source:** Implementation-derived.
- **Contract/function:** SafeERC20/nonReentrant guards, operation IDs, terminal mappings.
- **Existing test:** ICO V3, Lending V2, Referral, Treasury, marketplace suites; Direct scenario D.
- **Cross-module dependency:** token transfer semantics and event projection.
- **Current evidence:** Tests cover failed allowance/balance, stale owner, duplicate claim/settlement, replay, and full-seizure revert.
- **Result:** **PASS**.
- **Recommended action:** Add no-event/no-projection-after-revert assertion per indexer event domain.

**INV-FAIL-03 — oracle failure produces no guessed economic state**

- **Module / invariant:** ICO V3/Lending V2/LoanNFT valuation; invalid price data reverts purchase/risk/liquidation/valuation paths.
- **Source:** Approved ICO/Lending specifications and implementation.
- **Contract/function:** ICO _bnbUsdWad(), OracleAdapterV2, LoanNFT valuation.
- **Existing test:** test/ICOManagerV3.test.ts and test/LendingV2.test.ts.
- **Cross-module dependency:** external price feeds.
- **Current evidence:** Oracle/circuit-breaker tests pass; local UI presents unavailable price rather than fabricated value.
- **Result:** **PASS** locally.
- **Recommended action:** BSC oracle policy remains **OWNER/PRODUCTION DECISION REQUIRED**.

**INV-FAIL-04 — stale read model fails closed**

- **Module / invariant:** six canonical APIs/Admin; stale checkpoint/hash/runtime/deployment evidence is not presented as current.
- **Source:** Canonical Admin/read-model architecture.
- **Contract/function:** backend indexer checkpoint validators/status APIs.
- **Existing test:** projection-context, Treasury projection, canonical Admin-read and UX tests.
- **Cross-module dependency:** chain head -> indexer -> MongoDB -> API -> Admin UI.
- **Current evidence:** Catch-up reached block 125; all six status APIs are AVAILABLE with canonical provenance.
- **Result:** **PASS**.
- **Recommended action:** Add interrupted multi-indexer recovery test that rejects mixed-height dashboard data.

## 13. Evidence matrix

Every detailed entry above supplies required ID, module, invariant, source,
contract/function, existing test, dependency, current evidence, result, reason,
and action.

- INV-GOV-01: **BLOCKED** — allocation-document authority conflict.
- INV-TOKEN-01 through INV-TOKEN-02: **PASS** for deployed cap/restrictions; document interpretation remains qualified.
- INV-ICO-01 through INV-ICO-03: **PASS** for mechanics; icoWallet nomenclature is **BLOCKED** by INV-GOV-01.
- INV-LEND-01 through INV-LEND-03: **PASS**.
- INV-P2P-01 through INV-P2P-03: **PASS** for implemented safety; future recovery economics **UNSPECIFIED**.
- INV-REF-01 and INV-REF-02: **PASS**; INV-REF-03 canonical certificate E2E **BLOCKED** by owner deferral.
- INV-RES-01 through INV-RES-02, INV-TREAS-01 through INV-TREAS-02, INV-NFT-01 through INV-NFT-02, INV-MKT-10A-01, INV-MKT-10B-01, INV-XMOD-01 through INV-XMOD-05, and INV-FAIL-01 through INV-FAIL-04: **PASS** locally.

## Ten high-risk invariant gaps

These are planning categories, not invented severity scores.

1. **Economic conservation — BLOCKED:** active seven-allocation 1Q authority conflicts with older eight-allocation Phase 6 language.
2. **Protocol correctness — UNSPECIFIED:** P2P partial-liquidation/default recovery economics remain unavailable by design.
3. **Economic conservation — BLOCKED:** Referral Certificate metadata/mint E2E is deferred.
4. **Security — OWNER/PRODUCTION DECISION REQUIRED:** production signer custody, rotation, incident and separation-of-duties procedure.
5. **Protocol correctness — OWNER/PRODUCTION DECISION REQUIRED:** BSC oracle source, heartbeat, deviation, decimals and incident policy.
6. **Economic conservation — OWNER/PRODUCTION DECISION REQUIRED:** production liquidity/sale-route evidence.
7. **Recoverability — TEST COVERAGE GAP:** no interrupted multi-indexer mixed-height recovery property test.
8. **Test coverage — GAP:** no aggregate ICO BNB conservation sequence.
9. **Test coverage — GAP:** no aggregate Direct obligation/recovery/residual-debt property sequence.
10. **Protocol correctness — UNSPECIFIED:** Treasury multisig/timelock, native custody, routing and expanded economics.

## Exact tests recommended next

1. test/ABCDTokenV2.test.ts: pinned active-manifest allocation balance and supply regression.
2. test/ICOManagerV3.test.ts: two-buyer/two-stage purchase, refund, cancellation, finalization, claim and BNB conservation sequence.
3. test/LendingV2.test.ts: property-style repayment allocation and liquidation equation over rounding boundaries.
4. test/P2PLendingIntegration.test.ts: multi-installment lender credits versus totalRepaid plus terminal certificate/collateral event order.
5. test/LendingReferralV2.test.ts: both directions and 12-period aggregate cap with API/indexer reconciliation.
6. backend/backend/__tests__: a reverted transaction creates neither success projection nor confirmed audit record for every event domain.
7. Indexer suites: interrupted resume at unequal checkpoints rejects mixed-height provenance.

## Conclusion

The system is **ready to proceed to additional local failure/recovery testing only
for already specified canonical behavior**: atomic reverts, role/pause, oracle,
indexer continuity, repayment, liquidation, and settlement. It is **not
authorised to infer new economic outcomes** for blocked or unspecified items.
This audit makes no production-readiness claim and does not authorise BSC,
P2P recovery policy, Treasury expansion, or Referral Certificate minting.

## Change boundary

This document is the only artifact created by this audit. No deployment,
transaction, role/wallet change, checkpoint mutation, MongoDB mutation, IPFS
upload, Solidity change, tokenomics/economic change, or Franchise work occurred.

## Current revalidation — 2026-10-03

**Audit method.** This section preserves the historical 32-record audit above
and revalidates it against the current contracts, manifests, projection/API
tests, locks, and the completed disposable recovery harnesses. A current
classification below is deliberately singular. Historical uses of
`UNSPECIFIED` retain their existing meaning as **WHITEPAPER/OWNER SPEC
UNSPECIFIED — DO NOT INVENT**; this revalidation does not change protocol
policy or resolve governing-document conflicts.

**Evidence boundary.** Canonical evidence remains the protected `1Q_LOCAL`
family, chain `31337`, identity
`08af1c8d48ebfb5a9424097780192c3d40b430205b59d0622079e6659504d34b`,
and the documented block-125 checkpoint. Gap #1 and Gap #2 use only
`CROSS_LAYER_REVERT_TEST`, chain `31338`, loopback port `18545`, generated
`cross_layer_revert_*` databases, and disposable fixture manifests. They do
not alter or substitute canonical deployment provenance.

| Invariant ID | Revalidated invariant / authoritative source | Current contract, test, and recovery evidence | Cross-module dependency | Current classification | Exact reason and next action |
| --- | --- | --- | --- | --- | --- |
| INV-GOV-01 | One allocation authority; active 1Q owner decision | Owner confirmation dated 2026-10-03; `ABCDTokenV2` seven-allocation model, root manifest, `ABCDTokenV2.test.ts` | Token → all ABCD modules | PASS / CLOSED | The active system is authoritatively the seven-allocation 1Q model, with 18 decimals and fixed total supply `1,000,000,000,000,000 ABCD`; the older 1B/eight-allocation Phase 6 wording is superseded for the active system. |
| INV-TOKEN-01 | Fixed cap/allocation conservation | `maxSupply`, `totalSupply`, `allocation`; `ABCDTokenV2.test.ts` | ICO, Lending, Reserve, Treasury, markets | PASS | Active 1Q arithmetic is internally consistent; interpretation remains governed by INV-GOV-01. |
| INV-TOKEN-02 | Bounded mint/burn and pause | `mint`, `burnFromTreasury`, `_update`; token tests | All ABCD transfers | PASS | Cap, role and pause reverts remain covered. |
| INV-ICO-01 | Two-stage 50M inventory conservation | `ICOManagerV3.stage`, `buy`; `ICOManagerV3.test.ts` | ABCD ICO inventory/custody | PASS | Stage/global inventory checks and V3 projection binding remain covered. |
| INV-ICO-02 | BNB payment, eligibility, cap and oracle safety | `buy`, `_bnbUsdWad`; V3 tests plus Gap #1 rejected V3 receipt/projection evidence | Feed and native BNB | PASS | Reverted V3 operation produced status 0/no success projection in the isolated harness. |
| INV-ICO-03 | TGE/vesting/cancel/refund/unsold return | `configureTge`, `finalize`, `cancel`, `claim`; V3 tests | ICO custody | PASS | Mechanics remain tested; historical 1B/eight-allocation language has no active-system authority. |
| INV-LEND-01 | Direct principal/debt/repayment conservation | `LoanManagerV2`, `EMIManagerV2`; `LendingV2.test.ts` | Token, schedule, LoanNFT | PASS | Existing local E2E and repayment tests remain green. |
| INV-LEND-02 | Collateral/risk/cure/liquidation atomicity | `CollateralVaultV2`, `LiquidationV2`; Lending tests/scenarios; Gap #1 | Oracle, Reserve | PASS | Reverted Direct Lending call produced status 0, no success log/projection, and idempotent resume. |
| INV-LEND-03 | Collateral → Reserve → residual-debt waterfall | `InsuranceReserveV2.cover`; Lending tests | Liquidation/Reserve | PASS | Bounded authorised cover and explicit residual path remain covered. |
| INV-P2P-01 | Funded request binds one loan/schedule/lender credit | `LoanMarketplaceV2`, `EMIManagerV2`; P2P tests/lock | Token, Vault, LoanNFT | PASS | Locked Request #1/Loan #4 lifecycle and P2P-only history remain intact. |
| INV-P2P-02 | Terminal zero-debt settlement/collateral/certificate triple | `payOutstandingWithCompletionMetadata`; P2P/Lending tests and lock | Metadata, LoanNFT, Vault | PASS | Completion/certificate/collateral evidence remains locked. |
| INV-P2P-03 | No invented P2P recovery economics | P2P settlement guards; Lending tests | Direct liquidation/Reserve | WHITEPAPER UNSPECIFIED | Default/partial-sale/Reserve/residual P2P policy is deliberately fail-closed pending an explicit specification. |
| INV-REF-01 | 0.05% monthly reward, twelve-period cap and vault funding | `MONTHLY_REWARD_BPS`, `claimAccruedReward`; Referral tests | Loan lifecycle/reward vault | PASS | Loan #3 payment evidence remains 0.035 ABCD; no reward minting. |
| INV-REF-02 | Binding, completion/default and replay protection | `bindReferrer`, `recordLoanCompletion`; Referral tests | Direct/P2P lifecycle | PASS | Two-direction lifecycle guards and duplicate/default protection remain covered. |
| INV-REF-03 | 0.5% certificate calculation versus metadata provenance | `mintReferralCertificate`; Referral tests and owner decision record | Metadata/IPFS | OWNER DECISION | Calculation/eligibility are covered; actual certificate URI/hash source and mint remain formally deferred. |
| INV-RES-01 | ABCD-only, bounded, once-only authorised cover | `InsuranceReserveV2.cover`; Lending tests and Gap #1 | Token/Liquidation | PASS | Reverted Reserve call has no success receipt log/projection in the isolated harness. |
| INV-RES-02 | Pause prevents partial cover | `pause`, `cover`; Lending tests | Liquidation atomicity | PASS | Pause failure retains state; no success event is asserted on reverted paths. |
| INV-TREAS-01 | Authorised exact/replay-safe accounting | `TreasuryV2.fund`, `executeTransfer`; Treasury tests | ABCD/custody | PASS | Existing authorised/replay evidence remains valid. Expanded custody/routing is not implied. |
| INV-TREAS-02 | Pause receipt/projection consistency | Treasury indexer/tests and block-123 receipt evidence | Admin/read model | PASS | Inherited `Paused` and `TreasuryPaused` remain reconciled without a checkpoint rewind. |
| INV-NFT-01 | Completion triples once with URI/hash provenance | `LoanNFTV2.mintCompletionCertificates`; Lending/P2P tests | Loan state/metadata | PASS | Debt/provenance/replay rejection and #7/#8/#9 evidence remain intact. |
| INV-NFT-02 | Legion hierarchy/transfer/pause safety | `LegionNFTV2`; Legion tests | Legion settlement | PASS | Existing hierarchy, role, pause and consumed-request coverage remains green. |
| INV-MKT-10A-01 | Atomic ABCD/NFT exchange | `purchaseListing`; marketplace tests and Gap #1 | Token/ERC-721 | PASS | Reverted Phase 10A receipt has status 0, no success event/projection and idempotent replay. |
| INV-MKT-10B-01 | Named-buyer Legion atomic settlement | `settleSale`; settlement tests and Gap #1 | Token/Legion NFT | PASS | Reverted Phase 10B receipt has status 0, no success event/projection and idempotent replay. |
| INV-XMOD-01 | Lending/Reserve boundary | Lending/Reserve tests | Lending ↔ Reserve | PASS | P2P substitution remains rejected; Direct waterfall remains bounded. |
| INV-XMOD-02 | Lending/Referral boundary | Referral tests/Loan #3 evidence | Lending ↔ Referral | PASS | Terminal payment remains distinct from deferred Referral Certificate minting. |
| INV-XMOD-03 | Lending/LoanNFT boundary | P2P completion tests/lock | Lending ↔ LoanNFT | PASS | Certificates require valid completed loan state and metadata provenance. |
| INV-XMOD-04 | Treasury isolation | `TreasuryV2` tests | Treasury ↔ all modules | PASS | No automatic protocol routing was introduced. |
| INV-XMOD-05 | Marketplace payment/ownership conservation | Phase 10A/10B tests | Token ↔ NFTs | PASS | Atomic/reentrancy/replay coverage remains valid. |
| INV-FAIL-01 | Role/pause failure safety | Contract/Admin tests | All protected modules | PASS | Unauthorized and paused writes fail closed. |
| INV-FAIL-02 | Revert/replay/terminal atomicity | Existing failure tests plus **Gap #1 CLOSED** | Contract → indexer → isolated Mongo/read result | PASS | Five representative modules prove status-0 receipt → zero success log → no success projection → restart/idempotence. |
| INV-FAIL-03 | Oracle failure has no guessed value | ICO/Lending tests and UI tests | External feeds | PASS | Invalid/stale/unavailable values fail closed; production feed policy remains separate. |
| INV-FAIL-04 | Stale model/provenance and recovery safety | Projection tests plus **Gap #2 CLOSED** | Chain → indexer → Mongo → read model | PASS | Disposable worker outage/restart proved stored checkpoint/hash continuity, missed-event recovery, exactly-once projection and idempotence. |

### Recovery evidence reconciliation

- **Gap #1 — PASS / CLOSED:** Direct Lending, Reserve/Liquidation, ICO V3,
  Phase 10A, and Phase 10B each have a real disposable status-0 receipt, zero
  successful logs, no successful isolated projection/read result, and
  checkpoint resume/idempotence evidence. This supplements — not replaces —
  the canonical contract suites.
- **Gap #2 — PASS / CLOSED (authorised disposable scope):** initial processing,
  Mongo connectivity outage, a failing fresh worker, process interruption,
  recovery from the persisted checkpoint, block-hash verification, exactly-once
  events and a zero-log replay were observed. The canonical HTTP API was
  intentionally not pointed to the fixture: it correctly rejects a
  non-`1Q_LOCAL` runtime, and no provenance boundary was weakened.

### Current classification summary

- **PASS:** 30
- **BLOCKED:** 0
- **FAIL:** 0
- **OWNER DECISION:** 1 — INV-REF-03.
- **WHITEPAPER UNSPECIFIED:** 1 — INV-P2P-03.

### Non-PASS actions

1. **INV-REF-03 — OWNER DECISION:** provide a distinct Referral Certificate
   metadata URI/hash source authorization before any real mint. Do not reuse
   LoanNFT completion metadata or fabricate IPFS content.
2. **INV-P2P-03 — WHITEPAPER UNSPECIFIED:** define P2P default/partial-sale,
   Reserve, residual-debt and recovery economics before exposing any such path.

### Owner documentation closure — INV-GOV-01

**Owner confirmation dated 2026-10-03:** The active canonical ABCDeFi token
authority is the current seven-allocation 1Q model. It has 18 decimals and a
fixed total supply of **1,000,000,000,000,000 ABCD**. For the active system,
the older 1B/eight-allocation Phase 6 documentation is superseded.

Accordingly, **INV-GOV-01 is CLOSED / PASS solely as a
documentation-authority reconciliation.** This decision does not amend
`ABCDTokenV2`, total supply, allocation values, deployment addresses,
manifests, runtime, checkpoints, indexers, APIs, or any on-chain state. The
historical entries above are retained as an audit record of the former
contradiction.

### Revalidation change boundary

This dated section and the corresponding Gap #1/#2 cross-reference are
documentation-only. It did not access or alter the protected runtime,
canonical MongoDB, canonical checkpoint, BSC/Testnet/Mainnet, or any protocol
state.
