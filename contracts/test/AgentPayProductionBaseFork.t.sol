// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentPayEscrowFactory} from "../src/AgentPayEscrowFactory.sol";
import {OrderEscrowVault} from "../src/OrderEscrowVault.sol";
import {AgentPaySpendingModule} from "../src/AgentPaySpendingModule.sol";
import {SkillRegistry} from "../src/SkillRegistry.sol";
import {SettlementAuthorityController} from "../src/SettlementAuthorityController.sol";

interface IBaseForkVm {
    function addr(uint256 privateKey) external returns (address);
    function createSelectFork(string calldata rpcUrl) external returns (uint256 forkId);
    function envString(string calldata name) external returns (string memory value);
    function expectRevert(bytes calldata revertData) external;
    function prank(address sender) external;
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function warp(uint256 timestamp) external;
}

interface ISafeProxyFactoryFork {
    function createProxyWithNonce(address singleton, bytes memory initializer, uint256 saltNonce)
        external returns (address proxy);
}

interface ISafeFork {
    function setup(address[] calldata owners, uint256 threshold, address to, bytes calldata data,
        address fallbackHandler, address paymentToken, uint256 payment, address payable paymentReceiver) external;
    function enableModule(address module) external;
    function isModuleEnabled(address module) external view returns (bool);
    function nonce() external view returns (uint256);
    function execTransaction(address to, uint256 value, bytes calldata data, uint8 operation,
        uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken,
        address payable refundReceiver, bytes calldata signatures) external payable returns (bool success);
}

interface IBaseUsdc {
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
    function masterMinter() external view returns (address);
    function configureMinter(address minter, uint256 minterAllowedAmount) external returns (bool);
    function mint(address to, uint256 amount) external returns (bool);
}

contract ProductionSafeSetupHelper {
    function configure(address module, bytes calldata policyCall) external {
        ISafeFork(address(this)).enableModule(module);
        (bool success, bytes memory response) = module.call(policyCall);
        if (!success) assembly { revert(add(response, 0x20), mload(response)) }
    }
}

contract AgentPayProductionBaseForkTest {
    IBaseForkVm private constant vm = IBaseForkVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant SAFE_L2_SINGLETON = 0x29fcB43b46531BcA003ddC8FCB67FFE91900C762;
    address private constant SAFE_PROXY_FACTORY = 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67;
    address private constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    uint256 private constant DELEGATE_PK = 0xA11CE;
    uint256 private constant AMOUNT = 1_000_000;

    AgentPayEscrowFactory private factory;
    AgentPaySpendingModule private module;
    SkillRegistry private registry;
    SettlementAuthorityController private controller;
    ISafeFork private buyerSafe;
    ISafeFork private administratorSafe;
    IBaseUsdc private usdc = IBaseUsdc(BASE_USDC);
    address private delegate;
    address private seller = address(0x5E11E2);
    address private feeRecipient = address(0xFEE);
    bytes32 private policyId = keccak256("base-fork-policy");
    bytes32 private skillId = keccak256("base-fork-skill");
    bytes32 private profileHash = keccak256("base-fork-profile");

    function setUp() public {
        vm.createSelectFork(vm.envString("BASE_RPC_URL"));
        require(SAFE_L2_SINGLETON.code.length > 0 && SAFE_PROXY_FACTORY.code.length > 0, "Safe Base code missing");
        require(BASE_USDC.code.length > 0 && usdc.decimals() == 6, "official Base USDC missing");

        factory = new AgentPayEscrowFactory();
        module = new AgentPaySpendingModule();
        registry = new SkillRegistry(address(this));
        delegate = vm.addr(DELEGATE_PK);
        registry.setSkill(skillId, profileHash, seller, true);

        administratorSafe = ISafeFork(_createSafe(bytes(""), address(0), 101));
        controller = new SettlementAuthorityController(address(administratorSafe), address(factory), address(this));

        bytes memory policyCall = abi.encodeCall(module.createPolicy, (policyId, delegate, BASE_USDC,
            address(factory), address(registry), AMOUNT, 4 * AMOUNT,
            uint64(block.timestamp), uint64(block.timestamp + 7 days)));
        ProductionSafeSetupHelper helper = new ProductionSafeSetupHelper();
        buyerSafe = ISafeFork(_createSafe(policyCall, address(helper), 102));
        require(buyerSafe.isModuleEnabled(address(module)), "module not enabled");

        address masterMinter = usdc.masterMinter();
        vm.prank(masterMinter);
        require(usdc.configureMinter(address(this), 4 * AMOUNT), "configure minter failed");
        require(usdc.mint(address(buyerSafe), 4 * AMOUNT), "mint fork USDC failed");
    }

    function test_productionFlowUsesOfficialBaseUsdcForReleaseAndBothRefunds() public {
        uint256 ownerNonce = buyerSafe.nonce();
        OrderEscrowVault releaseVault = _fundAndActivate("release", 0, 1 days);
        OrderEscrowVault authorityRefundVault = _fundAndActivate("authority-refund", 1, 1 days);
        OrderEscrowVault timeoutVault = _fundAndActivate("timeout-refund", 2, 2 hours);
        require(buyerSafe.nonce() == ownerNonce, "per-order owner transaction");

        controller.submitDelivery(address(releaseVault), keccak256("output"), 2);
        controller.release(address(releaseVault), 665_000, 35_000);
        controller.refund(address(authorityRefundVault), AMOUNT);
        vm.warp(timeoutVault.refundAvailableAt());
        timeoutVault.refundAfterTimeout();

        require(uint8(releaseVault.state()) == uint8(OrderEscrowVault.State.Released), "release failed");
        require(uint8(authorityRefundVault.state()) == uint8(OrderEscrowVault.State.Refunded), "authority refund failed");
        require(uint8(timeoutVault.state()) == uint8(OrderEscrowVault.State.Refunded), "timeout refund failed");
        require(usdc.balanceOf(seller) == 665_000, "seller mismatch");
        require(usdc.balanceOf(feeRecipient) == 35_000, "fee mismatch");
        require(usdc.balanceOf(address(buyerSafe)) == 3_300_000, "buyer return mismatch");
    }

    function test_controllerPauseAndSafeExecutorRotationPreserveExistingVault() public {
        OrderEscrowVault vault = _fundAndActivate("rotation", 0, 1 days);
        _adminCall(abi.encodeCall(controller.pause, ()), 0);
        vm.expectRevert(bytes("paused"));
        controller.submitDelivery(address(vault), keccak256("blocked"), 1);

        address nextExecutor = address(0xBEEF);
        _adminCall(abi.encodeCall(controller.setExecutor, (nextExecutor)), 1);
        _adminCall(abi.encodeCall(controller.unpause, ()), 2);
        vm.expectRevert(bytes("not executor"));
        controller.submitDelivery(address(vault), keccak256("old"), 1);
        vm.prank(nextExecutor);
        controller.submitDelivery(address(vault), keccak256("rotated"), 1);
        require(vault.settlementAuthority() == address(controller), "Vault authority changed");
    }

    function _fundAndActivate(string memory label, uint256 nonce, uint64 refundDelay)
        private returns (OrderEscrowVault vault)
    {
        bytes32 orderId = keccak256(bytes(label));
        bytes32 termsHash = keccak256(abi.encode("terms", label));
        address vaultAddress = factory.createVault(OrderEscrowVault.OrderInit({
            orderId: orderId, termsHash: termsHash, buyer: address(buyerSafe), seller: seller,
            token: BASE_USDC, settlementAuthority: address(controller), feeRecipient: feeRecipient,
            amount: AMOUNT, maxFeeAmount: 50_000, expiresAt: uint64(block.timestamp + 1 hours),
            refundAvailableAt: uint64(block.timestamp + refundDelay)
        }));
        vault = OrderEscrowVault(vaultAddress);
        bytes32 commitmentNonce = keccak256(abi.encode(label, nonce));
        uint64 validBefore = uint64(block.timestamp + 10 minutes);
        bytes32 digest = module.commitmentDigest(address(buyerSafe), policyId, orderId, vaultAddress,
            BASE_USDC, AMOUNT, termsHash,
            module.qualificationHash(address(registry), skillId, profileHash, seller), commitmentNonce, validBefore);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(DELEGATE_PK, digest);
        module.fundVault(address(buyerSafe), policyId, orderId, skillId, profileHash, AMOUNT,
            commitmentNonce, validBefore, abi.encodePacked(r, s, v));
        vault.activate();
    }

    function _createSafe(bytes memory policyCall, address helper, uint256 salt) private returns (address) {
        address[] memory owners = new address[](1); owners[0] = address(this);
        bytes memory setupData = helper == address(0) ? bytes("")
            : abi.encodeCall(ProductionSafeSetupHelper.configure, (address(module), policyCall));
        bytes memory initializer = abi.encodeCall(ISafeFork.setup, (owners, 1, helper, setupData,
            address(0), address(0), 0, payable(address(0))));
        return ISafeProxyFactoryFork(SAFE_PROXY_FACTORY).createProxyWithNonce(SAFE_L2_SINGLETON, initializer, salt);
    }

    function _adminCall(bytes memory data, uint256 expectedNonce) private {
        require(administratorSafe.nonce() == expectedNonce, "unexpected admin nonce");
        require(administratorSafe.execTransaction(address(controller), 0, data, 0, 0, 0, 0,
            address(0), payable(address(0)), _prevalidatedOwnerSignature(address(this))), "admin call failed");
    }

    function _prevalidatedOwnerSignature(address owner) private pure returns (bytes memory) {
        return abi.encodePacked(bytes32(uint256(uint160(owner))), bytes32(0), uint8(1));
    }
}
