// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentPayEscrowFactory} from "../src/AgentPayEscrowFactory.sol";
import {AgentPaySpendingModule} from "../src/AgentPaySpendingModule.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {OrderEscrowVault} from "../src/OrderEscrowVault.sol";
import {SkillRegistry} from "../src/SkillRegistry.sol";

interface FlowVm {
    function addr(uint256 privateKey) external returns (address);
    function expectRevert(bytes calldata revertData) external;
    function prank(address msgSender) external;
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function warp(uint256 timestamp) external;
}

contract FalseReturnToken {
    function transfer(address, uint256) external pure returns (bool) { return false; }
}

contract FlowSafe {
    address public immutable owner;
    uint256 public ownerActionCount;
    mapping(address => bool) public enabledModules;

    constructor(address owner_) { owner = owner_; }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    function enableModule(address module) external onlyOwner {
        enabledModules[module] = true;
        ownerActionCount++;
    }

    function ownerCall(address target, bytes calldata data) external onlyOwner {
        ownerActionCount++;
        (bool success, bytes memory response) = target.call(data);
        if (!success) assembly { revert(add(response, 32), mload(response)) }
    }

    function execTransactionFromModuleReturnData(address to, uint256 value, bytes calldata data, uint8 operation)
        external
        returns (bool success, bytes memory returnData)
    {
        require(enabledModules[msg.sender], "module disabled");
        require(operation == 0, "delegatecall disabled");
        (success, returnData) = to.call{value: value}(data);
    }
}

contract AgentPayAuthorizationFlowTest {
    FlowVm private constant vm = FlowVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 private constant DELEGATE_PK = 0xA11CE;
    uint256 private constant ONE_USDC = 1_000_000;
    bytes32 private constant POLICY_ID = keccak256("default-policy");
    bytes32 private constant SKILL_ID = keccak256("skill.example");
    bytes32 private constant PROFILE_HASH = keccak256("profile-v1");

    AgentPayEscrowFactory private factory;
    AgentPaySpendingModule private module;
    SkillRegistry private registry;
    MockERC20 private token;
    FlowSafe private safe;
    address private delegate;
    address private seller = address(0x5E11E2);
    address private settlement = address(0x5E771E);
    address private feeRecipient = address(0xFEE);

    function setUp() public {
        factory = new AgentPayEscrowFactory();
        module = new AgentPaySpendingModule();
        registry = new SkillRegistry(address(this));
        token = new MockERC20("Mock USDC", "mUSDC", 6);
        safe = new FlowSafe(address(this));
        delegate = vm.addr(DELEGATE_PK);

        registry.setSkill(SKILL_ID, PROFILE_HASH, seller, true);
        safe.enableModule(address(module));
        safe.ownerCall(
            address(module),
            abi.encodeCall(
                module.createPolicy,
                (
                    POLICY_ID,
                    delegate,
                    address(token),
                    address(factory),
                    address(registry),
                    ONE_USDC,
                    3 * ONE_USDC,
                    uint64(block.timestamp),
                    uint64(block.timestamp + 7 days)
                )
            )
        );
        token.mint(address(safe), 5 * ONE_USDC);
    }

    function test_oneAuthorizationPaysActivatesReleasesAndRefunds() public {
        uint256 setupActions = safe.ownerActionCount();
        (bytes32 releaseOrder, OrderEscrowVault releaseVault) = _createVault("release");
        (bytes32 refundOrder, OrderEscrowVault refundVault) = _createVault("refund");

        _fund(releaseOrder, releaseVault, keccak256("nonce-1"));
        _fund(refundOrder, refundVault, keccak256("nonce-2"));
        require(safe.ownerActionCount() == setupActions, "owner approved an order");

        releaseVault.activate();
        refundVault.activate();
        vm.prank(seller);
        releaseVault.submitDelivery(keccak256("output"), 1);
        vm.prank(settlement);
        releaseVault.release(900_000, 50_000);
        vm.prank(settlement);
        refundVault.refund(ONE_USDC);

        require(releaseVault.state() == OrderEscrowVault.State.Released, "not released");
        require(refundVault.state() == OrderEscrowVault.State.Refunded, "not refunded");
        require(token.balanceOf(seller) == 900_000, "seller unpaid");
        require(token.balanceOf(address(safe)) == 4_050_000, "buyer balance wrong");
    }

    function test_qualificationHashMatchesPublicFixture() public view {
        bytes32 actual = module.qualificationHash(
            address(0x9000000000000000000000000000000000000009),
            0x2222222222222222222222222222222222222222222222222222222222222222,
            0x3333333333333333333333333333333333333333333333333333333333333333,
            address(0x6000000000000000000000000000000000000006)
        );
        require(actual == 0x376235a8bdd29a005aff75e66645f8df433b41c317c2ee722ac522bbf69ac8c9, "fixture hash");
    }

    function test_registryRemovalBlocksAlreadySignedPayment() public {
        (bytes32 orderId, OrderEscrowVault vault) = _createVault("removed");
        bytes32 nonce = keccak256("removed-nonce");
        bytes memory signature = _sign(orderId, vault, nonce);
        registry.setActive(SKILL_ID, false);

        vm.expectRevert(bytes("skill not qualified"));
        module.fundVault(
            address(safe), POLICY_ID, orderId, SKILL_ID, PROFILE_HASH, ONE_USDC, nonce, _validBefore(), signature
        );
    }

    function test_unorderedCommitmentsAndReplayProtection() public {
        (bytes32 firstOrder, OrderEscrowVault firstVault) = _createVault("unordered-1");
        (bytes32 secondOrder, OrderEscrowVault secondVault) = _createVault("unordered-2");
        bytes32 firstNonce = keccak256("first");
        bytes32 secondNonce = keccak256("second");
        bytes memory firstSignature = _sign(firstOrder, firstVault, firstNonce);

        _fund(secondOrder, secondVault, secondNonce);
        module.fundVault(
            address(safe), POLICY_ID, firstOrder, SKILL_ID, PROFILE_HASH, ONE_USDC, firstNonce, _validBefore(), firstSignature
        );

        vm.expectRevert(bytes("commitment used"));
        module.fundVault(
            address(safe), POLICY_ID, firstOrder, SKILL_ID, PROFILE_HASH, ONE_USDC, firstNonce, _validBefore(), firstSignature
        );
    }

    function test_userRevocationBlocksPayment() public {
        (bytes32 orderId, OrderEscrowVault vault) = _createVault("revoked");
        bytes32 nonce = keccak256("revoked-nonce");
        bytes memory signature = _sign(orderId, vault, nonce);
        safe.ownerCall(address(module), abi.encodeCall(module.revokePolicy, (POLICY_ID)));

        vm.expectRevert(bytes("policy revoked"));
        module.fundVault(
            address(safe), POLICY_ID, orderId, SKILL_ID, PROFILE_HASH, ONE_USDC, nonce, _validBefore(), signature
        );
    }

    function test_wrongProfileAndSellerFailRegistryQualification() public {
        (bytes32 orderId,) = _createVault("wrong-profile");
        vm.expectRevert(bytes("skill not qualified"));
        module.fundVault(
            address(safe), POLICY_ID, orderId, SKILL_ID, keccak256("other-profile"), ONE_USDC,
            keccak256("wrong-profile-nonce"), _validBefore(), bytes("")
        );

        seller = address(0xBAD5E11E2);
        (bytes32 wrongSellerOrder,) = _createVault("wrong-seller");
        vm.expectRevert(bytes("skill not qualified"));
        module.fundVault(
            address(safe), POLICY_ID, wrongSellerOrder, SKILL_ID, PROFILE_HASH, ONE_USDC,
            keccak256("wrong-seller-nonce"), _validBefore(), bytes("")
        );
    }

    function test_limitsExpiryAndDuplicateOrderFailClosed() public {
        (bytes32 tooLarge,) = _createVaultWithAmount("too-large", ONE_USDC + 1);
        vm.expectRevert(bytes("per-payment limit"));
        module.fundVault(
            address(safe), POLICY_ID, tooLarge, SKILL_ID, PROFILE_HASH, ONE_USDC + 1,
            keccak256("too-large-nonce"), _validBefore(), bytes("")
        );

        (bytes32 orderId, OrderEscrowVault vault) = _createVault("duplicate-order");
        _fund(orderId, vault, keccak256("first-order-nonce"));
        vm.expectRevert(bytes("order funded"));
        module.fundVault(
            address(safe), POLICY_ID, orderId, SKILL_ID, PROFILE_HASH, ONE_USDC,
            keccak256("second-order-nonce"), _validBefore(), bytes("")
        );

        vm.warp(block.timestamp + 8 days);
        vm.expectRevert(bytes("policy expired"));
        module.fundVault(
            address(safe), POLICY_ID, keccak256("expired-order"), SKILL_ID, PROFILE_HASH, ONE_USDC,
            keccak256("expired-nonce"), uint64(block.timestamp + 1), bytes("")
        );
    }

    function test_falseReturningTokenRollsBackAccounting() public {
        FalseReturnToken falseToken = new FalseReturnToken();
        bytes32 falsePolicyId = keccak256("false-token-policy");
        safe.ownerCall(
            address(module),
            abi.encodeCall(
                module.createPolicy,
                (
                    falsePolicyId, delegate, address(falseToken), address(factory), address(registry),
                    ONE_USDC, ONE_USDC, uint64(block.timestamp), uint64(block.timestamp + 1 days)
                )
            )
        );
        (bytes32 orderId, OrderEscrowVault vault) = _createVaultForToken("false-token", address(falseToken), ONE_USDC);
        bytes32 nonce = keccak256("false-token-nonce");
        bytes32 scopeProofHash = module.qualificationHash(address(registry), SKILL_ID, PROFILE_HASH, seller);
        bytes32 digest = module.commitmentDigest(
            address(safe), falsePolicyId, orderId, address(vault), address(falseToken), ONE_USDC,
            vault.termsHash(), scopeProofHash, nonce, _validBefore()
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(DELEGATE_PK, digest);

        vm.expectRevert(bytes("token transfer failed"));
        module.fundVault(
            address(safe), falsePolicyId, orderId, SKILL_ID, PROFILE_HASH, ONE_USDC,
            nonce, _validBefore(), abi.encodePacked(r, s, v)
        );
        (,,,,,,uint256 spent,,,) = module.policies(address(safe), falsePolicyId);
        require(spent == 0, "spent not rolled back");
        require(!module.usedCommitments(address(safe), falsePolicyId, nonce), "nonce not rolled back");
    }

    function _createVault(string memory label) private returns (bytes32 orderId, OrderEscrowVault vault) {
        return _createVaultForToken(label, address(token), ONE_USDC);
    }

    function _createVaultWithAmount(string memory label, uint256 vaultAmount)
        private
        returns (bytes32 orderId, OrderEscrowVault vault)
    {
        return _createVaultForToken(label, address(token), vaultAmount);
    }

    function _createVaultForToken(string memory label, address vaultToken, uint256 vaultAmount)
        private
        returns (bytes32 orderId, OrderEscrowVault vault)
    {
        orderId = keccak256(bytes(label));
        vault = OrderEscrowVault(
            factory.createVault(
                OrderEscrowVault.OrderInit({
                    orderId: orderId,
                    termsHash: keccak256(abi.encode("terms", label)),
                    buyer: address(safe),
                    seller: seller,
                    token: vaultToken,
                    settlementAuthority: settlement,
                    feeRecipient: feeRecipient,
                    amount: vaultAmount,
                    maxFeeAmount: 50_000,
                    expiresAt: uint64(block.timestamp + 1 hours),
                    refundAvailableAt: uint64(block.timestamp + 1 days)
                })
            )
        );
    }

    function test_cancelBeforeFundingLeavesSafeBudgetNonceAndBalanceUnchanged() public {
        (bytes32 id, OrderEscrowVault vault) = _createVault("cancel-first");
        bytes32 nonce = keccak256("cancel-first-nonce");
        bytes memory signature = _sign(id, vault, nonce);
        uint256 safeBalance = token.balanceOf(address(safe));
        vm.prank(settlement);
        vault.cancelUnfunded();
        vm.expectRevert(bytes("vault not created"));
        module.fundVault(address(safe), POLICY_ID, id, SKILL_ID, PROFILE_HASH, ONE_USDC,
            nonce, _validBefore(), signature);
        (,,,,,,uint256 spent,,,) = module.policies(address(safe), POLICY_ID);
        require(spent == 0, "budget consumed");
        require(!module.usedCommitments(address(safe), POLICY_ID, nonce), "nonce consumed");
        require(!module.fundedOrders(address(safe), address(factory), id), "funding recorded");
        require(token.balanceOf(address(safe)) == safeBalance, "Safe debited");
        require(token.balanceOf(address(vault)) == 0, "Vault funded");
    }

    function test_fundingBeforeCancelRequiresActivationAndRefund() public {
        (bytes32 id, OrderEscrowVault vault) = _createVault("fund-first");
        uint256 safeBalance = token.balanceOf(address(safe));
        _fund(id, vault, keccak256("fund-first-nonce"));
        require(vault.state() == OrderEscrowVault.State.Created, "not split activation");
        vm.prank(settlement);
        vm.expectRevert(bytes("vault has balance"));
        vault.cancelUnfunded();
        vault.activate();
        vm.prank(settlement);
        vault.refund(ONE_USDC);
        require(vault.state() == OrderEscrowVault.State.Refunded, "not refunded");
        require(token.balanceOf(address(safe)) == safeBalance, "refund missing");
        require(token.balanceOf(address(vault)) == 0, "Vault not empty");
        (,,,,,,uint256 spent,,,) = module.policies(address(safe), POLICY_ID);
        require(spent == ONE_USDC, "refund changed cumulative budget");
        require(token.balanceOf(seller) == 0 && token.balanceOf(feeRecipient) == 0, "charged service fee");
    }

    // Isolated characterization: a scoped signature is public-chain authority,
    // not permission granted to one HTTP gateway/relayer. No host RPC is used.
    function test_directCallerFundingNeedsActivationButHasPermissionlessTimeoutExit() public {
        (bytes32 id, OrderEscrowVault vault) = _createVault("direct-caller");
        bytes32 nonce = keccak256("direct-caller-nonce");
        bytes memory signature = _sign(id, vault, nonce);
        uint64 validBefore = _validBefore();
        uint256 originalBalance = token.balanceOf(address(safe));
        uint256 ownerActions = safe.ownerActionCount();
        vm.prank(address(0xD1EC7));
        module.fundVault(address(safe), POLICY_ID, id, SKILL_ID, PROFILE_HASH,
            ONE_USDC, nonce, validBefore, signature);
        require(vault.state() == OrderEscrowVault.State.Created, "funding activated Vault");
        require(token.balanceOf(address(vault)) == ONE_USDC, "payment absent");
        require(token.balanceOf(address(safe)) == originalBalance - ONE_USDC, "Safe debit wrong");
        require(module.fundedOrders(address(safe), address(factory), id), "Module funding missing");
        vm.warp(vault.refundAvailableAt());
        vm.expectRevert(bytes("bad state"));
        vault.refundAfterTimeout();
        vm.expectRevert(bytes("vault has balance"));
        vm.prank(settlement);
        vault.cancelUnfunded();
        // A separate public caller can activate and then refund to the Buyer,
        // even though time alone never transitions Created -> Funded.
        vm.prank(address(0xAC71));
        vault.activate();
        vm.prank(address(0xBEEF));
        vault.refundAfterTimeout();
        require(vault.state() == OrderEscrowVault.State.Refunded, "exit failed");
        require(token.balanceOf(address(safe)) == originalBalance, "Buyer not restored");
        require(token.balanceOf(address(vault)) == 0, "Vault not empty");
        require(token.balanceOf(seller) == 0 && token.balanceOf(feeRecipient) == 0, "unexpected income");
        (,,,,,,uint256 spent,,,) = module.policies(address(safe), POLICY_ID);
        require(spent == ONE_USDC, "refund restored spent");
        require(safe.ownerActionCount() == ownerActions, "new owner approval required");
    }

    function test_directValidSignatureAfterOffchainPaymentWindowStillFundsCreatedVault() public {
        (bytes32 id, OrderEscrowVault vault) = _createVault("direct-late");
        bytes32 nonce = keccak256("direct-late-nonce");
        bytes memory signature = _sign(id, vault, nonce);
        uint64 validBefore = _validBefore();
        // Five-minute Settlement waiting deadline is not a field of this Module call.
        // This demonstrates contract scope, not that Wallet currently issues this TTL.
        vm.warp(block.timestamp + 6 minutes);
        vm.prank(address(0xD1EC7));
        module.fundVault(address(safe), POLICY_ID, id, SKILL_ID, PROFILE_HASH,
            ONE_USDC, nonce, validBefore, signature);
        require(vault.state() == OrderEscrowVault.State.Created, "unexpected state");
        require(token.balanceOf(address(vault)) == ONE_USDC, "valid late payment lost");
    }

    function _fund(bytes32 orderId, OrderEscrowVault vault, bytes32 nonce) private {
        module.fundVault(
            address(safe), POLICY_ID, orderId, SKILL_ID, PROFILE_HASH, ONE_USDC, nonce, _validBefore(),
            _sign(orderId, vault, nonce)
        );
    }

    function _sign(bytes32 orderId, OrderEscrowVault vault, bytes32 nonce) private returns (bytes memory) {
        bytes32 scopeProofHash = module.qualificationHash(address(registry), SKILL_ID, PROFILE_HASH, seller);
        bytes32 digest = module.commitmentDigest(
            address(safe), POLICY_ID, orderId, address(vault), address(token), ONE_USDC, vault.termsHash(),
            scopeProofHash, nonce, _validBefore()
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(DELEGATE_PK, digest);
        return abi.encodePacked(r, s, v);
    }

    function _validBefore() private view returns (uint64) {
        return uint64(block.timestamp + 10 minutes);
    }
}
