# Agent Passport

Agent Passport is a separate live testnet alpha of Credit Passport. It turns a client-approved, escrow-settled agent job on Sepolia into a non-transferable credential on Creditcoin CC3 through the same Attestcoin verification path used for repayments.

The live Credit Passport v2 deployment and its loan proof are unchanged. Agent Passport has its own contracts and must not be represented as a completed credential flow until its first funded job is Attestcoin-proven.

## Live testnet contracts

| Contract | Network | Deployment transaction |
| --- | --- | --- |
| `AgentJobEscrow` | Sepolia `0x294400Ddd3F6E11F04d0e16416cc677Dc134a2E1` | [`0x1c338322da3bb7acf2d103ace4bfadaa9600246001f42c0f11e76839484217b9`](https://sepolia.etherscan.io/tx/0x1c338322da3bb7acf2d103ace4bfadaa9600246001f42c0f11e76839484217b9) |
| `AgentPassportNFT` | Creditcoin `0x7c052F21153352bf326Ed3fDecC678fEFB177284` | [`0x40930767f3f7e4713725fedb753dd90622d7536455f3522928d530590ec30155`](https://creditcoin-testnet.blockscout.com/tx/0x40930767f3f7e4713725fedb753dd90622d7536455f3522928d530590ec30155) |
| `AgentPassportASC` | Creditcoin `0x965bdfEcD8ac53885d1d899E99814Af2752E16C8` | [`0xd7e4597cde65140397ec9f2e357991749100f75aa2f69e25c43847c59836b800`](https://creditcoin-testnet.blockscout.com/tx/0xd7e4597cde65140397ec9f2e357991749100f75aa2f69e25c43847c59836b800) |

The deployed ASC is the NFT minter and trusts only the deployed Sepolia escrow. The escrow is configured with the existing v2 Sepolia MockUSD at `0x3937cFf0385AF9aAA25212432f030Ddbb1B98798`.

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

## Re-deploy sequence

1. Deploy `AgentJobEscrow` to Sepolia using the chosen escrow asset.
2. Deploy `AgentPassportNFT` and `AgentPassportASC` to Creditcoin CC3, configuring the Sepolia escrow address.
3. Call `AgentPassportNFT.setMinter(agentPassportAsc)`.
4. Add the deployed addresses to a dedicated agent configuration before exposing the UI.
5. Run a real funded job, wait for its height to attest, generate a proof, and submit from the agent wallet.

The proof builder remains generic: it proves a Sepolia transaction. Only the destination function and expected event change from `proveRepayment` / `LoanRepaid` to `proveJobCompletion` / `JobCompleted`.
