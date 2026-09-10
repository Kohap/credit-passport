// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {AaveV3RepaymentASC} from "../src/AaveV3RepaymentASC.sol";
import {CreditScore} from "../src/CreditScore.sol";
import {CreditLine} from "../src/CreditLine.sol";
import {PassportNFT} from "../src/PassportNFT.sol";
import {MockUSD} from "../src/MockUSD.sol";
import {INativeQueryVerifier} from "@gluwa/asc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";
import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";

contract AaveV3RepaymentASCHarness is AaveV3RepaymentASC {
    constructor(address pool, address score, address line, address nft) AaveV3RepaymentASC(pool, score, line, nft) {}

    function validateRepayCall(bytes calldata data, address borrower) external pure returns (address) {
        return _validateAaveRepayCall(data, borrower);
    }
}

/// @notice Unit checks for the Aave source binding. Live proof validation runs only against the CC3 precompile.
contract AaveV3RepaymentASCLogicTest is Test {
    bytes4 internal constant VERIFY = bytes4(keccak256("verifyAndEmit(uint64,uint64,bytes,(bytes32,(bytes32,bool)[]),(bytes32,bytes32[]))"));
    AaveV3RepaymentASCHarness internal asc;
    address internal borrower = makeAddr("borrower");
    address internal pool = makeAddr("aavePool");
    address internal asset = makeAddr("asset");
    CreditScore internal score;
    CreditLine internal line;
    PassportNFT internal nft;

    function setUp() public {
        MockUSD usd = new MockUSD(address(this));
        score = new CreditScore(address(this));
        line = new CreditLine(address(usd), address(this));
        nft = new PassportNFT(address(this));
        asc = new AaveV3RepaymentASCHarness(pool, address(score), address(line), address(nft));
        score.setWriter(address(asc));
        line.setUpdater(address(asc));
        nft.setMinter(address(asc));
        vm.mockCall(address(asc.VERIFIER()), abi.encodeWithSelector(INativeQueryVerifier.calculateTxIndex.selector), abi.encode(uint256(0)));
        vm.mockCall(address(asc.VERIFIER()), abi.encodeWithSelector(VERIFY), abi.encode(true));
    }

    function receipt() internal view returns (EvmV1Decoder.LogEntry[] memory logs) {
        logs = new EvmV1Decoder.LogEntry[](1);
        bytes32[] memory topics = new bytes32[](4);
        topics[0] = asc.AAVE_REPAY_SIGNATURE();
        topics[1] = bytes32(uint256(uint160(asset)));
        topics[2] = bytes32(uint256(uint160(borrower)));
        topics[3] = topics[2];
        logs[0] = EvmV1Decoder.LogEntry(pool, topics, abi.encode(uint256(1e6), false));
    }

    function encoded(address sender, address target, uint8 status, EvmV1Decoder.LogEntry[] memory logs)
        internal view returns (bytes memory)
    {
        bytes[] memory chunks = new bytes[](3);
        chunks[0] = abi.encode(uint64(0), uint64(300000), sender, false, target, uint256(0),
            abi.encodeWithSelector(asc.AAVE_REPAY_SELECTOR(), asset, type(uint256).max, 2, borrower));
        chunks[1] = hex"";
        chunks[2] = abi.encode(status, uint64(150000), logs, new bytes(256));
        return abi.encode(uint8(2), chunks);
    }

    function prove(bytes memory data, uint64 height) internal {
        INativeQueryVerifier.MerkleProofEntry[] memory siblings = new INativeQueryVerifier.MerkleProofEntry[](0);
        bytes32[] memory roots = new bytes32[](0);
        vm.prank(borrower);
        asc.proveAaveRepayment(1, height, data, bytes32(uint256(1)), siblings, bytes32(0), roots, borrower);
    }

    function test_verifiedReceiptUpdatesAllRecordsAndRejectsReplay() public {
        bytes memory data = encoded(borrower, pool, 1, receipt());
        prove(data, 100);
        assertEq(score.scoreOf(borrower), 50);
        assertEq(score.repaymentCountOf(borrower), 1);
        assertEq(line.borrowCapOf(borrower), 200 ether);
        assertEq(nft.ownerOf(nft.tokenOf(borrower)), borrower);
        vm.expectPartialRevert(AaveV3RepaymentASC.QueryAlreadyProcessed.selector);
        prove(data, 100);
        prove(data, 101);
        assertEq(score.scoreOf(borrower), 80);
    }

    function test_failedReceiptRollsBackReplayKeyAndRecords() public {
        bytes memory failed = encoded(borrower, pool, 0, receipt());
        vm.expectRevert(AaveV3RepaymentASC.TxFailed.selector);
        prove(failed, 100);
        assertEq(score.scoreOf(borrower), 0);
        prove(encoded(borrower, pool, 1, receipt()), 100);
        assertEq(score.scoreOf(borrower), 50);
    }

    function test_rejectsMismatchedAsset() public {
        EvmV1Decoder.LogEntry[] memory logs = receipt();
        logs[0].topics[1] = bytes32(uint256(uint160(makeAddr("otherAsset"))));
        bytes memory data = encoded(borrower, pool, 1, logs);
        vm.expectPartialRevert(AaveV3RepaymentASC.AssetMismatch.selector);
        prove(data, 100);
    }

    function test_rejectsWrongEmitter() public {
        EvmV1Decoder.LogEntry[] memory logs = receipt();
        logs[0].address_ = makeAddr("fakePool");
        bytes memory data = encoded(borrower, pool, 1, logs);
        vm.expectPartialRevert(AaveV3RepaymentASC.BadEmitter.selector);
        prove(data, 100);
    }

    function test_rejectsWrongSenderAndTarget() public {
        bytes memory data = encoded(makeAddr("other"), pool, 1, receipt());
        vm.expectPartialRevert(AaveV3RepaymentASC.BorrowerMismatch.selector);
        prove(data, 100);
        data = encoded(borrower, makeAddr("other"), 1, receipt());
        vm.expectPartialRevert(AaveV3RepaymentASC.BadTarget.selector);
        prove(data, 100);
    }

    function test_rejectsEmptyRepaymentAndATokens() public {
        EvmV1Decoder.LogEntry[] memory logs = receipt();
        logs[0].data = abi.encode(uint256(0), false);
        bytes memory data = encoded(borrower, pool, 1, logs);
        vm.expectRevert(AaveV3RepaymentASC.EmptyRepayment.selector);
        prove(data, 100);
        logs[0].data = abi.encode(uint256(1e6), true);
        data = encoded(borrower, pool, 1, logs);
        vm.expectRevert(AaveV3RepaymentASC.UnsupportedATokenRepayment.selector);
        prove(data, 100);
    }

    function test_rejectsMissingLogAndMalformedTopics() public {
        bytes memory data = encoded(borrower, pool, 1, new EvmV1Decoder.LogEntry[](0));
        vm.expectRevert(AaveV3RepaymentASC.NoAaveRepayLog.selector);
        prove(data, 100);
        EvmV1Decoder.LogEntry[] memory logs = receipt();
        logs[0].topics = new bytes32[](1);
        logs[0].topics[0] = asc.AAVE_REPAY_SIGNATURE();
        data = encoded(borrower, pool, 1, logs);
        vm.expectRevert(AaveV3RepaymentASC.BadTopics.selector);
        prove(data, 100);
    }

    function test_failedVerificationCannotUpdateRecords() public {
        vm.mockCall(address(asc.VERIFIER()), abi.encodeWithSelector(VERIFY), abi.encode(false));
        bytes memory data = encoded(borrower, pool, 1, receipt());
        vm.expectRevert(AaveV3RepaymentASC.ProofFailed.selector);
        prove(data, 100);
        assertEq(score.scoreOf(borrower), 0);
    }

    function test_expectedAaveFunctionAndEventSignatures() public view {
        assertEq(asc.AAVE_REPAY_SELECTOR(), bytes4(keccak256("repay(address,uint256,uint256,address)")));
        assertEq(asc.AAVE_REPAY_SIGNATURE(), keccak256("Repay(address,address,address,uint256,bool)"));
    }

    function test_revertsBeforePrecompileForWrongAttestcoinChainKey() public {
        INativeQueryVerifier.MerkleProofEntry[] memory siblings = new INativeQueryVerifier.MerkleProofEntry[](0);
        bytes32[] memory roots = new bytes32[](0);
        vm.expectRevert(abi.encodeWithSelector(AaveV3RepaymentASC.WrongChainKey.selector, uint64(99)));
        asc.proveAaveRepayment(99, 1, hex"00", bytes32(uint256(1)), siblings, bytes32(0), roots, address(0));
    }

    function test_acceptsOnlyAaveVariableDebtFullCloseCalldata() public {
        bytes memory data = abi.encodeWithSelector(asc.AAVE_REPAY_SELECTOR(), asset, type(uint256).max, 2, borrower);
        assertEq(asc.validateRepayCall(data, borrower), asset);
    }

    function test_rejectsPartialAaveRepaymentCalldata() public {
        bytes memory data = abi.encodeWithSelector(asc.AAVE_REPAY_SELECTOR(), makeAddr("asset"), 1, 2, borrower);
        vm.expectRevert(AaveV3RepaymentASC.NotFullVariableRepayment.selector);
        asc.validateRepayCall(data, borrower);
    }

    function test_rejectsAaveRepaymentForAnotherBorrower() public {
        bytes memory data = abi.encodeWithSelector(
            asc.AAVE_REPAY_SELECTOR(), makeAddr("asset"), type(uint256).max, 2, makeAddr("other")
        );
        vm.expectRevert(AaveV3RepaymentASC.NotFullVariableRepayment.selector);
        asc.validateRepayCall(data, borrower);
    }
}
