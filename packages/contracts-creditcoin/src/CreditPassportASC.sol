// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";
import {
    INativeQueryVerifier,
    NativeQueryVerifierLib
} from "@gluwa/asc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";

import {CreditScore} from "./CreditScore.sol";
import {CreditLine} from "./CreditLine.sol";
import {PassportNFT} from "./PassportNFT.sol";

/// @title CreditPassportASC
/// @notice Attestcoin Smart Contract: verify a Sepolia LoanRepaid tx, then raise score/cap + mint PASS.
/// @dev Follows the official ASCBase verify → dedupe → process pattern from @gluwa/asc-contracts.
///      Pitfalls:
///      - chainKey (Attestcoin) ≠ EVM chainId. Sepolia chainKey on CC3 testnet = 1.
///      - Precompile does NOT check receipt.status — we require receiptStatus == 1.
///      - Replay key = keccak256(chainKey, blockHeight, txIndex) via calculateTxIndex.
contract CreditPassportASC {
    /// @notice Attestcoin chainKey for Ethereum Sepolia on CC3 testnet (NOT 11155111).
    uint64 public constant SEPOLIA_CHAIN_KEY = 1;

    /// @dev keccak256("LoanRepaid(address,uint256,uint256,uint256,uint64)")
    bytes32 public constant LOAN_REPAID_SIGNATURE = keccak256("LoanRepaid(address,uint256,uint256,uint256,uint64)");

    INativeQueryVerifier public immutable VERIFIER;
    address public immutable sepoliaMockMarket;
    CreditScore public immutable creditScore;
    CreditLine public immutable creditLine;
    PassportNFT public immutable passportNFT;

    mapping(bytes32 => bool) public processedQueries;

    error WrongChainKey(uint64 got);
    error ProofFailed();
    error QueryAlreadyProcessed(bytes32 queryId);
    error TxFailed();
    error NoLoanRepaidLog();
    error BadEmitter(address got);
    error BorrowerMismatch(address logBorrower, address claimer);
    error BadTopics();

    event RepaymentVerified(
        address indexed borrower, uint256 indexed loanId, uint256 amount, bytes32 txKey, uint256 newScore
    );
    event PassportUpdated(address indexed borrower, uint256 tokenId, uint256 score, uint256 cap);

    constructor(
        address sepoliaMockMarket_,
        address creditScore_,
        address creditLine_,
        address passportNFT_
    ) {
        require(sepoliaMockMarket_ != address(0), "market");
        require(creditScore_ != address(0), "score");
        require(creditLine_ != address(0), "line");
        require(passportNFT_ != address(0), "nft");
        VERIFIER = NativeQueryVerifierLib.getVerifier();
        sepoliaMockMarket = sepoliaMockMarket_;
        creditScore = CreditScore(creditScore_);
        creditLine = CreditLine(creditLine_);
        passportNFT = PassportNFT(passportNFT_);
    }

    /// @notice Prove a Sepolia LoanRepaid tx and update Creditcoin credit state in the same call.
    /// @param claimBorrower Address that must match the log borrower. Use address(0) to default to msg.sender.
    function proveRepayment(
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
        INativeQueryVerifier.ContinuityProof memory continuityProof = INativeQueryVerifier.ContinuityProof({
            lowerEndpointDigest: lowerEndpointDigest, roots: continuityRoots
        });

        bool verified =
            VERIFIER.verifyAndEmit(chainKey, blockHeight, encodedTransaction, merkleProof, continuityProof);
        if (!verified) revert ProofFailed();

        processedQueries[queryId] = true;

        address borrower = claimBorrower == address(0) ? msg.sender : claimBorrower;
        if (borrower != msg.sender) revert BorrowerMismatch(borrower, msg.sender);

        _processRepayment(queryId, encodedTransaction, borrower);
        return true;
    }

    function _processRepayment(bytes32 queryId, bytes memory encodedTransaction, address borrower) internal {
        uint8 txType = EvmV1Decoder.getTransactionType(encodedTransaction);
        require(EvmV1Decoder.isValidTransactionType(txType), "bad tx type");

        // Pitfall: verifyAndEmit does not check success — reject failed source txs.
        EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(encodedTransaction);
        if (receipt.receiptStatus != 1) revert TxFailed();

        EvmV1Decoder.LogEntry[] memory logs =
            EvmV1Decoder.getLogsByEventSignature(receipt, LOAN_REPAID_SIGNATURE);
        if (logs.length == 0) revert NoLoanRepaidLog();

        EvmV1Decoder.LogEntry memory log = logs[0];
        if (log.address_ != sepoliaMockMarket) revert BadEmitter(log.address_);
        // topics: [sig, borrower, loanId]
        if (log.topics.length != 3) revert BadTopics();
        if (log.topics[0] != LOAN_REPAID_SIGNATURE) revert BadTopics();

        address logBorrower = address(uint160(uint256(log.topics[1])));
        uint256 loanId = uint256(log.topics[2]);
        if (logBorrower != borrower) revert BorrowerMismatch(logBorrower, borrower);

        // data: (amountRepaid, remainingDebt, timestamp)
        require(log.data.length == 96, "bad log data");
        (uint256 amountRepaid, uint256 remainingDebt,) =
            abi.decode(log.data, (uint256, uint256, uint64));

        uint256 newScore = creditScore.applyRepayment(borrower, remainingDebt);
        creditLine.setCapFromScore(borrower, newScore);
        uint256 tokenId = passportNFT.mintOrUpdate(borrower, newScore);
        uint256 cap = creditLine.borrowCapOf(borrower);

        emit RepaymentVerified(borrower, loanId, amountRepaid, queryId, newScore);
        emit PassportUpdated(borrower, tokenId, newScore, cap);
    }

    /// @dev Same query-id scheme as ASCBase (chainKey || blockHeight || txIndex).
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
