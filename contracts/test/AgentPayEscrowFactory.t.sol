// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentPayEscrowFactory} from "../src/AgentPayEscrowFactory.sol";
import {OrderEscrowVault} from "../src/OrderEscrowVault.sol";
import {MockERC20} from "../src/MockERC20.sol";

interface EscrowVm {
    function expectRevert(bytes calldata revertData) external;
    function prank(address msgSender) external;
    function warp(uint256 timestamp) external;
}
contract AgentPayEscrowFactoryTest {
    EscrowVm private constant vm = EscrowVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    AgentPayEscrowFactory private factory;
    MockERC20 private token;

    address private buyer = address(0xB0B);
    address private seller = address(0xA11CE);
    address private settlement = address(0x5E771E);
    address private feeRecipient = address(0xFEE);
    bytes32 private orderId = keccak256("order-1");
    bytes32 private termsHash = keccak256("terms-1");

    function setUp() public {
        factory = new AgentPayEscrowFactory();
        token = new MockERC20("Mock USDC", "mUSDC", 6);
    }

    function test_createVault_usesPredictedAddressAndStoresOrder() public {
        address predicted = factory.predictVaultAddress(orderId);
        address vault = factory.createVault(_init(orderId, 1_000_000, 50_000));

        require(vault == predicted, "wrong predicted address");
        require(factory.getVault(orderId) == vault, "vault not stored");

        OrderEscrowVault stored = OrderEscrowVault(vault);
        require(stored.orderId() == orderId, "order mismatch");
        require(stored.termsHash() == termsHash, "terms mismatch");
        require(stored.buyer() == buyer, "buyer mismatch");
        require(stored.seller() == seller, "seller mismatch");
        require(stored.token() == address(token), "token mismatch");
        require(stored.amount() == 1_000_000, "amount mismatch");
        require(uint8(stored.state()) == uint8(OrderEscrowVault.State.Created), "state mismatch");
    }

    function test_createVault_revertsForDuplicateOrder() public {
        factory.createVault(_init(orderId, 1_000_000, 50_000));

        vm.expectRevert(bytes("vault exists"));
        factory.createVault(_init(orderId, 1_000_000, 50_000));
    }

    function test_activate_requiresVaultBalance() public {
        OrderEscrowVault vault = OrderEscrowVault(factory.createVault(_init(orderId, 1_000_000, 50_000)));

        vm.expectRevert(bytes("not funded"));
        vault.activate();

        token.mint(buyer, 1_000_000);
        vm.prank(buyer);
        token.transfer(address(vault), 1_000_000);

        vault.activate();
        require(uint8(vault.state()) == uint8(OrderEscrowVault.State.Funded), "not funded");
    }

    function test_release_paysSellerFeeAndRefundsRemainder() public {
        OrderEscrowVault vault = _fundedVault(1_000_000, 50_000);
        vm.prank(seller);
        vault.submitDelivery(keccak256("output"), 1);

        vm.prank(settlement);
        vault.release(900_000, 50_000);

        require(uint8(vault.state()) == uint8(OrderEscrowVault.State.Released), "not released");
        require(token.balanceOf(seller) == 900_000, "seller not paid");
        require(token.balanceOf(feeRecipient) == 50_000, "fee not paid");
        require(token.balanceOf(buyer) == 50_000, "remainder not refunded");
        require(token.balanceOf(address(vault)) == 0, "vault not drained");
    }

    function test_release_revertsWhenCallerIsNotSettlement() public {
        OrderEscrowVault vault = _fundedVault(1_000_000, 50_000);
        vm.prank(seller);
        vault.submitDelivery(keccak256("output"), 1);

        vm.expectRevert(bytes("not settlement"));
        vault.release(950_000, 50_000);
    }

    function test_release_revertsWhenFeeExceedsCap() public {
        OrderEscrowVault vault = _fundedVault(1_000_000, 50_000);
        vm.prank(seller);
        vault.submitDelivery(keccak256("output"), 1);

        vm.prank(settlement);
        vm.expectRevert(bytes("fee cap"));
        vault.release(900_000, 60_000);
    }

    function test_createVault_revertsForExpiredTerms() public {
        OrderEscrowVault.OrderInit memory init = _init(keccak256("expired"), 1_000_000, 0);
        init.expiresAt = uint64(block.timestamp);
        vm.expectRevert(bytes("expired"));
        factory.createVault(init);
    }

    function test_release_revertsWhenTotalExceedsAmount() public {
        OrderEscrowVault vault = _fundedVault(1_000_000, 50_000);
        vm.prank(seller);
        vault.submitDelivery(keccak256("output"), 1);
        vm.prank(settlement);
        vm.expectRevert(bytes("release > amount"));
        vault.release(960_000, 50_000);
    }

    function test_deliveryRejectsUnauthorizedCallerAndZeroHash() public {
        OrderEscrowVault vault = _fundedVault(1_000_000, 50_000);
        vm.expectRevert(bytes("not deliverer"));
        vault.submitDelivery(keccak256("output"), 1);
        vm.prank(seller);
        vm.expectRevert(bytes("outputHash=0"));
        vault.submitDelivery(bytes32(0), 1);
    }

    function test_releasedVaultRejectsTerminalReplay() public {
        OrderEscrowVault vault = _fundedVault(1_000_000, 50_000);
        vm.prank(seller);
        vault.submitDelivery(keccak256("output"), 1);
        vm.prank(settlement);
        vault.release(950_000, 50_000);
        vm.prank(settlement);
        vm.expectRevert(bytes("bad state"));
        vault.release(950_000, 50_000);
        vm.prank(settlement);
        vm.expectRevert(bytes("bad state"));
        vault.refund(1_000_000);
    }

    function test_refundedVaultRejectsTerminalReplay() public {
        OrderEscrowVault vault = _fundedVault(1_000_000, 50_000);
        vm.prank(settlement);
        vault.refund(1_000_000);
        vm.prank(settlement);
        vm.expectRevert(bytes("bad state"));
        vault.refund(1_000_000);
        vm.expectRevert(bytes("bad state"));
        vault.refundAfterTimeout();
    }

    function testFuzz_createdVaultWithAnyPositiveBalanceCannotCancel(uint96 deposited) public {
        uint256 balance = uint256(deposited) + 1;
        OrderEscrowVault vault = OrderEscrowVault(factory.createVault(_init(orderId, 1_000_000, 50_000)));
        token.mint(address(vault), balance);
        vm.prank(settlement);
        vm.expectRevert(bytes("vault has balance"));
        vault.cancelUnfunded();
        require(vault.state() == OrderEscrowVault.State.Created, "changed state");
        require(token.balanceOf(address(vault)) == balance, "changed balance");
    }

    function test_prefundedPredictedAddressCannotBeCancelledAfterCreation() public {
        address predicted = factory.predictVaultAddress(orderId);
        token.mint(predicted, 1);
        OrderEscrowVault vault = OrderEscrowVault(factory.createVault(_init(orderId, 1_000_000, 50_000)));
        vm.prank(settlement);
        vm.expectRevert(bytes("vault has balance"));
        vault.cancelUnfunded();
        require(token.balanceOf(predicted) == 1, "lost prefunding");
    }

    function test_cancelledVaultRejectsActivationAndRefund() public {
        OrderEscrowVault vault = OrderEscrowVault(factory.createVault(_init(orderId, 1_000_000, 50_000)));
        vm.prank(settlement);
        vault.cancelUnfunded();
        vm.expectRevert(bytes("bad state"));
        vault.activate();
        vm.prank(settlement);
        vm.expectRevert(bytes("bad state"));
        vault.refund(1_000_000);
    }

    function test_refundBySettlementRefundsBuyer() public {
        OrderEscrowVault vault = _fundedVault(1_000_000, 50_000);

        vm.prank(settlement);
        vault.refund(1_000_000);

        require(uint8(vault.state()) == uint8(OrderEscrowVault.State.Refunded), "not refunded");
        require(token.balanceOf(buyer) == 1_000_000, "buyer not refunded");
        require(token.balanceOf(address(vault)) == 0, "vault not drained");
    }

    function test_refundAfterTimeoutIsPermissionless() public {
        OrderEscrowVault vault = _fundedVault(1_000_000, 50_000);

        vm.expectRevert(bytes("too early"));
        vault.refundAfterTimeout();

        vm.warp(block.timestamp + 1 days + 1);
        vault.refundAfterTimeout();

        require(uint8(vault.state()) == uint8(OrderEscrowVault.State.Refunded), "not refunded");
        require(token.balanceOf(buyer) == 1_000_000, "buyer not refunded");
    }

    function test_deadlinesRejectEmptySettlementWindow() public {
        OrderEscrowVault.OrderInit memory init = _init(orderId, 1_000_000, 50_000);
        init.refundAvailableAt = init.expiresAt;
        vm.expectRevert(bytes("refund <= expiry"));
        factory.createVault(init);
    }

    function test_lateFundedVaultCanStillActivateForRefundRecovery() public {
        OrderEscrowVault vault = OrderEscrowVault(factory.createVault(_init(orderId, 1_000_000, 50_000)));
        token.mint(address(vault), 1_000_000);
        vm.warp(vault.expiresAt());
        vault.activate();
        vm.prank(seller);
        vm.expectRevert(bytes("delivery deadline passed"));
        vault.submitDelivery(keccak256("late"), 1);
        vm.warp(vault.refundAvailableAt());
        vault.refundAfterTimeout();
        require(token.balanceOf(buyer) == 1_000_000, "late funding trapped");
    }

    function test_sellerAndAuthorityCannotDeliverAtOrAfterDeadline() public {
        OrderEscrowVault vault = _fundedVault(1_000_000, 50_000);
        vm.warp(vault.expiresAt());
        vm.prank(seller);
        vm.expectRevert(bytes("delivery deadline passed"));
        vault.submitDelivery(keccak256("late"), 1);
        vm.warp(block.timestamp + 1);
        vm.prank(settlement);
        vm.expectRevert(bytes("delivery deadline passed"));
        vault.submitDelivery(keccak256("late"), 1);
        require(vault.state() == OrderEscrowVault.State.Funded, "late delivery changed state");
        require(token.balanceOf(address(vault)) == 1_000_000, "late delivery moved funds");
    }

    function test_lastTimelyDeliveryCanSettleBeforeRefundBoundary() public {
        OrderEscrowVault vault = _fundedVault(1_000_000, 50_000);
        vm.warp(vault.expiresAt() - 1);
        vm.prank(seller);
        vault.submitDelivery(keccak256("timely"), 1);
        vm.warp(vault.refundAvailableAt() - 1);
        vm.expectRevert(bytes("too early"));
        vault.refundAfterTimeout();
        vm.prank(settlement);
        vault.release(950_000, 50_000);
        require(token.balanceOf(seller) == 950_000, "seller amount");
        require(token.balanceOf(feeRecipient) == 50_000, "fee amount");
        require(token.balanceOf(address(vault)) == 0, "escrow residue");
    }

    function test_deliveredOrderAtRefundBoundaryCannotRaceToRelease() public {
        OrderEscrowVault vault = _fundedVault(1_000_000, 50_000);
        vm.prank(seller);
        vault.submitDelivery(keccak256("timely"), 1);
        vm.warp(vault.refundAvailableAt());
        vm.prank(settlement);
        vm.expectRevert(bytes("refund window open"));
        vault.release(950_000, 50_000);
        vm.prank(address(0x1234));
        vault.refundAfterTimeout();
        require(token.balanceOf(buyer) == 1_000_000, "buyer exit amount");
        require(token.balanceOf(seller) == 0 && token.balanceOf(feeRecipient) == 0, "unexpected payout");
        require(token.balanceOf(address(vault)) == 0, "escrow residue");
        vm.prank(settlement);
        vm.expectRevert(bytes("bad state"));
        vault.release(950_000, 50_000);
    }

    function _fundedVault(uint256 amount, uint256 maxFeeAmount) internal returns (OrderEscrowVault) {
        OrderEscrowVault vault = OrderEscrowVault(factory.createVault(_init(orderId, amount, maxFeeAmount)));
        token.mint(buyer, amount);
        vm.prank(buyer);
        token.transfer(address(vault), amount);
        vault.activate();
        return vault;
    }

    function _init(
        bytes32 nextOrderId,
        uint256 amount,
        uint256 maxFeeAmount
    ) internal view returns (OrderEscrowVault.OrderInit memory) {
        return OrderEscrowVault.OrderInit({
            orderId: nextOrderId,
            termsHash: termsHash,
            buyer: buyer,
            seller: seller,
            token: address(token),
            settlementAuthority: settlement,
            feeRecipient: feeRecipient,
            amount: amount,
            maxFeeAmount: maxFeeAmount,
            expiresAt: uint64(block.timestamp + 1 hours),
            refundAvailableAt: uint64(block.timestamp + 1 days)
        });
    }
}
