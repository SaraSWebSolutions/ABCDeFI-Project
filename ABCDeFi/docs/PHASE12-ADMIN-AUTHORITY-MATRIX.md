# Phase 12 - Admin Authority Matrix

## Canonical rule

Admin is an authenticated control console. It has no independent on-chain
superuser authority. A connected wallet may act only when the target contract
already grants that wallet the required role and the action remains within the
locked module boundary.

| Module | Admin can | Admin cannot | Required on-chain role | Contract function / event | Canonical API/dashboard | Test boundary |
| --- | --- | --- | --- | --- | --- | --- |
| P2P | Observe canonical indexed lending state; expose only already-authorized module operations. | Rewrite loans, seize collateral, or bypass P2P settlement. | Existing module-local operator only. | Existing V2 events only. | `/api/lending`, `/api/lending-v2`; status-only unless a supported role action is present. | Existing lending regression. |
| Direct Lending | Observe local V2 state and existing permitted role capability. | Change debt/collateral/interest or cure/default state arbitrarily. | Existing LendingPool/LoanManager roles only. | Existing V2 events only. | Canonical lending APIs. | Existing Lending V2 regression. |
| Loan NFTs | Observe certificate provenance. | Mint/burn/transfer/rewrite user certificates outside completion flow. | `MINTER_ROLE` / completion operators only. | `LoanNFTV2` completion events. | Canonical lending metadata API. | Loan NFT regression. |
| Fees + Referral | Observe existing referral state; invoke no new financial action. | Change locked economics, rewards, or allocations. | Existing referral operator only. | Existing referral events. | Canonical lending path only. | Referral regression. |
| Reserve | Show deployment/role capability and existing indexer health. | Arbitrary `cover`, funding formula, Treasury integration, or debt forgiveness. | `RESERVE_FUNDER_ROLE` / `RESERVE_OPERATOR_ROLE` only. | `fund`, `cover` events through existing engine. | Canonical lending path only. | Reserve/Phase 5 regression. |
| ICO | Show status; existing role-gated finalization/cancellation/pause UI remains subject to the approved active/unlocked Phase 6 ICO boundary. | Alter stages, price, supply, inventory, claims, vesting, or proceeds policy. | `ICO_ADMIN_ROLE`, `PAUSER_ROLE` only. | `finalize`, `cancel`, `pause`, `unpause` and actual events. | `/api/ico-v2`; unavailable without V2 manifest/indexer. | ICO V2 regression. |
| Legion | Show roles/provenance and existing allowed administration. | Bypass LEG-44, direct transfer, public approval, hierarchy/parent mutation, or financial rights. | Legion-local roles only. | Locked Legion V2 events. | `/api/legion-nft-v2`. | Legion V2 regression. |
| Franchise | Show roles/provenance and existing Registry actions. | Bypass Registry transfer, add commercial rights, pricing, revenue, or Treasury paths. | Registry-local roles only. | Registry events only. | `/api/franchise`. | Franchise regression. |
| Marketplace | Show allowlist/listing/provenance and existing role capability. | Arbitrary settlement, fee/royalty/commission, or unsupported collection allowlisting. | `MARKETPLACE_ADMIN_ROLE` / `PAUSER_ROLE` only. | Marketplace events only. | `/api/abcd-nft-marketplace-v2`. | Marketplace regression. |
| Legion Marketplace | Show targeted-sale provenance and capability. | Bypass LEG-44, named-buyer binding, settlement role separation, or atomic settlement. | Dedicated settler/Legion roles only. | Phase 10B events only. | `/api/legion-marketplace-v2`. | Phase 10B regression. |
| Treasury | Show configured assets, role capability, indexed history, and health. | Arbitrary withdrawal, allocation, routing, Reserve funding, or asset seizure. | Treasury-local manager/operator/pause roles only. | `TreasuryV2` configured/fund/transfer/pause events. | `/api/treasury-v2`. | TreasuryV2 regression. |
| Governance | Nothing. | Invoke proposal, voting, Treasury, or role authority. | None. | None. | Explicitly out of scope. | No Phase 12 governance action. |

## Mandatory write lifecycle

`Admin dashboard -> connected wallet -> target contract role check -> mined
receipt with expected event -> existing canonical indexer -> canonical API ->
dashboard reconciliation`.

No hash alone is success. Any unavailable manifest/indexer/API or missing
wallet role produces an unavailable/not-authorized state and no write action.
