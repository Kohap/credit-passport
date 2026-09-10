# Aave repayment adapter: source alpha

Updated 2026-09-10. This is separate from the working human and Agent Passport demos.

## Verified in this review

- Thirteen local contract tests pass. The tests mock the Attestcoin verifier; they do not establish a valid live inclusion proof.
- Receipt tests cover asset, emitter, sender, target, status, amount, malformed topics, aToken rejection, replay rejection, and rollback after an invalid receipt.
- Sepolia DAI supply simulation still fails with error 51 (supply cap exceeded). No source transaction was sent during this review.
- The later CreditScore at `0x17d18e6FDd0aE48d15C0655D9Eb5f60C90DC07e8` has writer zero. Treat this deployment as incomplete.
- The historical ASC in the README predates the current receipt checks. It is not an approved current-source deployment. Alpha addresses are deliberately blank in `.env.example`.

## Scope and limitations

The adapter accepts a direct Pool repayment by the same wallet claiming credit, with the maximum amount sentinel and variable interest mode. The receipt must show a positive underlying-asset repayment to the same reserve by that borrower. See [Aave repayment logic](https://github.com/aave/aave-v3-core/blob/master/contracts/protocol/libraries/logic/BorrowLogic.sol).

This proves a historical action, not creditworthiness, identity, income, or absence of other debt. Small repeated borrow/repay cycles can increase the demo score. The trusted Pool is upgradeable: accepting historical receipts assumes the Pool implementation at that block had the expected semantics. Production use requires version-aware verification and an underwriting policy, not just this adapter.

## Remaining release gates

1. Obtain a genuine direct full variable-debt repayment from a debt-free test wallet without modifying an unrelated position.
2. Reconcile all earlier deployment transactions before deploying further contracts. Check bytecode, constructor bindings, owners, writer/updater/minter roles, and inventory.
3. Deploy the reviewed revision and record its exact source commit, addresses, and transaction receipts. Do not change the proven v2 or Agent Passport roles.
4. Generate and submit the real Attestcoin proof. Confirm score, cap, NFT, and replay rejection on CC3.
5. Only then configure the approved alpha addresses and publish live-proof claims.

## Local checks

```bash
cd packages/contracts-creditcoin
forge test --match-contract AaveV3RepaymentASCLogicTest -vv
cd ../..
bash scripts/aave-sepolia-e2e.sh --check
```

The script without `--check` sends testnet transactions and leaves supplied collateral in Aave. It refuses an account with existing debt, checks chain and decimals, and stops on unknown preflight errors. A passing preflight is not a guarantee that the subsequent borrow or repayment will succeed. Keep testnet funds available to recover a partially completed run.
