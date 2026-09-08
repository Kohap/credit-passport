# Agent Passport

Agent Passport is a separate, not-yet-deployed extension of Credit Passport. It turns a client-approved, escrow-settled agent job on Sepolia into a non-transferable credential on Creditcoin CC3 through the same Attestcoin verification path used for repayments.

The live Credit Passport v2 deployment and its loan proof are unchanged. Do not present the Agent Passport contracts as deployed until their own Sepolia and Creditcoin addresses are published.

## What counts as completion

1. A client funds `AgentJobEscrow.createJob(agent, amount, briefHash)` with mUSD.
2. The designated agent calls `submitWork(jobId, resultHash)`. The result itself remains offchain; `resultHash` is a public commitment to it.
3. The client calls `approveCompletion(jobId)`. Escrow releases the exact mUSD amount and emits `JobCompleted`.
4. The agent obtains the Attestcoin inclusion proof for that Sepolia transaction and calls `AgentPassportASC.proveJobCompletion` from the same agent wallet.
5. Creditcoin verifies the source receipt and trusted escrow event, then mints or updates the agent's soulbound `AgentPassportNFT` with cumulative completed jobs and settled volume.

## Verification boundaries

- The agent cannot fund a job for itself in one wallet. Client and agent must differ.
- Only the assigned agent can submit a result commitment.
- Only the funding client can release payment.
- A client can cancel only before a result is submitted. Submitted work intentionally has no unilateral cancellation path; a production protocol needs a dispute resolver with explicit governance and incentives.
- The Creditcoin ASC requires a successful source receipt, the trusted escrow emitter, the expected event signature and topic layout, a nonzero payment and result commitment, caller/agent equality, and a per-agent/job replay guard.
- This prevents a bare self-claim, but it does not solve multi-wallet Sybil behavior. A production rollout should bind agent wallets to an identity registry such as ERC-8004, add counterparty-quality policy, and introduce economically accountable dispute resolution.

## Deploy sequence

1. Deploy `AgentJobEscrow` to Sepolia using the chosen escrow asset.
2. Deploy `AgentPassportNFT` and `AgentPassportASC` to Creditcoin CC3, configuring the Sepolia escrow address.
3. Call `AgentPassportNFT.setMinter(agentPassportAsc)`.
4. Add the deployed addresses to a dedicated agent configuration before exposing the UI.
5. Run a real funded job, wait for its height to attest, generate a proof, and submit from the agent wallet.

The proof builder remains generic: it proves a Sepolia transaction. Only the destination function and expected event change from `proveRepayment` / `LoanRepaid` to `proveJobCompletion` / `JobCompleted`.
