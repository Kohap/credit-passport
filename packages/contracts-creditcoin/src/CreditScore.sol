// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title CreditScore
/// @notice On-chain credit score storage for Credit Passport.
/// @dev Scoring (v2):
///      - only closed loans may be credited
///      - +50 first verified closed repayment
///      - +30 each additional verified closed repayment
///      - total capped at 100
contract CreditScore is Ownable {
    address public writer;
    mapping(address => uint256) public scoreOf;
    mapping(address => uint256) public repaymentCountOf;

    event WriterUpdated(address indexed writer);
    event ScoreUpdated(address indexed borrower, uint256 oldScore, uint256 newScore, uint256 repaymentCount);

    error LoanNotClosed();

    modifier onlyWriter() {
        require(msg.sender == writer, "not writer");
        _;
    }

    constructor(address owner_) Ownable(owner_) {}

    function setWriter(address writer_) external onlyOwner {
        writer = writer_;
        emit WriterUpdated(writer_);
    }

    /// @notice Apply the scoring formula after a verified, fully closed repayment.
    function applyRepayment(address borrower, uint256 remainingDebt) external onlyWriter returns (uint256 newScore) {
        if (remainingDebt != 0) revert LoanNotClosed();
        uint256 old = scoreOf[borrower];
        uint256 count = repaymentCountOf[borrower];
        uint256 delta = count == 0 ? 50 : 30;
        newScore = old + delta;
        if (newScore > 100) newScore = 100;

        scoreOf[borrower] = newScore;
        repaymentCountOf[borrower] = count + 1;
        emit ScoreUpdated(borrower, old, newScore, count + 1);
    }
}
