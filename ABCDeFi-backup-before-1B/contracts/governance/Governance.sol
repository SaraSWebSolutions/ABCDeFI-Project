// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";

/**
 * @title Governance (ABCDeFi Protocol On-Chain Governance DAO)
 * @notice Implements:
 * - Create Proposal
 * - Vote (Support / Against with Voting Weight)
 * - Execute Proposal
 * - Treasury Vote (Treasury Allocation Proposals)
 */
contract Governance is AccessControl, ReentrancyGuard {
    enum ProposalCategory { General, ProtocolUpgrade, FeeRate, TreasuryAllocation }

    struct Proposal {
        uint256 proposalId;
        address proposer;
        ProposalCategory category;
        string title;
        string description;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 startTime;
        uint256 endTime;
        bool executed;
    }

    uint256 private _nextProposalId = 1;
    uint256 public totalProposals;

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, ProposalCategory category, string title);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId);
    event TreasuryVoteExecuted(uint256 indexed proposalId, uint256 amountAllocated);

    constructor(address admin) {
        if (admin == address(0)) revert Errors.InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Constants.GOVERNANCE_ROLE, admin);
    }

    /**
     * @notice Create Proposal
     */
    function createProposal(
        string calldata title,
        string calldata description,
        ProposalCategory category,
        uint256 durationSeconds
    ) external nonReentrant returns (uint256 proposalId) {
        if (bytes(title).length == 0) revert Errors.InvalidParameter("Empty title");

        proposalId = _nextProposalId++;
        proposals[proposalId] = Proposal({
            proposalId: proposalId,
            proposer: msg.sender,
            category: category,
            title: title,
            description: description,
            forVotes: 0,
            againstVotes: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + durationSeconds,
            executed: false
        });

        totalProposals++;
        emit ProposalCreated(proposalId, msg.sender, category, title);
        return proposalId;
    }

    /**
     * @notice Vote on Proposal
     */
    function vote(uint256 proposalId, bool support) external nonReentrant {
        Proposal storage prop = proposals[proposalId];
        if (block.timestamp < prop.startTime || block.timestamp > prop.endTime) revert Errors.InvalidState();
        if (hasVoted[proposalId][msg.sender]) revert Errors.AlreadyProcessed();

        hasVoted[proposalId][msg.sender] = true;
        uint256 weight = 100; // Standard voting weight unit

        if (support) {
            prop.forVotes += weight;
        } else {
            prop.againstVotes += weight;
        }

        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    /**
     * @notice Execute Proposal
     */
    function executeProposal(uint256 proposalId) external nonReentrant {
        Proposal storage prop = proposals[proposalId];
        if (block.timestamp <= prop.endTime) revert Errors.InvalidState();
        if (prop.executed) revert Errors.AlreadyProcessed();
        if (prop.forVotes <= prop.againstVotes) revert Errors.InvalidState();

        prop.executed = true;
        emit ProposalExecuted(proposalId);
    }

    /**
     * @notice Treasury Vote Execution
     */
    function treasuryVote(uint256 proposalId, uint256 amountAllocated) external onlyRole(Constants.GOVERNANCE_ROLE) nonReentrant {
        Proposal storage prop = proposals[proposalId];
        if (prop.category != ProposalCategory.TreasuryAllocation) revert Errors.InvalidParameter("Not treasury proposal");
        if (prop.executed) revert Errors.AlreadyProcessed();

        prop.executed = true;
        emit TreasuryVoteExecuted(proposalId, amountAllocated);
    }
}
