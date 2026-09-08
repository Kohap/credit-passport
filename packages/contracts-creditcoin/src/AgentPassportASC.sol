// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";
import {
    INativeQueryVerifier,
    NativeQueryVerifierLib
} from "@gluwa/asc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";

import {AgentPassportNFT} from "./AgentPassportNFT.sol";

/// @title AgentPassportASC
/// @notice Verifies a client-approved Sepolia job release and updates an agent's non-transferable credential.
/// @dev A source completion counts only when emitted by the configured escrow after its payment release.
contract AgentPassportASC {
    uint64 public constant SEPOLIA_CHAIN_KEY = 1;
    bytes32 public constant JOB_COMPLETED_SIGNATURE =
        keccak256("JobCompleted(address,address,uint256,uint256,bytes32,uint64)");

    INativeQueryVerifier public immutable VERIFIER;
    address public immutable sepoliaJobEscrow;
    AgentPassportNFT public immutable agentPassport;

    mapping(bytes32 => bool) public processedQueries;
    mapping(address => mapping(uint256 => bool)) public creditedJobs;
    mapping(address => uint256) public completedJobsOf;
    mapping(address => uint256) public settledVolumeOf;

    error WrongChainKey(uint64 got);
    error ProofFailed();
    error QueryAlreadyProcessed(bytes32 queryId);
    error TxFailed();
    error NoJobCompletedLog();
    error BadEmitter(address got);
    error BadTopics();
    error AgentMismatch(address logAgent, address claimer);
    error JobAlreadyCredited(address agent, uint256 jobId);
    error InvalidJobAmount();
    error InvalidResultCommitment();

    event JobCompletionVerified(
        address indexed agent,
        address indexed client,
        uint256 indexed jobId,
        uint256 amount,
        bytes32 resultHash,
        bytes32 txKey,
        uint256 completedJobs,
        uint256 settledVolume
    );
    event AgentPassportUpdated(address indexed agent, uint256 tokenId, uint256 completedJobs, uint256 settledVolume);

    constructor(address sepoliaJobEscrow_, address agentPassport_) {
        require(sepoliaJobEscrow_ != address(0), "escrow");
        require(agentPassport_ != address(0), "passport");
        VERIFIER = NativeQueryVerifierLib.getVerifier();
        sepoliaJobEscrow = sepoliaJobEscrow_;
        agentPassport = AgentPassportNFT(agentPassport_);
    }

    /// @notice Prove a source-chain JobCompleted event and update the caller's Agent Passport.
    function proveJobCompletion(
        uint64 chainKey,
        uint64 blockHeight,
        bytes calldata encodedTransaction,
        bytes32 merkleRoot,
        INativeQueryVerifier.MerkleProofEntry[] calldata siblings,
        bytes32 lowerEndpointDigest,
        bytes32[] calldata continuityRoots,
        address claimAgent
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

        address agent = claimAgent == address(0) ? msg.sender : claimAgent;
        if (agent != msg.sender) revert AgentMismatch(agent, msg.sender);
        _processCompletion(queryId, encodedTransaction, agent);
        return true;
    }

    function _processCompletion(bytes32 queryId, bytes memory encodedTransaction, address agent) internal {
        uint8 txType = EvmV1Decoder.getTransactionType(encodedTransaction);
        require(EvmV1Decoder.isValidTransactionType(txType), "bad tx type");

        EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(encodedTransaction);
        if (receipt.receiptStatus != 1) revert TxFailed();
        EvmV1Decoder.LogEntry[] memory logs = EvmV1Decoder.getLogsByEventSignature(receipt, JOB_COMPLETED_SIGNATURE);
        if (logs.length == 0) revert NoJobCompletedLog();

        EvmV1Decoder.LogEntry memory log = logs[0];
        if (log.address_ != sepoliaJobEscrow) revert BadEmitter(log.address_);
        if (log.topics.length != 4 || log.topics[0] != JOB_COMPLETED_SIGNATURE) revert BadTopics();

        address logAgent = address(uint160(uint256(log.topics[1])));
        address client = address(uint160(uint256(log.topics[2])));
        uint256 jobId = uint256(log.topics[3]);
        if (logAgent != agent) revert AgentMismatch(logAgent, agent);
        if (log.data.length != 96) revert BadTopics();
        (uint256 amount, bytes32 resultHash,) = abi.decode(log.data, (uint256, bytes32, uint64));
        if (amount == 0) revert InvalidJobAmount();
        if (resultHash == bytes32(0)) revert InvalidResultCommitment();
        if (creditedJobs[agent][jobId]) revert JobAlreadyCredited(agent, jobId);

        creditedJobs[agent][jobId] = true;
        uint256 completedJobs = completedJobsOf[agent] + 1;
        uint256 settledVolume = settledVolumeOf[agent] + amount;
        completedJobsOf[agent] = completedJobs;
        settledVolumeOf[agent] = settledVolume;
        uint256 tokenId = agentPassport.mintOrUpdate(agent, completedJobs, settledVolume);

        emit JobCompletionVerified(agent, client, jobId, amount, resultHash, queryId, completedJobs, settledVolume);
        emit AgentPassportUpdated(agent, tokenId, completedJobs, settledVolume);
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
