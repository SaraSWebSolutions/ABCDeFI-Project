// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";

interface IERC20Votes {
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title ABCDeFiGovernor (On-Chain Governance & DAO Voting)
 * @notice Handles community proposals, voting, decision making, and protocol upgrades.
 */
contract ABCDeFiGovernor is AccessControl, ReentrancyGuard {
    enum ProposalState { Pending, Active, Defeated, Succeeded, Executed }

    struct Proposal {
        uint256 proposalId;
        address proposer;
        string title;
        string description;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 startTime;
        uint256 endTime;
        bool executed;
    }

    IERC20Votes public abcdToken;
    uint256 private _nextProposalId = 1;
    uint256 public totalProposals;

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string title, uint256 startTime, uint256 endTime);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId);

    constructor(address admin, address _abcdToken) {
        if (admin == address(0)) revert Errors.InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Constants.GOVERNANCE_ROLE, admin);

        abcdToken = IERC20Votes(_abcdToken);
    }

    /**
     * @notice Create a community governance proposal
     */
    function createProposal(
        string calldata title,
        string calldata description,
        uint256 votingDurationSeconds
    ) external nonReentrant returns (uint256 proposalId) {
        if (bytes(title).length == 0) revert Errors.InvalidParameter("Title empty");

        proposalId = _nextProposalId++;
        uint256 startTime = block.timestamp;
        uint256 endTime = block.timestamp + votingDurationSeconds;

        proposals[proposalId] = Proposal({
            proposalId: proposalId,
            proposer: msg.sender,
            title: title,
            description: description,
            forVotes: 0,
            againstVotes: 0,
            startTime: startTime,
            endTime: endTime,
            executed: false
        });

        totalProposals++;
        emit ProposalCreated(proposalId, msg.sender, title, startTime, endTime);
        return proposalId;
    }

    /**
     * @notice Cast a vote on an active proposal
     */
    function castVote(uint256 proposalId, bool support) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        if (block.timestamp < proposal.startTime || block.timestamp > proposal.endTime) revert Errors.InvalidState();
        if (hasVoted[proposalId][msg.sender]) revert Errors.AlreadyProcessed();

        uint256 weight = 100; // 1 Vote default weight or token balance
        if (address(abcdToken) != address(0)) {
            uint256 bal = abcdToken.balanceOf(msg.sender);
            if (bal > 0) weight = bal;
        }

        hasVoted[proposalId][msg.sender] = true;
        if (support) {
            proposal.forVotes += weight;
        } else {
            proposal.againstVotes += weight;
        }

        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    /**
     * @notice Execute a succeeded proposal
     */
    function executeProposal(uint256 proposalId) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        if (block.timestamp <= proposal.endTime) revert Errors.InvalidState();
        if (proposal.executed) revert Errors.AlreadyProcessed();
        if (proposal.forVotes <= proposal.againstVotes) revert Errors.InvalidState();

        proposal.executed = true;
        emit ProposalExecuted(proposalId);
    }
}
