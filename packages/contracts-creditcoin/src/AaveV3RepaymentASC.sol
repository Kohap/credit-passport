// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";
import {
    INativeQueryVerifier,
    NativeQueryVerifierLib
} from "@gluwa/asc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";

import {CreditScore} from "./CreditScore.sol";
import {CreditLine} from "./CreditLine.sol";
import {PassportNFT} from "./PassportNFT.sol";

/// @title AaveV3RepaymentASC
/// @notice Credits a borrower only after Attestcoin proves a successful, direct, full Aave V3 variable-debt repayment.
/// @dev This is intentionally a separate alpha stack. It does not change the mock-loan Passport deployment.
contract AaveV3RepaymentASC {
    /// @notice Attestcoin chainKey for Ethereum Sepolia on Creditcoin CC3 (not EVM chainId 11155111).
    uint64 public constant SEPOLIA_CHAIN_KEY = 1;
    bytes4 public constant AAVE_REPAY_SELECTOR = bytes4(keccak256("repay(address,uint256,uint256,address)"));
    bytes32 public constant AAVE_REPAY_SIGNATURE = keccak256("Repay(address,address,address,uint256,bool)");

    INativeQueryVerifier public immutable VERIFIER;
    address public immutable sepoliaAavePool;
    CreditScore public immutable creditScore;
    CreditLine public immutable creditLine;
    PassportNFT public immutable passportNFT;

    mapping(bytes32 => bool) public processedQueries;

    error WrongChainKey(uint64 got);
    error ProofFailed();
    error QueryAlreadyProcessed(bytes32 queryId);
    error TxFailed();
    error BorrowerMismatch(address source, address claimer);
    error BadTarget(address got);
    error BadCalldata();
    error NotFullVariableRepayment();
    error NoAaveRepayLog();
    error BadEmitter(address got);
    error BadTopics();
    error AssetMismatch(address eventAsset, address calldataAsset);
    error EmptyRepayment();
    error UnsupportedATokenRepayment();

    event AaveRepaymentVerified(
        address indexed borrower,
        address indexed asset,
        uint256 repaidAmount,
        bytes32 txKey,
        uint256 newScore
    );
    event PassportUpdated(address indexed borrower, uint256 tokenId, uint256 score, uint256 cap);

    constructor(address sepoliaAavePool_, address creditScore_, address creditLine_, address passportNFT_) {
        require(sepoliaAavePool_ != address(0), "pool");
        require(creditScore_ != address(0), "score");
        require(creditLine_ != address(0), "line");
        require(passportNFT_ != address(0), "nft");
        VERIFIER = NativeQueryVerifierLib.getVerifier();
        sepoliaAavePool = sepoliaAavePool_;
        creditScore = CreditScore(creditScore_);
        creditLine = CreditLine(creditLine_);
        passportNFT = PassportNFT(passportNFT_);
    }

    /// @notice Prove an Aave V3 Sepolia full variable-debt repayment and update this alpha credit stack.
    /// @dev The source transaction must call Pool.repay(asset, type(uint256).max, 2, borrower) directly.
    function proveAaveRepayment(
        uint64 chainKey,
        uint64 blockHeight,
        bytes calldata encodedTransaction,
        bytes32 merkleRoot,
        INativeQueryVerifier.MerkleProofEntry[] calldata siblings,
        bytes32 lowerEndpointDigest,
        bytes32[] calldata continuityRoots,
        address claimBorrower
    ) external returns (bool) {
        if (chainKey != SEPOLIA_CHAIN_KEY) revert WrongChainKey(chainKey);

        bytes32 queryId = _computeQueryId(chainKey, blockHeight, merkleRoot, siblings);
        if (processedQueries[queryId]) revert QueryAlreadyProcessed(queryId);

        INativeQueryVerifier.MerkleProof memory merkleProof =
            INativeQueryVerifier.MerkleProof({root: merkleRoot, siblings: siblings});
        INativeQueryVerifier.ContinuityProof memory continuityProof =
            INativeQueryVerifier.ContinuityProof({lowerEndpointDigest: lowerEndpointDigest, roots: continuityRoots});
        if (!VERIFIER.verifyAndEmit(chainKey, blockHeight, encodedTransaction, merkleProof, continuityProof)) {
            revert ProofFailed();
        }
        processedQueries[queryId] = true;

        address borrower = claimBorrower == address(0) ? msg.sender : claimBorrower;
        if (borrower != msg.sender) revert BorrowerMismatch(borrower, msg.sender);
        _processRepayment(queryId, encodedTransaction, borrower);
        return true;
    }

    function _processRepayment(bytes32 queryId, bytes memory encodedTransaction, address borrower) internal {
        uint8 txType = EvmV1Decoder.getTransactionType(encodedTransaction);
        require(EvmV1Decoder.isValidTransactionType(txType), "bad tx type");

        EvmV1Decoder.CommonTxFields memory common = EvmV1Decoder.decodeCommonTxFields(encodedTransaction);
        if (common.toIsNull || common.to != sepoliaAavePool) revert BadTarget(common.to);
        if (common.from != borrower) revert BorrowerMismatch(common.from, borrower);
        address asset = _validateAaveRepayCall(common.data, borrower);

        EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(encodedTransaction);
        if (receipt.receiptStatus != 1) revert TxFailed();
        uint256 repaidAmount = _findAaveRepayment(receipt, borrower, asset);
        if (repaidAmount == 0) revert EmptyRepayment();

        uint256 newScore = creditScore.applyRepayment(borrower, 0);
        creditLine.setCapFromScore(borrower, newScore);
        uint256 tokenId = passportNFT.mintOrUpdate(borrower, newScore);
        uint256 cap = creditLine.borrowCapOf(borrower);

        emit AaveRepaymentVerified(borrower, asset, repaidAmount, queryId, newScore);
        emit PassportUpdated(borrower, tokenId, newScore, cap);
    }

    function _validateAaveRepayCall(bytes memory data, address borrower) internal pure returns (address asset) {
        // Selector plus exactly four ABI words: asset, amount, interestRateMode, onBehalfOf.
        if (data.length != 132) revert BadCalldata();
        bytes4 selector;
        assembly {
            selector := mload(add(data, 32))
        }
        if (selector != AAVE_REPAY_SELECTOR) revert BadCalldata();

        asset = address(uint160(uint256(_wordAt(data, 4))));
        if (asset == address(0)) revert BadCalldata();
        uint256 amount = uint256(_wordAt(data, 36));
        uint256 interestRateMode = uint256(_wordAt(data, 68));
        address onBehalfOf = address(uint160(uint256(_wordAt(data, 100))));
        if (amount != type(uint256).max || interestRateMode != 2 || onBehalfOf != borrower) {
            revert NotFullVariableRepayment();
        }
    }

    function _findAaveRepayment(EvmV1Decoder.ReceiptFields memory receipt, address borrower, address asset)
        private
        view
        returns (uint256 repaidAmount)
    {
        EvmV1Decoder.LogEntry[] memory logs = EvmV1Decoder.getLogsByEventSignature(receipt, AAVE_REPAY_SIGNATURE);
        if (logs.length == 0) revert NoAaveRepayLog();

        for (uint256 i; i < logs.length; ++i) {
            EvmV1Decoder.LogEntry memory log = logs[i];
            if (log.address_ != sepoliaAavePool) continue;
            // topics: [signature, reserve, user, repayer]
            if (log.topics.length != 4 || log.topics[0] != AAVE_REPAY_SIGNATURE) revert BadTopics();
            address eventAsset = address(uint160(uint256(log.topics[1])));
            if (eventAsset != asset) revert AssetMismatch(eventAsset, asset);
            address user = address(uint160(uint256(log.topics[2])));
            address repayer = address(uint160(uint256(log.topics[3])));
            if (user != borrower) revert BorrowerMismatch(user, borrower);
            if (repayer != borrower) revert BorrowerMismatch(repayer, borrower);
            if (log.data.length != 64) revert BadTopics();
            bool useATokens;
            (repaidAmount, useATokens) = abi.decode(log.data, (uint256, bool));
            if (useATokens) revert UnsupportedATokenRepayment();
            return repaidAmount;
        }
        revert BadEmitter(logs[0].address_);
    }

    function _wordAt(bytes memory data, uint256 offset) private pure returns (bytes32 word) {
        assembly {
            word := mload(add(add(data, 32), offset))
        }
    }

    function _computeQueryId(
        uint64 chainKey,
        uint64 blockHeight,
        bytes32 merkleRoot,
        INativeQueryVerifier.MerkleProofEntry[] calldata siblings
    ) internal view returns (bytes32 queryId) {
        INativeQueryVerifier.MerkleProof memory merkleProof =
            INativeQueryVerifier.MerkleProof({root: merkleRoot, siblings: siblings});
        uint256 txIndex = VERIFIER.calculateTxIndex(merkleProof);
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, chainKey)
            mstore(add(ptr, 32), shl(192, blockHeight))
            mstore(add(ptr, 40), txIndex)
            queryId := keccak256(ptr, 72)
        }
    }
}
