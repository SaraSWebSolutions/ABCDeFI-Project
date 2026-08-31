// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/access/AccessControl.sol";

contract LoanManagerV2 is AccessControl {
    bytes32 public constant LOAN_OPERATOR_ROLE = keccak256("LOAN_OPERATOR_ROLE");
    enum State { ACTIVE, REPAID, GRACE_PERIOD, DEFAULTED, LIQUIDATED, CLOSED }
    uint16 public constant FIXED_APR_BPS = 1_200;
    uint16 public constant LATE_FEE_BPS = 200;
    uint256 private constant BPS = 10_000;
    uint256 private constant YEAR = 365 days;

    struct Loan { address borrower; address lender; uint128 collateralETH; uint128 principal; uint128 principalOutstanding; uint128 accruedInterest; uint128 fees; uint16 aprBps; uint48 start; uint48 lastAccrual; uint48 maturity; uint48 graceEnd; State state; bool lateFeeAssessed; uint128 reserveContribution; uint128 badDebt; }
    uint256 public nextLoanId=1;
    mapping(uint256=>Loan) private loans;
    event LoanCreated(uint256 indexed loanId,address indexed borrower,address indexed lender,uint256 principal,uint256 collateral,uint16 aprBps,uint48 maturity);
    event InterestAccrued(uint256 indexed loanId,uint256 amount,uint256 total);
    event FeeAssessed(uint256 indexed loanId,uint256 amount);
    event RepaymentApplied(uint256 indexed loanId,address indexed payer,uint256 amount,uint256 fees,uint256 interest,uint256 principal,uint256 outstanding);
    event LoanStateChanged(uint256 indexed loanId,State previous,State current);
    event BadDebtRecorded(uint256 indexed loanId,uint256 reserveContribution,uint256 remainingBadDebt);
    constructor(address admin){_grantRole(DEFAULT_ADMIN_ROLE,admin);_grantRole(LOAN_OPERATOR_ROLE,admin);}
    function create(address borrower,address lender,uint128 collateral,uint128 principal,uint16 aprBps,uint48 term) external onlyRole(LOAN_OPERATOR_ROLE) returns(uint256 id){
        require(borrower!=address(0) && lender!=address(0) && collateral!=0 && principal!=0, "invalid loan");
        require(aprBps == FIXED_APR_BPS && (term==30 days || term==90 days || term==180 days), "invalid terms");
        id=nextLoanId++;
        uint48 start=uint48(block.timestamp);
        loans[id]=Loan(borrower,lender,collateral,principal,principal,0,0,aprBps,start,start,start+term,start+term+7 days,State.ACTIVE,false,0,0);
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
    /// @notice The fee presently due. The 2% fee is previewed once grace has begun.
    function previewLateFee(uint256 id) public view returns(uint256) {
        Loan memory l = loans[id]; require(l.borrower != address(0), "missing loan");
        if(l.lateFeeAssessed || l.state==State.REPAID || l.state==State.CLOSED || l.state==State.LIQUIDATED) return l.fees;
        if(block.timestamp <= l.maturity) return l.fees;
        return (uint256(l.principalOutstanding) + previewAccruedInterest(id)) * LATE_FEE_BPS / BPS;
    }
    /// @notice Exact current obligation if repaid now, calculated without a state write.
    function previewOutstanding(uint256 id) public view returns(uint256) {
        Loan memory l = loans[id]; require(l.borrower != address(0), "missing loan");
        return uint256(l.principalOutstanding) + previewAccruedInterest(id) + previewLateFee(id);
    }
    /// @notice Contractual total repayment if the remaining principal is paid at maturity, plus an already-triggered late fee.
    function previewTotalRepayment(uint256 id) external view returns(uint256) {
        Loan memory l = loans[id]; require(l.borrower != address(0), "missing loan");
        if(l.state==State.REPAID || l.state==State.CLOSED || l.state==State.LIQUIDATED) return previewOutstanding(id);
        uint256 remainingSeconds = l.maturity > l.lastAccrual ? l.maturity - l.lastAccrual : 0;
        uint256 interestAtMaturity = uint256(l.accruedInterest) + (uint256(l.principalOutstanding) * l.aprBps * remainingSeconds) / (BPS * YEAR);
        return uint256(l.principalOutstanding) + interestAtMaturity + previewLateFee(id);
    }
    /// @notice State implied by time at the current block, without persisting a transition.
    function previewLoanStatus(uint256 id) public view returns(State) {
        Loan memory l = loans[id]; require(l.borrower != address(0), "missing loan");
        if(l.state != State.ACTIVE) {
            if(l.state == State.GRACE_PERIOD && block.timestamp > l.graceEnd) return State.DEFAULTED;
            return l.state;
        }
        if(block.timestamp > l.graceEnd) return State.DEFAULTED;
        if(block.timestamp > l.maturity) return State.GRACE_PERIOD;
        return State.ACTIVE;
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
        // The exact maturity timestamp is still payable at the contracted schedule amount.
        // Grace (and its one-time late fee) begins only after that timestamp.
        if(l.state==State.ACTIVE && block.timestamp>l.maturity){
            l.state=State.GRACE_PERIOD;
            if(!l.lateFeeAssessed){uint256 fee=(uint256(l.principalOutstanding)+l.accruedInterest)*LATE_FEE_BPS/BPS;l.fees=uint128(fee);l.lateFeeAssessed=true;emit FeeAssessed(id,fee);}
            emit LoanStateChanged(id,State.ACTIVE,State.GRACE_PERIOD);
        }
        if(l.state==State.GRACE_PERIOD && block.timestamp>l.graceEnd){l.state=State.DEFAULTED;emit LoanStateChanged(id,State.GRACE_PERIOD,State.DEFAULTED);}
    }
    function repay(uint256 id,address payer,uint256 amount) external onlyRole(LOAN_OPERATOR_ROLE) returns(uint256 fee,uint256 interest,uint256 principal){Loan storage l=loans[id];require(l.state==State.ACTIVE||l.state==State.GRACE_PERIOD,"repay unavailable");accrue(id);fee=amount>l.fees?l.fees:amount;l.fees-=uint128(fee);amount-=fee;interest=amount>l.accruedInterest?l.accruedInterest:amount;l.accruedInterest-=uint128(interest);amount-=interest;principal=amount>l.principalOutstanding?l.principalOutstanding:amount;l.principalOutstanding-=uint128(principal);if(l.principalOutstanding==0&&l.accruedInterest==0&&l.fees==0){State p=l.state;l.state=State.REPAID;emit LoanStateChanged(id,p,State.REPAID);}emit RepaymentApplied(id,payer,fee+interest+principal,fee,interest,principal,uint256(l.principalOutstanding)+l.accruedInterest+l.fees);}
    function liquidate(uint256 id,uint256 debtCovered,uint256 reserve,uint256 badDebt) external onlyRole(LOAN_OPERATOR_ROLE){
        Loan storage l=loans[id];require(l.state==State.ACTIVE||l.state==State.GRACE_PERIOD||l.state==State.DEFAULTED,"not liquidatable");
        uint256 debt = uint256(l.principalOutstanding) + l.accruedInterest + l.fees;
        require(debtCovered + reserve + badDebt == debt, "settlement mismatch");
        l.principalOutstanding=0;l.accruedInterest=0;l.fees=0;l.reserveContribution=uint128(reserve);l.badDebt=uint128(badDebt);
        State p=l.state;l.state=State.LIQUIDATED;emit LoanStateChanged(id,p,State.LIQUIDATED);
        if(reserve!=0||badDebt!=0)emit BadDebtRecorded(id,reserve,badDebt);
    }
    function close(uint256 id) external onlyRole(LOAN_OPERATOR_ROLE){Loan storage l=loans[id];require(l.state==State.REPAID,"not repaid");l.state=State.CLOSED;emit LoanStateChanged(id,State.REPAID,State.CLOSED);}
}
