# Aave repayment adapter: verified testnet alpha

Updated 2026-09-10. This is separate from the working human and Agent Passport demos.

## Verified in this review

- Thirteen local contract tests pass. The tests mock the Attestcoin verifier; they do not establish a valid live inclusion proof.
- Receipt tests cover asset, emitter, sender, target, status, amount, malformed topics, aToken rejection, replay rejection, and rollback after an invalid receipt.
- DAI supply is full, so the verified source run used the official LINK reserve instead.
- The current deployment at `0x2fe50115eE40c4264b643a23102e4cEf88A2AebB` matches the reviewed bytecode and has all three writer roles bound.
- The four Aave alpha contracts are source-verified on Creditcoin Blockscout with Solidity `0.8.28`, optimizer runs `200`, via-IR, and Shanghai EVM settings.
- The live proof was submitted at `https://creditcoin-testnet.blockscout.com/tx/0xac4ee54fda4821b896c654298a5e4a37d016c64befed0f3bcf6260fd361095d2`.

## Scope and limitations

The adapter accepts a direct Pool repayment by the same wallet claiming credit, with the maximum amount sentinel and variable interest mode. The receipt must show a positive underlying-asset repayment to the same reserve by that borrower. See [Aave repayment logic](https://github.com/aave/aave-v3-core/blob/master/contracts/protocol/libraries/logic/BorrowLogic.sol).

This proves a historical action, not creditworthiness, identity, income, or absence of other debt. Small repeated borrow/repay cycles can increase the demo score. The trusted Pool is upgradeable: accepting historical receipts assumes the Pool implementation at that block had the expected semantics. Production use requires version-aware verification and an underwriting policy, not just this adapter.

## Remaining limitations

1. This is a testnet alpha, not production underwriting.
2. DAI supply capacity is currently full; LINK was used for the verified run.
3. The adapter covers one reserve's variable debt and does not assess identity, income, or other debt.

## Browser flow

The Desk now supports the complete testnet sequence from the connected wallet: receive public LINK and USDC test assets, supply LINK, borrow 1 USDC variable debt, repay with Aave's full-close sentinel, wait for the hosted Attestcoin proof, and submit `proveAaveRepayment` on Creditcoin. The CLI remains an optional recovery and reproducibility path, not the primary judge flow.

## Local checks

```bash
cd packages/contracts-creditcoin
forge test --match-contract AaveV3RepaymentASCLogicTest -vv
cd ../..
bash scripts/aave-sepolia-e2e.sh --check
```

The script without `--check` sends testnet transactions and leaves supplied collateral in Aave. It refuses an account with existing debt, checks chain and decimals, and stops on unknown preflight errors. A passing preflight is not a guarantee that the subsequent borrow or repayment will succeed. Keep testnet funds available to recover a partially completed run.
