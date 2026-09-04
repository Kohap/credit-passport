// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title CreditLine
/// @notice Mock Creditcoin borrow line. Cap = 100 mUSD + score * 2 mUSD.
contract CreditLine is Ownable {
    using SafeERC20 for IERC20;

    error CapExceeded(uint256 requested, uint256 available);
    error NotBorrower();

    IERC20 public immutable asset;
    address public updater;
    mapping(address => uint256) public borrowCapOf;
    mapping(address => uint256) public debtOf;

    event UpdaterUpdated(address indexed updater);
    event CapUpdated(address indexed borrower, uint256 cap);
    event Borrowed(address indexed borrower, uint256 amount, uint256 debt);
    event RepaidLocal(address indexed borrower, uint256 amount, uint256 debt);

    modifier onlyUpdater() {
        require(msg.sender == updater, "not updater");
        _;
    }

    constructor(address asset_, address owner_) Ownable(owner_) {
        require(asset_ != address(0), "asset");
        asset = IERC20(asset_);
    }

    function setUpdater(address updater_) external onlyOwner {
        updater = updater_;
        emit UpdaterUpdated(updater_);
    }

    /// @notice Cap formula: 100e18 + score * 2e18.
    function setCapFromScore(address borrower, uint256 score) external onlyUpdater {
        uint256 cap = 100 ether + (score * 2 ether);
        borrowCapOf[borrower] = cap;
        emit CapUpdated(borrower, cap);
    }

    function available(address borrower) public view returns (uint256) {
        uint256 cap = borrowCapOf[borrower];
        uint256 debt = debtOf[borrower];
        if (debt >= cap) return 0;
        return cap - debt;
    }

    function borrow(uint256 amount) external {
        uint256 avail = available(msg.sender);
        if (amount == 0 || amount > avail) revert CapExceeded(amount, avail);
        debtOf[msg.sender] += amount;
        asset.safeTransfer(msg.sender, amount);
        emit Borrowed(msg.sender, amount, debtOf[msg.sender]);
    }

    function repay(uint256 amount) external {
        uint256 debt = debtOf[msg.sender];
        if (amount == 0 || amount > debt) revert CapExceeded(amount, debt);
        asset.safeTransferFrom(msg.sender, address(this), amount);
        debtOf[msg.sender] = debt - amount;
        emit RepaidLocal(msg.sender, amount, debtOf[msg.sender]);
    }
}
