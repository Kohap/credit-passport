// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockUSD
/// @notice Sepolia test ERC20 with a public faucet mint for the Credit Passport demo.
contract MockUSD is ERC20, Ownable {
    uint256 public constant FAUCET_AMOUNT = 1_000 ether;

    error FaucetCooldown(uint256 nextMintAt);

    mapping(address => uint256) public lastFaucetAt;

    constructor() ERC20("Mock USD", "mUSD") Ownable(msg.sender) {}

    /// @notice Mint FAUCET_AMOUNT to the caller (rate-limited to once per hour).
    function faucet() external {
        uint256 last = lastFaucetAt[msg.sender];
        if (last != 0) {
            uint256 next = last + 1 hours;
            if (block.timestamp < next) revert FaucetCooldown(next);
        }
        lastFaucetAt[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
    }

    /// @notice Inventory mint for the deployer-owned market and local tests.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
