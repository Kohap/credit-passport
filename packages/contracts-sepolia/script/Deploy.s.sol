// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console2} from "forge-std/Script.sol";
import {MockUSD} from "../src/MockUSD.sol";
import {MockMarket} from "../src/MockMarket.sol";

/// @notice Deploy MockUSD + MockMarket on Sepolia and seed the market inventory.
contract DeploySepolia is Script {
    function run() external {
        uint256 pk = vm.envUint("SEPOLIA_PRIVATE_KEY");
        vm.startBroadcast(pk);

        MockUSD usd = new MockUSD();
        MockMarket market = new MockMarket(address(usd));
        usd.mint(address(market), 10_000_000 ether);

        vm.stopBroadcast();

        console2.log("SEPOLIA_MOCK_USD", address(usd));
        console2.log("SEPOLIA_MOCK_MARKET", address(market));
    }
}
