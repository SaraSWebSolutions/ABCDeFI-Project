// ============================================================================
// ABCDeFi Governance & Community Voting Engine
// Features: Proposals, Voting, Decision Making, Protocol Upgrades
// ============================================================================

export interface DAOProposal {
  id: string;
  proposer: string;
  title: string;
  category: 'Protocol Upgrade' | 'Fee Rate' | 'Treasury Allocation' | 'New Feature';
  description: string;
  forVotes: number;
  againstVotes: number;
  status: 'Active' | 'Succeeded' | 'Defeated' | 'Executed';
  endTime: string;
  voted: boolean;
}

export const COMMUNITY_PROPOSALS: DAOProposal[] = [
  {
    id: 'PROP-101',
    proposer: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    title: 'VIP Staking Yield Boost (+2% APY for Pool 3)',
    category: 'Protocol Upgrade',
    description: 'Increase Pool 3 (VIP) APY from 25% to 27% for 180-day stakers to reward long-term token holders.',
    forVotes: 1250000,
    againstVotes: 120000,
    status: 'Active',
    endTime: '2026-08-05',
    voted: true,
  },
  {
    id: 'PROP-102',
    proposer: '0x3C44CdD66a900fa2b585dd299e03d12FA4293BC',
    title: 'Reduce Loan Origination Fee to 1.0%',
    category: 'Fee Rate',
    description: 'Lower protocol loan origination fee from 1.5% to 1.0% to increase borrowing competitiveness.',
    forVotes: 980000,
    againstVotes: 450000,
    status: 'Active',
    endTime: '2026-08-08',
    voted: false,
  },
  {
    id: 'PROP-103',
    proposer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    title: 'Allocate $250k Treasury Grant to University Scholarships',
    category: 'Treasury Allocation',
    description: 'Provide full scholarships and gas subsidies for students completing the Financial Education University program.',
    forVotes: 2100000,
    againstVotes: 50000,
    status: 'Succeeded',
    endTime: '2026-07-25',
    voted: true,
  },
];

/**
 * Cast vote on proposal
 */
export async function voteOnProposal(proposalId: string, support: boolean): Promise<void> {
  await new Promise((r) => setTimeout(r, 500));
  const prop = COMMUNITY_PROPOSALS.find((p) => p.id === proposalId);
  if (prop) {
    prop.voted = true;
    if (support) prop.forVotes += 10000;
    else prop.againstVotes += 10000;
  }
}
