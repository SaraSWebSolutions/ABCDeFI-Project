// ==========================================
// Step 14: AI Financial Assistant Knowledge Base
// ==========================================

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  category?: 'staking' | 'borrowing' | 'portfolio' | 'loan' | 'general';
}

export interface AISuggestion {
  label: string;
  query: string;
  category: 'staking' | 'borrowing' | 'portfolio' | 'loan';
  icon: string;
}

const KB: Record<string, { keywords: string[]; category: AIMessage['category']; answer: string }> = {
  'how-to-stake': {
    keywords: ['stake', 'staking', 'how to stake', 'stake abcd', 'earn yield'],
    category: 'staking',
    answer: `## 🥩 How to Stake on ABCDeFi

**Staking** lets you lock ABCD tokens into our protocol to earn passive yield rewards.

### Step-by-Step Guide:
1. **Connect Your Wallet** — Use MetaMask or any WalletConnect-compatible wallet on Sepolia.
2. **Navigate to the Staking tab** — Click "Staking" in the top navigation bar.
3. **Choose a Staking Pool:**
   - 🥩 **Pool 1 (Standard)** — 12% APY, 30-day lock, minimum 100 ABCD
   - 🔥 **Pool 2 (Premium)** — 18% APY, 90-day lock, minimum 500 ABCD
   - 💎 **Pool 3 (VIP)** — 25% APY, 180-day lock, minimum 2,000 ABCD
4. **Enter Amount** — Type the ABCD amount you wish to stake.
5. **Approve & Stake** — Confirm the approval transaction, then the stake transaction in MetaMask.
6. **Earn Rewards** — Rewards accrue every block and can be claimed anytime.

### Key Facts:
- 📅 Lock Period: Tokens are locked for the pool duration.
- 💰 Rewards: Claimable anytime, no lock on reward tokens.
- 🛡️ Security: Staking is governed by the audited StakingPool.sol contract.
- 🎓 Credit Score Boost: Staking increases your wallet activity score.

> **Tip:** Stake in Pool 3 for the highest APY (25%) and faster Reputation NFT Level upgrades!`,
  },

  'how-to-borrow': {
    keywords: ['borrow', 'borrowing', 'how to borrow', 'take loan', 'get loan', 'borrow abcd'],
    category: 'borrowing',
    answer: `## 💳 How to Borrow on ABCDeFi

**Borrowing** allows you to take ABCD token loans by depositing ETH as collateral. You keep ETH exposure while unlocking liquidity.

### Step-by-Step Guide:
1. **Connect Wallet** — Ensure MetaMask is connected on Sepolia testnet.
2. **Navigate to "Lending & Borrowing"** — Click the Lending tab in the header.
3. **Deposit ETH Collateral:**
   - Go to the **Loan Marketplace** tab.
   - Click **"Create New Loan"**.
   - Enter ETH collateral amount and desired ABCD borrow amount.
4. **Set Loan Terms:**
   - Choose duration (7d / 30d / 90d / 180d / 365d).
   - Review the calculated APY (5%–14% based on your Credit Score).
5. **Submit Loan Request** — Wait for a lender to fund your loan.
6. **Receive ABCD** — Once funded, ABCD tokens are transferred to your wallet.
7. **Repay on Time** — Pay monthly EMI installments to avoid margin calls.

### LTV & Risk Limits (by Credit Score):
| Reputation Level | Max LTV | Interest APY |
|---|---|---|
| 🥉 Bronze | 60% | 14.0% |
| 🥈 Silver | 70% | 11.0% |
| 🥇 Gold | 75% | 8.0% |
| 💎 Platinum | 85% | 5.0% |

> **Warning:** If your LTV rises above 85%, a margin call is triggered. Above 90%, your collateral may be liquidated.`,
  },

  'portfolio-explanation': {
    keywords: ['portfolio', 'my portfolio', 'holdings', 'assets', 'explain portfolio', 'my assets', 'balance'],
    category: 'portfolio',
    answer: `## 📊 Your ABCDeFi Portfolio Explained

Your **portfolio** is a unified view of all your positions and balances across the ABCDeFi ecosystem.

### Portfolio Components:

#### 1. 💰 Token Holdings
- **ABCD Balance** — Your liquid ABCD token balance, spendable for staking, lending, or NFT purchases.
- **ETH Balance** — Your native Sepolia ETH balance used as collateral or gas.

#### 2. 🥩 Staking Positions
- Active stakes across Pool 1, 2, and 3.
- Accrued but unclaimed staking rewards.
- Lock expiry dates and early withdrawal penalties.

#### 3. 🏦 Lending Positions
- ETH collateral currently locked in the LendingPool.sol contract.
- Outstanding ABCD borrow balance.
- Health Factor (HF) — Must stay above 1.0 to avoid liquidation.
- Monthly EMI schedule and next payment due date.

#### 4. 🎨 NFT Assets
- Loan NFTs (Borrower & Lender certificates).
- Reputation Soulbound NFT (Bronze / Silver / Gold / Platinum).
- Marketplace NFTs and collectibles.

#### 5. 🏆 Credit Score (300–850)
Calculated from:
- ✅ Loans Repaid (+25 pts each)
- ⚠️ Late Payments (−30 pts each)
- ❌ Liquidations (−75 pts each)
- 👥 Referrals (+15 pts each)
- 📅 Wallet Age (+1 pt per 30 days)

> **Tip:** Navigate to the **Credit Score & Reputation** tab to simulate your score and level up your Reputation NFT!`,
  },

  'loan-explanation': {
    keywords: ['loan', 'explain loan', 'what is a loan', 'loan details', 'how loans work', 'loan nft', 'emi'],
    category: 'loan',
    answer: `## 🏦 ABCDeFi Loan System Explained

ABCDeFi uses a **peer-to-peer collateralized lending** model where borrowers lock ETH to receive ABCD loans.

### How a Loan Works:

#### 1. Loan Lifecycle:
\`\`\`
Requested → Funded (Active) → Repaid
                   ↓
             Defaulted / Liquidated
\`\`\`

#### 2. Loan Details (All 9 Fields):
| Field | Description |
|---|---|
| **Borrower** | Wallet address of the loan requester |
| **Lender** | Wallet address of the funder |
| **Amount** | ABCD tokens borrowed |
| **Interest APY** | Annual rate (5%–14%) |
| **Duration** | Loan term (7d–365d) |
| **Status** | Requested / Active / Repaid / Defaulted |
| **Collateral** | ETH locked + LTV ratio |
| **Due Date** | Final repayment deadline |
| **Remaining Balance** | Outstanding ABCD owed |

#### 3. EMI System:
- Payments split into equal **Monthly EMI** installments.
- Auto-calculated as: \`EMI = P × r(1+r)^n / ((1+r)^n − 1)\`
- **Next Payment Date** tracked on-chain.

#### 4. Margin Call Thresholds:
| LTV | Alert Level |
|---|---|
| 75% | ⚠️ Warning |
| 85% | 🔴 Critical |
| 90%+ | 💀 Liquidation |

#### 5. Loan NFTs:
When a loan is funded, two Soulbound NFTs are minted:
- 🟦 **Borrower NFT** — Proof of debt obligation.
- 🟩 **Lender NFT** — Proof of funded position.

> **Tip:** Repay loans on time to boost your Credit Score and unlock Gold / Platinum Reputation NFT levels!`,
  },

  'referral': {
    keywords: ['referral', 'refer', 'invite', 'referral rewards', 'refer a friend'],
    category: 'general',
    answer: `## 👥 ABCDeFi Referral System

Earn ABCD rewards by inviting friends to the platform!

### How Referrals Work:
1. Get your unique referral link from the **Referral** tab.
2. Share with friends.
3. When they stake or borrow, you earn **10% of their transaction as ABCD reward**.
4. Each successful referral also adds **+15 Credit Score points** to your profile.

> Referral rewards are claimable any time from the Dashboard.`,
  },

  'vesting': {
    keywords: ['vesting', 'vesting schedule', 'claim vesting', 'unlock tokens'],
    category: 'general',
    answer: `## ⏳ ABCDeFi Token Vesting

Token vesting ensures early participants receive ABCD over a structured schedule rather than all at once.

### Vesting Schedule:
- **Cliff Period**: 30 days — no tokens unlock during this period.
- **Vesting Duration**: 12 months linear vesting after the cliff.
- **Claimable**: Tokens unlock proportionally each second after the cliff.

### How to Claim:
1. Navigate to the **Vesting** tab.
2. View your claimable amount.
3. Click **"Claim Vested Tokens"** to withdraw unlocked ABCD.

> Check the Dashboard card "Claimable Vesting" for your current claimable balance!`,
  },

  'liquidation': {
    keywords: ['liquidation', 'liquidate', 'liquidated', 'margin call', 'health factor'],
    category: 'borrowing',
    answer: `## ⚠️ Liquidation & Margin Call System

Liquidation protects lenders if collateral values fall and a borrower's debt becomes under-collateralized.

### Liquidation Thresholds:
| LTV | Status |
|---|---|
| < 75% | ✅ Safe |
| 75% | ⚠️ Warning — Add collateral |
| 85% | 🔴 Critical — Liquidation imminent |
| ≥ 90% | 💀 Liquidated — Collateral seized |

### Health Factor (HF):
- **HF > 1.5** — Healthy
- **HF 1.0–1.5** — At risk
- **HF < 1.0** — Liquidatable

### How to Avoid Liquidation:
1. Monitor your LTV in the **Margin Call System** tab.
2. Add more ETH collateral if LTV rises.
3. Partially repay your ABCD loan to reduce the ratio.

> The Margin Call system in ABCDeFi includes an ETH price stress tester to simulate liquidation scenarios before they happen!`,
  },
};

function findBestAnswer(query: string): { answer: string; category: AIMessage['category'] } {
  const q = query.toLowerCase().trim();
  let bestMatch: { score: number; key: string } = { score: 0, key: '' };

  for (const [key, entry] of Object.entries(KB)) {
    const score = entry.keywords.reduce((acc, kw) => {
      if (q.includes(kw.toLowerCase())) return acc + kw.split(' ').length * 2;
      return acc;
    }, 0);
    if (score > bestMatch.score) bestMatch = { score, key };
  }

  if (bestMatch.score > 0) {
    const entry = KB[bestMatch.key];
    return { answer: entry.answer, category: entry.category };
  }

  // Default fallback
  return {
    category: 'general',
    answer: `## 🤖 ABCDeFi AI Assistant

I can help you with the following topics:

- 🥩 **"How to stake"** — Earn yield on your ABCD tokens
- 💳 **"How to borrow"** — Take ABCD loans using ETH collateral
- 📊 **"Explain my portfolio"** — Understand your positions and balances
- 🏦 **"Explain loans"** — How the ABCDeFi loan system works
- 👥 **"Referral rewards"** — Earn by inviting friends
- ⏳ **"Vesting schedule"** — Claim your vested ABCD tokens
- ⚠️ **"Liquidation"** — Understand margin calls and risk

> Try asking one of the above questions and I'll give you a detailed guide!`,
  };
}

export async function getAIResponse(query: string): Promise<{ answer: string; category: AIMessage['category'] }> {
  // Simulate AI processing delay
  await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
  return findBestAnswer(query);
}

export const AI_SUGGESTIONS: AISuggestion[] = [
  { label: 'How to Stake?', query: 'How do I stake my ABCD tokens and earn yield?', category: 'staking', icon: '🥩' },
  { label: 'How to Borrow?', query: 'How do I borrow ABCD tokens using ETH collateral?', category: 'borrowing', icon: '💳' },
  { label: 'Explain My Portfolio', query: 'Explain my portfolio and all my positions', category: 'portfolio', icon: '📊' },
  { label: 'How Do Loans Work?', query: 'Explain how loans work on ABCDeFi', category: 'loan', icon: '🏦' },
];
