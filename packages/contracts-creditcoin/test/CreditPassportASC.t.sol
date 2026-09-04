// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {CreditPassportASC} from "../src/CreditPassportASC.sol";
import {CreditScore} from "../src/CreditScore.sol";
import {CreditLine} from "../src/CreditLine.sol";
import {PassportNFT} from "../src/PassportNFT.sol";
import {MockUSD} from "../src/MockUSD.sol";
import {INativeQueryVerifier} from "@gluwa/asc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";

/// @notice Unit tests for Creditcoin business logic.
/// @dev Live Attestcoin verification (0xFD2) only works on CC3 testnet — see README.
contract CreditPassportLogicTest is Test {
    MockUSD internal usd;
    CreditScore internal score;
    CreditLine internal line;
    PassportNFT internal nft;
    CreditPassportASC internal asc;

    address internal market = makeAddr("market");
    address internal borrower = makeAddr("borrower");

    function setUp() public {
        usd = new MockUSD(address(this));
        score = new CreditScore(address(this));
        line = new CreditLine(address(usd), address(this));
        nft = new PassportNFT(address(this));
        asc = new CreditPassportASC(market, address(score), address(line), address(nft));

        score.setWriter(address(this));
        line.setUpdater(address(this));
        nft.setMinter(address(this));
        usd.mint(address(line), 1_000_000 ether);
    }

    function test_score_firstPartialThenClosed() public {
        assertEq(score.applyRepayment(borrower, 50 ether), 40);
        assertEq(score.applyRepayment(borrower, 0), 70);
        assertEq(score.repaymentCountOf(borrower), 2);
    }

    function test_score_capsAt100() public {
        score.applyRepayment(borrower, 0); // 50
        score.applyRepayment(borrower, 0); // 80
        score.applyRepayment(borrower, 0); // 100
        assertEq(score.applyRepayment(borrower, 0), 100);
    }

    function test_cap_formula() public {
        line.setCapFromScore(borrower, 40);
        assertEq(line.borrowCapOf(borrower), 180 ether);
        vm.prank(borrower);
        line.borrow(50 ether);
        assertEq(line.debtOf(borrower), 50 ether);
        assertEq(line.available(borrower), 130 ether);
    }

    function test_passport_soulboundAndUpdate() public {
        uint256 id = nft.mintOrUpdate(borrower, 40);
        assertEq(nft.ownerOf(id), borrower);
        assertEq(nft.mintOrUpdate(borrower, 70), id);
        assertEq(nft.scoreOfToken(id), 70);

        vm.prank(borrower);
        vm.expectRevert(PassportNFT.Soulbound.selector);
        nft.transferFrom(borrower, makeAddr("other"), id);

        vm.prank(borrower);
        vm.expectRevert(PassportNFT.Soulbound.selector);
        nft.approve(makeAddr("other"), id);
    }

    function test_asc_wrongChainKeyReverts() public {
        INativeQueryVerifier.MerkleProofEntry[] memory siblings =
            new INativeQueryVerifier.MerkleProofEntry[](0);
        bytes32[] memory roots = new bytes32[](0);
        vm.expectRevert(abi.encodeWithSelector(CreditPassportASC.WrongChainKey.selector, uint64(99)));
        asc.proveRepayment(99, 1, hex"00", bytes32(uint256(1)), siblings, bytes32(0), roots, address(0));
    }

    function test_loanRepaid_eventSignatureMatchesSpec() public {
        assertEq(
            asc.LOAN_REPAID_SIGNATURE(),
            keccak256("LoanRepaid(address,uint256,uint256,uint256,uint64)")
        );
    }
}
