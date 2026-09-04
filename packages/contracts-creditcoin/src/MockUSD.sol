// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockUSD (Creditcoin)
/// @notice Inventory token for the Creditcoin mock credit line.
contract MockUSD is ERC20, Ownable {
    constructor(address owner_) ERC20("Mock USD", "mUSD") Ownable(owner_) {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
