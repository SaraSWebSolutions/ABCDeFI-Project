// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Test-only adversarial native-BNB receiver for ICOManagerV2 negative-path tests.
interface IICOManagerV2NativeTarget {
    function buy(uint8 stageId, uint256 requestedAllocation) external payable;
    function claimRefund() external;
    function withdrawProceeds() external;
}

contract ICOManagerV2NativeReceiver {
    enum ReceiveMode { Accept, Reject, ReenterPurchase, ReenterRefund, ReenterProceeds }

    IICOManagerV2NativeTarget public immutable sale;
    ReceiveMode public receiveMode;
    bool public reentryAttempted;
    bool public reentrySucceeded;

    constructor(address sale_) { sale = IICOManagerV2NativeTarget(sale_); }

    function setReceiveMode(ReceiveMode nextMode) external {
        receiveMode = nextMode;
        reentryAttempted = false;
        reentrySucceeded = false;
    }

    function buy(uint8 stageId, uint256 requestedAllocation) external payable {
        sale.buy{value: msg.value}(stageId, requestedAllocation);
    }

    function claimRefund() external { sale.claimRefund(); }

    receive() external payable {
        if (receiveMode == ReceiveMode.Reject) revert("ICOManagerV2NativeReceiver: rejecting native BNB");
        if (receiveMode == ReceiveMode.Accept) return;

        reentryAttempted = true;
        if (receiveMode == ReceiveMode.ReenterPurchase) {
            try sale.buy{value: 0}(0, 100 ether) { reentrySucceeded = true; } catch { }
        } else if (receiveMode == ReceiveMode.ReenterRefund) {
            try sale.claimRefund() { reentrySucceeded = true; } catch { }
        } else if (receiveMode == ReceiveMode.ReenterProceeds) {
            try sale.withdrawProceeds() { reentrySucceeded = true; } catch { }
        }
    }
}
