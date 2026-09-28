// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Canonical debt and lifecycle authority for Lending V2 loans.
/// @dev The struct and enum retain their prior persisted ordering. New
///      recovery paths use the dedicated risk-settlement role rather than the
///      broader origination/repayment operator role.
contract LoanManagerV2 is AccessControl {
    bytes32 public constant LOAN_OPERATOR_ROLE = keccak256("LOAN_OPERATOR_ROLE");
    bytes32 public constant RATE_MANAGER_ROLE = keccak256("RATE_MANAGER_ROLE");
    bytes32 public constant RISK_SETTLEMENT_ROLE = keccak256("RISK_SETTLEMENT_ROLE");

    // Existing numeric values are retained for persisted/local-index compatibility.
    enum State { ACTIVE, REPAID, GRACE_PERIOD, DEFAULTED, LIQUIDATED, CLOSED, MARGIN_CALL, RESIDUAL_DEBT }

    /// @notice Page 25 of the supplied whitepaper places ETH in the
    /// 35%-LTV / 9.25%-APR group. This immutable rate applies to Direct and P2P.
    uint16 public constant P2P_ETH_APR_BPS = 925;
    uint16 public constant INITIAL_APR_BPS = P2P_ETH_APR_BPS;
    uint16 public constant MIN_APR_BPS = 1;
    uint16 public constant MAX_APR_BPS = 10_000;
    uint16 public constant DIRECT_CRYPTO_ORIGINATION_FEE_BPS = 0;
    uint16 public constant P2P_CRYPTO_ORIGINATION_FEE_BPS = 0;
    uint48 public constant MARGIN_CALL_CURE_PERIOD = 72 hours;
    uint256 private constant BPS = 10_000;
    uint256 private constant YEAR = 365 days;

    /// @notice Appended accounting values retain legacy field ordering.
    /// `badDebt` is an explicit remaining shortfall; it is never a write-off.
    struct Loan {
        address borrower;
        address lender;
        uint128 collateralETH;
        uint128 principal;
        uint128 principalOutstanding;
        uint128 accruedInterest;
        uint128 fees;
        uint16 aprBps;
        uint48 start;
        uint48 lastAccrual;
        uint48 maturity;
        uint48 graceEnd;
        uint48 marginCallAt;
        uint48 marginCallCureEnd;
        State state;
        bool lateFeeAssessed;
        uint128 reserveContribution;
        uint128 badDebt;
        uint128 totalRepaid;
        bool isP2P;
    }

    uint256 public nextLoanId = 1;
    uint16 public newLoanAprBps = INITIAL_APR_BPS;
    mapping(uint256 => Loan) private loans;

    event LoanCreated(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 principal, uint256 collateral, uint16 aprBps, uint48 maturity);
    event InterestAccrued(uint256 indexed loanId, uint256 amount, uint256 total);
    event RepaymentApplied(uint256 indexed loanId, address indexed payer, uint256 amount, uint256 fees, uint256 interest, uint256 principal, uint256 outstanding);
    event LoanStateChanged(uint256 indexed loanId, State previous, State current);
    event BadDebtRecorded(uint256 indexed loanId, uint256 reserveContribution, uint256 remainingBadDebt);
    event NewLoanAprUpdated(uint16 indexed previousAprBps, uint16 indexed newAprBps, address indexed updater);
    event MarginCallActivated(uint256 indexed loanId, uint256 cureEnd);
    event MarginCallCured(uint256 indexed loanId);
    event PartialLiquidationRecoveryApplied(uint256 indexed loanId, uint256 recovery, uint256 feeApplied, uint256 interestApplied, uint256 principalApplied, uint256 remainingDebt);
    event OverdueCollateralRecoveryApplied(uint256 indexed loanId, uint256 indexed installmentIndex, uint256 recovery, uint256 feeApplied, uint256 interestApplied, uint256 principalApplied, uint256 remainingDebt);
    event ReserveShortfallRecoveryApplied(uint256 indexed loanId, uint256 indexed installmentIndex, uint256 collateralRecovery, uint256 reserveRecovery, uint256 remainingDebt);
    event LiquidationRecoveryApplied(uint256 indexed loanId, uint256 collateralRecovery, uint256 reserveRecovery, uint256 remainingDebt);

    constructor(address admin) {
        require(admin != address(0), "admin=0");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(LOAN_OPERATOR_ROLE, admin);
        _grantRole(RATE_MANAGER_ROLE, admin);
        _grantRole(RISK_SETTLEMENT_ROLE, admin);
    }

    function setNewLoanAprBps(uint16 aprBps) external onlyRole(RATE_MANAGER_ROLE) {
        require(aprBps >= MIN_APR_BPS && aprBps <= MAX_APR_BPS, "invalid apr");
        require(aprBps == P2P_ETH_APR_BPS, "direct ETH APR fixed");
        uint16 previous = newLoanAprBps;
        newLoanAprBps = aprBps;
        emit NewLoanAprUpdated(previous, aprBps, msg.sender);
    }

    function create(address borrower, address lender, uint128 collateral, uint128 principal, uint16 aprBps, uint48 term)
        external
        onlyRole(LOAN_OPERATOR_ROLE)
        returns (uint256 id)
    {
        require(aprBps == newLoanAprBps, "invalid terms");
        return _create(borrower, lender, collateral, principal, aprBps, term, false);
    }

    function createP2P(address borrower, address lender, uint128 collateral, uint128 principal, uint48 term)
        external
        onlyRole(LOAN_OPERATOR_ROLE)
        returns (uint256 id)
    {
        return _create(borrower, lender, collateral, principal, P2P_ETH_APR_BPS, term, true);
    }

    function _create(address borrower, address lender, uint128 collateral, uint128 principal, uint16 aprBps, uint48 term, bool isP2P)
        private
        returns (uint256 id)
    {
        require(borrower != address(0) && lender != address(0) && collateral != 0 && principal != 0, "invalid loan");
        require(term == 30 days || term == 90 days || term == 180 days, "invalid terms");
        id = nextLoanId++;
        uint48 start = uint48(block.timestamp);
        loans[id] = Loan({
            borrower: borrower,
            lender: lender,
            collateralETH: collateral,
            principal: principal,
            principalOutstanding: principal,
            accruedInterest: 0,
            fees: 0,
            aprBps: aprBps,
            start: start,
            lastAccrual: start,
            maturity: start + term,
            graceEnd: start + term + 7 days,
            marginCallAt: 0,
            marginCallCureEnd: 0,
            state: State.ACTIVE,
            lateFeeAssessed: false,
            reserveContribution: 0,
            badDebt: 0,
            totalRepaid: 0,
            isP2P: isP2P
        });
        emit LoanCreated(id, borrower, lender, principal, collateral, aprBps, start + term);
    }

    function getLoan(uint256 id) external view returns (Loan memory) { return loans[id]; }

    function previewAccruedInterest(uint256 id) public view returns (uint256) {
        Loan memory loan = loans[id];
        require(loan.borrower != address(0), "missing loan");
        if (loan.state == State.REPAID || loan.state == State.CLOSED || loan.state == State.LIQUIDATED) return loan.accruedInterest;
        uint256 through = block.timestamp < loan.maturity ? block.timestamp : loan.maturity;
        uint256 elapsed = through > loan.lastAccrual ? through - loan.lastAccrual : 0;
        return uint256(loan.accruedInterest) + (uint256(loan.principalOutstanding) * loan.aprBps * elapsed) / (BPS * YEAR);
    }

    function previewOutstanding(uint256 id) public view returns (uint256) {
        Loan memory loan = loans[id];
        require(loan.borrower != address(0), "missing loan");
        return uint256(loan.principalOutstanding) + previewAccruedInterest(id);
    }

    function previewLiquidationObligation(uint256 id) public view returns (uint256) {
        Loan memory loan = loans[id];
        require(loan.borrower != address(0), "missing loan");
        return previewOutstanding(id) + loan.fees;
    }

    function previewTotalRepayment(uint256 id) external view returns (uint256) {
        Loan memory loan = loans[id];
        require(loan.borrower != address(0), "missing loan");
        if (loan.state == State.REPAID || loan.state == State.CLOSED || loan.state == State.LIQUIDATED) return previewOutstanding(id);
        uint256 remainingSeconds = loan.maturity > loan.lastAccrual ? loan.maturity - loan.lastAccrual : 0;
        uint256 interestAtMaturity = uint256(loan.accruedInterest) + (uint256(loan.principalOutstanding) * loan.aprBps * remainingSeconds) / (BPS * YEAR);
        return uint256(loan.principalOutstanding) + interestAtMaturity;
    }

    function previewLoanStatus(uint256 id) public view returns (State) {
        Loan memory loan = loans[id];
        require(loan.borrower != address(0), "missing loan");
        if (loan.isP2P) return loan.state;
        if (loan.state != State.ACTIVE) {
            if (loan.state == State.GRACE_PERIOD && block.timestamp > loan.graceEnd) return State.DEFAULTED;
            return loan.state;
        }
        if (block.timestamp > loan.graceEnd) return State.DEFAULTED;
        if (block.timestamp > loan.maturity) return State.GRACE_PERIOD;
        return State.ACTIVE;
    }

    function activateMarginCall(uint256 id) external onlyRole(LOAN_OPERATOR_ROLE) {
        Loan storage loan = loans[id];
        require(loan.state == State.ACTIVE, "not active");
        loan.state = State.MARGIN_CALL;
        loan.marginCallAt = uint48(block.timestamp);
        loan.marginCallCureEnd = uint48(block.timestamp + MARGIN_CALL_CURE_PERIOD);
        emit LoanStateChanged(id, State.ACTIVE, State.MARGIN_CALL);
        emit MarginCallActivated(id, loan.marginCallCureEnd);
    }

    function cureMarginCall(uint256 id) external onlyRole(LOAN_OPERATOR_ROLE) {
        Loan storage loan = loans[id];
        require(loan.state == State.MARGIN_CALL, "not margin call");
        loan.state = State.ACTIVE;
        emit LoanStateChanged(id, State.MARGIN_CALL, State.ACTIVE);
        emit MarginCallCured(id);
    }

    function accrue(uint256 id) public onlyRole(LOAN_OPERATOR_ROLE) returns (uint256 added) {
        Loan storage loan = loans[id];
        require(loan.borrower != address(0), "missing loan");
        if (loan.state == State.REPAID || loan.state == State.CLOSED || loan.state == State.LIQUIDATED) return 0;
        uint256 through = block.timestamp < loan.maturity ? block.timestamp : loan.maturity;
        uint256 elapsed = through > loan.lastAccrual ? through - loan.lastAccrual : 0;
        if (elapsed != 0) {
            added = (uint256(loan.principalOutstanding) * loan.aprBps * elapsed) / (BPS * YEAR);
            loan.lastAccrual = uint48(through);
            if (added != 0) {
                loan.accruedInterest += uint128(added);
                emit InterestAccrued(id, added, loan.accruedInterest);
            }
        }
    }

    function sync(uint256 id) external onlyRole(LOAN_OPERATOR_ROLE) {
        Loan storage loan = loans[id];
        accrue(id);
        if (loan.isP2P) return;
        if (loan.state == State.ACTIVE && block.timestamp > loan.maturity) {
            loan.state = State.GRACE_PERIOD;
            emit LoanStateChanged(id, State.ACTIVE, State.GRACE_PERIOD);
        }
        if (loan.state == State.GRACE_PERIOD && block.timestamp > loan.graceEnd) {
            loan.state = State.DEFAULTED;
            emit LoanStateChanged(id, State.GRACE_PERIOD, State.DEFAULTED);
        }
    }

    function repay(uint256 id, address payer, uint256 amount)
        external
        onlyRole(LOAN_OPERATOR_ROLE)
        returns (uint256 fee, uint256 interest, uint256 principal)
    {
        Loan storage loan = loans[id];
        require(loan.state == State.ACTIVE || loan.state == State.GRACE_PERIOD || loan.state == State.MARGIN_CALL || loan.state == State.RESIDUAL_DEBT, "repay unavailable");
        accrue(id);
        (fee, interest, principal) = _applyInRepaymentOrder(loan, amount);
        uint256 applied = fee + interest + principal;
        loan.totalRepaid += uint128(applied);
        if (_remainingDebt(loan) == 0) {
            State previous = loan.state;
            loan.state = previous == State.RESIDUAL_DEBT ? State.LIQUIDATED : State.REPAID;
            emit LoanStateChanged(id, previous, loan.state);
        }
        emit RepaymentApplied(id, payer, applied, fee, interest, principal, _remainingDebt(loan));
    }

    /// @notice Applies exactly the protocol-derived partial-sale recovery in
    /// fees -> interest -> principal order. It intentionally leaves the loan in
    /// MARGIN_CALL until LiquidationV2 proves the target LTV from the same
    /// oracle snapshots and calls `restoreAfterPartialLiquidation`.
    function applyPartialLiquidationRecovery(uint256 id, uint256 recovery)
        external
        onlyRole(RISK_SETTLEMENT_ROLE)
        returns (uint256 fee, uint256 interest, uint256 principal, uint256 remainingDebt)
    {
        Loan storage loan = loans[id];
        require(!loan.isP2P, "p2p partial sale policy required");
        require(loan.state == State.MARGIN_CALL, "not margin call");
        accrue(id);
        uint256 debt = _remainingDebt(loan);
        require(recovery != 0 && recovery < debt, "invalid partial recovery");
        (fee, interest, principal) = _applyInRepaymentOrder(loan, recovery);
        remainingDebt = _remainingDebt(loan);
        emit PartialLiquidationRecoveryApplied(id, recovery, fee, interest, principal, remainingDebt);
    }

    function restoreAfterPartialLiquidation(uint256 id) external onlyRole(RISK_SETTLEMENT_ROLE) {
        Loan storage loan = loans[id];
        require(!loan.isP2P && loan.state == State.MARGIN_CALL && _remainingDebt(loan) != 0, "partial restoration unavailable");
        loan.state = State.ACTIVE;
        emit LoanStateChanged(id, State.MARGIN_CALL, State.ACTIVE);
    }

    /// @notice Applies collateral-sale proceeds to one due installment. This
    /// is distinct from borrower repayment: it never increments totalRepaid or
    /// creates a completion certificate. A fully debt-settling collateral path
    /// is recorded as LIQUIDATED so it cannot masquerade as an honoured loan.
    function applyOverdueInstallmentRecovery(uint256 id, uint256 installmentIndex, uint256 recovery)
        external
        onlyRole(RISK_SETTLEMENT_ROLE)
        returns (uint256 fee, uint256 interest, uint256 principal, uint256 remainingDebt, bool terminalRecovery)
    {
        Loan storage loan = loans[id];
        require(
            loan.state == State.ACTIVE || loan.state == State.GRACE_PERIOD || loan.state == State.MARGIN_CALL || loan.state == State.RESIDUAL_DEBT,
            "overdue settlement unavailable"
        );
        accrue(id);
        uint256 debt = _remainingDebt(loan);
        require(recovery != 0 && recovery <= debt, "invalid overdue recovery");
        (fee, interest, principal) = _applyInRepaymentOrder(loan, recovery);
        remainingDebt = _remainingDebt(loan);
        if (remainingDebt == 0) {
            State previous = loan.state;
            loan.state = State.LIQUIDATED;
            terminalRecovery = true;
            emit LoanStateChanged(id, previous, State.LIQUIDATED);
        }
        emit OverdueCollateralRecoveryApplied(id, installmentIndex, recovery, fee, interest, principal, remainingDebt);
    }

    /// @notice Applies the approved Direct-only collateral -> reserve waterfall
    /// for an overdue installment whose eligible collateral has been exhausted.
    /// The caller supplies only the reserve amount actually transferred by the
    /// configured InsuranceReserveV2 in this same transaction. Any remainder
    /// becomes explicit residual bad debt; it is never forgiven or inferred.
    function applyOverdueInstallmentRecoveryWithReserve(
        uint256 id,
        uint256 installmentIndex,
        uint256 collateralRecovery,
        uint256 reserveRecovery
    )
        external
        onlyRole(RISK_SETTLEMENT_ROLE)
        returns (uint256 fee, uint256 interest, uint256 principal, uint256 remainingDebt, bool terminalRecovery)
    {
        Loan storage loan = loans[id];
        require(!loan.isP2P, "p2p settlement policy required");
        require(
            loan.state == State.ACTIVE || loan.state == State.GRACE_PERIOD || loan.state == State.MARGIN_CALL || loan.state == State.RESIDUAL_DEBT,
            "overdue settlement unavailable"
        );
        accrue(id);
        uint256 debt = _remainingDebt(loan);
        require(collateralRecovery != 0 && collateralRecovery <= debt, "invalid overdue recovery");
        require(reserveRecovery <= debt - collateralRecovery, "invalid reserve recovery");

        (fee, interest, principal) = _applyInRepaymentOrder(loan, collateralRecovery);
        if (reserveRecovery != 0) {
            (uint256 reserveFee, uint256 reserveInterest, uint256 reservePrincipal) = _applyInRepaymentOrder(loan, reserveRecovery);
            fee += reserveFee;
            interest += reserveInterest;
            principal += reservePrincipal;
            loan.reserveContribution += uint128(reserveRecovery);
        }
        remainingDebt = _remainingDebt(loan);
        loan.badDebt = uint128(remainingDebt);
        State previous = loan.state;
        loan.state = remainingDebt == 0 ? State.LIQUIDATED : State.RESIDUAL_DEBT;
        terminalRecovery = remainingDebt == 0;
        if (previous != loan.state) emit LoanStateChanged(id, previous, loan.state);
        emit OverdueCollateralRecoveryApplied(id, installmentIndex, collateralRecovery, fee, interest, principal, remainingDebt);
        emit ReserveShortfallRecoveryApplied(id, installmentIndex, collateralRecovery, reserveRecovery, remainingDebt);
        emit BadDebtRecorded(id, reserveRecovery, remainingDebt);
    }

    /// @notice Terminal recovery support for a separately approved recovery
    /// identity. It preserves shortfall/bad-debt evidence but is inaccessible
    /// to ordinary lending operators and is not a normal partial-sale path.
    function applyLiquidationRecovery(uint256 id, uint256 collateralRecovery, uint256 reserveRecovery)
        external
        onlyRole(RISK_SETTLEMENT_ROLE)
        returns (uint256 remainingDebt)
    {
        Loan storage loan = loans[id];
        require(!loan.isP2P, "p2p settlement policy required");
        require(
            loan.state == State.ACTIVE || loan.state == State.GRACE_PERIOD || loan.state == State.MARGIN_CALL || loan.state == State.DEFAULTED || loan.state == State.RESIDUAL_DEBT,
            "not liquidatable"
        );
        accrue(id);
        uint256 applied = collateralRecovery + reserveRecovery;
        uint256 debt = _remainingDebt(loan);
        require(applied != 0 && applied <= debt, "invalid recovery");
        _applyInRepaymentOrder(loan, applied);
        loan.reserveContribution += uint128(reserveRecovery);
        remainingDebt = _remainingDebt(loan);
        loan.badDebt = uint128(remainingDebt);
        State previous = loan.state;
        loan.state = remainingDebt == 0 ? State.LIQUIDATED : State.RESIDUAL_DEBT;
        emit LoanStateChanged(id, previous, loan.state);
        if (reserveRecovery != 0 || remainingDebt != 0) emit BadDebtRecorded(id, reserveRecovery, remainingDebt);
        emit LiquidationRecoveryApplied(id, collateralRecovery, reserveRecovery, remainingDebt);
    }

    /// @notice Legacy ABI boundary retained but restricted to the same narrow
    /// risk-settlement role. Canonical LiquidationV2 uses the verified adapter
    /// path above rather than caller-supplied accounting inputs.
    function liquidate(uint256 id, uint256 debtCovered, uint256 reserve, uint256 badDebt)
        external
        onlyRole(RISK_SETTLEMENT_ROLE)
    {
        Loan storage loan = loans[id];
        require(!loan.isP2P, "p2p settlement policy required");
        require(loan.state == State.ACTIVE || loan.state == State.GRACE_PERIOD || loan.state == State.MARGIN_CALL || loan.state == State.DEFAULTED, "not liquidatable");
        uint256 debt = _remainingDebt(loan);
        require(debtCovered + reserve + badDebt == debt, "settlement mismatch");
        require(debtCovered + reserve != 0, "invalid recovery");
        _applyInRepaymentOrder(loan, debtCovered + reserve);
        loan.reserveContribution = uint128(reserve);
        loan.badDebt = uint128(badDebt);
        State previous = loan.state;
        loan.state = badDebt == 0 ? State.LIQUIDATED : State.RESIDUAL_DEBT;
        emit LoanStateChanged(id, previous, loan.state);
        if (reserve != 0 || badDebt != 0) emit BadDebtRecorded(id, reserve, badDebt);
    }

    function close(uint256 id) external onlyRole(LOAN_OPERATOR_ROLE) {
        Loan storage loan = loans[id];
        require(loan.state == State.REPAID, "not repaid");
        loan.state = State.CLOSED;
        emit LoanStateChanged(id, State.REPAID, State.CLOSED);
    }

    function _applyInRepaymentOrder(Loan storage loan, uint256 amount)
        private
        returns (uint256 fee, uint256 interest, uint256 principal)
    {
        fee = amount > loan.fees ? loan.fees : amount;
        loan.fees -= uint128(fee);
        amount -= fee;
        interest = amount > loan.accruedInterest ? loan.accruedInterest : amount;
        loan.accruedInterest -= uint128(interest);
        amount -= interest;
        principal = amount > loan.principalOutstanding ? loan.principalOutstanding : amount;
        loan.principalOutstanding -= uint128(principal);
    }

    function _remainingDebt(Loan storage loan) private view returns (uint256) {
        return uint256(loan.principalOutstanding) + loan.accruedInterest + loan.fees;
    }
}
