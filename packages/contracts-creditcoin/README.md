# contracts-creditcoin

Uses `@gluwa/asc-contracts` for `EvmV1Decoder` + `INativeQueryVerifier`.

```bash
forge install foundry-rs/forge-std@v1.9.4 OpenZeppelin/openzeppelin-contracts@v5.0.2 --no-commit
npm install @gluwa/asc-contracts@0.2.1
forge test
# Requires SEPOLIA_MOCK_MARKET from Sepolia deploy:
forge script script/Deploy.s.sol:DeployCreditcoin --rpc-url $CREDITCOIN_RPC_URL --broadcast
```

Live `0xFD2` verification only works on CC3 testnet. Unit tests cover scoring, caps, soulbound NFT, and wrong-chainKey revert.
