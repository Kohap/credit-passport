// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {AgentPassportASC} from "../src/AgentPassportASC.sol";
import {AgentPassportNFT} from "../src/AgentPassportNFT.sol";
import {INativeQueryVerifier} from "@gluwa/asc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";

contract AgentPassportLogicTest is Test {
    AgentPassportNFT internal passport;
    AgentPassportASC internal asc;
    address internal escrow = makeAddr("escrow");
    address internal agent = makeAddr("agent");

    function setUp() public {
        passport = new AgentPassportNFT(address(this));
        asc = new AgentPassportASC(escrow, address(passport));
        passport.setMinter(address(this));
    }

    function test_passportIsSoulboundAndTracksAggregateWork() public {
        uint256 id = passport.mintOrUpdate(agent, 1, 100 ether);
        assertEq(passport.ownerOf(id), agent);
        assertEq(passport.completedJobsOfToken(id), 1);
        assertEq(passport.settledVolumeOfToken(id), 100 ether);

        assertEq(passport.mintOrUpdate(agent, 2, 250 ether), id);
        assertEq(passport.completedJobsOfToken(id), 2);
        assertEq(passport.settledVolumeOfToken(id), 250 ether);

        vm.prank(agent);
        vm.expectRevert(AgentPassportNFT.Soulbound.selector);
        passport.transferFrom(agent, makeAddr("other"), id);
    }

    function test_ascRejectsWrongAttestcoinChainKey() public {
        INativeQueryVerifier.MerkleProofEntry[] memory siblings = new INativeQueryVerifier.MerkleProofEntry[](0);
        bytes32[] memory roots = new bytes32[](0);
        vm.expectRevert(abi.encodeWithSelector(AgentPassportASC.WrongChainKey.selector, uint64(99)));
        asc.proveJobCompletion(99, 1, hex"00", bytes32(uint256(1)), siblings, bytes32(0), roots, address(0));
    }

    function test_jobCompletedSignatureMatchesSourceEvent() public view {
        assertEq(
            asc.JOB_COMPLETED_SIGNATURE(), keccak256("JobCompleted(address,address,uint256,uint256,bytes32,uint64)")
        );
    }
}
