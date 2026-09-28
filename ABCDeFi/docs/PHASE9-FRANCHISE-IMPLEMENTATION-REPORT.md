# Phase 9 Franchise V2 Implementation Report

## Implemented

The canonical owner-approved V2 implementation adds `FranchiseNFTV2` and `FranchiseRegistryV2`, bound to a live `LegionNFTV2` contract/token. It adds an isolated local manifest/deployment script, a dedicated `canonical-franchise-v2-legion-bound` indexer/projection, hash-verified read API, canonical user application/assignment/controlled-transfer view, and role-gated Admin console.

Legacy Franchise NFT/Registry, mock records, and legacy economic/marketplace screens remain non-canonical and are not used by `/api/franchise-v2` or the active Franchise Registry dashboard.

## Local E2E evidence

An isolated chain 31337 deployment was used:

- LegionNFTV2: `0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0`, block 38.
- FranchiseNFTV2: `0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82`, block 39.
- FranchiseRegistryV2: `0x9A676e781A523b5d0C0e43731313A708CB607508`, block 40.
- Deployment version: `franchise-v2-local-0xaa9e256b4cccc2a36f132600716b144ed694dec4b03bb9072c9aa463809362d7`.

Real receipts created Country #1 (block 42), State #2 (43), District #3 (44), completed Legion transfer request/approval/execution (45–47), submitted/approved/minted Franchise #1 (48–50), and completed Franchise transfer request/approval/execution (51–53). Final Franchise owner and Registry operator both equal `0x976EA74026E726554dB657fA54763abd0C3a0aa9`; status is ACTIVE.

The indexer checkpoint reached block 53 in local MongoDB. The canonical API returned AVAILABLE and a four-event Franchise history: FranchiseMinted, FranchiseTransferRequested, FranchiseTransferApproved, FranchiseTransferred.

## Validation

- `test/FranchiseV2.test.ts`: 8 passing, including direct-transfer/approval rejection, lifecycle/replay boundaries, pause, metadata lockstep, and receiver callback reentrancy rejection.
- canonical V2 user/Admin UX static regression: passed.
- legacy Franchise projection focused regression: 9 passing; historical foundation remains separate.
- no BSC/Testnet/Mainnet deployment occurred.

The pre-existing generated ICO TypeChain trailing whitespace remains unrelated and untouched.
