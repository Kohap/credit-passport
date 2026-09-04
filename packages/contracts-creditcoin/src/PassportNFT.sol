// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title PassportNFT
/// @notice Soulbound Credit Passport (PASS). Non-transferable, non-approvable.
contract PassportNFT is ERC721, Ownable {
    error Soulbound();
    error AlreadyMinted();

    address public minter;
    uint256 public nextTokenId = 1;
    mapping(address => uint256) public tokenOf;
    mapping(uint256 => uint256) public scoreOfToken;

    event MinterUpdated(address indexed minter);
    event PassportMinted(address indexed to, uint256 indexed tokenId, uint256 score);
    event PassportScoreUpdated(uint256 indexed tokenId, uint256 score);

    modifier onlyMinter() {
        require(msg.sender == minter, "not minter");
        _;
    }

    constructor(address owner_) ERC721("Credit Passport", "PASS") Ownable(owner_) {}

    function setMinter(address minter_) external onlyOwner {
        minter = minter_;
        emit MinterUpdated(minter_);
    }

    /// @notice Mint or update the borrower's soulbound passport.
    function mintOrUpdate(address to, uint256 score) external onlyMinter returns (uint256 tokenId) {
        tokenId = tokenOf[to];
        if (tokenId == 0) {
            tokenId = nextTokenId++;
            tokenOf[to] = tokenId;
            _safeMint(to, tokenId);
            scoreOfToken[tokenId] = score;
            emit PassportMinted(to, tokenId, score);
        } else {
            scoreOfToken[tokenId] = score;
            emit PassportScoreUpdated(tokenId, score);
        }
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
