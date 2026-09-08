// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title AgentPassportNFT
/// @notice Soulbound credential summarizing attestably settled work for an agent wallet.
contract AgentPassportNFT is ERC721, Ownable {
    error Soulbound();

    address public minter;
    uint256 public nextTokenId = 1;
    mapping(address => uint256) public tokenOf;
    mapping(uint256 => uint256) public completedJobsOfToken;
    mapping(uint256 => uint256) public settledVolumeOfToken;

    event MinterUpdated(address indexed minter);
    event AgentPassportMinted(
        address indexed agent, uint256 indexed tokenId, uint256 completedJobs, uint256 settledVolume
    );
    event AgentPassportUpdated(
        address indexed agent, uint256 indexed tokenId, uint256 completedJobs, uint256 settledVolume
    );

    modifier onlyMinter() {
        require(msg.sender == minter, "not minter");
        _;
    }

    constructor(address owner_) ERC721("Agent Passport", "AGENT") Ownable(owner_) {}

    function setMinter(address minter_) external onlyOwner {
        minter = minter_;
        emit MinterUpdated(minter_);
    }

    function mintOrUpdate(address agent, uint256 completedJobs, uint256 settledVolume)
        external
        onlyMinter
        returns (uint256 tokenId)
    {
        tokenId = tokenOf[agent];
        if (tokenId == 0) {
            tokenId = nextTokenId++;
            tokenOf[agent] = tokenId;
            _safeMint(agent, tokenId);
            emit AgentPassportMinted(agent, tokenId, completedJobs, settledVolume);
        } else {
            emit AgentPassportUpdated(agent, tokenId, completedJobs, settledVolume);
        }
        completedJobsOfToken[tokenId] = completedJobs;
        settledVolumeOfToken[tokenId] = settledVolume;
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert Soulbound();
    }
}
