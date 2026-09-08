// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title AgentJobEscrow
/// @notice Client-funded work escrow whose release is the source-chain completion signal.
/// @dev Result contents stay offchain; only a commitment hash is emitted for Attestcoin verification.
contract AgentJobEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum JobState {
        None,
        Funded,
        Submitted,
        Completed,
        Cancelled
    }

    struct Job {
        address client;
        address agent;
        uint256 amount;
        bytes32 briefHash;
        bytes32 resultHash;
        JobState state;
    }

    IERC20 public immutable asset;
    uint256 public nextJobId = 1;
    mapping(uint256 => Job) public jobs;

    error InvalidAddress();
    error InvalidAmount();
    error InvalidCommitment();
    error NotClient();
    error NotAgent();
    error InvalidState(JobState expected, JobState actual);

    event JobFunded(
        address indexed client, address indexed agent, uint256 indexed jobId, uint256 amount, bytes32 briefHash
    );
    event WorkSubmitted(address indexed agent, uint256 indexed jobId, bytes32 resultHash);
    event JobCompleted(
        address indexed agent,
        address indexed client,
        uint256 indexed jobId,
        uint256 amount,
        bytes32 resultHash,
        uint64 timestamp
    );
    event JobCancelled(address indexed client, uint256 indexed jobId, uint256 amount);

    constructor(address asset_) {
        if (asset_ == address(0)) revert InvalidAddress();
        asset = IERC20(asset_);
    }

    /// @notice Fund a job for a distinct agent. The escrow transfers the exact amount in immediately.
    function createJob(address agent, uint256 amount, bytes32 briefHash)
        external
        nonReentrant
        returns (uint256 jobId)
    {
        if (agent == address(0) || agent == msg.sender) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (briefHash == bytes32(0)) revert InvalidCommitment();

        jobId = nextJobId++;
        jobs[jobId] = Job({
            client: msg.sender,
            agent: agent,
            amount: amount,
            briefHash: briefHash,
            resultHash: bytes32(0),
            state: JobState.Funded
        });
        asset.safeTransferFrom(msg.sender, address(this), amount);
        emit JobFunded(msg.sender, agent, jobId, amount, briefHash);
    }

    /// @notice Agent commits its completed result before the client decides whether to release funds.
    function submitWork(uint256 jobId, bytes32 resultHash) external {
        Job storage job = jobs[jobId];
        if (job.agent != msg.sender) revert NotAgent();
        if (job.state != JobState.Funded) revert InvalidState(JobState.Funded, job.state);
        if (resultHash == bytes32(0)) revert InvalidCommitment();

        job.resultHash = resultHash;
        job.state = JobState.Submitted;
        emit WorkSubmitted(msg.sender, jobId, resultHash);
    }

    /// @notice Client accepts the committed result and releases escrow, emitting the attestable completion event.
    function approveCompletion(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        if (job.client != msg.sender) revert NotClient();
        if (job.state != JobState.Submitted) revert InvalidState(JobState.Submitted, job.state);

        job.state = JobState.Completed;
        asset.safeTransfer(job.agent, job.amount);
        emit JobCompleted(job.agent, job.client, jobId, job.amount, job.resultHash, uint64(block.timestamp));
    }

    /// @notice Client may recover funds before the agent submits a result. Submitted jobs deliberately need a dispute path.
    function cancelBeforeSubmission(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        if (job.client != msg.sender) revert NotClient();
        if (job.state != JobState.Funded) revert InvalidState(JobState.Funded, job.state);

        job.state = JobState.Cancelled;
        asset.safeTransfer(job.client, job.amount);
        emit JobCancelled(job.client, jobId, job.amount);
    }
}
