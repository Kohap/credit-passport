// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title MockMarket
/// @notice Tiny Sepolia mock loan book whose LoanRepaid event is the Attestcoin signal.
/// @dev Keep this minimal. Creditcoin ASC trusts THIS address as the only valid emitter.
contract MockMarket {
    using SafeERC20 for IERC20;

    error InvalidAmount();
    error LoanNotActive();
    error NotBorrower();
    error InsufficientDebt();

    struct Loan {
        address borrower;
        uint256 principal;
        uint256 debt;
        bool active;
    }

    IERC20 public immutable asset;
    uint256 public nextLoanId = 1;
    mapping(uint256 => Loan) public loans;

    event LoanOpened(
        address indexed borrower, uint256 indexed loanId, uint256 principal, uint64 timestamp
    );

    /// @notice Cross-chain signal. Do NOT replace with a generic ERC20 Transfer.
    event LoanRepaid(
        address indexed borrower,
        uint256 indexed loanId,
        uint256 amountRepaid,
        uint256 remainingDebt,
        uint64 timestamp
    );

    constructor(address asset_) {
        require(asset_ != address(0), "asset required");
        asset = IERC20(asset_);
    }

    /// @notice Open a mock loan: pull `principal` from the market inventory into the borrower.
    /// @dev Deploy script pre-funds this contract. Borrower must have been fauceted separately
    ///      for repayments; for demos we also mint via MockUSD.mint into the market.
    function openLoan(uint256 principal) external returns (uint256 loanId) {
        if (principal == 0) revert InvalidAmount();
        loanId = nextLoanId++;
        loans[loanId] =
            Loan({borrower: msg.sender, principal: principal, debt: principal, active: true});
        asset.safeTransfer(msg.sender, principal);
        emit LoanOpened(msg.sender, loanId, principal, uint64(block.timestamp));
    }

    /// @notice Repay `amount` against an active loan. Emits LoanRepaid for Attestcoin.
    function repay(uint256 loanId, uint256 amount) external {
        Loan storage loan = loans[loanId];
        if (!loan.active) revert LoanNotActive();
        if (loan.borrower != msg.sender) revert NotBorrower();
        if (amount == 0) revert InvalidAmount();
        if (amount > loan.debt) revert InsufficientDebt();

        asset.safeTransferFrom(msg.sender, address(this), amount);
        loan.debt -= amount;
        if (loan.debt == 0) {
            loan.active = false;
        }

        emit LoanRepaid(msg.sender, loanId, amount, loan.debt, uint64(block.timestamp));
    }
}
