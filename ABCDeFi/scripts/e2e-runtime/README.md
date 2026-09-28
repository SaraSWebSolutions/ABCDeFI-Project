# Persistent 1Q local E2E runtime

This directory contains local test infrastructure only. It does not alter a
protocol contract, a historical manifest, or a deployment family outside the
selected E2E runtime directory.

The wrapper uses the pinned local Anvil binary at
`.e2e-runtime/foundry-v1.8.3/anvil.exe`, chain `31337`, RPC `127.0.0.1:8546`,
and the deterministic local test mnemonic. Runtime artifacts are intentionally
ignored by Git beneath a versioned `.e2e-runtime/<runtime-name>/` directory.

## Procedure

1. Start a new empty local runtime only when a new E2E family is authorized:

   ```powershell
   node scripts/e2e-runtime/oneq-persistent-runtime.mjs start --fresh --runtime-dir .e2e-runtime/<runtime-name>
   ```

2. Deploy the explicitly selected isolated family and write its manifests under
   that same runtime directory. Never point these commands at a historical
   manifest path.

3. After any checkpoint-worthy E2E boundary, save a durable checkpoint:

   ```powershell
   node scripts/e2e-runtime/oneq-persistent-runtime.mjs checkpoint --runtime-dir .e2e-runtime/<runtime-name>
   ```

   The command validates Anvil's working state JSON and atomically copies it to
   `anvil-checkpoint-state.json`. The copy, checksum, chain ID, and block are
   recorded in `checkpoint-metadata.json`.

4. A process may then be stopped or lost. Recover the same state without a
   deployment command:

   ```powershell
   node scripts/e2e-runtime/oneq-persistent-runtime.mjs start --runtime-dir .e2e-runtime/<runtime-name>
   node scripts/e2e-runtime/oneq-persistent-runtime.mjs status --runtime-dir .e2e-runtime/<runtime-name>
   ```

   `start` fails closed for a malformed checkpoint or a conflicting listener.
   It uses `--load-state` only from the versioned E2E checkpoint.

5. Run `npm run e2e:oneq:persistence:recover` to create a disposable 1Q family
   and prove deployment, state, transaction history, bytecode, chain ID, and
   block recovery. Its evidence is written to
   `.e2e-runtime/oneq-persistence-v1/recovery-proof.json`.

The current helper intentionally does not start backend, indexer, or frontend;
those services must be explicitly bound to the recovered unified manifest only
after its deployment identity is verified.
