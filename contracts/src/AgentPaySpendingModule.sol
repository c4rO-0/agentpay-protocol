// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OrderEscrowVault} from "./OrderEscrowVault.sol";

interface IAgentPaySafe {
    function execTransactionFromModuleReturnData(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external returns (bool success, bytes memory returnData);
}

interface IAgentPayFactory {
    function getVault(bytes32 orderId) external view returns (address);
}

interface IAgentPayRegistry {
    function isQualified(bytes32 skillId, bytes32 profileHash, address seller) external view returns (bool);
}

/// @title AgentPaySpendingModule
/// @notice Lets a Safe fund qualified AgentPay orders within an owner-approved policy.
contract AgentPaySpendingModule {
    struct Policy {
        address delegate;
        address token;
        address factory;
        address registry;
        uint256 maxPerPayment;
        uint256 totalBudget;
        uint256 spent;
        uint64 validAfter;
        uint64 validUntil;
        bool revoked;
    }

    bytes32 public constant COMMITMENT_TYPEHASH = keccak256(
        "AgentPayCommitment(address safe,bytes32 policyId,address factory,bytes32 orderId,address vault,address token,uint256 amount,bytes32 termsHash,bytes32 scopeProofHash,bytes32 commitmentNonce,uint64 validBefore)"
    );
    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant NAME_HASH = keccak256("AgentPay Safe Module");
    bytes32 private constant VERSION_HASH = keccak256("1");
    uint256 private constant SECP256K1_HALF_N =
        0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    mapping(address => mapping(bytes32 => Policy)) public policies;
    mapping(address => mapping(bytes32 => mapping(bytes32 => bool))) public usedCommitments;
    mapping(address => mapping(address => mapping(bytes32 => bool))) public fundedOrders;

    event PolicyCreated(
        address indexed safe,
        bytes32 indexed policyId,
        address indexed delegate,
        address token,
        address factory,
        address registry,
        uint256 maxPerPayment,
        uint256 totalBudget,
        uint64 validAfter,
        uint64 validUntil
    );
    event PolicyRevoked(address indexed safe, bytes32 indexed policyId);
    event VaultFunded(
        address indexed safe,
        bytes32 indexed policyId,
        bytes32 indexed orderId,
        address vault,
        uint256 amount,
        bytes32 commitmentNonce
    );

    function createPolicy(
        bytes32 policyId,
        address delegate,
        address token,
        address factory,
        address registry,
        uint256 maxPerPayment,
        uint256 totalBudget,
        uint64 validAfter,
        uint64 validUntil
    ) external {
        require(policyId != bytes32(0), "policyId=0");
        require(policies[msg.sender][policyId].delegate == address(0), "policy exists");
        require(delegate != address(0), "delegate=0");
        require(token != address(0), "token=0");
        require(factory != address(0), "factory=0");
        require(registry != address(0), "registry=0");
        require(maxPerPayment > 0, "max=0");
        require(totalBudget >= maxPerPayment, "budget < max");
        require(validUntil > block.timestamp && validUntil > validAfter, "bad validity");

        policies[msg.sender][policyId] = Policy({
            delegate: delegate,
            token: token,
            factory: factory,
            registry: registry,
            maxPerPayment: maxPerPayment,
            totalBudget: totalBudget,
            spent: 0,
            validAfter: validAfter,
            validUntil: validUntil,
            revoked: false
        });
        emit PolicyCreated(
            msg.sender,
            policyId,
            delegate,
            token,
            factory,
            registry,
            maxPerPayment,
            totalBudget,
            validAfter,
            validUntil
        );
    }

    function revokePolicy(bytes32 policyId) external {
        Policy storage policy = policies[msg.sender][policyId];
        require(policy.delegate != address(0), "unknown policy");
        require(!policy.revoked, "policy revoked");
        policy.revoked = true;
        emit PolicyRevoked(msg.sender, policyId);
    }

    function qualificationHash(address registry, bytes32 skillId, bytes32 profileHash, address seller)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(registry, skillId, profileHash, seller));
    }

    function commitmentDigest(
        address safe,
        bytes32 policyId,
        bytes32 orderId,
        address vault,
        address token,
        uint256 amount,
        bytes32 termsHash,
        bytes32 scopeProofHash,
        bytes32 commitmentNonce,
        uint64 validBefore
    ) public view returns (bytes32) {
        Policy storage policy = policies[safe][policyId];
        bytes32 structHash = keccak256(
            abi.encode(
                COMMITMENT_TYPEHASH,
                safe,
                policyId,
                policy.factory,
                orderId,
                vault,
                token,
                amount,
                termsHash,
                scopeProofHash,
                commitmentNonce,
                validBefore
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
    }

    function fundVault(
        address safe,
        bytes32 policyId,
        bytes32 orderId,
        bytes32 skillId,
        bytes32 profileHash,
        uint256 amount,
        bytes32 commitmentNonce,
        uint64 validBefore,
        bytes calldata signature
    ) external returns (address vault) {
        Policy storage policy = policies[safe][policyId];
        require(policy.delegate != address(0), "unknown policy");
        require(!policy.revoked, "policy revoked");
        require(block.timestamp >= policy.validAfter, "policy not active");
        require(block.timestamp <= policy.validUntil, "policy expired");
        require(validBefore >= block.timestamp && validBefore <= policy.validUntil, "commitment expired");
        require(!usedCommitments[safe][policyId][commitmentNonce], "commitment used");
        require(amount > 0 && amount <= policy.maxPerPayment, "per-payment limit");
        require(policy.spent + amount <= policy.totalBudget, "budget exceeded");
        require(!fundedOrders[safe][policy.factory][orderId], "order funded");

        vault = IAgentPayFactory(policy.factory).getVault(orderId);
        require(vault != address(0), "unknown order");
        OrderEscrowVault orderVault = OrderEscrowVault(vault);
        require(orderVault.factory() == policy.factory, "factory mismatch");
        require(orderVault.buyer() == safe, "buyer mismatch");
        require(orderVault.token() == policy.token, "token mismatch");
        require(orderVault.amount() == amount, "amount mismatch");
        require(orderVault.state() == OrderEscrowVault.State.Created, "vault not created");

        address seller = orderVault.seller();
        require(IAgentPayRegistry(policy.registry).isQualified(skillId, profileHash, seller), "skill not qualified");
        bytes32 scopeProofHash = qualificationHash(policy.registry, skillId, profileHash, seller);
        bytes32 digest = commitmentDigest(
            safe,
            policyId,
            orderId,
            vault,
            policy.token,
            amount,
            orderVault.termsHash(),
            scopeProofHash,
            commitmentNonce,
            validBefore
        );
        require(_recover(digest, signature) == policy.delegate, "bad delegate signature");

        usedCommitments[safe][policyId][commitmentNonce] = true;
        fundedOrders[safe][policy.factory][orderId] = true;
        policy.spent += amount;

        (bool success, bytes memory returnData) = IAgentPaySafe(safe).execTransactionFromModuleReturnData(
            policy.token,
            0,
            abi.encodeWithSignature("transfer(address,uint256)", vault, amount),
            0
        );
        require(success, "safe transfer failed");
        require(returnData.length == 0 || (returnData.length == 32 && abi.decode(returnData, (bool))), "token transfer failed");

        emit VaultFunded(safe, policyId, orderId, vault, amount, commitmentNonce);
    }

    function _domainSeparator() private view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this)));
    }

    function _recover(bytes32 digest, bytes calldata signature) private pure returns (address signer) {
        require(signature.length == 65, "bad signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        require(v == 27 || v == 28, "bad signature v");
        require(uint256(s) <= SECP256K1_HALF_N, "bad signature s");
        signer = ecrecover(digest, v, r, s);
        require(signer != address(0), "bad signature");
    }
}
