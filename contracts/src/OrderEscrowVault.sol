// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Escrow {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @title OrderEscrowVault
/// @notice Per-order escrow receiver for AgentPay x402 `exact` funding.
contract OrderEscrowVault {
    enum State {
        Uninitialized,
        Created,
        Funded,
        Delivered,
        Released,
        Refunded,
        Cancelled
    }

    struct OrderInit {
        bytes32 orderId;
        bytes32 termsHash;
        address buyer;
        address seller;
        address token;
        address settlementAuthority;
        address feeRecipient;
        uint256 amount;
        uint256 maxFeeAmount;
        uint64 expiresAt;
        uint64 refundAvailableAt;
    }

    bytes32 public orderId;
    bytes32 public termsHash;
    address public factory;
    address public buyer;
    address public seller;
    address public token;
    address public settlementAuthority;
    address public feeRecipient;
    uint256 public amount;
    uint256 public maxFeeAmount;
    uint64 public expiresAt;
    uint64 public refundAvailableAt;
    State public state;
    bytes32 public outputHash;
    uint256 public usageUnits;
    uint256 public sellerPaidAmount;
    uint256 public feePaidAmount;
    uint256 public refundedAmount;

    event VaultInitialized(
        bytes32 indexed orderId,
        bytes32 indexed termsHash,
        address indexed buyer,
        address seller,
        address token,
        uint256 amount
    );
    event VaultFunded(bytes32 indexed orderId, address indexed buyer, uint256 amount, uint256 balance);
    event DeliverySubmitted(bytes32 indexed orderId, bytes32 indexed outputHash, uint256 usageUnits);
    event VaultReleased(bytes32 indexed orderId, address indexed seller, uint256 sellerAmount, uint256 feeAmount);
    event VaultRefunded(bytes32 indexed orderId, address indexed buyer, uint256 refundAmount);
    event VaultCancelled(bytes32 indexed orderId);

    constructor() {
        state = State.Cancelled;
    }

    modifier onlySettlementAuthority() {
        require(msg.sender == settlementAuthority, "not settlement");
        _;
    }

    function initialize(OrderInit calldata init) external {
        require(state == State.Uninitialized, "initialized");
        require(init.orderId != bytes32(0), "orderId=0");
        require(init.termsHash != bytes32(0), "termsHash=0");
        require(init.buyer != address(0), "buyer=0");
        require(init.seller != address(0), "seller=0");
        require(init.token != address(0), "token=0");
        require(init.settlementAuthority != address(0), "settlement=0");
        require(init.feeRecipient != address(0), "feeRecipient=0");
        require(init.amount > 0, "amount=0");
        require(init.maxFeeAmount <= init.amount, "fee > amount");
        require(init.expiresAt > block.timestamp, "expired");
        // Deadline behavior revision 2: delivery and settlement have disjoint
        // windows. Settlement must reserve its full waiting window in this gap.
        require(init.refundAvailableAt > init.expiresAt, "refund <= expiry");

        orderId = init.orderId;
        termsHash = init.termsHash;
        factory = msg.sender;
        buyer = init.buyer;
        seller = init.seller;
        token = init.token;
        settlementAuthority = init.settlementAuthority;
        feeRecipient = init.feeRecipient;
        amount = init.amount;
        maxFeeAmount = init.maxFeeAmount;
        expiresAt = init.expiresAt;
        refundAvailableAt = init.refundAvailableAt;
        state = State.Created;

        emit VaultInitialized(init.orderId, init.termsHash, init.buyer, init.seller, init.token, init.amount);
    }

    function activate() external {
        require(state == State.Created, "bad state");
        uint256 balance = IERC20Escrow(token).balanceOf(address(this));
        require(balance >= amount, "not funded");
        state = State.Funded;
        emit VaultFunded(orderId, buyer, amount, balance);
    }

    function submitDelivery(bytes32 deliveryOutputHash, uint256 deliveryUsageUnits) external {
        require(msg.sender == seller || msg.sender == settlementAuthority, "not deliverer");
        require(state == State.Funded, "bad state");
        require(block.timestamp < expiresAt, "delivery deadline passed");
        require(deliveryOutputHash != bytes32(0), "outputHash=0");
        outputHash = deliveryOutputHash;
        usageUnits = deliveryUsageUnits;
        state = State.Delivered;
        emit DeliverySubmitted(orderId, deliveryOutputHash, deliveryUsageUnits);
    }

    function release(uint256 sellerAmount, uint256 feeAmount) external onlySettlementAuthority {
        require(state == State.Delivered, "bad state");
        // Once the public refund window opens, transaction ordering must not
        // allow the Authority to win a race against the buyer's timeout exit.
        require(block.timestamp < refundAvailableAt, "refund window open");
        require(sellerAmount > 0 || feeAmount > 0, "release=0");
        require(feeAmount <= maxFeeAmount, "fee cap");
        require(sellerAmount + feeAmount <= amount, "release > amount");

        state = State.Released;
        sellerPaidAmount = sellerAmount;
        feePaidAmount = feeAmount;

        if (sellerAmount > 0) {
            _safeTransfer(token, seller, sellerAmount);
        }
        if (feeAmount > 0) {
            _safeTransfer(token, feeRecipient, feeAmount);
        }

        uint256 remaining = IERC20Escrow(token).balanceOf(address(this));
        if (remaining > 0) {
            refundedAmount = remaining;
            _safeTransfer(token, buyer, remaining);
            emit VaultRefunded(orderId, buyer, remaining);
        }

        emit VaultReleased(orderId, seller, sellerAmount, feeAmount);
    }

    function refund(uint256 refundAmount) external onlySettlementAuthority {
        require(state == State.Funded || state == State.Delivered, "bad state");
        require(refundAmount == amount, "refund != amount");
        state = State.Refunded;
        uint256 balance = IERC20Escrow(token).balanceOf(address(this));
        require(balance >= refundAmount, "insufficient");
        refundedAmount = balance;
        _safeTransfer(token, buyer, balance);
        emit VaultRefunded(orderId, buyer, balance);
    }

    function refundAfterTimeout() external {
        require(state == State.Funded || state == State.Delivered, "bad state");
        require(block.timestamp >= refundAvailableAt, "too early");
        state = State.Refunded;
        uint256 balance = IERC20Escrow(token).balanceOf(address(this));
        require(balance >= amount, "insufficient");
        refundedAmount = balance;
        _safeTransfer(token, buyer, balance);
        emit VaultRefunded(orderId, buyer, balance);
    }

    function cancelUnfunded() external onlySettlementAuthority {
        require(state == State.Created, "bad state");
        // Module funding transfers tokens before the separate activate call.
        // Check the actual balance atomically: Created alone is not unfunded.
        require(IERC20Escrow(token).balanceOf(address(this)) == 0, "vault has balance");
        state = State.Cancelled;
        emit VaultCancelled(orderId);
    }

    function getOrder() external view returns (OrderInit memory) {
        return OrderInit({
            orderId: orderId,
            termsHash: termsHash,
            buyer: buyer,
            seller: seller,
            token: token,
            settlementAuthority: settlementAuthority,
            feeRecipient: feeRecipient,
            amount: amount,
            maxFeeAmount: maxFeeAmount,
            expiresAt: expiresAt,
            refundAvailableAt: refundAvailableAt
        });
    }

    function _safeTransfer(address tokenAddress, address to, uint256 value) internal {
        (bool success, bytes memory data) =
            tokenAddress.call(abi.encodeWithSelector(IERC20Escrow.transfer.selector, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "transfer failed");
    }
}
