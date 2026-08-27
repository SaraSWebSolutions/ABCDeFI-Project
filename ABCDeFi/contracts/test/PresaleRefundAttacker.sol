// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRefundablePresale {
    function buyWithETH() external payable;
    function claimRefund() external;
}

/**
 * @dev Test-only receiver used to prove that claimRefund cannot be re-entered.
 */
contract PresaleRefundAttacker {
    IRefundablePresale private immutable _presale;

    bool public attacking;
    bool public reentryAttempted;
    bool public reentrySucceeded;

    constructor(address presaleAddress) {
        _presale = IRefundablePresale(presaleAddress);
    }

    function buy() external payable {
        _presale.buyWithETH{value: msg.value}();
    }

    function attackRefund() external {
        attacking = true;
        _presale.claimRefund();
        attacking = false;
    }

    receive() external payable {
        if (attacking) {
            reentryAttempted = true;
            try _presale.claimRefund() {
                reentrySucceeded = true;
            } catch {}
        }
    }
}
