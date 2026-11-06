// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SkillRegistry
/// @notice AgentPay-maintained list of developer-controlled Skill payment identities.
/// @dev Qualification confirms identity/control only. It is not a quality endorsement.
/// @dev skillId identifies the Provider-served paid Skill, not a User-installed Skill package.
contract SkillRegistry {
    struct Skill {
        bytes32 profileHash;
        address seller;
        bool active;
    }

    address public owner;
    mapping(bytes32 => Skill) public skills;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event SkillUpdated(bytes32 indexed skillId, bytes32 indexed profileHash, address indexed seller, bool active);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address owner_) {
        require(owner_ != address(0), "owner=0");
        owner = owner_;
        emit OwnershipTransferred(address(0), owner_);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "owner=0");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setSkill(bytes32 skillId, bytes32 profileHash, address seller, bool active) external onlyOwner {
        require(skillId != bytes32(0), "skillId=0");
        require(profileHash != bytes32(0), "profileHash=0");
        require(seller != address(0), "seller=0");
        skills[skillId] = Skill({profileHash: profileHash, seller: seller, active: active});
        emit SkillUpdated(skillId, profileHash, seller, active);
    }

    function setActive(bytes32 skillId, bool active) external onlyOwner {
        Skill storage skill = skills[skillId];
        require(skill.seller != address(0), "unknown skill");
        skill.active = active;
        emit SkillUpdated(skillId, skill.profileHash, skill.seller, active);
    }

    function isQualified(bytes32 skillId, bytes32 profileHash, address seller) external view returns (bool) {
        Skill storage skill = skills[skillId];
        return skill.active && skill.profileHash == profileHash && skill.seller == seller;
    }
}
