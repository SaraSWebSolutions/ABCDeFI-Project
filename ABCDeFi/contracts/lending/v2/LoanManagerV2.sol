// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/access/AccessControl.sol";

contract LoanManagerV2 is AccessControl {
    bytes32 public constant LOAN_OPERATOR_ROLE = keccak256("LOAN_OPERATOR_ROLE");
    // Existing numeric values are retained for persisted/local-index compatibility.
    // MARGIN_CALL is appended rather than inserted into the legacy enum ordering.
    // RESIDUAL_DEBT is appended so previously persisted enum values retain
    // their meaning. It records an unpaid balance after an approved partial
    // collateral realization; it is never a write-off.
    enum State { ACTIVE, REPAID, GRACE_PERIOD, DEFAULTED, LIQUIDATED, CLOSED, MARGIN_CALL, RESIDUAL_DEBT }
    /// @notice Page 25 of the ABCDeFi 21 Jan 2022 whitepaper places ETH in
    /// the ABCD-against-crypto 35% LTV / 9.25% rate group. This immutable
    /// rate applies to both supported ETH-backed paths: P2P and Direct.
    uint16 public constant P2P_ETH_APR_BPS = 925;
    /// @notice The approved Direct ETH Option A policy uses the same
    /// whitepaper table rate as ETH-backed P2P origination. Existing loans
    /// retain the APR stored at creation; this initializes the governed rate
    /// for future direct loans.
    uint16 public constant INITIAL_APR_BPS = P2P_ETH_APR_BPS;
    uint16 public constant MIN_APR_BPS = 1;
    uint16 public constant MAX_APR_BPS = 10_000;
    uint48 public constant MARGIN_CALL_CURE_PERIOD = 72 hours;
    uint256 private constant BPS = 10_000;
    uint256 private constant YEAR = 365 days;

    /// @notice `totalRepaid` is an immutable-accounting input for a completed
    /// LoanNFT certificate.  It is appended so existing loan fields retain
    /// their persisted ordering.
    struct Loan { address borrower; address lender; uint128 collateralETH; uint128 principal; uint128 principalOutstanding; uint128 accruedInterest; uint128 fees; uint16 aprBps; uint48 start; uint48 lastAccrual; uint48 maturity; uint48 graceEnd; uint48 marginCallAt; uint48 marginCallCureEnd; State state; bool lateFeeAssessed; uint128 reserveContribution; uint128 badDebt; uint128 totalRepaid; bool isP2P; }
    uint256 public nextLoanId=1;
    uint16 public newLoanAprBps = INITIAL_APR_BPS;
    bytes32 public constant RATE_MANAGER_ROLE = keccak256("RATE_MANAGER_ROLE");
    mapping(uint256=>Loan) private loans;
    event LoanCreated(uint256 indexed loanId,address indexed borrower,address indexed lender,uint256 principal,uint256 collateral,uint16 aprBps,uint48 maturity);
    event InterestAccrued(uint256 indexed loanId,uint256 amount,uint256 total);
    event RepaymentApplied(uint256 indexed loanId,address indexed payer,uint256 amount,uint256 fees,uint256 interest,uint256 principal,uint256 outstanding);
    event LoanStateChanged(uint256 indexed loanId,State previous,State current);
    event BadDebtRecorded(uint256 indexed loanId,uint256 reserveContribution,uint256 remainingBadDebt);
    event NewLoanAprUpdated(uint16 indexed previousAprBps, uint16 indexed newAprBps, address indexed updater);
    event MarginCallActivated(uint256 indexed loanId, uint256 cureEnd);
    event MarginCallCured(uint256 indexed loanId);
    event LiquidationRecoveryApplied(uint256 indexed loanId, uint256 collateralRecovery, uint256 reserveRecovery, uint256 remainingDebt);
    constructor(address admin){_grantRole(DEFAULT_ADMIN_ROLE,admin);_grantRole(LOAN_OPERATOR_ROLE,admin);_grantRole(RATE_MANAGER_ROLE,admin);}
    function setNewLoanAprBps(uint16 aprBps) external onlyRole(RATE_MANAGER_ROLE) {
        require(aprBps >= MIN_APR_BPS && aprBps <= MAX_APR_BPS, "invalid apr");
        require(aprBps == P2P_ETH_APR_BPS, "direct ETH APR fixed");
        uint16 previous = newLoanAprBps; newLoanAprBps = aprBps;
        emit NewLoanAprUpdated(previous, aprBps, msg.sender);
    }
    function create(address borrower,address lender,uint128 collateral,uint128 principal,uint16 aprBps,uint48 term) external onlyRole(LOAN_OPERATOR_ROLE) returns(uint256 id){
        require(aprBps == newLoanAprBps, "invalid terms");
        return _create(borrower, lender, collateral, principal, aprBps, term, false);
    }
    /// @notice Creates an ETH-backed P2P loan at the whitepaper table rate.
    /// Only a trusted LoanManager operator (the configured marketplace) can
    /// originate it; the rate is stored on the loan and never changes later.
    function createP2P(address borrower,address lender,uint128 collateral,uint128 principal,uint48 term) external onlyRole(LOAN_OPERATOR_ROLE) returns(uint256 id){
        return _create(borrower, lender, collateral, principal, P2P_ETH_APR_BPS, term, true);
    }
    function _create(address borrower,address lender,uint128 collateral,uint128 principal,uint16 aprBps,uint48 term,bool isP2P) private returns(uint256 id){
        require(borrower!=address(0) && lender!=address(0) && collateral!=0 && principal!=0, "invalid loan");
        require(term==30 days || term==90 days || term==180 days, "invalid terms");
        id=nextLoanId++;
        uint48 start=uint48(block.timestamp);
        loans[id]=Loan(borrower,lender,collateral,principal,principal,0,0,aprBps,start,start,start+term,start+term+7 days,0,0,State.ACTIVE,false,0,0,0,isP2P);
        emit LoanCreated(id,borrower,lender,principal,collateral,aprBps,start+term);
    }
    function getLoan(uint256 id) external view returns(Loan memory){return loans[id];}
    /// @notice Accrued simple interest through the current timestamp, without changing storage.
    function previewAccruedInterest(uint256 id) public view returns(uint256) {
        Loan memory l = loans[id]; require(l.borrower != address(0), "missing loan");
        if(l.state==State.REPAID || l.state==State.CLOSED || l.state==State.LIQUIDATED) return l.accruedInterest;
        uint256 through = block.timestamp < l.maturity ? block.timestamp : l.maturity;
        uint256 elapsed = through > l.lastAccrual ? through - l.lastAccrual : 0;
        return uint256(l.accruedInterest) + (uint256(l.principalOutstanding) * l.aprBps * elapsed) / (BPS * YEAR);
    }
    /// @notice Exact current obligation if repaid now, calculated without a state write.
    function previewOutstanding(uint256 id) public view returns(uint256) {
        Loan memory l = loans[id]; require(l.borrower != address(0), "missing loan");
        return uint256(l.principalOutstanding) + previewAccruedInterest(id);
    }
    /// @notice Complete canonical monetary obligation used only by approved
    /// liquidation settlement. Normal borrower repayment keeps its existing
    /// fee/interest/principal ordering.
    function previewLiquidationObligation(uint256 id) public view returns(uint256) {
        Loan memory l = loans[id]; require(l.borrower != address(0), "missing loan");
        return previewOutstanding(id) + l.fees;
    }
    /// @notice Contractual total repayment if the remaining principal is paid at maturity.
    function previewTotalRepayment(uint256 id) external view returns(uint256) {
        Loan memory l = loans[id]; require(l.borrower != address(0), "missing loan");
        if(l.state==State.REPAID || l.state==State.CLOSED || l.state==State.LIQUIDATED) return previewOutstanding(id);
        uint256 remainingSeconds = l.maturity > l.lastAccrual ? l.maturity - l.lastAccrual : 0;
        uint256 interestAtMaturity = uint256(l.accruedInterest) + (uint256(l.principalOutstanding) * l.aprBps * remainingSeconds) / (BPS * YEAR);
        return uint256(l.principalOutstanding) + interestAtMaturity;
    }
    /// @notice State implied by time at the current block, without persisting a transition.
    function previewLoanStatus(uint256 id) public view returns(State) {
        Loan memory l = loans[id]; require(l.borrower != address(0), "missing loan");
        if (l.isP2P) return l.state;
        if(l.state != State.ACTIVE) {
            if(l.state == State.GRACE_PERIOD && block.timestamp > l.graceEnd) return State.DEFAULTED;
            return l.state;
        }
        if(block.timestamp > l.graceEnd) return State.DEFAULTED;
        if(block.timestamp > l.maturity) return State.GRACE_PERIOD;
        return State.ACTIVE;
    }
    function activateMarginCall(uint256 id) external onlyRole(LOAN_OPERATOR_ROLE) {
        Loan storage l = loans[id]; require(l.state == State.ACTIVE, "not active");
        l.state = State.MARGIN_CALL; l.marginCallAt = uint48(block.timestamp); l.marginCallCureEnd = uint48(block.timestamp + MARGIN_CALL_CURE_PERIOD);
        emit LoanStateChanged(id, State.ACTIVE, State.MARGIN_CALL); emit MarginCallActivated(id, l.marginCallCureEnd);
    }
    function cureMarginCall(uint256 id) external onlyRole(LOAN_OPERATOR_ROLE) {
        Loan storage l = loans[id]; require(l.state == State.MARGIN_CALL, "not margin call");
        l.state = State.ACTIVE; emit LoanStateChanged(id, State.MARGIN_CALL, State.ACTIVE); emit MarginCallCured(id);
    }
    function accrue(uint256 id) public onlyRole(LOAN_OPERATOR_ROLE) returns(uint256 added){
        Loan storage l=loans[id]; require(l.borrower!=address(0),"missing loan");
        if(l.state==State.REPAID || l.state==State.CLOSED || l.state==State.LIQUIDATED) return 0;
        uint256 through=block.timestamp<l.maturity ? block.timestamp : l.maturity;
        uint256 elapsed=through>l.lastAccrual ? through-l.lastAccrual : 0;
        if(elapsed != 0) {
            added=(uint256(l.principalOutstanding)*l.aprBps*elapsed)/(BPS*YEAR);
            l.lastAccrual=uint48(through);
            if(added != 0) { l.accruedInterest += uint128(added); emit InterestAccrued(id,added,l.accruedInterest); }
        }
    }
    function sync(uint256 id) external onlyRole(LOAN_OPERATOR_ROLE){
        Loan storage l=loans[id]; accrue(id);
        if (l.isP2P) return;
        // The exact maturity timestamp is still payable at the contracted schedule amount.
        // Direct maturity enters its existing grace state without assessing a late fee.
        if(l.state==State.ACTIVE && block.timestamp>l.maturity){
            l.state=State.GRACE_PERIOD;
            emit LoanStateChanged(id,State.ACTIVE,State.GRACE_PERIOD);
        }
        if(l.state==State.GRACE_PERIOD && block.timestamp>l.graceEnd){l.state=State.DEFAULTED;emit LoanStateChanged(id,State.GRACE_PERIOD,State.DEFAULTED);}
        // Margin-call expiry is not a terminal default. The approved P2P
        // policy requires a partial sale after the 72-hour cure window, with
        // residual debt/collateral remaining active. `LiquidationV2`
        // determines expiry from `marginCallCureEnd` and may then restore the
        // position toward the target LTV. Maturity/grace defaults remain
        // explicitly represented by State.DEFAULTED above.
    }
    function repay(uint256 id,address payer,uint256 amount) external onlyRole(LOAN_OPERATOR_ROLE) returns(uint256 fee,uint256 interest,uint256 principal) {
        Loan storage l = loans[id];
        require(l.state == State.ACTIVE || l.state == State.GRACE_PERIOD || l.state == State.MARGIN_CALL || l.state == State.RESIDUAL_DEBT, "repay unavailable");
        accrue(id);
        fee = amount > l.fees ? l.fees : amount;
        l.fees -= uint128(fee);
        amount -= fee;
        interest = amount > l.accruedInterest ? l.accruedInterest : amount;
        l.accruedInterest -= uint128(interest);
        amount -= interest;
        principal = amount > l.principalOutstanding ? l.principalOutstanding : amount;
        l.principalOutstanding -= uint128(principal);
        uint256 applied = fee + interest + principal;
        l.totalRepaid += uint128(applied);
        if (l.principalOutstanding == 0 && l.accruedInterest == 0 && l.fees == 0) {
            State previous = l.state;
            // A residual-debt borrower may cure the balance later, but this
            // does not convert a liquidation into a normal completion/NFT path.
            l.state = previous == State.RESIDUAL_DEBT ? State.LIQUIDATED : State.REPAID;
            emit LoanStateChanged(id, previous, l.state);
        }
        emit RepaymentApplied(id, payer, applied, fee, interest, principal, uint256(l.principalOutstanding) + l.accruedInterest + l.fees);
    }
    function liquidate(uint256 id,uint256 debtCovered,uint256 reserve,uint256 badDebt) external onlyRole(LOAN_OPERATOR_ROLE){
        Loan storage l=loans[id];require(l.state==State.ACTIVE||l.state==State.GRACE_PERIOD||l.state==State.MARGIN_CALL||l.state==State.DEFAULTED,"not liquidatable");
        uint256 debt = uint256(l.principalOutstanding) + l.accruedInterest + l.fees;
        require(debtCovered + reserve + badDebt == debt, "settlement mismatch");
        l.principalOutstanding=0;l.accruedInterest=0;l.fees=0;l.reserveContribution=uint128(reserve);l.badDebt=uint128(badDebt);
        State p=l.state;l.state=State.LIQUIDATED;emit LoanStateChanged(id,p,State.LIQUIDATED);
        if(reserve!=0||badDebt!=0)emit BadDebtRecorded(id,reserve,badDebt);
    }
    /// @notice Applies actual, already-transferred recovery in the canonical
    /// lender-first settlement transaction. Any amount not covered remains a
    /// borrower obligation; this function cannot forgive or fabricate debt.
    function applyLiquidationRecovery(uint256 id, uint256 collateralRecovery, uint256 reserveRecovery)
        external onlyRole(LOAN_OPERATOR_ROLE) returns (uint256 remainingDebt)
    {
        Loan storage l = loans[id];
        require(!l.isP2P, "p2p settlement policy required");
        require(l.state == State.ACTIVE || l.state == State.GRACE_PERIOD || l.state == State.MARGIN_CALL || l.state == State.DEFAULTED || l.state == State.RESIDUAL_DEBT, "not liquidatable");
        accrue(id);
        uint256 applied = collateralRecovery + reserveRecovery;
        uint256 debt = uint256(l.principalOutstanding) + l.accruedInterest + l.fees;
        require(applied != 0 && applied <= debt, "invalid recovery");
        uint256 remaining = applied;
        uint256 principalPart = remaining > l.principalOutstanding ? l.principalOutstanding : remaining;
        l.principalOutstanding -= uint128(principalPart); remaining -= principalPart;
        uint256 interestPart = remaining > l.accruedInterest ? l.accruedInterest : remaining;
        l.accruedInterest -= uint128(interestPart); remaining -= interestPart;
        uint256 feePart = remaining > l.fees ? l.fees : remaining;
        l.fees -= uint128(feePart);
        l.reserveContribution += uint128(reserveRecovery);
        remainingDebt = uint256(l.principalOutstanding) + l.accruedInterest + l.fees;
        State previous = l.state;
        l.state = remainingDebt == 0 ? State.LIQUIDATED : State.RESIDUAL_DEBT;
        emit LoanStateChanged(id, previous, l.state);
        emit LiquidationRecoveryApplied(id, collateralRecovery, reserveRecovery, remainingDebt);
    }
    function close(uint256 id) external onlyRole(LOAN_OPERATOR_ROLE){Loan storage l=loans[id];require(l.state==State.REPAID,"not repaid");l.state=State.CLOSED;emit LoanStateChanged(id,State.REPAID,State.CLOSED);}
}
