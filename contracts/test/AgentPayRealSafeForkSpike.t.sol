// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentPayEscrowFactory} from "../src/AgentPayEscrowFactory.sol";
import {OrderEscrowVault} from "../src/OrderEscrowVault.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {AgentPaySpendingModuleSpike} from "./AgentPaySafeAuthorizationSpike.t.sol";

interface RealSafeForkVm {
    function addr(uint256 privateKey) external returns (address);
    function createSelectFork(string calldata rpcUrl) external returns (uint256 forkId);
    function envString(string calldata name) external returns (string memory value);
    function expectRevert(bytes calldata revertData) external;
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
}

interface ISafeProxyFactorySpike {
    function createProxyWithNonce(
        address singleton,
        bytes memory initializer,
        uint256 saltNonce
    ) external returns (address proxy);
}

interface IRealSafeSpike {
    function setup(
        address[] calldata owners,
        uint256 threshold,
        address to,
        bytes calldata data,
        address fallbackHandler,
        address paymentToken,
        uint256 payment,
        address payable paymentReceiver
    ) external;

    function enableModule(address module) external;
    function isModuleEnabled(address module) external view returns (bool);
    function nonce() external view returns (uint256);

    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes calldata signatures
    ) external payable returns (bool success);
}

/// @dev Called by Safe.setup using delegatecall, so address(this) is the new Safe proxy.
contract RealSafeSetupHelperSpike {
    function configure(address module, bytes calldata policyCall) external {
        IRealSafeSpike(address(this)).enableModule(module);
        (bool success, bytes memory response) = module.call(policyCall);
        if (!success) {
            assembly {
                revert(add(response, 0x20), mload(response))
            }
        }
    }
}

contract AgentPayRealSafeForkSpikeTest {
    RealSafeForkVm private constant vm =
        RealSafeForkVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    // Safe v1.4.1 canonical deployments used by Safe on Base.
    address private constant SAFE_L2_SINGLETON = 0x29fcB43b46531BcA003ddC8FCB67FFE91900C762;
    address private constant SAFE_PROXY_FACTORY = 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67;

    uint256 private constant DELEGATE_PK = 0xA11CE;
    uint256 private constant ONE_USDC = 1_000_000;

    AgentPayEscrowFactory private factory;
    AgentPaySpendingModuleSpike private module;
    MockERC20 private token;
    IRealSafeSpike private safe;
    address private delegate;

    address private seller = address(0x5E11E2);
    address private settlement = address(0x5E771E);
    address private feeRecipient = address(0xFEE);

    function setUp() public {
        vm.createSelectFork(vm.envString("BASE_RPC_URL"));

        factory = new AgentPayEscrowFactory();
        module = new AgentPaySpendingModuleSpike();
        token = new MockERC20("Mock USDC", "mUSDC", 6);
        delegate = vm.addr(DELEGATE_PK);

        RealSafeSetupHelperSpike setupHelper = new RealSafeSetupHelperSpike();
        bytes memory policyCall = abi.encodeCall(
            module.setPolicy,
            (
                delegate,
                address(token),
                address(factory),
                ONE_USDC,
                3 * ONE_USDC,
                uint64(block.timestamp),
                uint64(block.timestamp + 7 days)
            )
        );
        bytes memory setupData = abi.encodeCall(setupHelper.configure, (address(module), policyCall));

        address[] memory owners = new address[](1);
        owners[0] = address(this);
        bytes memory initializer = abi.encodeCall(
            IRealSafeSpike.setup,
            (owners, 1, address(setupHelper), setupData, address(0), address(0), 0, payable(address(0)))
        );
        address safeAddress = ISafeProxyFactorySpike(SAFE_PROXY_FACTORY).createProxyWithNonce(
            SAFE_L2_SINGLETON,
            initializer,
            uint256(keccak256("agentpay-real-safe-fork-spike"))
        );
        safe = IRealSafeSpike(safeAddress);

        require(safe.isModuleEnabled(address(module)), "module not enabled");
        require(safe.nonce() == 0, "setup consumed owner nonce");
        token.mint(safeAddress, 5 * ONE_USDC);
    }

    function test_realSafeFundsTwoOrdersWithoutOwnerTransactions() public {
        uint256 ownerNonceAfterSetup = safe.nonce();
        (bytes32 firstOrder, OrderEscrowVault firstVault) = _createVault("real-safe-1");
        (bytes32 secondOrder, OrderEscrowVault secondVault) = _createVault("real-safe-2");

        _fund(firstOrder, firstVault, 0);
        _fund(secondOrder, secondVault, 1);

        require(safe.nonce() == ownerNonceAfterSetup, "owner approved an order");
        require(token.balanceOf(address(firstVault)) == ONE_USDC, "first vault not funded");
        require(token.balanceOf(address(secondVault)) == ONE_USDC, "second vault not funded");
        firstVault.activate();
        secondVault.activate();
        require(uint8(firstVault.state()) == uint8(OrderEscrowVault.State.Funded), "first not active");
        require(uint8(secondVault.state()) == uint8(OrderEscrowVault.State.Funded), "second not active");
    }

    function test_realSafeOwnerCanRevokeAndInvalidateCommitment() public {
        (bytes32 nextOrder, OrderEscrowVault vault) = _createVault("real-safe-revoked");
        uint64 validBefore = uint64(block.timestamp + 10 minutes);
        bytes memory signature = _sign(nextOrder, vault, 0, validBefore);

        uint256 ownerNonceBeforeRevoke = safe.nonce();
        bool success = safe.execTransaction(
            address(module),
            0,
            abi.encodeCall(module.revokePolicy, ()),
            0,
            0,
            0,
            0,
            address(0),
            payable(address(0)),
            _prevalidatedOwnerSignature(address(this))
        );
        require(success, "Safe revoke failed");
        require(safe.nonce() == ownerNonceBeforeRevoke + 1, "revoke did not consume owner nonce");

        vm.expectRevert(bytes("policy inactive"));
        module.fundVault(address(safe), nextOrder, ONE_USDC, 0, validBefore, signature);
        require(token.balanceOf(address(vault)) == 0, "revoked commitment funded");
    }

    function _createVault(string memory label) private returns (bytes32 nextOrder, OrderEscrowVault vault) {
        nextOrder = keccak256(bytes(label));
        address vaultAddress = factory.createVault(
            OrderEscrowVault.OrderInit({
                orderId: nextOrder,
                termsHash: keccak256(abi.encode("terms", label)),
                buyer: address(safe),
                seller: seller,
                token: address(token),
                settlementAuthority: settlement,
                feeRecipient: feeRecipient,
                amount: ONE_USDC,
                maxFeeAmount: 50_000,
                expiresAt: uint64(block.timestamp + 1 hours),
                refundAvailableAt: uint64(block.timestamp + 1 days)
            })
        );
        vault = OrderEscrowVault(vaultAddress);
    }

    function _fund(bytes32 nextOrder, OrderEscrowVault vault, uint256 nonce) private {
        uint64 validBefore = uint64(block.timestamp + 10 minutes);
        module.fundVault(
            address(safe),
            nextOrder,
            ONE_USDC,
            nonce,
            validBefore,
            _sign(nextOrder, vault, nonce, validBefore)
        );
    }

    function _sign(
        bytes32 nextOrder,
        OrderEscrowVault vault,
        uint256 nonce,
        uint64 validBefore
    ) private returns (bytes memory) {
        bytes32 digest = module.paymentDigest(
            address(safe),
            nextOrder,
            address(vault),
            address(token),
            ONE_USDC,
            vault.termsHash(),
            nonce,
            validBefore
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(DELEGATE_PK, digest);
        return abi.encodePacked(r, s, v);
    }

    function _prevalidatedOwnerSignature(address owner) private pure returns (bytes memory) {
        return abi.encodePacked(bytes32(uint256(uint160(owner))), bytes32(0), uint8(1));
    }
}
