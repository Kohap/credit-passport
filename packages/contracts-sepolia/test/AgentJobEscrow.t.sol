// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {MockUSD} from "../src/MockUSD.sol";
import {AgentJobEscrow} from "../src/AgentJobEscrow.sol";

contract AgentJobEscrowTest is Test {
    MockUSD internal usd;
    AgentJobEscrow internal escrow;
    address internal client = address(0xC11E);
    address internal agent = address(0xA63E7);
    address internal other = address(0x0A11CE);
    bytes32 internal constant BRIEF = keccak256("summarize a market report");
    bytes32 internal constant RESULT = keccak256("ipfs://agent-result-commitment");

    event JobCompleted(
        address indexed agent,
        address indexed client,
        uint256 indexed jobId,
        uint256 amount,
        bytes32 resultHash,
        uint64 timestamp
    );

    function setUp() public {
        usd = new MockUSD();
        escrow = new AgentJobEscrow(address(usd));
        usd.mint(client, 1_000 ether);
        vm.prank(client);
        usd.approve(address(escrow), type(uint256).max);
    }

    function test_clientApprovedCompletion_releasesEscrowAndEmitsSignal() public {
        vm.prank(client);
        uint256 jobId = escrow.createJob(agent, 100 ether, BRIEF);

        vm.prank(agent);
        escrow.submitWork(jobId, RESULT);

        vm.expectEmit(true, true, true, true);
        emit JobCompleted(agent, client, jobId, 100 ether, RESULT, uint64(block.timestamp));
        vm.prank(client);
        escrow.approveCompletion(jobId);

        (,,,,, AgentJobEscrow.JobState state) = escrow.jobs(jobId);
        assertEq(uint256(state), uint256(AgentJobEscrow.JobState.Completed));
        assertEq(usd.balanceOf(agent), 100 ether);
        assertEq(usd.balanceOf(address(escrow)), 0);
    }

    function test_cannotCreateSelfFundedJob() public {
        vm.prank(client);
        vm.expectRevert(AgentJobEscrow.InvalidAddress.selector);
        escrow.createJob(client, 1 ether, BRIEF);
    }

    function test_onlyAssignedAgentCanSubmitWork() public {
        vm.prank(client);
        uint256 jobId = escrow.createJob(agent, 100 ether, BRIEF);

        vm.prank(other);
        vm.expectRevert(AgentJobEscrow.NotAgent.selector);
        escrow.submitWork(jobId, RESULT);
    }

    function test_onlyClientCanReleaseEscrow() public {
        vm.prank(client);
        uint256 jobId = escrow.createJob(agent, 100 ether, BRIEF);
        vm.prank(agent);
        escrow.submitWork(jobId, RESULT);

        vm.prank(other);
        vm.expectRevert(AgentJobEscrow.NotClient.selector);
        escrow.approveCompletion(jobId);
    }

    function test_clientCannotCancelAfterAgentSubmitsWork() public {
        vm.prank(client);
        uint256 jobId = escrow.createJob(agent, 100 ether, BRIEF);
        vm.prank(agent);
        escrow.submitWork(jobId, RESULT);

        vm.prank(client);
        vm.expectRevert(
            abi.encodeWithSelector(
                AgentJobEscrow.InvalidState.selector, AgentJobEscrow.JobState.Funded, AgentJobEscrow.JobState.Submitted
            )
        );
        escrow.cancelBeforeSubmission(jobId);
    }

    function test_clientCanCancelBeforeSubmission() public {
        vm.prank(client);
        uint256 jobId = escrow.createJob(agent, 100 ether, BRIEF);

        vm.prank(client);
        escrow.cancelBeforeSubmission(jobId);

        (,,,,, AgentJobEscrow.JobState state) = escrow.jobs(jobId);
        assertEq(uint256(state), uint256(AgentJobEscrow.JobState.Cancelled));
        assertEq(usd.balanceOf(client), 1_000 ether);
    }
}
