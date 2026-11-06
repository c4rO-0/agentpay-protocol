// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentPayEscrowFactory} from "../src/AgentPayEscrowFactory.sol";
import {OrderEscrowVault} from "../src/OrderEscrowVault.sol";
import {MockERC20} from "../src/MockERC20.sol";

interface SpikeVm {
    function addr(uint256 privateKey) external returns (address);
    function expectRevert(bytes calldata revertData) external;
    function prank(address msgSender) external;
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function warp(uint256 timestamp) external;
}

interface ISpikeSafe {
    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external returns (bool success);
}

interface ISpikeFactory {
    function getVault(bytes32 orderId) external view returns (address);
}

interface ISpikeVault {
    function buyer() external view returns (address);
    function token() external view returns (address);
    function amount() external view returns (uint256);
    function termsHash() external view returns (bytes32);
    function state() external view returns (uint8);
}

/// @dev Test-only Safe surface. Production validation must use a supported Safe deployment.
contract SpikeSafe {
    address public immutable owner;
    uint256 public ownerActionCount;
    mapping(address => bool) public enabledModules;

    constructor(address owner_) {
        owner = owner_;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    function enableModule(address module) external onlyOwner {
        require(module != address(0), "module=0");
        enabledModules[module] = true;
        ownerActionCount += 1;
    }

    function ownerCall(address target, bytes calldata data) external onlyOwner returns (bytes memory result) {
        ownerActionCount += 1;
        (bool success, bytes memory response) = target.call(data);
        if (!success) {
            assembly {
                revert(add(response, 0x20), mload(response))
            }
        }
        return response;
    }

    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external returns (bool success) {
        require(enabledModules[msg.sender], "module disabled");
        require(operation == 0, "delegatecall disabled");
        (success,) = to.call{value: value}(data);
    }
}

/// @dev Test-only authorization prototype. It is intentionally not a production contract.
contract AgentPaySpendingModuleSpike {
    struct Policy {
        address delegate;
        address token;
        address factory;
        uint256 maxPerPayment;
        uint256 totalBudget;
        uint256 spent;
        uint256 nonce;
        uint64 validAfter;
        uint64 validUntil;
        bool active;
    }

    bytes32 public constant PAYMENT_TYPEHASH = keccak256(
        "SafeDelegatedPayment(address safe,address factory,bytes32 orderId,address vault,address token,uint256 amount,bytes32 termsHash,uint256 nonce,uint64 validBefore)"
    );
    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant NAME_HASH = keccak256("AgentPay Safe Authorization");
    bytes32 private constant VERSION_HASH = keccak256("1");

    mapping(address => Policy) public policies;

    event PolicyConfigured(
        address indexed safe,
        address indexed delegate,
        address indexed token,
        address factory,
        uint256 maxPerPayment,
        uint256 totalBudget,
        uint64 validAfter,
        uint64 validUntil
    );
    event PolicyRevoked(address indexed safe, uint256 invalidatedNonce);
    event VaultFunded(
        address indexed safe,
        bytes32 indexed orderId,
        address indexed vault,
        uint256 amount,
        uint256 nonce
    );

    function setPolicy(
        address delegate,
        address token,
        address factory,
        uint256 maxPerPayment,
        uint256 totalBudget,
        uint64 validAfter,
        uint64 validUntil
    ) external {
        require(delegate != address(0), "delegate=0");
        require(token != address(0), "token=0");
        require(factory != address(0), "factory=0");
        require(maxPerPayment > 0, "max=0");
        require(totalBudget >= maxPerPayment, "budget < max");
        require(validUntil > block.timestamp && validUntil > validAfter, "bad validity");

        policies[msg.sender] = Policy({
            delegate: delegate,
            token: token,
            factory: factory,
            maxPerPayment: maxPerPayment,
            totalBudget: totalBudget,
            spent: 0,
            nonce: 0,
            validAfter: validAfter,
            validUntil: validUntil,
            active: true
        });

        emit PolicyConfigured(
            msg.sender,
            delegate,
            token,
            factory,
            maxPerPayment,
            totalBudget,
            validAfter,
            validUntil
        );
    }

    function revokePolicy() external {
        Policy storage policy = policies[msg.sender];
        require(policy.active, "policy inactive");
        policy.active = false;
        policy.nonce += 1;
        emit PolicyRevoked(msg.sender, policy.nonce);
    }

    function paymentDigest(
        address safe,
        bytes32 orderId,
        address vault,
        address token,
        uint256 amount,
        bytes32 termsHash,
        uint256 nonce,
        uint64 validBefore
    ) public view returns (bytes32) {
        Policy storage policy = policies[safe];
        bytes32 structHash = keccak256(
            abi.encode(
                PAYMENT_TYPEHASH,
                safe,
                policy.factory,
                orderId,
                vault,
                token,
                amount,
                termsHash,
                nonce,
                validBefore
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
    }

    function fundVault(
        address safe,
        bytes32 orderId,
        uint256 amount,
        uint256 nonce,
        uint64 validBefore,
        bytes calldata signature
    ) external returns (address vault) {
        Policy storage policy = policies[safe];
        require(policy.active, "policy inactive");
        require(block.timestamp >= policy.validAfter, "policy not active");
        require(block.timestamp <= policy.validUntil, "policy expired");
        require(validBefore >= block.timestamp && validBefore <= policy.validUntil, "commitment expired");
        require(nonce == policy.nonce, "bad nonce");
        require(amount > 0 && amount <= policy.maxPerPayment, "per-payment limit");
        require(policy.spent + amount <= policy.totalBudget, "budget exceeded");

        vault = ISpikeFactory(policy.factory).getVault(orderId);
        require(vault != address(0), "unknown order");

        ISpikeVault orderVault = ISpikeVault(vault);
        require(orderVault.buyer() == safe, "buyer mismatch");
        require(orderVault.token() == policy.token, "token mismatch");
        require(orderVault.amount() == amount, "amount mismatch");
        require(orderVault.state() == uint8(OrderEscrowVault.State.Created), "vault not created");

        bytes32 digest = paymentDigest(
            safe,
            orderId,
            vault,
            policy.token,
            amount,
            orderVault.termsHash(),
            nonce,
            validBefore
        );
        require(_recover(digest, signature) == policy.delegate, "bad delegate signature");

        policy.spent += amount;
        policy.nonce += 1;

        bool success = ISpikeSafe(safe).execTransactionFromModule(
            policy.token,
            0,
            abi.encodeWithSignature("transfer(address,uint256)", vault, amount),
            0
        );
        require(success, "safe transfer failed");

        emit VaultFunded(safe, orderId, vault, amount, nonce);
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
        signer = ecrecover(digest, v, r, s);
        require(signer != address(0), "bad signature");
    }
}

contract AgentPaySafeAuthorizationSpikeTest {
    SpikeVm private constant vm = SpikeVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant DELEGATE_PK = 0xA11CE;
    uint256 private constant ATTACKER_PK = 0xBAD;
    uint256 private constant ONE_USDC = 1_000_000;

    AgentPayEscrowFactory private factory;
    AgentPaySpendingModuleSpike private module;
    MockERC20 private token;
    SpikeSafe private safe;
    address private delegate;

    address private seller = address(0x5E11E2);
    address private settlement = address(0x5E771E);
    address private feeRecipient = address(0xFEE);

    function setUp() public {
        factory = new AgentPayEscrowFactory();
        module = new AgentPaySpendingModuleSpike();
        token = new MockERC20("Mock USDC", "mUSDC", 6);
        safe = new SpikeSafe(address(this));
        delegate = vm.addr(DELEGATE_PK);

        safe.enableModule(address(module));
        _setPolicy(ONE_USDC, 3 * ONE_USDC, uint64(block.timestamp), uint64(block.timestamp + 7 days));
        token.mint(address(safe), 5 * ONE_USDC);
    }

    function test_oneSetupFundsTwoOrdersWithoutOwnerAndCompletesEscrow() public {
        uint256 ownerActionsAfterSetup = safe.ownerActionCount();
        (bytes32 releaseOrder, OrderEscrowVault releaseVault) = _createVault("release", address(safe), token, ONE_USDC);
        (bytes32 refundOrder, OrderEscrowVault refundVault) = _createVault("refund", address(safe), token, ONE_USDC);

        _fund(DELEGATE_PK, releaseOrder, releaseVault, ONE_USDC, 0);
        _fund(DELEGATE_PK, refundOrder, refundVault, ONE_USDC, 1);

        require(safe.ownerActionCount() == ownerActionsAfterSetup, "owner approved an order");
        require(token.balanceOf(address(releaseVault)) == ONE_USDC, "release vault not funded");
        require(token.balanceOf(address(refundVault)) == ONE_USDC, "refund vault not funded");

        releaseVault.activate();
        refundVault.activate();

        vm.prank(seller);
        releaseVault.submitDelivery(keccak256("output"), 1);
        vm.prank(settlement);
        releaseVault.release(900_000, 50_000);
        vm.prank(settlement);
        refundVault.refund(ONE_USDC);

        require(uint8(releaseVault.state()) == uint8(OrderEscrowVault.State.Released), "not released");
        require(uint8(refundVault.state()) == uint8(OrderEscrowVault.State.Refunded), "not refunded");
    }

    function test_rejectsPerPaymentLimit() public {
        (bytes32 nextOrder, OrderEscrowVault vault) =
            _createVault("too-large", address(safe), token, ONE_USDC + 1);
        bytes memory signature = _sign(DELEGATE_PK, nextOrder, vault, ONE_USDC + 1, 0, _validBefore());

        vm.expectRevert(bytes("per-payment limit"));
        module.fundVault(address(safe), nextOrder, ONE_USDC + 1, 0, _validBefore(), signature);
    }

    function test_rejectsTotalBudget() public {
        _setPolicy(ONE_USDC, ONE_USDC, uint64(block.timestamp), uint64(block.timestamp + 7 days));
        (bytes32 firstOrder, OrderEscrowVault firstVault) = _createVault("budget-1", address(safe), token, ONE_USDC);
        (bytes32 secondOrder, OrderEscrowVault secondVault) = _createVault("budget-2", address(safe), token, ONE_USDC);
        _fund(DELEGATE_PK, firstOrder, firstVault, ONE_USDC, 0);

        bytes memory signature = _sign(DELEGATE_PK, secondOrder, secondVault, ONE_USDC, 1, _validBefore());
        vm.expectRevert(bytes("budget exceeded"));
        module.fundVault(address(safe), secondOrder, ONE_USDC, 1, _validBefore(), signature);
    }

    function test_rejectsUnknownOrder() public {
        bytes32 unknownOrder = keccak256("unknown");
        vm.expectRevert(bytes("unknown order"));
        module.fundVault(address(safe), unknownOrder, ONE_USDC, 0, _validBefore(), bytes(""));
    }

    function test_rejectsVaultForAnotherBuyer() public {
        (bytes32 nextOrder, OrderEscrowVault vault) = _createVault("wrong-buyer", address(0xB0B), token, ONE_USDC);
        vm.expectRevert(bytes("buyer mismatch"));
        module.fundVault(address(safe), nextOrder, ONE_USDC, 0, _validBefore(), bytes(""));
        require(token.balanceOf(address(vault)) == 0, "wrong vault funded");
    }

    function test_rejectsWrongToken() public {
        MockERC20 otherToken = new MockERC20("Other", "OTHER", 6);
        (bytes32 nextOrder,) = _createVault("wrong-token", address(safe), otherToken, ONE_USDC);
        vm.expectRevert(bytes("token mismatch"));
        module.fundVault(address(safe), nextOrder, ONE_USDC, 0, _validBefore(), bytes(""));
    }

    function test_rejectsTamperedTermsCommitment() public {
        (bytes32 nextOrder, OrderEscrowVault vault) = _createVault("terms", address(safe), token, ONE_USDC);
        uint64 validBefore = _validBefore();
        bytes32 digest = module.paymentDigest(
            address(safe),
            nextOrder,
            address(vault),
            address(token),
            ONE_USDC,
            keccak256("tampered-terms"),
            0,
            validBefore
        );
        bytes memory signature = _signDigest(DELEGATE_PK, digest);

        vm.expectRevert(bytes("bad delegate signature"));
        module.fundVault(address(safe), nextOrder, ONE_USDC, 0, validBefore, signature);
    }

    function test_rejectsReplay() public {
        (bytes32 nextOrder, OrderEscrowVault vault) = _createVault("replay", address(safe), token, ONE_USDC);
        uint64 validBefore = _validBefore();
        bytes memory signature = _sign(DELEGATE_PK, nextOrder, vault, ONE_USDC, 0, validBefore);
        module.fundVault(address(safe), nextOrder, ONE_USDC, 0, validBefore, signature);

        vm.expectRevert(bytes("bad nonce"));
        module.fundVault(address(safe), nextOrder, ONE_USDC, 0, validBefore, signature);
    }

    function test_rejectsUnauthorizedSigner() public {
        (bytes32 nextOrder, OrderEscrowVault vault) = _createVault("attacker", address(safe), token, ONE_USDC);
        uint64 validBefore = _validBefore();
        bytes memory signature = _sign(ATTACKER_PK, nextOrder, vault, ONE_USDC, 0, validBefore);

        vm.expectRevert(bytes("bad delegate signature"));
        module.fundVault(address(safe), nextOrder, ONE_USDC, 0, validBefore, signature);
    }

    function test_rejectsExpiredCommitment() public {
        (bytes32 nextOrder, OrderEscrowVault vault) = _createVault("expired", address(safe), token, ONE_USDC);
        uint64 validBefore = uint64(block.timestamp + 10);
        bytes memory signature = _sign(DELEGATE_PK, nextOrder, vault, ONE_USDC, 0, validBefore);
        vm.warp(block.timestamp + 11);

        vm.expectRevert(bytes("commitment expired"));
        module.fundVault(address(safe), nextOrder, ONE_USDC, 0, validBefore, signature);
    }

    function test_rejectsAfterUserRevocation() public {
        (bytes32 nextOrder, OrderEscrowVault vault) = _createVault("revoked", address(safe), token, ONE_USDC);
        uint64 validBefore = _validBefore();
        bytes memory signature = _sign(DELEGATE_PK, nextOrder, vault, ONE_USDC, 0, validBefore);
        safe.ownerCall(address(module), abi.encodeCall(module.revokePolicy, ()));

        vm.expectRevert(bytes("policy inactive"));
        module.fundVault(address(safe), nextOrder, ONE_USDC, 0, validBefore, signature);
    }

    function _setPolicy(uint256 maxPerPayment, uint256 totalBudget, uint64 validAfter, uint64 validUntil) private {
        safe.ownerCall(
            address(module),
            abi.encodeCall(
                module.setPolicy,
                (delegate, address(token), address(factory), maxPerPayment, totalBudget, validAfter, validUntil)
            )
        );
    }

    function _createVault(
        string memory label,
        address buyer,
        MockERC20 vaultToken,
        uint256 amount
    ) private returns (bytes32 nextOrder, OrderEscrowVault vault) {
        nextOrder = keccak256(bytes(label));
        bytes32 termsHash = keccak256(abi.encode("terms", label));
        address vaultAddress = factory.createVault(
            OrderEscrowVault.OrderInit({
                orderId: nextOrder,
                termsHash: termsHash,
                buyer: buyer,
                seller: seller,
                token: address(vaultToken),
                settlementAuthority: settlement,
                feeRecipient: feeRecipient,
                amount: amount,
                maxFeeAmount: 50_000,
                expiresAt: uint64(block.timestamp + 1 hours),
                refundAvailableAt: uint64(block.timestamp + 1 days)
            })
        );
        vault = OrderEscrowVault(vaultAddress);
    }

    function _fund(
        uint256 signerPk,
        bytes32 nextOrder,
        OrderEscrowVault vault,
        uint256 amount,
        uint256 nonce
    ) private {
        uint64 validBefore = _validBefore();
        bytes memory signature = _sign(signerPk, nextOrder, vault, amount, nonce, validBefore);
        module.fundVault(address(safe), nextOrder, amount, nonce, validBefore, signature);
    }

    function _sign(
        uint256 signerPk,
        bytes32 nextOrder,
        OrderEscrowVault vault,
        uint256 amount,
        uint256 nonce,
        uint64 validBefore
    ) private returns (bytes memory) {
        bytes32 digest = module.paymentDigest(
            address(safe),
            nextOrder,
            address(vault),
            address(token),
            amount,
            vault.termsHash(),
            nonce,
            validBefore
        );
        return _signDigest(signerPk, digest);
    }

    function _signDigest(uint256 signerPk, bytes32 digest) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _validBefore() private view returns (uint64) {
        return uint64(block.timestamp + 10 minutes);
    }
}
