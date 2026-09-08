// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./LoanManagerV2.sol";

/// @notice Lending-only referral accounting. It is deliberately independent
/// from the legacy presale ReferralManager and the LoanNFTV2 lifecycle.
///
/// Monthly rewards are 5 BPS of the originated principal per completed
/// 30-day period. This explicit accounting policy is immutable here: rewards
/// are funded from an approved Marketing allocation wallet, never minted.
contract LendingReferralManagerV2 is ERC721URIStorage, AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant LENDING_REFERRAL_OPERATOR_ROLE = keccak256("LENDING_REFERRAL_OPERATOR_ROLE");
    uint16 public constant MONTHLY_REWARD_BPS = 5;
    uint16 public constant REFERRAL_NFT_VALUE_BPS = 50;
    uint8 public constant MAX_REWARD_PERIODS = 12;
    uint48 public constant REWARD_PERIOD = 30 days;
    uint256 private constant BPS = 10_000;
    uint256 private constant YEAR = 365 days;

    struct LoanReferral {
        address referrer;
        address referred;
        uint256 requestId;
        uint128 monthlyReward;
        uint128 totalRewards;
        uint48 startedAt;
        uint48 completedAt;
        uint8 paidPeriods;
        bool isLenderReferral;
        bool registered;
        bool referralNftMinted;
    }

    struct ReferralCertificate {
        uint256 loanId;
        uint256 requestId;
        address referrer;
        address referred;
        uint256 value;
        bool isLenderReferral;
        bytes32 metadataHash;
    }

    IERC20 public immutable abcd;
    LoanManagerV2 public immutable loanManager;
    address public rewardVault;
    uint256 public nextCertificateId = 1;

    mapping(address => string) public userReferralCode;
    mapping(string => address) public codeToUser;
    mapping(address => address) public referrerOf;
    mapping(uint256 => mapping(address => LoanReferral)) private _loanReferrals;
    mapping(uint256 => ReferralCertificate) private _certificates;

    event ReferralCodeCreated(address indexed user, string code);
    event LendingReferrerBound(address indexed referred, address indexed referrer);
    event LendingReferralRegistered(uint256 indexed loanId, uint256 indexed requestId, address indexed referrer, address referred, bool isLenderReferral, uint256 monthlyReward);
    event LendingReferralRewardPaid(uint256 indexed loanId, address indexed referrer, address indexed referred, uint256 period, uint256 amount, uint256 totalRewards);
    event LendingReferralCompleted(uint256 indexed loanId, uint256 completedAt);
    event LendingReferralCertificateMinted(uint256 indexed tokenId, uint256 indexed loanId, address indexed referrer, address referred, uint256 value, bool isLenderReferral, bytes32 metadataHash, string metadataURI);
    event RewardVaultUpdated(address indexed previousVault, address indexed newVault);

    constructor(address admin, address abcd_, address manager_, address rewardVault_)
        ERC721("ABCDeFi Lending Referral Certificate", "ABCD-LREF")
    {
        require(admin != address(0) && abcd_ != address(0) && manager_ != address(0) && rewardVault_ != address(0), "invalid address");
        abcd = IERC20(abcd_);
        loanManager = LoanManagerV2(manager_);
        rewardVault = rewardVault_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(LENDING_REFERRAL_OPERATOR_ROLE, admin);
    }

    function setRewardVault(address newRewardVault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newRewardVault != address(0), "invalid vault");
        address previous = rewardVault;
        rewardVault = newRewardVault;
        emit RewardVaultUpdated(previous, newRewardVault);
    }

    function createReferralCode(string calldata code) external whenNotPaused {
        require(bytes(code).length >= 4, "code too short");
        require(bytes(userReferralCode[msg.sender]).length == 0, "code exists");
        require(codeToUser[code] == address(0), "code taken");
        userReferralCode[msg.sender] = code;
        codeToUser[code] = msg.sender;
        emit ReferralCodeCreated(msg.sender, code);
    }

    function bindReferrer(string calldata code) external whenNotPaused {
        require(referrerOf[msg.sender] == address(0), "referrer exists");
        address referrer = codeToUser[code];
        require(referrer != address(0), "invalid referral code");
        require(referrer != msg.sender, "self referral");
        referrerOf[msg.sender] = referrer;
        emit LendingReferrerBound(msg.sender, referrer);
    }

    /// @notice Called only after a direct loan disburses or a P2P request is funded.
    /// A request alone never registers a rewardable lending relationship.
    function registerLoan(uint256 loanId, uint256 requestId, bool isP2P)
        external onlyRole(LENDING_REFERRAL_OPERATOR_ROLE) whenNotPaused
    {
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        require(loan.borrower != address(0) && loan.state == LoanManagerV2.State.ACTIVE, "loan not active");
        require(isP2P ? requestId != 0 : requestId == 0, "request association");
        _register(loanId, requestId, loan.borrower, false, loan);
        _register(loanId, requestId, loan.lender, true, loan);
    }

    function _register(uint256 loanId, uint256 requestId, address referred, bool isLenderReferral, LoanManagerV2.Loan memory loan) private {
        address referrer = referrerOf[referred];
        if (referrer == address(0)) return;
        LoanReferral storage record = _loanReferrals[loanId][referred];
        require(!record.registered, "loan referral exists");
        uint256 reward = uint256(loan.principal) * MONTHLY_REWARD_BPS / BPS;
        record.referrer = referrer;
        record.referred = referred;
        record.requestId = requestId;
        record.monthlyReward = uint128(reward);
        record.startedAt = loan.start;
        record.isLenderReferral = isLenderReferral;
        record.registered = true;
        emit LendingReferralRegistered(loanId, requestId, referrer, referred, isLenderReferral, reward);
    }

    /// @notice Records the actual close timestamp so rewards cannot be claimed
    /// for periods after an early repayment.
    function recordLoanCompletion(uint256 loanId) external onlyRole(LENDING_REFERRAL_OPERATOR_ROLE) whenNotPaused {
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        require(loan.state == LoanManagerV2.State.CLOSED, "loan not closed");
        bool updated;
        updated = _recordCompletion(loanId, loan.borrower) || updated;
        updated = _recordCompletion(loanId, loan.lender) || updated;
        if (updated) emit LendingReferralCompleted(loanId, uint48(block.timestamp));
    }

    function _recordCompletion(uint256 loanId, address referred) private returns (bool) {
        LoanReferral storage record = _loanReferrals[loanId][referred];
        if (!record.registered || record.completedAt != 0) return false;
        record.completedAt = uint48(block.timestamp);
        return true;
    }

    /// @notice Pays exactly one completed monthly period and cannot pay beyond
    /// the loan term or twelve periods. Defaulted/liquidated loans are blocked.
    function claimMonthlyReward(uint256 loanId, address referred) external nonReentrant whenNotPaused returns (uint256 amount) {
        LoanReferral storage record = _loanReferrals[loanId][referred];
        require(record.registered && record.referrer == msg.sender, "not referral owner");
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        require(loan.state != LoanManagerV2.State.DEFAULTED && loan.state != LoanManagerV2.State.LIQUIDATED, "rewards stopped");
        require(loan.state == LoanManagerV2.State.ACTIVE || loan.state == LoanManagerV2.State.GRACE_PERIOD || loan.state == LoanManagerV2.State.MARGIN_CALL || loan.state == LoanManagerV2.State.CLOSED, "reward unavailable");
        uint256 availablePeriods = _availablePeriods(loan, record);
        require(record.paidPeriods < availablePeriods, "no reward due");
        amount = record.monthlyReward;
        require(amount != 0, "zero reward");
        record.paidPeriods += 1;
        record.totalRewards += uint128(amount);
        abcd.safeTransferFrom(rewardVault, msg.sender, amount);
        emit LendingReferralRewardPaid(loanId, msg.sender, referred, record.paidPeriods, amount, record.totalRewards);
    }

    function _availablePeriods(LoanManagerV2.Loan memory loan, LoanReferral memory record) private view returns (uint256) {
        uint256 termPeriods = (uint256(loan.maturity) - uint256(loan.start)) / REWARD_PERIOD;
        if (termPeriods > MAX_REWARD_PERIODS) termPeriods = MAX_REWARD_PERIODS;
        uint256 endAt = record.completedAt == 0 ? block.timestamp : record.completedAt;
        uint256 elapsedPeriods = endAt > loan.start ? (endAt - loan.start) / REWARD_PERIOD : 0;
        return elapsedPeriods < termPeriods ? elapsedPeriods : termPeriods;
    }

    /// @notice A 0.5% accounting certificate can be minted only after the
    /// associated loan closes successfully. It has no redemption or payout.
    function mintReferralCertificate(uint256 loanId, address referred, string calldata metadataURI, bytes32 metadataHash)
        external whenNotPaused nonReentrant returns (uint256 tokenId)
    {
        LoanReferral storage record = _loanReferrals[loanId][referred];
        require(record.registered && record.referrer == msg.sender, "not referral owner");
        require(!record.referralNftMinted, "certificate exists");
        require(bytes(metadataURI).length != 0 && metadataHash == keccak256(bytes(metadataURI)), "invalid provenance");
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        require(loan.state == LoanManagerV2.State.CLOSED && record.completedAt != 0, "loan not completed");
        uint256 agreedInterest = uint256(loan.principal) * loan.aprBps * (uint256(loan.maturity) - uint256(loan.start)) / (BPS * YEAR);
        uint256 value = (uint256(loan.principal) + agreedInterest) * REFERRAL_NFT_VALUE_BPS / BPS;
        tokenId = nextCertificateId++;
        record.referralNftMinted = true;
        _certificates[tokenId] = ReferralCertificate(loanId, record.requestId, msg.sender, referred, value, record.isLenderReferral, metadataHash);
        _mint(msg.sender, tokenId);
        _setTokenURI(tokenId, metadataURI);
        emit LendingReferralCertificateMinted(tokenId, loanId, msg.sender, referred, value, record.isLenderReferral, metadataHash, metadataURI);
    }

    function getLoanReferral(uint256 loanId, address referred) external view returns (LoanReferral memory) { return _loanReferrals[loanId][referred]; }
    function getReferralCertificate(uint256 tokenId) external view returns (ReferralCertificate memory) { return _certificates[tokenId]; }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        require(from == address(0) || to == address(0), "non-transferable");
        return super._update(to, tokenId, auth);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
