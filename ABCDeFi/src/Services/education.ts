// ============================================================================
// ABCDeFi Financial Education University Engine
// Features: Courses, Teachers, Learning Paths, Exams, Certificates, Progress Tracking, Financial Literacy Program
// ============================================================================

export interface Teacher {
  id: string;
  name: string;
  title: string;
  bio: string;
  avatarUrl: string;
  coursesTaught: string[];
  rating: number;
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  duration: string;
  totalCourses: number;
  creditHours: number;
  icon: string;
  courses: string[]; // Course IDs
  level: 'Beginner' | 'Intermediate' | 'Advanced';
}

export interface FinancialLiteracyModule {
  id: string;
  title: string;
  topic: 'Savings' | 'Debt & Interest' | 'Budgeting' | 'Inflation' | 'Investments';
  description: string;
  readTime: string;
  completed: boolean;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string;
  lessons: number;
  category: 'DeFi' | 'CeFi' | 'NFT' | 'Trading' | 'Blockchain';
  icon: string;
  color: string;
  enrolled: boolean;
  progress: number; // 0-100
  teacherId: string;
  videoUrl?: string;
}

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  duration: string;
  videoUrl: string;
  completed: boolean;
  description: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  category: string;
}

export interface Certificate {
  id: string;
  courseId: string;
  courseTitle: string;
  recipientName: string;
  walletAddress: string;
  issuedDate: string;
  level: string;
  tokenId: string;
}

// 1. TEACHERS / INSTRUCTORS DIRECTORY
export const TEACHERS: Teacher[] = [
  {
    id: 'teacher-1',
    name: 'Dr. Satoshi Vance',
    title: 'Head of Decentralized Economics',
    bio: 'PhD in Cryptoeconomics from MIT. Former Senior Protocol Engineer at Ethereum Foundation.',
    avatarUrl: '👨‍🏫',
    coursesTaught: ['course-1', 'course-5'],
    rating: 4.9,
  },
  {
    id: 'teacher-2',
    name: 'Prof. Elena Rostova',
    title: 'Professor of Yield & DeFi Strategies',
    bio: 'Lead Quant Strategist with 12+ years managing automated yield aggregators.',
    avatarUrl: '👩‍🏫',
    coursesTaught: ['course-2', 'course-3'],
    rating: 4.95,
  },
  {
    id: 'teacher-3',
    name: 'Master Dev Liam Chen',
    title: 'Smart Contract Architecture Lead',
    bio: 'Core Security Auditor & Solidity instructor. Audited $2B+ in TVL smart contracts.',
    avatarUrl: '👨‍💻',
    coursesTaught: ['course-4', 'course-6'],
    rating: 4.88,
  },
];

// 2. LEARNING PATHS TRACKS
export const LEARNING_PATHS: LearningPath[] = [
  {
    id: 'path-1',
    title: 'DeFi & Yield Master Track',
    description: 'Complete path from wallet fundamentals to advanced yield farming and collateralized lending strategies.',
    duration: '9 Hours',
    totalCourses: 3,
    creditHours: 12,
    icon: '🚀',
    courses: ['course-1', 'course-2', 'course-3'],
    level: 'Intermediate',
  },
  {
    id: 'path-2',
    title: 'CeDeFi Credit & Reputation Expert',
    description: 'Master on-chain credit scores, Soulbound Reputation NFTs, and zero-fee VIP privileges.',
    duration: '6 Hours',
    totalCourses: 2,
    creditHours: 8,
    icon: '🏆',
    courses: ['course-4', 'course-6'],
    level: 'Beginner',
  },
  {
    id: 'path-3',
    title: 'Blockchain Architecture & Smart Contracts',
    description: 'Learn EVM deep dive, Solidity gas optimization, and smart contract security audit methodologies.',
    duration: '12 Hours',
    totalCourses: 2,
    creditHours: 16,
    icon: '⛓️',
    courses: ['course-5'],
    level: 'Advanced',
  },
];

// 3. FINANCIAL LITERACY PROGRAM MODULES
export const FINANCIAL_LITERACY_PROGRAM: FinancialLiteracyModule[] = [
  {
    id: 'lit-1',
    title: 'Understanding Compound Interest & Debt',
    topic: 'Debt & Interest',
    description: 'Learn how interest compounds over time in both traditional loans and automated DeFi EMI schedules.',
    readTime: '8 min',
    completed: true,
  },
  {
    id: 'lit-2',
    title: 'Building a 50/30/20 Crypto-Fiat Budget',
    topic: 'Budgeting',
    description: 'A practical framework for allocating income between essential needs, savings, and DeFi yield assets.',
    readTime: '10 min',
    completed: true,
  },
  {
    id: 'lit-3',
    title: 'Inflation & Purchasing Power Defense',
    topic: 'Inflation',
    description: 'How to protect savings against currency devaluation using stablecoin yield pools.',
    readTime: '12 min',
    completed: false,
  },
  {
    id: 'lit-4',
    title: 'Emergency Reserve Fund Strategy',
    topic: 'Savings',
    description: 'Why keeping 3 to 6 months of living expenses in liquid reserves prevents forced liquidation.',
    readTime: '7 min',
    completed: false,
  },
];

export const COURSES: Course[] = [
  {
    id: 'course-1',
    title: 'DeFi Fundamentals',
    description: 'Master the core concepts of Decentralized Finance — from wallets and tokens to liquidity pools and yield farming.',
    level: 'Beginner',
    duration: '2h 30m',
    lessons: 8,
    category: 'DeFi',
    icon: '🏦',
    color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/40',
    enrolled: true,
    progress: 75,
    teacherId: 'teacher-1',
  },
  {
    id: 'course-2',
    title: 'Staking & Yield Strategies',
    description: 'Learn how to maximize returns through strategic staking, liquidity provision, and compounding rewards.',
    level: 'Intermediate',
    duration: '3h 15m',
    lessons: 10,
    category: 'DeFi',
    icon: '🥩',
    color: 'from-purple-500/20 to-indigo-500/20 border-purple-500/40',
    enrolled: true,
    progress: 40,
    teacherId: 'teacher-2',
  },
  {
    id: 'course-3',
    title: 'Collateralized Lending & Borrowing',
    description: 'Deep dive into how overcollateralized loans work, LTV ratios, EMI schedules, and margin call risk management.',
    level: 'Intermediate',
    duration: '4h 00m',
    lessons: 12,
    category: 'DeFi',
    icon: '💳',
    color: 'from-amber-500/20 to-orange-500/20 border-amber-500/40',
    enrolled: false,
    progress: 0,
    teacherId: 'teacher-2',
  },
  {
    id: 'course-4',
    title: 'NFT Ecosystem & Digital Ownership',
    description: 'Understand ERC-721 tokens, NFT marketplaces, Soulbound tokens, and how Reputation NFTs work in CeDeFi.',
    level: 'Beginner',
    duration: '2h 00m',
    lessons: 6,
    category: 'NFT',
    icon: '🎨',
    color: 'from-pink-500/20 to-rose-500/20 border-pink-500/40',
    enrolled: false,
    progress: 0,
    teacherId: 'teacher-3',
  },
  {
    id: 'course-5',
    title: 'Advanced Blockchain Architecture',
    description: 'Explore EVM internals, Solidity smart contract design patterns, gas optimization, and Sepolia testnet deployment.',
    level: 'Advanced',
    duration: '6h 00m',
    lessons: 18,
    category: 'Blockchain',
    icon: '⛓️',
    color: 'from-cyan-500/20 to-blue-500/20 border-cyan-500/40',
    enrolled: false,
    progress: 0,
    teacherId: 'teacher-1',
  },
  {
    id: 'course-6',
    title: 'Credit Scores & Reputation Systems',
    description: 'Learn how on-chain credit scores are calculated, how Reputation NFT levels unlock better rates, and how to improve your score.',
    level: 'Beginner',
    duration: '1h 45m',
    lessons: 5,
    category: 'CeFi',
    icon: '🏆',
    color: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/40',
    enrolled: true,
    progress: 100,
    teacherId: 'teacher-3',
  },
];

export const VIDEO_LESSONS: Lesson[] = [
  { id: 'v1', courseId: 'course-1', title: 'What is DeFi?', duration: '12:30', videoUrl: 'https://www.youtube.com/embed/k9HYC0EJU6E', completed: true, description: 'Introduction to Decentralized Finance and how it differs from traditional banking.' },
  { id: 'v2', courseId: 'course-1', title: 'Wallets & Keys', duration: '10:15', videoUrl: 'https://www.youtube.com/embed/dnC5mFaIW3Q', completed: true, description: 'Understanding public/private keys, seed phrases, and MetaMask setup.' },
  { id: 'v3', courseId: 'course-1', title: 'Smart Contracts Explained', duration: '14:00', videoUrl: 'https://www.youtube.com/embed/ZE2HxTmxfrI', completed: true, description: 'How smart contracts enable trustless financial transactions.' },
  { id: 'v4', courseId: 'course-1', title: 'Token Standards: ERC-20 & ERC-721', duration: '11:45', videoUrl: 'https://www.youtube.com/embed/9WmTmyYE3l8', completed: false, description: 'Overview of fungible and non-fungible token standards on Ethereum.' },
  { id: 'v5', courseId: 'course-2', title: 'Introduction to Staking', duration: '15:00', videoUrl: 'https://www.youtube.com/embed/vZ2UZdB07fo', completed: true, description: 'How proof-of-stake and protocol staking rewards work.' },
  { id: 'v6', courseId: 'course-2', title: 'APY vs APR Explained', duration: '08:20', videoUrl: 'https://www.youtube.com/embed/HKh4BDooFYE', completed: false, description: 'The math behind annual percentage yield and rate calculations.' },
];

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    question: 'What does LTV stand for in the context of DeFi lending?',
    options: ['Loan-To-Value', 'Liquidity-To-Volume', 'Leverage-To-Vault', 'Loan-Transaction-Validator'],
    correctIndex: 0,
    explanation: 'LTV (Loan-To-Value) is the ratio of borrowed amount to collateral value. A 70% LTV means you borrowed 70% of your collateral\'s worth.',
    category: 'DeFi',
  },
  {
    id: 'q2',
    question: 'What happens when your Health Factor drops below 1.0?',
    options: ['You earn bonus rewards', 'Your loan is liquidated', 'Your APY increases', 'Your wallet is frozen'],
    correctIndex: 1,
    explanation: 'A Health Factor below 1.0 means your collateral no longer covers your debt. This triggers liquidation to protect the lender\'s funds.',
    category: 'DeFi',
  },
  {
    id: 'q3',
    question: 'What type of NFT is the ABCDeFi Reputation NFT?',
    options: ['ERC-1155 Multi-Token', 'Transferable ERC-721', 'Soulbound (Non-Transferable) ERC-721', 'ERC-20 Token'],
    correctIndex: 2,
    explanation: 'Reputation NFTs are Soulbound — they are permanently bound to the wallet that earned them and cannot be transferred or sold.',
    category: 'NFT',
  },
  {
    id: 'q4',
    question: 'Which factor does NOT affect your ABCDeFi Credit Score?',
    options: ['Loans Repaid', 'Twitter Followers', 'Late Payments', 'Wallet Age'],
    correctIndex: 1,
    explanation: 'Your on-chain credit score is based on loans repaid, late payments, liquidations, referrals, and wallet age — not social media activity.',
    category: 'CeFi',
  },
  {
    id: 'q5',
    question: 'What is the minimum staking amount for Pool 3 (VIP) in ABCDeFi?',
    options: ['100 ABCD', '500 ABCD', '1,000 ABCD', '2,000 ABCD'],
    correctIndex: 3,
    explanation: 'Pool 3 (VIP) requires a minimum of 2,000 ABCD tokens and offers the highest APY of 25% with a 180-day lock period.',
    category: 'DeFi',
  },
  {
    id: 'q6',
    question: 'Which Reputation NFT level gives 100% Zero Fee VIP access?',
    options: ['Bronze', 'Silver', 'Gold', 'Platinum'],
    correctIndex: 3,
    explanation: 'Platinum Level Reputation NFT (Score 800-850) unlocks 100% Zero Fee VIP access with the highest LTV of 85% and lowest APY of 5%.',
    category: 'DeFi',
  },
];

export const CERTIFICATES: Certificate[] = [
  {
    id: 'cert-1',
    courseId: 'course-6',
    courseTitle: 'Credit Scores & Reputation Systems',
    recipientName: 'Alex Rivers',
    walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    issuedDate: 'July 15, 2026',
    level: 'Beginner',
    tokenId: '#CERT-7891',
  },
];

export async function enrollCourse(courseId: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 400));
}

export async function claimCertificate(courseId: string, walletAddress: string): Promise<Certificate> {
  await new Promise((r) => setTimeout(r, 600));
  const course = COURSES.find((c) => c.id === courseId)!;
  return {
    id: `cert-${Date.now()}`,
    courseId,
    courseTitle: course.title,
    recipientName: 'Alex Rivers',
    walletAddress,
    issuedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    level: course.level,
    tokenId: `#CERT-${Math.floor(Math.random() * 9000 + 1000)}`,
  };
}
