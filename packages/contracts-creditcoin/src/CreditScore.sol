// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title CreditScore
/// @notice On-chain credit score storage for Credit Passport.
/// @dev Scoring (v1):
///      - +40 first verified repayment
///      - +20 each additional verified repayment
///      - +10 if remainingDebt == 0 (loan closed)
///      - total capped at 100
contract CreditScore is Ownable {
    address public writer;
    mapping(address => uint256) public scoreOf;
    mapping(address => uint256) public repaymentCountOf;

    event WriterUpdated(address indexed writer);
    event ScoreUpdated(address indexed borrower, uint256 oldScore, uint256 newScore, uint256 repaymentCount);

    modifier onlyWriter() {
        require(msg.sender == writer, "not writer");
        _;
    }

    constructor(address owner_) Ownable(owner_) {}

    function setWriter(address writer_) external onlyOwner {
        writer = writer_;
        emit WriterUpdated(writer_);
    }

    /// @notice Apply the v1 scoring formula after a verified repayment.
    function applyRepayment(address borrower, uint256 remainingDebt)
        external
        onlyWriter
        returns (uint256 newScore)
    {
        uint256 old = scoreOf[borrower];
        uint256 count = repaymentCountOf[borrower];
        uint256 delta = count == 0 ? 40 : 20;
        if (remainingDebt == 0) {
            delta += 10;
        }
        newScore = old + delta;
        if (newScore > 100) newScore = 100;

        scoreOf[borrower] = newScore;
        repaymentCountOf[borrower] = count + 1;
        emit ScoreUpdated(borrower, old, newScore, count + 1);
    }
}
