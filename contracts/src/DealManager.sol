// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC1271 {
    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4 magicValue);
}

/// @title DealManager
/// @notice Minimal public rule shell for AgentPay's three-party settlement flow.
contract DealManager {
    bytes4 private constant EIP1271_MAGICVALUE = 0x1626ba7e;
    uint256 private constant SECP256K1N_DIV_2 =
        0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    string public constant NAME = "AgentPay DealManager";
    string public constant VERSION = "1";

    enum Status {
        None,
        Created,
        Ready,
        GracePeriod,
        Released,
        Disputed,
        Refunded,
        Chargeback,
        Closed,
        Cancelled
    }

    enum AuthorizationMode {
        None,
        ParticipantApproval,
        SettlementPreauthorized
    }

    struct DealTerms {
        bytes32 dealId;
        address userSafe;
        address mcpSafe;
        address settlement;
        address token;
        uint256 amount;
        uint256 fee;
        uint256 maxRefund;
        uint256 maxLiability;
        uint64 gracePeriodEnd;
        uint64 deadline;
        uint256 userNonce;
        uint256 mcpNonce;
    }

    struct Deal {
        bytes32 dealId;
        address userSafe;
        address mcpSafe;
        address settlement;
        address token;
        uint256 amount;
        uint256 fee;
        uint256 maxRefund;
        uint256 maxLiability;
        uint64 gracePeriodEnd;
        uint64 deadline;
        uint256 userNonce;
        uint256 mcpNonce;
        Status status;
        bool userBound;
        bool mcpBound;
        AuthorizationMode authorizationMode;
        uint256 fundedAmount;
        uint256 releasedAmount;
        uint256 feePaid;
        uint256 refundedAmount;
        uint256 chargebackAmount;
    }

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

    mapping(bytes32 => Deal) public deals;
    mapping(address => mapping(uint256 => bool)) public consumedUserNonces;
    mapping(address => mapping(uint256 => bool)) public consumedMcpNonces;

    event DealCreated(
        bytes32 indexed dealId,
        address indexed userSafe,
        address indexed mcpSafe,
        address settlement,
        address token,
        uint256 amount
    );
    event UserBound(bytes32 indexed dealId, address indexed userSafe, uint256 nonce);
    event McpBound(bytes32 indexed dealId, address indexed mcpSafe, uint256 nonce);
    event DealReady(bytes32 indexed dealId);
    event DealFunded(bytes32 indexed dealId, uint256 fundedAmount, uint64 gracePeriodEnd);
    event DealReleased(bytes32 indexed dealId, address indexed mcpSafe, uint256 grossAmount, uint256 feeAmount);
    event DisputeOpened(bytes32 indexed dealId, bytes32 indexed reasonHash);
    event DealRefunded(bytes32 indexed dealId, address indexed userSafe, uint256 refundAmount);
    event ChargebackMarked(bytes32 indexed dealId, address indexed mcpSafe, uint256 recoveredAmount);
    event DealCancelled(bytes32 indexed dealId);
    event DealClosed(bytes32 indexed dealId);

    modifier onlySettlement(bytes32 dealId) {
        require(deals[dealId].settlement != address(0), "deal missing");
        require(msg.sender == deals[dealId].settlement, "not settlement");
        _;
    }

    function createDeal(DealTerms calldata terms) external returns (bytes32) {
        require(msg.sender == terms.settlement, "not settlement");
        require(terms.dealId != bytes32(0), "dealId=0");
        require(deals[terms.dealId].status == Status.None, "deal exists");
        _validateTerms(terms);

        deals[terms.dealId] = Deal({
            dealId: terms.dealId,
            userSafe: terms.userSafe,
            mcpSafe: terms.mcpSafe,
            settlement: terms.settlement,
            token: terms.token,
            amount: terms.amount,
            fee: terms.fee,
            maxRefund: terms.maxRefund,
            maxLiability: terms.maxLiability,
            gracePeriodEnd: terms.gracePeriodEnd,
            deadline: terms.deadline,
            userNonce: terms.userNonce,
            mcpNonce: terms.mcpNonce,
            status: Status.Created,
            userBound: false,
            mcpBound: false,
            authorizationMode: AuthorizationMode.None,
            fundedAmount: 0,
            releasedAmount: 0,
            feePaid: 0,
            refundedAmount: 0,
            chargebackAmount: 0
        });

        emit DealCreated(terms.dealId, terms.userSafe, terms.mcpSafe, terms.settlement, terms.token, terms.amount);
        return terms.dealId;
    }

    function bindUserWithSig(DealTerms calldata terms, bytes calldata signature) external onlySettlement(terms.dealId) {
        Deal storage deal = deals[terms.dealId];
        require(!deal.userBound, "user bound");
        _requireTermsMatch(deal, terms);
        require(!consumedUserNonces[deal.userSafe][terms.userNonce], "user nonce used");

        bytes32 digest = _hashTypedDataV4(
            keccak256(
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
            )
        );
        require(_isValidSigner(deal.userSafe, digest, signature), "bad user sig");

        consumedUserNonces[deal.userSafe][terms.userNonce] = true;
        deal.userBound = true;
        emit UserBound(terms.dealId, deal.userSafe, terms.userNonce);
        _autoReady(deal);
    }

    function bindMcpWithSig(DealTerms calldata terms, bytes calldata signature) external onlySettlement(terms.dealId) {
        Deal storage deal = deals[terms.dealId];
        require(!deal.mcpBound, "mcp bound");
        _requireTermsMatch(deal, terms);
        require(!consumedMcpNonces[deal.mcpSafe][terms.mcpNonce], "mcp nonce used");

        bytes32 digest = _hashTypedDataV4(
            keccak256(
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
            )
        );
        require(_isValidSigner(deal.mcpSafe, digest, signature), "bad mcp sig");

        consumedMcpNonces[deal.mcpSafe][terms.mcpNonce] = true;
        deal.mcpBound = true;
        emit McpBound(terms.dealId, deal.mcpSafe, terms.mcpNonce);
        _autoReady(deal);
    }

    function approveUserParticipation(bytes32 dealId) external {
        Deal storage deal = deals[dealId];
        require(deal.status != Status.None, "deal missing");
        require(msg.sender == deal.userSafe, "not user");
        require(!deal.userBound, "user bound");
        require(deal.status == Status.Created, "bad status");
        deal.userBound = true;
        emit UserBound(dealId, deal.userSafe, deal.userNonce);
        _autoReady(deal);
    }

    function approveMcpParticipation(bytes32 dealId) external {
        Deal storage deal = deals[dealId];
        require(deal.status != Status.None, "deal missing");
        require(msg.sender == deal.mcpSafe, "not mcp");
        require(!deal.mcpBound, "mcp bound");
        require(deal.status == Status.Created, "bad status");
        deal.mcpBound = true;
        emit McpBound(dealId, deal.mcpSafe, deal.mcpNonce);
        _autoReady(deal);
    }

    function markReady(bytes32 dealId) external onlySettlement(dealId) {
        Deal storage deal = deals[dealId];
        require(deal.status == Status.Created, "bad status");
        require(deal.userBound && deal.mcpBound, "missing binds");
        deal.status = Status.Ready;
        deal.authorizationMode = AuthorizationMode.ParticipantApproval;
        emit DealReady(dealId);
    }

    function markReadyBySettlement(bytes32 dealId) external onlySettlement(dealId) {
        Deal storage deal = deals[dealId];
        require(deal.status == Status.Created, "bad status");
        deal.authorizationMode = AuthorizationMode.SettlementPreauthorized;
        deal.status = Status.Ready;
        emit DealReady(dealId);
    }

    function markFunded(bytes32 dealId, uint256 fundedAmount) external onlySettlement(dealId) {
        Deal storage deal = deals[dealId];
        require(deal.status == Status.Ready, "bad status");
        require(fundedAmount > 0, "funded=0");
        require(fundedAmount <= deal.amount, "funded > amount");
        deal.fundedAmount = fundedAmount;
        deal.status = Status.GracePeriod;
        emit DealFunded(dealId, fundedAmount, deal.gracePeriodEnd);
    }

    function releaseToMcp(bytes32 dealId, uint256 grossAmount, uint256 feeAmount) external onlySettlement(dealId) {
        Deal storage deal = deals[dealId];
        require(deal.status == Status.GracePeriod, "bad status");
        _recordRelease(deal, grossAmount, feeAmount);
        deal.status = Status.Released;
    }

    function openDispute(bytes32 dealId, bytes32 reasonHash) external onlySettlement(dealId) {
        Deal storage deal = deals[dealId];
        require(
            deal.status == Status.Created ||
                deal.status == Status.Ready ||
                deal.status == Status.GracePeriod ||
                deal.status == Status.Released,
            "bad status"
        );
        deal.status = Status.Disputed;
        emit DisputeOpened(dealId, reasonHash);
    }

    function resolveRefund(bytes32 dealId, uint256 refundAmount) external onlySettlement(dealId) {
        Deal storage deal = deals[dealId];
        require(
            deal.status == Status.Disputed ||
                deal.status == Status.GracePeriod ||
                deal.status == Status.Released ||
                deal.status == Status.Ready,
            "bad status"
        );
        require(refundAmount > 0, "refund=0");
        require(deal.refundedAmount + refundAmount <= deal.maxRefund, "refund cap");
        require(deal.refundedAmount + refundAmount <= deal.amount, "refund > amount");

        deal.refundedAmount += refundAmount;
        emit DealRefunded(dealId, deal.userSafe, refundAmount);

        if (deal.releasedAmount == 0 && deal.feePaid == 0 && deal.refundedAmount >= _referenceFunding(deal)) {
            deal.status = Status.Refunded;
        } else {
            deal.status = Status.Closed;
            emit DealClosed(dealId);
        }
    }

    function resolveRelease(bytes32 dealId, uint256 grossAmount, uint256 feeAmount) external onlySettlement(dealId) {
        Deal storage deal = deals[dealId];
        require(deal.status == Status.Disputed, "bad status");
        _recordRelease(deal, grossAmount, feeAmount);
        deal.status = Status.Closed;
        emit DealClosed(dealId);
    }

    function markChargeback(bytes32 dealId, uint256 recoveredAmount) external onlySettlement(dealId) {
        Deal storage deal = deals[dealId];
        require(
            deal.status == Status.Released || deal.status == Status.Disputed || deal.status == Status.Closed,
            "bad status"
        );
        require(recoveredAmount > 0, "chargeback=0");
        require(deal.chargebackAmount + recoveredAmount <= deal.maxLiability, "liability cap");
        deal.chargebackAmount += recoveredAmount;
        deal.status = Status.Chargeback;
        emit ChargebackMarked(dealId, deal.mcpSafe, recoveredAmount);
    }

    function cancelDeal(bytes32 dealId) external onlySettlement(dealId) {
        Deal storage deal = deals[dealId];
        require(deal.status == Status.Created || deal.status == Status.Ready, "bad status");
        deal.status = Status.Cancelled;
        emit DealCancelled(dealId);
    }

    function getDeal(bytes32 dealId) external view returns (Deal memory) {
        return deals[dealId];
    }

    function _recordRelease(Deal storage deal, uint256 grossAmount, uint256 feeAmount) internal {
        require(grossAmount > 0 || feeAmount > 0, "release=0");
        require(deal.fundedAmount > 0, "not funded");
        uint256 nextGross = deal.releasedAmount + grossAmount;
        uint256 nextFee = deal.feePaid + feeAmount;
        require(nextGross + nextFee + deal.refundedAmount <= deal.fundedAmount, "release > funded");
        deal.releasedAmount = nextGross;
        deal.feePaid = nextFee;
        emit DealReleased(deal.dealId, deal.mcpSafe, grossAmount, feeAmount);
    }

    function _referenceFunding(Deal storage deal) internal view returns (uint256) {
        return deal.fundedAmount > 0 ? deal.fundedAmount : deal.amount;
    }

    function _autoReady(Deal storage deal) internal {
        if (deal.status == Status.Created && deal.userBound && deal.mcpBound) {
            deal.authorizationMode = AuthorizationMode.ParticipantApproval;
            deal.status = Status.Ready;
            emit DealReady(deal.dealId);
        }
    }

    function _validateTerms(DealTerms calldata terms) internal view {
        require(terms.userSafe != address(0), "user=0");
        require(terms.mcpSafe != address(0), "mcp=0");
        require(terms.settlement != address(0), "settlement=0");
        require(terms.token != address(0), "token=0");
        require(terms.amount > 0, "amount=0");
        require(terms.fee <= terms.amount, "fee > amount");
        require(terms.maxRefund <= terms.amount, "refund > amount");
        require(terms.maxLiability <= terms.amount, "liability > amount");
        require(terms.deadline > block.timestamp, "deadline expired");
        require(terms.gracePeriodEnd <= terms.deadline, "grace > deadline");
    }

    function _requireTermsMatch(Deal storage deal, DealTerms calldata terms) internal view {
        require(deal.dealId == terms.dealId, "dealId mismatch");
        require(deal.userSafe == terms.userSafe, "user mismatch");
        require(deal.mcpSafe == terms.mcpSafe, "mcp mismatch");
        require(deal.settlement == terms.settlement, "settlement mismatch");
        require(deal.token == terms.token, "token mismatch");
        require(deal.amount == terms.amount, "amount mismatch");
        require(deal.fee == terms.fee, "fee mismatch");
        require(deal.maxRefund == terms.maxRefund, "refund mismatch");
        require(deal.maxLiability == terms.maxLiability, "liability mismatch");
        require(deal.gracePeriodEnd == terms.gracePeriodEnd, "grace mismatch");
        require(deal.deadline == terms.deadline, "deadline mismatch");
        require(deal.userNonce == terms.userNonce, "user nonce mismatch");
        require(deal.mcpNonce == terms.mcpNonce, "mcp nonce mismatch");
    }

    function _isValidSigner(address signer, bytes32 digest, bytes calldata signature) internal view returns (bool) {
        if (signer.code.length > 0) {
            try IERC1271(signer).isValidSignature(digest, signature) returns (bytes4 magicValue) {
                return magicValue == EIP1271_MAGICVALUE;
            } catch {
                return false;
            }
        }

        if (signature.length != 65) {
            return false;
        }

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (uint256(s) > SECP256K1N_DIV_2) {
            return false;
        }
        if (v != 27 && v != 28) {
            return false;
        }
        return ecrecover(digest, v, r, s) == signer;
    }

    function _hashTypedDataV4(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparatorV4(), structHash));
    }

    function _domainSeparatorV4() internal view returns (bytes32) {
        return keccak256(
            abi.encode(EIP712_DOMAIN_TYPEHASH, keccak256(bytes(NAME)), keccak256(bytes(VERSION)), block.chainid, address(this))
        );
    }
}
