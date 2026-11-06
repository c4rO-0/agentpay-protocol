// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentPayEscrowFactory} from "../src/AgentPayEscrowFactory.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {OrderEscrowVault} from "../src/OrderEscrowVault.sol";
import {SettlementAuthorityController} from "../src/SettlementAuthorityController.sol";

interface AuthorityVm {
    function expectRevert(bytes calldata revertData) external;
    function prank(address msgSender) external;
}

contract AdminSafeHarness {
    address private immutable owner;

    constructor(address owner_) {
        owner = owner_;
    }

    function execute(address target, bytes calldata data) external {
        require(msg.sender == owner, "not owner");
        (bool success, bytes memory result) = target.call(data);
        if (!success) {
            assembly {
                revert(add(result, 0x20), mload(result))
            }
        }
    }
}

contract SettlementAuthorityControllerTest {
    AuthorityVm private constant vm = AuthorityVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant EXECUTOR = address(0xE1);
    address private constant NEXT_EXECUTOR = address(0xE2);
    address private constant RELAYER = address(0xE3);
    address private constant BUYER = address(0xB0B);
    address private constant SELLER = address(0x5E11E2);
    address private constant FEE_RECIPIENT = address(0xFEE);

    AgentPayEscrowFactory private factory;
    AdminSafeHarness private adminSafe;
    SettlementAuthorityController private controller;
    MockERC20 private token;

    function setUp() public {
        factory = new AgentPayEscrowFactory();
        adminSafe = new AdminSafeHarness(address(this));
        controller = new SettlementAuthorityController(address(adminSafe), address(factory), EXECUTOR);
        token = new MockERC20("Mock USDC", "mUSDC", 6);
    }

    function test_constructorRejectsEoaAdministratorAndFactory() public {
        vm.expectRevert(bytes("administrator not contract"));
        new SettlementAuthorityController(address(0xA11CE), address(factory), EXECUTOR);
        vm.expectRevert(bytes("factory not contract"));
        new SettlementAuthorityController(address(adminSafe), address(0xFAC), EXECUTOR);
    }

    function test_rotationKeepsExistingVaultAndRemovesOldExecutor() public {
        OrderEscrowVault vault = _fundedVault(keccak256("rotation"));

        _adminCall(abi.encodeCall(controller.setExecutor, (NEXT_EXECUTOR)));
        require(vault.settlementAuthority() == address(controller), "Vault authority changed");

        vm.prank(EXECUTOR);
        vm.expectRevert(bytes("not executor"));
        controller.refund(address(vault), 1_000_000);

        vm.prank(NEXT_EXECUTOR);
        controller.refund(address(vault), 1_000_000);
        require(uint8(vault.state()) == uint8(OrderEscrowVault.State.Refunded), "not refunded");
        require(token.balanceOf(BUYER) == 1_000_000, "buyer not refunded");
    }

    function test_executorCanSubmitDeliveryAndReleaseOnlyForApprovedVault() public {
        OrderEscrowVault vault = _fundedVault(keccak256("release"));
        vm.prank(EXECUTOR);
        controller.submitDelivery(address(vault), keccak256("output"), 3);
        vm.prank(EXECUTOR);
        controller.release(address(vault), 900_000, 50_000);

        require(uint8(vault.state()) == uint8(OrderEscrowVault.State.Released), "not released");
        require(token.balanceOf(SELLER) == 900_000, "seller unpaid");
        require(token.balanceOf(FEE_RECIPIENT) == 50_000, "fee unpaid");
        require(token.balanceOf(BUYER) == 50_000, "remainder not refunded");
    }

    function test_pauseBlocksEveryAuthorityOperationAndUnpauseRestoresIt() public {
        OrderEscrowVault funded = _fundedVault(keccak256("paused-funded"));
        OrderEscrowVault created = _createdVault(keccak256("paused-created"));
        _adminCall(abi.encodeCall(controller.pause, ()));

        vm.prank(EXECUTOR);
        vm.expectRevert(bytes("paused"));
        controller.submitDelivery(address(funded), keccak256("output"), 1);
        vm.prank(EXECUTOR);
        vm.expectRevert(bytes("paused"));
        controller.release(address(funded), 950_000, 50_000);
        vm.prank(EXECUTOR);
        vm.expectRevert(bytes("paused"));
        controller.refund(address(funded), 1_000_000);
        vm.prank(EXECUTOR);
        vm.expectRevert(bytes("paused"));
        controller.cancelUnfunded(address(created));

        _adminCall(abi.encodeCall(controller.unpause, ()));
        vm.prank(EXECUTOR);
        controller.cancelUnfunded(address(created));
        require(uint8(created.state()) == uint8(OrderEscrowVault.State.Cancelled), "not cancelled");
    }

    function test_cancelUnfundedCannotTrapAlreadyTransferredPayment() public {
        OrderEscrowVault vault = _createdVault(keccak256("funding-before-activation"));
        token.mint(address(vault), 1_000_000);
        vm.prank(EXECUTOR);
        vm.expectRevert(bytes("vault has balance"));
        controller.cancelUnfunded(address(vault));
        vault.activate();
        vm.prank(EXECUTOR);
        controller.refund(address(vault), 1_000_000);
        require(vault.state() == OrderEscrowVault.State.Refunded, "refund recovery failed");
        require(token.balanceOf(address(vault)) == 0, "trapped balance");
    }

    function test_rolesCannotEscalateOrOverlap() public {
        OrderEscrowVault vault = _fundedVault(keccak256("roles"));
        vm.prank(RELAYER);
        vm.expectRevert(bytes("not executor"));
        controller.refund(address(vault), 1_000_000);
        vm.prank(address(adminSafe));
        vm.expectRevert(bytes("not executor"));
        controller.refund(address(vault), 1_000_000);
        vm.prank(EXECUTOR);
        vm.expectRevert(bytes("not administrator"));
        controller.pause();
        vm.prank(address(adminSafe));
        vm.expectRevert(bytes("roles overlap"));
        controller.setExecutor(address(adminSafe));
    }

    function test_rejectsForeignFactoryVaultAndArbitraryCalldata() public {
        AgentPayEscrowFactory foreignFactory = new AgentPayEscrowFactory();
        OrderEscrowVault foreignVault = OrderEscrowVault(foreignFactory.createVault(_init(keccak256("foreign"))));
        require(!controller.isApprovedVault(address(foreignVault)), "foreign Vault approved");
        vm.prank(EXECUTOR);
        vm.expectRevert(bytes("wrong factory"));
        controller.cancelUnfunded(address(foreignVault));

        vm.prank(EXECUTOR);
        (bool success,) = address(controller).call(abi.encodeWithSignature("execute(address,bytes)", address(vaultPlaceholder()), hex"00"));
        require(!success, "arbitrary call surface exists");
    }

    function test_permissionlessActivationStaysOutsideController() public {
        OrderEscrowVault vault = _createdVault(keccak256("activation"));
        token.mint(address(vault), 1_000_000);
        vm.prank(RELAYER);
        vault.activate();
        require(uint8(vault.state()) == uint8(OrderEscrowVault.State.Funded), "relayer activation failed");
    }

    function _fundedVault(bytes32 id) internal returns (OrderEscrowVault vault) {
        vault = _createdVault(id);
        token.mint(address(vault), 1_000_000);
        vm.prank(RELAYER);
        vault.activate();
    }

    function _adminCall(bytes memory data) internal {
        adminSafe.execute(address(controller), data);
    }

    function _createdVault(bytes32 id) internal returns (OrderEscrowVault) {
        return OrderEscrowVault(factory.createVault(_init(id)));
    }

    function _init(bytes32 id) internal view returns (OrderEscrowVault.OrderInit memory) {
        return OrderEscrowVault.OrderInit({
            orderId: id,
            termsHash: keccak256(abi.encode("terms", id)),
            buyer: BUYER,
            seller: SELLER,
            token: address(token),
            settlementAuthority: address(controller),
            feeRecipient: FEE_RECIPIENT,
            amount: 1_000_000,
            maxFeeAmount: 50_000,
            expiresAt: uint64(block.timestamp + 1 hours),
            refundAvailableAt: uint64(block.timestamp + 1 days)
        });
    }

    function vaultPlaceholder() private pure returns (address) {
        return address(0x1234);
    }
}
