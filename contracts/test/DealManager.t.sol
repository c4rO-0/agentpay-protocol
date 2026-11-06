// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DealManager} from "../src/DealManager.sol";

interface Vm {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function expectRevert(bytes calldata revertData) external;
    function prank(address msgSender) external;
}

contract Mock1271Wallet {
    bytes4 internal constant MAGICVALUE = 0x1626ba7e;
    address internal immutable owner;

    constructor(address owner_) {
        owner = owner_;
    }

    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
        if (signature.length != 65) {
            return 0xffffffff;
        }

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        return ecrecover(hash, v, r, s) == owner ? MAGICVALUE : bytes4(0xffffffff);
    }
}

contract DealManagerTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant USER_BINDING_TYPEHASH =
        keccak256(
            "UserBinding(bytes32 dealId,address userSafe,address mcpSafe,address settlement,address token,uint256 amount,uint256 fee,uint256 maxRefund,uint256 maxLiability,uint64 gracePeriodEnd,uint64 deadline,uint256 userNonce)"
        );
    bytes32 private constant MCP_BINDING_TYPEHASH =
        keccak256(
            "McpBinding(bytes32 dealId,address userSafe,address mcpSafe,address settlement,address token,uint256 amount,uint256 fee,uint256 maxRefund,uint256 maxLiability,uint64 gracePeriodEnd,uint64 deadline,uint256 mcpNonce)"
        );

    uint256 private constant USER_PK = 0xA11CE;
    uint256 private constant SAFE_OWNER_PK = 0xB0B;
    uint256 private constant MCP_PK = 0xCAFE;

    DealManager private manager;
    address private settlement;
    address private token;
    address private user;
    address private mcp;

    function setUp() public {
        manager = new DealManager();
        settlement = address(this);
        token = address(0x1234);
        user = vm.addr(USER_PK);
        mcp = vm.addr(MCP_PK);
    }

    function test_createDeal_andBindEoaTransitionsToReady() public {
        DealManager.DealTerms memory terms = _terms(user, mcp, bytes32("deal-eoa"), 1, 2);

        manager.createDeal(terms);
        manager.bindUserWithSig(terms, _signUser(terms, USER_PK));
        manager.bindMcpWithSig(terms, _signMcp(terms, MCP_PK));

        DealManager.Deal memory stored = manager.getDeal(terms.dealId);
        require(stored.userBound, "user not bound");
        require(stored.mcpBound, "mcp not bound");
        require(uint8(stored.status) == uint8(DealManager.Status.Ready), "not ready");
        require(uint8(stored.authorizationMode) == uint8(DealManager.AuthorizationMode.ParticipantApproval), "wrong auth mode");
    }

    function test_bindUserWithSig_supports1271Safe() public {
        Mock1271Wallet safe = new Mock1271Wallet(vm.addr(SAFE_OWNER_PK));
        DealManager.DealTerms memory terms = _terms(address(safe), mcp, bytes32("deal-safe"), 11, 22);

        manager.createDeal(terms);
        manager.bindUserWithSig(terms, _signUser(terms, SAFE_OWNER_PK));

        DealManager.Deal memory stored = manager.getDeal(terms.dealId);
        require(stored.userBound, "safe user not bound");
        require(uint8(stored.status) == uint8(DealManager.Status.Created), "unexpected status");
    }

    function test_bindBothSafeParties_transitionsToReady() public {
        Mock1271Wallet userSafe = new Mock1271Wallet(vm.addr(SAFE_OWNER_PK));
        Mock1271Wallet mcpSafe = new Mock1271Wallet(vm.addr(MCP_PK));
        DealManager.DealTerms memory terms = _terms(address(userSafe), address(mcpSafe), bytes32("deal-safe-ready"), 21, 22);

        manager.createDeal(terms);
        manager.bindUserWithSig(terms, _signUser(terms, SAFE_OWNER_PK));
        manager.bindMcpWithSig(terms, _signMcp(terms, MCP_PK));

        DealManager.Deal memory stored = manager.getDeal(terms.dealId);
        require(stored.userBound, "safe user not bound");
        require(stored.mcpBound, "safe mcp not bound");
        require(uint8(stored.status) == uint8(DealManager.Status.Ready), "safe deal not ready");
        require(uint8(stored.authorizationMode) == uint8(DealManager.AuthorizationMode.ParticipantApproval), "wrong auth mode");
    }

    function test_safeDirectApprovals_transitionToReady() public {
        address userSafe = address(0x1111);
        address mcpSafe = address(0x2222);
        DealManager.DealTerms memory terms = _terms(userSafe, mcpSafe, bytes32("deal-safe-direct"), 31, 32);

        manager.createDeal(terms);

        vm.prank(userSafe);
        manager.approveUserParticipation(terms.dealId);

        DealManager.Deal memory afterUser = manager.getDeal(terms.dealId);
        require(afterUser.userBound, "user direct approval missing");
        require(!afterUser.mcpBound, "mcp should not be bound");
        require(uint8(afterUser.status) == uint8(DealManager.Status.Created), "unexpected interim status");

        vm.prank(mcpSafe);
        manager.approveMcpParticipation(terms.dealId);

        DealManager.Deal memory stored = manager.getDeal(terms.dealId);
        require(stored.userBound, "user not bound");
        require(stored.mcpBound, "mcp not bound");
        require(uint8(stored.status) == uint8(DealManager.Status.Ready), "not ready");
    }

    function test_safeDirectApproval_revertsForWrongCaller() public {
        address userSafe = address(0x1111);
        address mcpSafe = address(0x2222);
        DealManager.DealTerms memory terms = _terms(userSafe, mcpSafe, bytes32("deal-safe-wrong-caller"), 33, 34);

        manager.createDeal(terms);

        vm.prank(address(0x9999));
        vm.expectRevert(bytes("not user"));
        manager.approveUserParticipation(terms.dealId);
    }

    function test_markReadyBySettlement_allowsPreauthorizedPath() public {
        DealManager.DealTerms memory terms = _terms(user, mcp, bytes32("deal-preauthorized"), 35, 36);

        manager.createDeal(terms);
        manager.markReadyBySettlement(terms.dealId);
        manager.markFunded(terms.dealId, terms.amount);

        DealManager.Deal memory stored = manager.getDeal(terms.dealId);
        require(uint8(stored.status) == uint8(DealManager.Status.GracePeriod), "not grace period");
        require(uint8(stored.authorizationMode) == uint8(DealManager.AuthorizationMode.SettlementPreauthorized), "wrong auth mode");
        require(stored.fundedAmount == terms.amount, "funded mismatch");
    }

    function test_markFunded_andRelease_recordsAmounts() public {
        DealManager.DealTerms memory terms = _terms(user, mcp, bytes32("deal-release"), 41, 42);

        manager.createDeal(terms);
        manager.bindUserWithSig(terms, _signUser(terms, USER_PK));
        manager.bindMcpWithSig(terms, _signMcp(terms, MCP_PK));
        manager.markFunded(terms.dealId, terms.amount);
        manager.releaseToMcp(terms.dealId, 90e6, 10e6);

        DealManager.Deal memory stored = manager.getDeal(terms.dealId);
        require(stored.fundedAmount == terms.amount, "funded mismatch");
        require(stored.releasedAmount == 90e6, "released mismatch");
        require(stored.feePaid == 10e6, "fee mismatch");
        require(uint8(stored.status) == uint8(DealManager.Status.Released), "not released");
    }

    function test_release_revertsWhenExceedingFundedAmount() public {
        DealManager.DealTerms memory terms = _terms(user, mcp, bytes32("deal-cap"), 41, 42);

        manager.createDeal(terms);
        manager.bindUserWithSig(terms, _signUser(terms, USER_PK));
        manager.bindMcpWithSig(terms, _signMcp(terms, MCP_PK));
        manager.markFunded(terms.dealId, terms.amount);

        vm.expectRevert(bytes("release > funded"));
        manager.releaseToMcp(terms.dealId, terms.amount, 1);
    }

    function test_chargeback_revertsWhenExceedingLiability() public {
        DealManager.DealTerms memory terms = _terms(user, mcp, bytes32("deal-chargeback"), 51, 52);

        manager.createDeal(terms);
        manager.bindUserWithSig(terms, _signUser(terms, USER_PK));
        manager.bindMcpWithSig(terms, _signMcp(terms, MCP_PK));
        manager.markFunded(terms.dealId, terms.amount);
        manager.releaseToMcp(terms.dealId, 90e6, 10e6);

        vm.expectRevert(bytes("liability cap"));
        manager.markChargeback(terms.dealId, terms.maxLiability + 1);
    }

    function _terms(
        address userSafe,
        address mcpSafe,
        bytes32 dealId,
        uint256 userNonce,
        uint256 mcpNonce
    ) internal view returns (DealManager.DealTerms memory) {
        return
            DealManager.DealTerms({
                dealId: dealId,
                userSafe: userSafe,
                mcpSafe: mcpSafe,
                settlement: settlement,
                token: token,
                amount: 100e6,
                fee: 10e6,
                maxRefund: 100e6,
                maxLiability: 100e6,
                gracePeriodEnd: uint64(block.timestamp + 2 hours),
                deadline: uint64(block.timestamp + 1 days),
                userNonce: userNonce,
                mcpNonce: mcpNonce
            });
    }

    function _signUser(DealManager.DealTerms memory terms, uint256 pk) internal returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                USER_BINDING_TYPEHASH,
                terms.dealId,
                terms.userSafe,
                terms.mcpSafe,
                terms.settlement,
                terms.token,
                terms.amount,
                terms.fee,
                terms.maxRefund,
                terms.maxLiability,
                terms.gracePeriodEnd,
                terms.deadline,
                terms.userNonce
            )
        );
        return _signDigest(_hashTypedDataV4(structHash), pk);
    }

    function _signMcp(DealManager.DealTerms memory terms, uint256 pk) internal returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                MCP_BINDING_TYPEHASH,
                terms.dealId,
                terms.userSafe,
                terms.mcpSafe,
                terms.settlement,
                terms.token,
                terms.amount,
                terms.fee,
                terms.maxRefund,
                terms.maxLiability,
                terms.gracePeriodEnd,
                terms.deadline,
                terms.mcpNonce
            )
        );
        return _signDigest(_hashTypedDataV4(structHash), pk);
    }

    function _signDigest(bytes32 digest, uint256 pk) internal returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _hashTypedDataV4(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparatorV4(), structHash));
    }

    function _domainSeparatorV4() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("AgentPay DealManager")),
                keccak256(bytes("1")),
                block.chainid,
                address(manager)
            )
        );
    }
}
