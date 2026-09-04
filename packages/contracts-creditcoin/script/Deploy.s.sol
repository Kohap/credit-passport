// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {MockUSD} from "../src/MockUSD.sol";
import {CreditScore} from "../src/CreditScore.sol";
import {CreditLine} from "../src/CreditLine.sol";
import {PassportNFT} from "../src/PassportNFT.sol";
import {CreditPassportASC} from "../src/CreditPassportASC.sol";

/// @notice Deploy Credit Passport stack on Creditcoin CC3 testnet.
/// @dev Requires SEPOLIA_MOCK_MARKET env (the trusted Sepolia emitter address).
contract DeployCreditcoin is Script {
    function run() external {
        uint256 pk = vm.envUint("CREDITCOIN_PRIVATE_KEY");
        address sepoliaMarket = vm.envAddress("SEPOLIA_MOCK_MARKET");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);

        MockUSD usd = new MockUSD(deployer);
        CreditScore score = new CreditScore(deployer);
        CreditLine line = new CreditLine(address(usd), deployer);
        PassportNFT nft = new PassportNFT(deployer);
        CreditPassportASC asc =
            new CreditPassportASC(sepoliaMarket, address(score), address(line), address(nft));

        score.setWriter(address(asc));
        line.setUpdater(address(asc));
        nft.setMinter(address(asc));
        usd.mint(address(line), 10_000_000 ether);

        vm.stopBroadcast();

        console2.log("CREDITCOIN_MOCK_USD", address(usd));
        console2.log("CREDITCOIN_CREDIT_SCORE", address(score));
        console2.log("CREDITCOIN_CREDIT_LINE", address(line));
        console2.log("CREDITCOIN_PASSPORT_NFT", address(nft));
        console2.log("CREDITCOIN_PASSPORT_ASC", address(asc));
        console2.log("trusted Sepolia MockMarket", sepoliaMarket);
    }
}
