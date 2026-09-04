// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {MockUSD} from "../src/MockUSD.sol";
import {MockMarket} from "../src/MockMarket.sol";

contract MockMarketTest is Test {
    MockUSD internal usd;
    MockMarket internal market;
    address internal borrower = address(0xB0);

    event LoanRepaid(
        address indexed borrower,
        uint256 indexed loanId,
        uint256 amountRepaid,
        uint256 remainingDebt,
        uint64 timestamp
    );

    function setUp() public {
        usd = new MockUSD();
        market = new MockMarket(address(usd));
        usd.mint(address(market), 1_000_000 ether);
        vm.deal(borrower, 1 ether);
    }

    function test_openAndFullRepay_emitsLoanRepaid() public {
        vm.startPrank(borrower);
        uint256 loanId = market.openLoan(100 ether);
        assertEq(usd.balanceOf(borrower), 100 ether);

        usd.approve(address(market), 100 ether);

        vm.expectEmit(true, true, false, true);
        emit LoanRepaid(borrower, loanId, 100 ether, 0, uint64(block.timestamp));
        market.repay(loanId, 100 ether);
        vm.stopPrank();

        (address b, uint256 principal, uint256 debt, bool active) = market.loans(loanId);
        assertEq(b, borrower);
        assertEq(principal, 100 ether);
        assertEq(debt, 0);
        assertFalse(active);
    }

    function test_partialRepay_keepsLoanActive() public {
        vm.startPrank(borrower);
        uint256 loanId = market.openLoan(100 ether);
        usd.approve(address(market), type(uint256).max);
        market.repay(loanId, 40 ether);
        vm.stopPrank();

        (,, uint256 debt, bool active) = market.loans(loanId);
        assertEq(debt, 60 ether);
        assertTrue(active);
    }

    function test_repay_revertsIfNotBorrower() public {
        vm.prank(borrower);
        uint256 loanId = market.openLoan(100 ether);

        address other = address(0xC0);
        usd.mint(other, 100 ether);
        vm.startPrank(other);
        usd.approve(address(market), 100 ether);
        vm.expectRevert(MockMarket.NotBorrower.selector);
        market.repay(loanId, 10 ether);
        vm.stopPrank();
    }

    function test_faucet_mints() public {
        vm.prank(borrower);
        usd.faucet();
        assertEq(usd.balanceOf(borrower), usd.FAUCET_AMOUNT());
    }
}
