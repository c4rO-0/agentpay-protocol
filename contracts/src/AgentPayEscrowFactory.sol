// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OrderEscrowVault} from "./OrderEscrowVault.sol";

library EscrowClones {
    function cloneDeterministic(address implementation, bytes32 salt) internal returns (address instance) {
        bytes memory bytecode = abi.encodePacked(
            hex"3d602d80600a3d3981f3",
            hex"363d3d373d3d3d363d73",
            bytes20(implementation),
            hex"5af43d82803e903d91602b57fd5bf3"
        );
        assembly {
            instance := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }
        require(instance != address(0), "create2 failed");
    }

    function predictDeterministicAddress(
        address implementation,
        bytes32 salt,
        address deployer
    ) internal pure returns (address) {
        bytes32 codeHash = keccak256(
            abi.encodePacked(
                hex"3d602d80600a3d3981f3",
                hex"363d3d373d3d3d363d73",
                bytes20(implementation),
                hex"5af43d82803e903d91602b57fd5bf3"
            )
        );
        bytes32 hash = keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, codeHash));
        return address(uint160(uint256(hash)));
    }
}

/// @title AgentPayEscrowFactory
/// @notice Creates deterministic per-order escrow vaults for x402 `exact` payments.
contract AgentPayEscrowFactory {
    address public immutable implementation;

    mapping(bytes32 => address) public vaults;

    event OrderVaultCreated(
        bytes32 indexed orderId,
        address indexed vault,
        address indexed buyer,
        address seller,
        address token,
        uint256 amount,
        bytes32 termsHash
    );

    constructor() {
        implementation = address(new OrderEscrowVault());
    }

    function createVault(OrderEscrowVault.OrderInit calldata init) external returns (address vault) {
        require(init.orderId != bytes32(0), "orderId=0");
        require(vaults[init.orderId] == address(0), "vault exists");

        bytes32 salt = _salt(init.orderId);
        vault = EscrowClones.cloneDeterministic(implementation, salt);
        OrderEscrowVault(vault).initialize(init);
        vaults[init.orderId] = vault;

        emit OrderVaultCreated(
            init.orderId,
            vault,
            init.buyer,
            init.seller,
            init.token,
            init.amount,
            init.termsHash
        );
    }

    function predictVaultAddress(bytes32 orderId) external view returns (address) {
        require(orderId != bytes32(0), "orderId=0");
        return EscrowClones.predictDeterministicAddress(implementation, _salt(orderId), address(this));
    }

    function getVault(bytes32 orderId) external view returns (address) {
        return vaults[orderId];
    }

    function _salt(bytes32 orderId) internal pure returns (bytes32) {
        return keccak256(abi.encode("agentpay.x402.escrow.v1", orderId));
    }
}
