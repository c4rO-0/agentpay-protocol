// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAgentPayAuthorityFactory {
    function getVault(bytes32 orderId) external view returns (address);
}

interface IAgentPayAuthorityVault {
    function orderId() external view returns (bytes32);
    function factory() external view returns (address);
    function settlementAuthority() external view returns (address);
    function submitDelivery(bytes32 outputHash, uint256 usageUnits) external;
    function release(uint256 sellerAmount, uint256 feeAmount) external;
    function refund(uint256 refundAmount) external;
    function cancelUnfunded() external;
}

/// @title SettlementAuthorityController
/// @notice Stable, narrow authority boundary for AgentPay order Vaults.
contract SettlementAuthorityController {
    address public immutable administrator;
    address public immutable factory;
    address public executor;
    bool public paused;

    event ExecutorUpdated(address indexed previousExecutor, address indexed newExecutor);
    event Paused(address indexed administrator);
    event Unpaused(address indexed administrator);
    event DeliveryForwarded(address indexed vault, bytes32 indexed orderId, bytes32 indexed outputHash, uint256 usageUnits);
    event ReleaseForwarded(address indexed vault, bytes32 indexed orderId, uint256 sellerAmount, uint256 feeAmount);
    event RefundForwarded(address indexed vault, bytes32 indexed orderId, uint256 refundAmount);
    event CancellationForwarded(address indexed vault, bytes32 indexed orderId);

    modifier onlyAdministrator() {
        require(msg.sender == administrator, "not administrator");
        _;
    }

    modifier onlyExecutor() {
        require(msg.sender == executor, "not executor");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "paused");
        _;
    }

    constructor(address administratorSafe, address approvedFactory, address initialExecutor) {
        require(administratorSafe != address(0), "administrator=0");
        require(approvedFactory != address(0), "factory=0");
        require(initialExecutor != address(0), "executor=0");
        require(administratorSafe.code.length > 0, "administrator not contract");
        require(approvedFactory.code.length > 0, "factory not contract");
        require(administratorSafe != initialExecutor, "roles overlap");
        administrator = administratorSafe;
        factory = approvedFactory;
        executor = initialExecutor;
        emit ExecutorUpdated(address(0), initialExecutor);
    }

    function setExecutor(address newExecutor) external onlyAdministrator {
        require(newExecutor != address(0), "executor=0");
        require(newExecutor != administrator, "roles overlap");
        require(newExecutor != executor, "executor unchanged");
        address previousExecutor = executor;
        executor = newExecutor;
        emit ExecutorUpdated(previousExecutor, newExecutor);
    }

    function pause() external onlyAdministrator {
        require(!paused, "paused");
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyAdministrator {
        require(paused, "not paused");
        paused = false;
        emit Unpaused(msg.sender);
    }

    function submitDelivery(address vault, bytes32 outputHash, uint256 usageUnits)
        external
        onlyExecutor
        whenNotPaused
    {
        bytes32 id = _validateVault(vault);
        IAgentPayAuthorityVault(vault).submitDelivery(outputHash, usageUnits);
        emit DeliveryForwarded(vault, id, outputHash, usageUnits);
    }

    function release(address vault, uint256 sellerAmount, uint256 feeAmount)
        external
        onlyExecutor
        whenNotPaused
    {
        bytes32 id = _validateVault(vault);
        IAgentPayAuthorityVault(vault).release(sellerAmount, feeAmount);
        emit ReleaseForwarded(vault, id, sellerAmount, feeAmount);
    }

    function refund(address vault, uint256 refundAmount) external onlyExecutor whenNotPaused {
        bytes32 id = _validateVault(vault);
        IAgentPayAuthorityVault(vault).refund(refundAmount);
        emit RefundForwarded(vault, id, refundAmount);
    }

    function cancelUnfunded(address vault) external onlyExecutor whenNotPaused {
        bytes32 id = _validateVault(vault);
        IAgentPayAuthorityVault(vault).cancelUnfunded();
        emit CancellationForwarded(vault, id);
    }

    function isApprovedVault(address vault) external view returns (bool) {
        return _isApprovedVault(vault);
    }

    function _validateVault(address vault) internal view returns (bytes32 id) {
        require(vault.code.length > 0, "vault has no code");
        IAgentPayAuthorityVault candidate = IAgentPayAuthorityVault(vault);
        id = candidate.orderId();
        require(id != bytes32(0), "orderId=0");
        require(candidate.factory() == factory, "wrong factory");
        require(IAgentPayAuthorityFactory(factory).getVault(id) == vault, "unapproved vault");
        require(candidate.settlementAuthority() == address(this), "wrong authority");
    }

    function _isApprovedVault(address vault) internal view returns (bool) {
        if (vault.code.length == 0) return false;
        try IAgentPayAuthorityVault(vault).orderId() returns (bytes32 id) {
            if (id == bytes32(0)) return false;
            try IAgentPayAuthorityVault(vault).factory() returns (address origin) {
                if (origin != factory) return false;
            } catch { return false; }
            try IAgentPayAuthorityFactory(factory).getVault(id) returns (address registered) {
                if (registered != vault) return false;
            } catch { return false; }
            try IAgentPayAuthorityVault(vault).settlementAuthority() returns (address authority) {
                return authority == address(this);
            } catch { return false; }
        } catch { return false; }
    }
}
