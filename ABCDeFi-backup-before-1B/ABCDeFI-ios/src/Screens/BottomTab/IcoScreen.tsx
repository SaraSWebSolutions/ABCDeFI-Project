import "@thirdweb-dev/react-native-adapter";
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  Image,
  Linking,
  Animated,
  Clipboard,
} from 'react-native';
import { checkWalletInstalled, showInstallationAlert, WALLET_METADATA } from '../../Utils/WalletDetection';
import { useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useResponsive } from '../../Utils/Responsive';
import Icon from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Jazzicon } from '@arturhoncharuk/react-native-jazzicon';
import Fonts from '../../Utils/Fonts';
import { useActiveAccount, useActiveWalletChain, useSwitchActiveWalletChain, useActiveWallet, useConnect, useDisconnect } from 'thirdweb/react';
import { WalletModal } from '../../Components/WalletModal';
import { createWallet, WalletId } from 'thirdweb/wallets';
import { PROJECT_ID } from '@env';
import { thirdwebClient, bscTestnet_custom } from '../../Config/thirdwebConfig';
import { ethers } from 'ethers';
import { ethers6Adapter } from 'thirdweb/adapters/ethers6';
import { api } from '../../Services/axiosConfig';
import icoABI from '../../abi/ico.json';
import vestingVaultABI from '../../abi/vestingVault.json';
import erc20ABI from '../../abi/ERC20.json';

interface StageData {
  price: number;
  cap: string;
  sold: string;
  endTime: number;
  cliff: number;
  duration: number;
  bps: number;
}

interface VestingSchedule {
  roundName: string;
  round: number;
  totalAmount: string;
  claimedAmount: string;
  claimableAmount: string;
  progress: number;
  cliff: number;
  duration: number;
  initialUnlockBps: number;
}



interface Token {
  symbol: string;
  name: string;
  decimals: number;
  address?: string;
  priceFeed?: string;
}

const TOKENS: Token[] = [
  {
    symbol: 'BNB',
    name: 'BNB',
    decimals: 18,
    priceFeed: '0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526',
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 18,
    address: '0xe64cD36a899E6136bE5ebd4EF459AE5BE2a43307',
    priceFeed: '0xEca2605f0BCF2BA5966372C99837b1F182d3D620',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 18,
    address: '0xd056eE5dC917ab61Cca8488F39Cd472b552a010B',
    priceFeed: '0x90c069C4538adAc136E051052E14c1cD799C41B7',
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ethereum',
    decimals: 18,
    address: '0xF80124202C5a52318f86166DaafECa11fB8cb21F',
    priceFeed: '0x143db3CEEfbdfe5631aDD3E50f7614B6ba708BA7',
  },
  {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    decimals: 8,
    address: '0xC650457Cc1c928fF0cbf47A43fbFA26c7D56c652',
    priceFeed: '0x5741306c21795FdCBb9b265Ea0255F499DFe515C',
  },
];

export const ICO_CONTRACT_ADDRESS = '0x306a5089f9874925Fc66d1FB28b8f00831155397';
export const expected_chainID = 97;


export default function IcoScreen() {
  const { wp, hp, font, radius, space } = useResponsive();
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const chain = useActiveWalletChain();
  const switchChain = useSwitchActiveWalletChain();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const address = account?.address;
  const isConnected = !!account;



  useEffect(() => {
    if (isConnected && chain && chain.id !== expected_chainID) {
      console.log('Wrong network:', chain.name || `Chain ${chain.id}`);
      try {
        switchChain(bscTestnet_custom);

      } catch (error) {
        console.error('Error switching chain:', error);
      }
    }
  }, [isConnected, chain, bscTestnet_custom, switchChain]);

  const [selectedToken, setSelectedToken] = useState<Token>(TOKENS[0]);
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenBalances, setTokenBalances] = useState<{ [key: string]: string }>({});
  const [tokenPrices, setTokenPrices] = useState<{ [key: string]: number }>({});
  const [icoPrice, setIcoPrice] = useState<number>(0);
  const [roundTimeLeft, setRoundTimeLeft] = useState('00D : 00H');
  const [globalTimeLeft, setGlobalTimeLeft] = useState('00D : 00H');
  const [icoStartsIn, setIcoStartsIn] = useState('00D : 00H');
  const [gasFee, setGasFee] = useState('0.10');
  const [showSuccessModal, setShowSuccessModal] = useState(false);


  const [txnHash, setTxnHash] = useState('');
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [abcdBalance, setAbcdBalance] = useState('0.00');
  const [abcdTokenAddress, setAbcdAddress] = useState<string | null>(null);
  const [abcdDecimals, setAbcdDecimals] = useState<number>(18);
  const [globalStartTime, setGlobalStartTime] = useState<number>(0);
  const [globalEndTime, setGlobalEndTime] = useState<number>(0);
  const [allStages, setAllStages] = useState<StageData[]>([]);

  // Vesting States
  const [vestingVaultAddress, setVestingVaultAddress] = useState<string | null>(null);
  const [currentStageData, setCurrentStageData] = useState<StageData | null>(null);
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(0);
  const [globalIcoSold, setGlobalIcoSold] = useState('0.00');
  const [globalIcoCap, setGlobalIcoCap] = useState('0.00');
  const [globalIcoPercent, setGlobalIcoPercent] = useState('0.0');
  const [roundIcoPercent, setRoundIcoPercent] = useState('0.0');
  const [globalTotalRaised, setGlobalTotalRaised] = useState('0');
  const [userSchedules, setUserSchedules] = useState<VestingSchedule[]>([]);
  const [vestingStartTime, setVestingStartTime] = useState<number>(0);
  const [isVestingLoading, setIsVestingLoading] = useState(false);
  const [participantCount, setParticipantCount] = useState<number>(0);
  const [totalClaimableAll, setTotalClaimableAll] = useState('0.00');
  const [totalAllocatedAll, setTotalAllocatedAll] = useState('0.00');
  const [showAllSchedules, setShowAllSchedules] = useState(false);

  // Verification States
  const [isWalletVerified, setIsWalletVerified] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [boundAddress, setBoundAddress] = useState<string | null>(null);
  const [isWrongWallet, setIsWrongWallet] = useState(false);
  const [isAlreadyUsed, setIsAlreadyUsed] = useState(false);
  const [usedErrorMessage, setUsedErrorMessage] = useState("");
  const [isCheckingVerification, setIsCheckingVerification] = useState(true);

  useEffect(() => {
    const checkVerificationStatus = async () => {
      if (!account?.address) {
        console.log("No account connected, skipping check.");
        setIsCheckingVerification(false);
        return;
      }

      setIsCheckingVerification(true);
      try {
        console.log("Verification Check for:", account.address);
        const response = await api.post('user/get-wallet-address');
        const data = response.data;
        console.log("API DATA RECEIVED:", data);

        const rawAddress = data.walletAddress || data.profile?.walletAddress;

        if (rawAddress) {
          const linkedAddr = rawAddress.toString().toLowerCase().trim();
          const currentAddr = account.address.toString().toLowerCase().trim();
          
          setBoundAddress(linkedAddr);
          console.log(` Comparing: \nBound: ${linkedAddr}\nConnected: ${currentAddr}`);
          
          if (linkedAddr === currentAddr) {
            console.log(" MATCH: User is already verified.");
            setIsWalletVerified(true);
            setIsWrongWallet(false);
            setShowVerificationModal(false);
          } else {
            console.warn("MISMATCH: Connected wallet doesn't match bound wallet.");
            setIsWalletVerified(false);
            setIsWrongWallet(true);
            setShowVerificationModal(true);
          }
        } else {
          console.log("NO BINDING: No wallet is currently linked to this profile.");
          setIsWalletVerified(false);
          setIsWrongWallet(false);
          setShowVerificationModal(true);
        }

      } catch (error: any) {
        console.log("CHECK FAILED:", error.message);
        if (error.response) {
          console.log("Response Error:", error.response.status, error.response.data);
        }
        
        // If it's a 404 or specific "not found" error, show the bind modal
        setIsWalletVerified(false);
        setIsWrongWallet(false);
        setShowVerificationModal(true);
      } finally {
        setIsCheckingVerification(false);
        console.log("Verification check complete.");
      }
    };

    if (isConnected && !isWalletVerified) {
      checkVerificationStatus();
    } else if (!isConnected) {
      setIsCheckingVerification(false);
    }
  }, [isConnected, isWalletVerified, account?.address]);




  useEffect(() => {
    // Reset state on disconnect
    if (!account) {
      setIsWalletVerified(false);
      setShowVerificationModal(false);
      setHasConsent(false);
      setBoundAddress(null);
      setIsWrongWallet(false);
      setIsAlreadyUsed(false);
      setUsedErrorMessage("");
    }
  }, [account]);



  const handleVerifyWallet = async () => {
    if (!hasConsent) {
      Toast.show({ type: 'error', text1: 'Consent Required', text2: 'Please agree to the terms to proceed.' });
      return;
    }
    if (!account) return;

    setIsVerifying(true);
    try {
      const message = "Verify wallet ownership for ABCDeFI ICO. This wallet will be bound to your profile.";
      console.log("Generating signature for address:", account.address);
      const signature = await account.signMessage({ message });
      console.log("Signature generated successfully:", signature);

      // Use the application's global API service to ensure Authorization headers are included
      console.log("Sending verification request to API...");
      const response = await api.post('user/get-address', {
        signature: signature,
        expectedAddress: account.address
      });
      
      const data = response.data;
      console.log("API Response data:", data);
      
      // Assuming 'success' or 'status === "success"' based on common API patterns
      if (data.success || data.status === 'success') {
          setIsWalletVerified(true);
          setShowVerificationModal(false);
          Toast.show({ type: 'success', text1: 'Verified!', text2: 'Your wallet is verified for the ICO.' });
      } else {
          throw new Error(data.message || 'Verification failed on server');
      }


    } catch (error: any) {
      console.error("DETAILED VERIFICATION ERROR:", error);
      const displayError = error.response?.data?.message || error.message || 'Verification failed';
      
      // Check if the API indicated the wallet is already in use
      if (
        displayError.toLowerCase().includes('already') || 
        displayError.toLowerCase().includes('in use') || 
        displayError.toLowerCase().includes('used') ||
        error.response?.status === 400 || error.response?.status === 403 || error.response?.status === 409
      ) {
        setIsAlreadyUsed(true);
        setUsedErrorMessage(displayError);
        return; // Don't show toast, handle in UI modal
      }

      Toast.show({ 
        type: 'error', 
        text1: 'Verification Failed', 
        text2: displayError === 'user rejected' ? 'You must sign the message.' : displayError 
      });


    } finally {
      setIsVerifying(false);
    }
  };

  const fetchTokenData = async (showLoading = true) => {
    if (!address) {
      setTokenBalances({});
      setAbcdBalance('0.00');
    }
    if (showLoading) setIsBalanceLoading(true);

    try {
      const provider = new ethers.JsonRpcProvider('https://bsc-testnet.publicnode.com');
      const balances: { [key: string]: string } = {};
      const prices: { [key: string]: number } = {};
      let sData: StageData | null = null; // Lifted scope for shared logic

      const icoContract = new ethers.Contract(ICO_CONTRACT_ADDRESS, icoABI, provider);

      // Fetch Global Timings
      try {
        const [startTime, endTime] = await Promise.all([
          icoContract.icoStartTime(),
          icoContract.icoEndTime()
        ]);
        setGlobalStartTime(Number(startTime));
        setGlobalEndTime(Number(endTime));
      } catch (e) {
        console.error("Error fetching ICO global times:", e);
      }

      // Fetch ICO Stage Data
      try {
        const [stageIndex, icoSummary, allStagesRaw] = await Promise.all([
          icoContract.getEffectiveStage(),
          icoContract.getIcoSummary(),
          icoContract.getAllStages()
        ]);

        const totalSold = BigInt(icoSummary.totalSoldGlobal);
        const totalCap = BigInt(icoSummary.totalCapGlobal);
        let totalRaised = 0;

        const fetchedStages: StageData[] = allStagesRaw.map((s: any) => {
          const stagePrice = Number(ethers.formatUnits(s.price, 18));
          const stageSold = BigInt(s.sold);

          totalRaised += Number(ethers.formatUnits(stageSold, abcdDecimals)) * stagePrice;

          return {
            price: stagePrice,
            cap: ethers.formatUnits(s.cap, abcdDecimals),
            sold: ethers.formatUnits(s.sold, abcdDecimals),
            endTime: Number(s.endTime),
            cliff: Number(s.cliff),
            duration: Number(s.duration),
            bps: Number(s.initialUnlockBps)
          };
        });

        setAllStages(fetchedStages);
        setGlobalIcoSold(ethers.formatUnits(totalSold, abcdDecimals));
        setGlobalIcoCap(ethers.formatUnits(totalCap, abcdDecimals));
        setGlobalTotalRaised(totalRaised.toFixed(0));

        if (totalCap > BigInt(0)) {
          const scaledPercent = (totalSold * BigInt(1000000)) / totalCap;
          const numPercent = Number(scaledPercent) / 10000;
          setGlobalIcoPercent(totalSold > 0 && numPercent < 0.01 ? "< 0.01" : numPercent.toFixed(2));
        } else {
          setGlobalIcoPercent('0.00');
        }

        sData = fetchedStages[Number(stageIndex)]; // Assign to lifted scope
        setCurrentStageData(sData);
        setCurrentStageIndex(Number(stageIndex));
        setIcoPrice(sData.price);

        // Calculate Round Progress
        const rSold = BigInt(ethers.parseUnits(sData.sold, abcdDecimals));
        const rCap = BigInt(ethers.parseUnits(sData.cap, abcdDecimals));
        setRoundIcoPercent(rCap > 0 ? (Number((rSold * BigInt(10000)) / rCap) / 100).toFixed(2) : '0.00');



        // Fetch Vault Stats (Participants and Global Total Allocated)
        let vaultAddr = vestingVaultAddress;
        if (!vaultAddr) {
          vaultAddr = await icoContract.vestingVault();
          setVestingVaultAddress(vaultAddr);
        }

        if (vaultAddr) {
          const vaultContract = new ethers.Contract(vaultAddr, vestingVaultABI, provider);
          // NEW: Call public states to simplify logic and get global round stats
          const [count, totalAlloc, roundRemaining] = await Promise.all([
            vaultContract.numberOfParticipants(),
            vaultContract.totalAllocated(),
            vaultContract.totalAllocatedPerRound(stageIndex)
          ]);
          setParticipantCount(Number(count));
          // totalAlloc is global vault state, roundRemaining is specific to current round
          console.log(`Global Vault Stats - Participants: ${count}, Total Locked: ${totalAlloc}, Round Locked: ${roundRemaining}`);
        }



        // Fetch ABCD Token Address and Balance
        let abcdAddr = abcdTokenAddress;
        if (!abcdAddr) {
          abcdAddr = await icoContract.icoToken();
          setAbcdAddress(abcdAddr);
        }

        if (abcdAddr) {
          const abcdContract = new ethers.Contract(abcdAddr, erc20ABI, provider);
          const dec = await abcdContract.decimals();
          setAbcdDecimals(Number(dec));

          if (address && chain?.id === expected_chainID) {
            const bal = await abcdContract.balanceOf(address);
            setAbcdBalance(ethers.formatUnits(bal, Number(dec)));
          } else {
            setAbcdBalance('0.00');
          }
        }
      } catch (e) {
        console.error('Error fetching ico data:', e);
      }


      // Fetch Round and Global End Times
      try {
        // Timers are handled by the 1s useEffect below to avoid dashboard stuttering
      } catch (e) {
        console.error('Error fetching ico timings:', e);
      }




      // Fetch balances and prices for each payment token
      await Promise.all(TOKENS.map(async (token) => {
        const tokenAddr = token.address || '0x0000000000000000000000000000000000000000';

        // Fetch Balance if connected
        // Fetch Balance if connected on correct network
        if (address && chain?.id === expected_chainID) {
          try {
            if (token.symbol === 'BNB') {
              const bnbBal = await provider.getBalance(address);
              balances['BNB'] = ethers.formatEther(bnbBal);
            } else {
              const contract = new ethers.Contract(token.address!, erc20ABI, provider);
              const bal = await contract.balanceOf(address);
              balances[token.symbol] = ethers.formatUnits(bal, token.decimals);
            }
          } catch (err) {
            balances[token.symbol] = '0.00';
          }
        } else {
          balances[token.symbol] = '0.00';
        }

        // Fetch Price
        try {
          const [price, decimals] = await icoContract.getTokenPrice(tokenAddr);
          prices[token.symbol] = Number(ethers.formatUnits(price, decimals));
        } catch (err) {
          console.error(`Error fetching price for ${token.symbol}:`, err);
        }
      }));

      if (address) setTokenBalances(balances);
      setTokenPrices(prices);

      // Fetch Gas Fee Estimation
      try {
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice || BigInt(5000000000); // Fallback 5 Gwei
        const bnbPrice = prices['BNB'] || 600; // Fallback to a reasonable BNB price if fetch failed
        
        // Typical purchase transaction uses ~250,000 gas
        const estimatedGas = BigInt(250000);
        const costInBnb = (gasPrice * estimatedGas);
        const costInUsd = (Number(ethers.formatEther(costInBnb)) * bnbPrice).toFixed(2);
        
        setGasFee(costInUsd);
      } catch (err) {
        console.error("Error estimating gas fee:", err);
      }
    } finally {
      setIsBalanceLoading(false);
    }

  };

  const fetchVestingData = async (showLoading = true) => {
    if (!address || !vestingVaultAddress) {
      setUserSchedules([]);
      setTotalClaimableAll('0.00');
      return;
    }

    if (showLoading) setIsVestingLoading(true);

    try {
      const provider = new ethers.JsonRpcProvider('https://bsc-testnet.publicnode.com');
      const vaultContract = new ethers.Contract(vestingVaultAddress, vestingVaultABI, provider);

      // 1. Fetch Overview & Round Summaries (Parallel)
      // getUserVestingSummary gives global totals; getUserVestingRoundSummary gives per-round status.
      const roundIndices = [0, 1, 2, 3, 4];
      const [vStartTimeBN, userSummary, ...roundSummaries] = await Promise.all([
        vaultContract.vestingStartTime(),
        vaultContract.getUserVestingSummary(address),
        ...roundIndices.map(r => vaultContract.getUserVestingRoundSummary(address, r))
      ]);

      const vStartTime = Number(vStartTimeBN);
      setVestingStartTime(vStartTime);

      // Set user summary totals directly from contract state
      const totalRemaining = BigInt(userSummary.totalAllocatedUser) - BigInt(userSummary.totalClaimedUser);
      setTotalAllocatedAll(ethers.formatUnits(totalRemaining, abcdDecimals));
      setTotalClaimableAll(ethers.formatUnits(userSummary.totalClaimableUser, abcdDecimals));

      // 2. Build Breakdown from Round Summaries
      const groups: VestingSchedule[] = [];
      const roundNames = ['SEED SALE', 'STRATEGIC SALE', 'CROWD SALE 1', 'CROWD SALE 2', 'CROWD SALE 3'];

      roundSummaries.forEach((rs, i) => {
        const totalAmt = BigInt(rs.totalAllocatedRound);
        if (totalAmt === BigInt(0)) return; // User didn't participate in this round

        const claimedAmt = BigInt(rs.totalClaimedRound);
        const claimableAmt = BigInt(rs.totalClaimableRound);
        const vestedAmt = claimedAmt + claimableAmt;

        // Use stage metadata already fetched in fetchTokenData
        const stageMeta = allStages[i] || { cliff: 0, duration: 0, bps: 0 };

        groups.push({
          roundName: roundNames[i] || `ROUND ${i + 1}`,
          round: i,

          totalAmount: ethers.formatUnits(totalAmt, abcdDecimals),
          claimedAmount: ethers.formatUnits(claimedAmt, abcdDecimals),
          claimableAmount: ethers.formatUnits(claimableAmt, abcdDecimals),
          // Higher precision (2 decimal places) for progress calculation
          progress: totalAmt > BigInt(0) ? Number((vestedAmt * BigInt(10000)) / totalAmt) / 100 : 0,
          cliff: stageMeta.cliff,
          duration: stageMeta.duration,
          initialUnlockBps: stageMeta.bps,
        });

      });

      setUserSchedules(groups);
    } catch (e) {
      console.error('Error fetching vesting data:', e);
    } finally {
      setIsVestingLoading(false);
    }
  };





  // NEW: Per-second timer for all countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);

      // 1. Check if Pre-Launch
      const isPreLaunch = globalStartTime > 0 && now < globalStartTime;

      if (isPreLaunch) {
        // Calculate "Starts In" Countdown
        const diff = globalStartTime - now;
        const d = Math.floor(diff / 86400);
        const h = Math.floor((diff % 86400) / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        setIcoStartsIn(`${String(d).padStart(2, '0')}D:${String(h).padStart(2, '0')}H:${String(m).padStart(2, '0')}M:${String(s).padStart(2, '0')}S`);
        
        // Suppress End timers until launch
        setGlobalTimeLeft("-");
        setRoundTimeLeft("-");
      } else {
        setIcoStartsIn("");

        // 2. Handle Global Countdown (Active Phase)
        if (globalEndTime > 0 && now < globalEndTime) {
          const diff = globalEndTime - now;
          const d = Math.floor(diff / 86400);
          const h = Math.floor((diff % 86400) / 3600);
          const m = Math.floor((diff % 3600) / 60);
          setGlobalTimeLeft(`${String(d).padStart(2, '0')}D:${String(h).padStart(2, '0')}H:${String(m).padStart(2, '0')}M`);
        } else {
          // If ICO has started but no end time is reached, we could show Ended or calculate from stage
          setGlobalTimeLeft(globalEndTime > 0 && now >= globalEndTime ? "Ended" : "-");
        }

        // 3. Handle Round Countdown (Active Phase)
        const roundEndTime = currentStageData?.endTime || 0;
        if (roundEndTime > 0 && now < roundEndTime) {
          const diff = Number(roundEndTime) - now;
          const d = Math.floor(diff / 86400);
          const h = Math.floor((diff % 86400) / 3600);
          const m = Math.floor((diff % 3600) / 60);
          setRoundTimeLeft(`${String(d).padStart(2, '0')}D:${String(h).padStart(2, '0')}H:${String(m).padStart(2, '0')}M`);
        } else {
          setRoundTimeLeft(roundEndTime > 0 && now >= roundEndTime ? "Ended" : "-");
        }
      }

    }, 1000);
    return () => clearInterval(timer);
  }, [globalStartTime, globalEndTime, currentStageData]);



  useEffect(() => {
    fetchTokenData(true);
    fetchVestingData(true);
    const interval = setInterval(() => {
        fetchTokenData(false);
        fetchVestingData(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [isConnected, address, chain?.id, vestingVaultAddress]);


  const amountToNumber = parseFloat(purchaseAmount) || 0;
  const currentTokenBalance = parseFloat(tokenBalances[selectedToken.symbol] || '0');
  const isInsufficient = isConnected && amountToNumber > currentTokenBalance;

  const styles = createStyles(wp, hp, font, radius, space);

  const validateInputs = () => {
    if (!account) {
      Alert.alert('Error', 'Please connect your wallet first');
      return false;
    }

    const amount = parseFloat(purchaseAmount);
    if (!purchaseAmount || isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid positive amount');
      return false;
    }

    const currentBalance = tokenBalances[selectedToken.symbol] || '0';
    if (amount > parseFloat(currentBalance)) {
      Alert.alert('Error', `Insufficient ${selectedToken.symbol} balance. You have ${parseFloat(currentBalance).toFixed(4)} ${selectedToken.symbol}`);
      return false;
    }

    return true;
  };

  const SkeletonLoader = () => {
    const opacity = useRef(new Animated.Value(0.2)).current;

    useEffect(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.5,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.2,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }, []);

    return (
      <Animated.View style={{
        width: wp(18),
        height: font(12),
        backgroundColor: '#4b5563',
        borderRadius: radius(2),
        opacity: opacity,
        marginLeft: space(2),
      }} />
    );
  };

  const handleWalletConnect = async (walletId: string) => {
    try {
      if (WALLET_METADATA[walletId]) {
        const isInstalled = await checkWalletInstalled(walletId);
        if (!isInstalled) {
          showInstallationAlert(walletId);
          return;
        }
      }

      const wallet = createWallet(walletId as WalletId);

      await connect(async () => {
        await wallet.connect({
          client: thirdwebClient,
          chain: bscTestnet_custom,
          walletConnect: {
            projectId: PROJECT_ID,
            appMetadata: {
              name: "ABCDefi",
              url: "https://abcdefi.com",
              description: "ABCDefi - Your DeFi Platform",
              logoUrl: "https://abcdefi.com/logo.png",
            },
          },
        });
        return wallet;
      });
      setShowWalletModal(false);
    } catch (error) {
      console.log("Local handle error (ICO):", error);
    }
  };

  const buyTokens = async () => {
    if (!validateInputs()) {
      return;
    }

    setIsPurchasing(true);

    try {
      if (!account) return;

      const signer = ethers6Adapter.signer.toEthers({
        client: thirdwebClient,
        chain: bscTestnet_custom,
        account: account,
      });

      const user = await signer.getAddress();
      const ICO_contract = new ethers.Contract(ICO_CONTRACT_ADDRESS, icoABI, signer);

      if (selectedToken.symbol === "BNB") {
        Toast.show({
          type: 'info',
          text1: 'Transaction Sent',
          text2: 'Confirm in your wallet...',
          visibilityTime: 4000,
        });

        // Use await to maintain the try/catch context while still delaying
        await new Promise(resolve => setTimeout(resolve, 3000));

        const value = ethers.parseEther(purchaseAmount);
        const tx = await ICO_contract.buyTokenWithNative({ value: value });
        const receipt = await tx.wait();

        setTxnHash(receipt.hash);
        setShowSuccessModal(true);
        fetchTokenData(false);
        fetchVestingData(false);

      } else {
        const payment_contract = new ethers.Contract(selectedToken.address!, erc20ABI, signer);
        const purchaseAmount_inwei = ethers.parseUnits(purchaseAmount, selectedToken.decimals);
        const allowance = await payment_contract.allowance(user, ICO_CONTRACT_ADDRESS);

        if (BigInt(allowance) < BigInt(purchaseAmount_inwei)) {
          Toast.show({
            type: 'info',
            text1: 'Approval Required',
            text2: 'Please confirm the token spend limit in your wallet.',
            visibilityTime: 4000,
          });

          // Delay for toast visibility
          await new Promise(resolve => setTimeout(resolve, 3000));


          const approveTx = await payment_contract.approve(ICO_CONTRACT_ADDRESS, purchaseAmount_inwei);
          await approveTx.wait();

          Toast.show({
            type: 'success',
            text1: 'Approved!',
            text2: 'Token spend limit confirmed.',
            visibilityTime: 6000,
          });
          fetchTokenData(false);
        }
        await new Promise(resolve => setTimeout(resolve, 4000));
        Toast.show({
          type: 'info',
          text1: 'Processing Purchase',
          text2: 'Confirming your buy transaction...',
        });

        // Delay for toast visibility
        await new Promise(resolve => setTimeout(resolve, 3000));

        const txn = await ICO_contract.buyTokenWithERC20(selectedToken.address, purchaseAmount_inwei);
        const rec = await txn.wait();

        setTxnHash(rec.hash);
        setShowSuccessModal(true);
        fetchTokenData(false);
        fetchVestingData(false);
      }
    } catch (e: any) {
      console.error('Detailed Purchase Error:', e);
      let errorMessage = 'The transaction was cancelled or failed.';

      // More robust error message extraction
      const e_obj = e as any;
      const errorStr = (
        e_obj?.message ||
        e_obj?.reason ||
        e_obj?.data?.message ||
        e_obj?.error?.message ||
        e_obj?.info?.error?.message ||
        ""
      ).toLowerCase();

      // Check for user rejection or specific error codes
      if (
        errorStr.includes('user rejected') ||
        errorStr.includes('user denied') ||
        errorStr.includes('rejected by user') ||
        errorStr.includes('cancelled') ||
        e_obj?.code === 'ACTION_REJECTED' ||
        e_obj?.code === 4001
      ) {
        errorMessage = 'Transaction rejected in wallet.';
      } else if (errorStr.includes('insufficient funds')) {
        errorMessage = 'Insufficient BNB for gas fees.';
      } else if (errorStr.includes('execution reverted')) {
        errorMessage = 'Transaction failed. Check contract constraints.';
      }

      // Hide any existing toast before showing the error one
      Toast.hide();

      Toast.show({
        type: 'error',
        text1: 'Transaction Failed',
        text2: errorMessage,
        visibilityTime: 7000
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleClaim = async (round: number) => {
    if (!account) return;
    try {
        const signer = ethers6Adapter.signer.toEthers({
            client: thirdwebClient,
            chain: bscTestnet_custom,
            account: account,
        });
        const vaultContract = new ethers.Contract(vestingVaultAddress!, vestingVaultABI, signer);
        
        Toast.show({ type: 'info', text1: 'Claiming Tokens', text2: 'Processing request...' });
        
        const tx = await vaultContract.claimRound(round);
        await tx.wait();
        
        Toast.show({ type: 'success', text1: 'Claim Successful', text2: 'Tokens have been sent to your wallet.' });

        fetchTokenData(false);
        fetchVestingData(false);
    } catch (e: any) {
        console.error('Claim error:', e);
        Toast.show({ type: 'error', text1: 'Claim Failed', text2: e.message || 'Transaction failed' });
    }
  };

  const handleClaimAll = async () => {
    if (!account) return;
    
    // Check if vesting has started (to match contract require)
    const currentTime = Math.floor(Date.now() / 1000);
    if (vestingStartTime === 0 || currentTime < vestingStartTime) {
      Toast.show({ type: 'error', text1: 'Vesting Not Started', text2: 'Tokens will be claimable after the distribution period.' });
      return;
    }

    try {
        const signer = ethers6Adapter.signer.toEthers({
            client: thirdwebClient,
            chain: bscTestnet_custom,
            account: account,
        });
        const vaultContract = new ethers.Contract(vestingVaultAddress!, vestingVaultABI, signer);
        
        Toast.show({ type: 'info', text1: 'Claiming All Tokens', text2: 'Confirm in your wallet...' });
        const tx = await vaultContract.claimAll();
        await tx.wait();
        
        Toast.show({ type: 'success', text1: 'Claim Successful', text2: 'All available tokens have been sent to your wallet.' });
        fetchTokenData(false);
        fetchVestingData(false);
    } catch (e: any) {
        console.error('Claim All error:', e);
        Toast.show({ type: 'error', text1: 'Claim Failed', text2: e.message || 'Transaction failed' });
    }
  };


  if (isConnected && isCheckingVerification) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0f11', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ alignItems: 'center' }}>
          <Image 
            source={require('../../assets/ABCD.png')} 
            style={{ width: wp(15), height: wp(15), marginBottom: space(4), opacity: 0.8 }} 
            resizeMode="contain" 
          />
          <SkeletonLoader />
          <Text style={{ color: '#9ca3af', fontFamily: Fonts.medium, marginTop: space(4), fontSize: font(12) }}>
            Verifying secure connection...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0f11' }}>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>

          {/* TOP NAV */}
          <View style={styles.topNav}>
            <View style={styles.navLeft}>
              {/* <Image
                source={require('../../assets/ABCD.png')}
                style={{ width: wp(9), height: wp(9) }}
                resizeMode="contain"
              /> */}
              {/* <Text style={styles.brandTitle}>ABCD<Text style={styles.brandHighlight}>.FI</Text></Text> */}
            </View>

            <View style={styles.walletBar}>
              <View style={[styles.networkBadge, isConnected && chain && chain.id !== expected_chainID && {
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderColor: 'rgba(239, 68, 68, 0.3)',
                borderWidth: 1,
                paddingHorizontal: space(3)
              }]}>
                {isConnected && chain && chain.id !== expected_chainID ? (
                  <Icon name="warning" size={wp(3.5)} color="#ef4444" style={{ marginRight: space(1.5) }} />
                ) : (
                  <Image
                    source={require('../../assets/Binance.png')}
                    style={styles.miniBnbIcon}
                  />
                )}
                <Text style={[styles.networkName, isConnected && chain && chain.id !== expected_chainID && { color: '#ef4444' }]}>
                  {isConnected && chain && chain.id !== expected_chainID ? (chain.name || 'Wrong') : 'BSC'}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.addressPill}
              // onPress={() => isConnected && wallet ? disconnect(wallet) : setShowWalletModal(true)}
              >
                <Text style={styles.truncatedAddress}>
                  {isConnected && address ? `${address.slice(0, 5)}...${address.slice(-7)}` : 'Wallet not connected'}
                </Text>
                <View style={styles.jazziconBox}>
                  {isConnected && address ? (
                    <Jazzicon size={wp(7)} address={address} />
                  ) : (
                    <Icon name="wallet" size={16} color="#4b5563" />
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* HERO SECTION */}
          {/* <View style={styles.heroSection}>
            <Text style={styles.heroTitleLine1}>FUEL THE</Text>
            <Text style={styles.heroTitleLine2}>
              <Text style={styles.heroTitleHighlight}>KINETIC</Text> VOID.
            </Text>
            <Text style={styles.heroSubtitle}>
              Secure your allocation in the next generation of BSC yield protocols. Limited presale live.
            </Text>
          </View> */}

          {/* MAIN SWAP CARD */}
          <View style={styles.mainSwapCard}>
            {/* PAY SECTION */}
            <View style={styles.swapSectionHeader}>
              <Text style={styles.swapSectionTitle}>PAY</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.swapSectionSubtitle}>Balance: </Text>
                {isBalanceLoading ? (
                  <SkeletonLoader />
                ) : (
                  <Text style={styles.swapSectionSubtitle}>
                    {tokenBalances[selectedToken.symbol] ? parseFloat(tokenBalances[selectedToken.symbol]).toFixed(4) : '0.00'} {selectedToken.symbol}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.swapInputRow}>
              <View style={styles.swapInputCol}>
                <TextInput
                  style={[styles.swapInputPrimary, isInsufficient && { color: '#ef4444' }]}
                  value={purchaseAmount}
                  onChangeText={(text) => {
                    let sanitized = text.replace(/[^0-9.]/g, '');
                    const parts = sanitized.split('.');
                    if (parts.length > 2) {
                      sanitized = parts[0] + '.' + parts.slice(1).join('');
                    }

                    // Handle leading zeros
                    if (sanitized.startsWith('0') && sanitized.length > 1 && sanitized[1] !== '.') {
                      sanitized = sanitized.replace(/^0+/, '');
                      if (sanitized.startsWith('.')) sanitized = '0' + sanitized;
                    } else if (sanitized.startsWith('.')) {
                      sanitized = '0' + sanitized;
                    }

                    setPurchaseAmount(sanitized);
                  }}
                  placeholder="0.0"
                  keyboardType="numeric"
                  placeholderTextColor="#666"
                />
                <Text style={styles.swapInputSecondary}>
                  ~${purchaseAmount && tokenPrices[selectedToken.symbol]
                    ? (parseFloat(purchaseAmount) * tokenPrices[selectedToken.symbol]).toFixed(2)
                    : '0.00'}
                </Text>
              </View>

              <TouchableOpacity style={styles.tokenPill} onPress={() => setShowTokenModal(true)}>
                {selectedToken.symbol === 'BNB' && <Image source={require('../../assets/Binance.png')} style={styles.pillIcon} resizeMode="contain" />}
                {selectedToken.symbol === 'USDT' && <Image source={require('../../assets/USDT.png')} style={styles.pillIcon} resizeMode="contain" />}
                {selectedToken.symbol === 'USDC' && <Image source={require('../../assets/USDC.png')} style={[styles.pillIcon, { transform: [{ scale: 1.3 }] }]} resizeMode="contain" />}
                {selectedToken.symbol === 'WBTC' && <Image source={require('../../assets/Bitcoin.png')} style={[styles.pillIcon, { transform: [{ scale: 1.2 }] }]} resizeMode="contain" />}
                {selectedToken.symbol === 'WETH' && <Image source={require('../../assets/Ethereum.png')} style={[styles.pillIcon, { transform: [{ scale: 1.5 }] }]} resizeMode="contain" />}
                <Text style={styles.pillText}>{selectedToken.symbol}</Text>
                <Icon name="chevron-down" size={14} color="#a1a1aa" />
              </TouchableOpacity>
            </View>

            {/* Center Swap Arrow */}
            <View style={styles.centerArrowContainer}>
              <View style={styles.centerArrowCircle}>
                <MaterialCommunityIcons name="arrow-down" size={20} color="#7042f8" />
              </View>
            </View>

            {/* RECEIVE SECTION */}
            <View style={styles.swapSectionHeader}>
              <Text style={styles.swapSectionTitle}></Text>
            </View>
            <View style={styles.swapInputRow}>
              <View style={styles.swapInputCol}>
                <Text 
                  style={[styles.swapInputPrimary, { color: '#7042f8', paddingRight: space(4) }]}
                  numberOfLines={1} 
                  adjustsFontSizeToFit={true}

                  minimumFontScale={0.4}
                >
                  {purchaseAmount && tokenPrices[selectedToken.symbol] && icoPrice > 0
                    ? ((parseFloat(purchaseAmount) * tokenPrices[selectedToken.symbol]) / icoPrice).toFixed(2)
                    : '0.00'}
                </Text>

                <Text style={styles.swapInputSecondary}>
                  {`GasFee :~ $${gasFee}`}
                </Text>

              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <View style={[styles.tokenPill, { paddingRight: space(4), marginBottom: space(1.5) }]}>
                  <Image source={require('../../assets/ABCD.png')} style={styles.pillIcon} resizeMode="contain" />
                  <Text style={styles.pillText}>ABCD</Text>
                </View>
              </View>
            </View>

            <View style={{ alignItems: 'center', marginBottom: hp(1) }}>
              <Text style={styles.swapSectionSubtitle}>
                1 {selectedToken.symbol} = {tokenPrices?.[selectedToken.symbol] && icoPrice > 0
                  ? (tokenPrices[selectedToken.symbol] / icoPrice).toLocaleString('en-US', { maximumFractionDigits: 0 })
                  : '...'} ABCD
              </Text>
            </View>


            {!isConnected ? (
              <TouchableOpacity
                style={styles.buyBtn}
                onPress={() => setShowWalletModal(true)}
              >
                <Text style={styles.buyBtnText}>CONNECT WALLET</Text>
              </TouchableOpacity>
            ) : icoStartsIn !== "" ? (
              <View
                style={[styles.buyBtn, { backgroundColor: 'rgba(28, 28, 31, 0.8)', borderColor: '#2d2d30', borderWidth: 1, height: hp(6.5) }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', paddingHorizontal: space(2) }}>
                  <Icon name="time-outline" size={font(14.5)} color="#6b7280" style={{ marginRight: space(2), marginTop: -3 }} />
                  <Text style={[styles.buyBtnText, { color: '#9ca3af', fontSize: font(12.5), textAlignVertical: 'center' }]}>
                    STARTS IN {icoStartsIn}
                  </Text>
                </View>


              </View>

            ) : (
              <TouchableOpacity
                style={[styles.buyBtn, (isPurchasing || isInsufficient || globalTimeLeft === 'Ended' || (isConnected && chain && chain.id !== expected_chainID)) && { backgroundColor: '#2d2d30' }]}
                onPress={() => {
                  if (globalTimeLeft === 'Ended') return;
                  if (isConnected && !isWalletVerified) {
                    setShowVerificationModal(true);
                  } else {
                    buyTokens();
                  }
                }}
                disabled={isPurchasing || globalTimeLeft === 'Ended' || (isConnected && isWalletVerified && isInsufficient) || (isConnected && chain && chain.id !== expected_chainID)}
              >
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%'
                }}>
                  {globalTimeLeft === 'Ended' && (
                    <Icon name="lock-closed-outline" size={font(16)} color="#6b7280" style={{ marginRight: space(2), marginTop: -3 }} />
                  )}
                  <Text style={[styles.buyBtnText, (isPurchasing || globalTimeLeft === 'Ended' || (isConnected && isWalletVerified && isInsufficient) || (isConnected && chain && chain.id !== expected_chainID)) && { color: '#6b7280', textAlignVertical: 'center' }]}>
                    {globalTimeLeft === 'Ended' ? 'ICO ENDED' : isPurchasing ? 'Processing...' : (isConnected && chain && chain.id !== expected_chainID) ? 'WRONG NETWORK' : (!isWalletVerified) ? 'VERIFY WALLET FIRST' : isInsufficient ? 'Insufficient Balance' : 'BUY ABCD'}
                  </Text>




                  {!isPurchasing && globalTimeLeft !== 'Ended' && !(isConnected && chain && chain.id !== expected_chainID) && isWalletVerified && !isInsufficient && (
                    <Image
                      source={require('../../assets/rocket.png')}
                      style={{ width: wp(6.5), height: wp(8), marginTop: -6, marginLeft: space(2.5) }}
                      resizeMode="contain"
                    />
                  )}

                </View>
              </TouchableOpacity>
            )}

          </View>

          {/* ROUND PROGRESS */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>
                <Text style={{ color: '#d3d1daff' }}>ROUND</Text>
                <Text style={{ color: '#7042f8', opacity: 0.7 }}> 0{currentStageIndex + 1} </Text> 
                <Text style={{ color: '#d2cfdbff' }}>PROGRESS</Text>
              </Text>


              <Text style={styles.progressPercent}>{roundIcoPercent}%</Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View 
                style={[
                    styles.progressBarFill, 
                    { 
                        // Force 1% width if progress is > 0 but very small
                        width: `${Math.max(roundIcoPercent !== '0.00' ? 1.0 : 0, Math.min(100, parseFloat(roundIcoPercent)))}%` as any 
                    }
                ]} 
              />
            </View>
            <Text style={styles.progressSubInfo}>
                {currentStageData ? `${parseFloat(currentStageData.sold).toLocaleString('en-US')} / ${parseFloat(currentStageData.cap).toLocaleString('en-US')} ABCD` : '...'}
            </Text>
          </View>


          {/* ABCD BALANCE HERO CARD */}
          <View style={styles.balanceHeroCard}>
            <View style={styles.balanceHeroHeader}>
               <View>
                 <Text style={styles.balanceHeroTitle}>Total ABCD Balance</Text>
                 <Text style={styles.balanceHeroAmount}>
                   {(parseFloat(abcdBalance) + parseFloat(totalAllocatedAll)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                 </Text>
                 <Text style={styles.balanceHeroUsd}>
                   ≈ ${((parseFloat(abcdBalance) + parseFloat(totalAllocatedAll)) * (icoPrice || 0.00001)).toFixed(4)} USD
                 </Text>
               </View>
               <Image source={require('../../assets/ABCD.png')} style={styles.balanceHeroIcon} resizeMode="contain" />
            </View>

            <View style={styles.balanceHeroDivider} />

            <View style={styles.balanceHeroFooter}>
               <View style={styles.balanceHeroStat}>
                 <Text style={styles.balanceHeroStatLabel}>WALLET</Text>
                 <Text style={styles.balanceHeroStatValue}>{parseFloat(abcdBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
               </View>
               <View style={styles.verticalDivider} />
               <View style={styles.balanceHeroStat}>
                 <Text style={styles.balanceHeroStatLabel}>ALLOCATION</Text>
                 <Text style={[styles.balanceHeroStatValue, { color: '#7042f8' }]}>{parseFloat(totalAllocatedAll).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
               </View>
            </View>
          </View>

          {/* SIMPLIFIED STATS GRID */}
          <View style={styles.simpleGrid}>
            <View style={styles.simpleStatCard}>
              <MaterialCommunityIcons name="timer-outline" size={wp(6)} color="#7042f8" style={styles.statIconFix} />

              <View style={styles.simpleStatTextCol}>
                <Text style={styles.simpleLabel}>ROUND 0{currentStageIndex + 1}</Text>
                <Text style={styles.simpleValue}>
                    {currentStageIndex === 0 ? 'SEED SALE' : 
                     currentStageIndex === 1 ? 'STRATEGIC' : 
                     currentStageIndex < 5 ? `CROWD SALE ${currentStageIndex - 1}` : 'SALE'}
                </Text>
                <Text style={styles.simpleSubValue}>{currentStageData?.price ? `${currentStageData.price.toFixed(7)} $` : '... $'}</Text>
              </View>
            </View>


            <View style={styles.simpleStatCard}>
              <MaterialCommunityIcons name="currency-usd" size={wp(6)} color="#7042f8" style={styles.statIconFix} />

              <View style={styles.simpleStatTextCol}>
                <Text style={styles.simpleLabel}>TOTAL RAISED</Text>
                <Text style={styles.simpleValue}>{parseFloat(globalTotalRaised).toLocaleString('en-US')} USD</Text>
              </View>
            </View>


            <View style={styles.simpleStatCard}>
              <Feather name="clock" size={wp(5)} color="#7042f8" style={styles.statIconFix} />

              <View style={styles.simpleStatTextCol}>
                <Text style={styles.simpleLabel}>ROUND ENDS</Text>
                <Text style={styles.simpleValue}>{roundTimeLeft}</Text>
              </View>
            </View>


            <View style={styles.simpleStatCard}>
              <MaterialCommunityIcons name="earth" size={wp(6)} color="#7042f8" style={styles.statIconFix} />

              <View style={styles.simpleStatTextCol}>
                <Text style={styles.simpleLabel}>ICO END</Text>
                <Text style={styles.simpleValue}>{globalTimeLeft}</Text>
              </View>
            </View>


            <View style={styles.simpleStatCard}>
              <MaterialCommunityIcons name="chart-donut" size={wp(6)} color="#7042f8" style={styles.statIconFix} />

              <View style={styles.simpleStatTextCol}>
                <Text style={styles.simpleLabel}>GLOBAL PROGRESS</Text>
                <Text style={styles.simpleValue}>{globalIcoPercent}%</Text>
              </View>
            </View>


            <View style={styles.simpleStatCard}>
              <MaterialCommunityIcons name="account-group-outline" size={wp(6)} color="#7042f8" style={styles.statIconFix} />

              <View style={styles.simpleStatTextCol}>
                <Text style={styles.simpleLabel}>PARTICIPANTS</Text>
                <Text style={styles.simpleValue}>
                    {participantCount.toLocaleString('en-US')} Users
                </Text>
              </View>
            </View>

          </View>

        </View>

        {/* VESTING DASHBOARD */}
        {isConnected && userSchedules.length > 0 && (
          <View style={[styles.container, { marginTop: -hp(2), paddingBottom: hp(10) }]}>
            <View style={styles.vestingHeader}>
              <View>
                <Text style={styles.vestingTitle}>My Allocations</Text>
                <Text style={styles.vestingSubtitle}>{userSchedules.length} Purchase Rounds</Text>
              </View>
            </View>

            {/* SUMMARY CLAIM ALL CARD */}
            <View style={styles.summaryClaimCard}>
               <View style={styles.summaryClaimContent}>
                  <Text style={styles.summaryClaimLabel}>TOTAL CLAIMABLE</Text>
                  <Text style={styles.summaryClaimValue}>{parseFloat(totalClaimableAll).toLocaleString('en-US', { minimumFractionDigits: 2 })} ABCD</Text>
                  <Text style={styles.summaryClaimSub}>Across all your purchase rounds</Text>
               </View>
               <TouchableOpacity 
                  style={[styles.summaryClaimBtn, parseFloat(totalClaimableAll) <= 0 && styles.summaryClaimBtnDisabled]} 
                  disabled={parseFloat(totalClaimableAll) <= 0}
                  onPress={handleClaimAll}
               >
                  <Text style={styles.summaryClaimBtnText}>CLAIM ALL</Text>
               </TouchableOpacity>

               <TouchableOpacity 
                 style={styles.detailsToggle} 
                 onPress={() => setShowAllSchedules(!showAllSchedules)}
               >
                 <Text style={styles.detailsToggleText}>{showAllSchedules ? 'Hide Details' : 'View Round Details'}</Text>
                 <Icon name={showAllSchedules ? "chevron-up" : "chevron-down"} size={16} color="#7042f8" />
               </TouchableOpacity>
            </View>

            {vestingStartTime === 0 && (
              <View style={[styles.securityFooter, { marginBottom: space(4), backgroundColor: 'rgba(112, 66, 248, 0.05)', borderColor: 'rgba(112, 66, 248, 0.2)', borderWidth: 1 }]}>
                <Icon name="time-outline" size={wp(5)} color="#7042f8" />
                <View style={styles.securityTexts}>
                  <Text style={[styles.securityTitle, { color: '#7042f8', fontSize: font(12) }]}>Vesting Pending</Text>
                  <Text style={styles.securityDesc}>The vesting period begins after the ICO distribution phase is completed. Your allocation is safely secured.</Text>
                </View>
              </View>
            )}

            {showAllSchedules && userSchedules.map((schedule, idx) => (
              <View key={idx} style={styles.refinedScheduleCard}>
                 {/* ... existing card content ... */}
                 <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeaderInfo}>
                    <View style={styles.roundIconSmall}>
                       <MaterialCommunityIcons name="layers-outline" size={wp(4)} color="#7042f8" />
                    </View>
                    <Text style={styles.cardRoundName}>{schedule.roundName}</Text>
                  </View>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>
                        {schedule.progress > 0 && schedule.progress < 0.01 ? '< 0.01' : schedule.progress.toFixed(2)}% Unlocked
                    </Text>
                  </View>
                </View>

                <View style={styles.cardMetricsGrid}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>TOTAL ALLOCATED</Text>
                    <Text style={styles.metricValue}>{parseFloat(schedule.totalAmount).toLocaleString('en-US')}</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>CLAIMED SO FAR</Text>
                    <Text style={styles.metricValue}>{parseFloat(schedule.claimedAmount).toLocaleString('en-US')}</Text>
                  </View>
                </View>

                <View style={styles.cardProgressContainer}>
                   <View style={styles.cardProgressTrack}>
                     <View style={[styles.cardProgressFill, { width: `${Math.max(schedule.progress > 0 ? 1 : 0, schedule.progress)}%` as any }]} />
                   </View>
                </View>


                <View style={styles.claimHeroSection}>
                   <View>
                     <Text style={styles.claimHeroLabel}>AVAILABLE TO CLAIM</Text>
                     <Text style={styles.claimHeroValue}>{parseFloat(schedule.claimableAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })} ABCD</Text>
                   </View>
                   <TouchableOpacity 
                    style={[styles.claimActionButton, parseFloat(schedule.claimableAmount) <= 0 && styles.claimActionDisabled]} 
                    disabled={parseFloat(schedule.claimableAmount) <= 0}
                    onPress={() => handleClaim(schedule.round)}
                  >
                    <Text style={styles.claimActionText}>CLAIM</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* TOKEN SELECTION MODAL */}
        <Modal
          visible={showTokenModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowTokenModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Asset</Text>
                <TouchableOpacity onPress={() => setShowTokenModal(false)} style={styles.modalCloseBtn}>
                  <Icon name="close" size={24} color="#a1a1aa" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space(4) }}>
                {TOKENS.map(token => (
                  <TouchableOpacity
                    key={token.symbol}
                    style={styles.tokenOptionCard}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSelectedToken(token);
                      setShowTokenModal(false);
                    }}
                  >
                    <View style={styles.tokenOptionLayout}>
                      <View style={styles.tokenIconWrapper}>
                        {token.symbol === 'BNB' && <Image source={require('../../assets/Binance.png')} style={styles.modalTokenIcon} resizeMode="contain" />}
                        {token.symbol === 'USDT' && <Image source={require('../../assets/USDT.png')} style={styles.modalTokenIcon} resizeMode="contain" />}
                        {token.symbol === 'USDC' && <Image source={require('../../assets/USDC.png')} style={[styles.modalTokenIcon, { transform: [{ scale: 1.3 }] }]} resizeMode="contain" />}
                        {token.symbol === 'WETH' && <Image source={require('../../assets/Ethereum.png')} style={[styles.modalTokenIcon, { transform: [{ scale: 1.5 }] }]} resizeMode="contain" />}
                        {token.symbol === 'WBTC' && <Image source={require('../../assets/Bitcoin.png')} style={[styles.modalTokenIcon, { transform: [{ scale: 1.2 }] }]} resizeMode="contain" />}
                      </View>

                      <View style={styles.tokenNameCol}>
                        <Text style={styles.tokenSymbolText}>{token.symbol}</Text>
                        <Text style={styles.tokenSubtitleText}>{token.name}</Text>
                      </View>

                      <View style={styles.tokenBalanceCol}>
                        <Text style={styles.tokenBalanceText}>
                          {tokenBalances[token.symbol] ? parseFloat(tokenBalances[token.symbol]).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '0.00'}
                        </Text>
                        {/* <Text style={styles.tokenBalanceLabel}>Balance</Text> */}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* SUCCESS MODAL */}
        <Modal
          visible={showSuccessModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowSuccessModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { alignItems: 'center', paddingVertical: space(8) }]}>
              <View style={styles.successIconCircle}>
                <Icon name="checkmark-circle" size={hp(10)} color="#4ade80" />
              </View>

              <Text style={styles.successTitle}>Success!</Text>
              <Text style={styles.successDesc}>
                Your purchase was successful. Your tokens are now secured in the Vesting Vault and will unlock according to the stage schedule.
              </Text>

              <View style={styles.txnHashSection}>
                <Text style={styles.txnHashLabel}>TRANSACTION HASH</Text>
                <View style={styles.hashLine} />
                <Text style={styles.txnHashValue} numberOfLines={1} ellipsizeMode="middle">
                  {txnHash}
                </Text>

                <TouchableOpacity
                  style={styles.explorerLink}
                  onPress={() => Linking.openURL(`https://testnet.bscscan.com/tx/${txnHash}`)}
                >
                  <Text style={styles.explorerLinkText}>View on Explorer</Text>
                  <Feather name="external-link" size={14} color="#7042f8" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => setShowSuccessModal(false)}
              >
                <Text style={styles.doneBtnText}>Great!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <WalletModal
          visible={showWalletModal}
          onClose={() => setShowWalletModal(false)}
          onWalletConnect={handleWalletConnect}
        />

        {/* VERIFICATION MODAL */}
        <Modal
          visible={showVerificationModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => isWalletVerified ? setShowVerificationModal(false) : null}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { paddingVertical: space(6) }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, isWrongWallet && { color: '#ef4444' }]}>
                  {isWrongWallet ? 'Wrong Wallet' : 'Verify Wallet'}
                </Text>
                {(isWalletVerified && !isWrongWallet) && (
                  <TouchableOpacity onPress={() => setShowVerificationModal(false)} style={styles.modalCloseBtn}>
                    <Icon name="close" size={24} color="#a1a1aa" />
                  </TouchableOpacity>
                )}
              </View>

              {isWrongWallet || isAlreadyUsed ? (
                <>
                  <Text style={{ color: '#ef4444', fontSize: font(15), fontFamily: Fonts.bold, marginBottom: space(2) }}>
                    {isAlreadyUsed ? 'Wallet Already In Use' : ''}
                  </Text>
                  <Text style={{ color: '#d1d5db', fontSize: font(13), fontFamily: Fonts.regular, marginBottom: space(4), lineHeight: 20 }}>
                    {isAlreadyUsed 
                      ? (usedErrorMessage || "This wallet is already bound to another participant's profile. Please disconnect and use a fresh wallet to join the ICO.")
                      : "This profile is already linked to a different wallet address. To participate, please switch your address in your mobile wallet or disconnect to try another."}
                  </Text>

                  
                  {isWrongWallet && (
                    <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: space(4), borderRadius: radius(2), borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)', marginBottom: space(6) }}>
                      <Text style={{ color: '#9ca3af', fontSize: font(10), fontFamily: Fonts.medium, marginBottom: 4 }}>LINKED ADDRESS:</Text>
                      <Text style={{ color: '#e5e7eb', fontSize: font(12), fontFamily: Fonts.medium, letterSpacing: 0.5 }}>{boundAddress}</Text>
                    </View>
                  )}

                </>
              ) : (
                <>
                  <Text style={{ color: '#d1d5db', fontSize: font(13), fontFamily: Fonts.regular, marginBottom: space(4), lineHeight: 20 }}>
                    To participate in the ICO, please verify your wallet ownership by signing a message.
                  </Text>

                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: space(6), backgroundColor: 'rgba(112, 66, 248, 0.1)', padding: space(3), borderRadius: radius(2), borderWidth: 1, borderColor: 'rgba(112, 66, 248, 0.2)' }}>
                    <Icon name="information-circle-outline" size={wp(5)} color="#7042f8" style={{ marginRight: space(2), marginTop: 2 }} />
                    <Text style={{ color: '#9ca3af', fontSize: font(11), fontFamily: Fonts.medium, flex: 1, lineHeight: 16 }}>
                      Once linked, this wallet will be used for your ICO participation and cannot be changed without contacting the team.
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space(6) }}
                    activeOpacity={0.7}
                    onPress={() => setHasConsent(!hasConsent)}
                  >
                    <View style={{ width: wp(5), height: wp(5), borderRadius: 4, borderWidth: 1.5, borderColor: hasConsent ? '#7042f8' : '#6b7280', backgroundColor: hasConsent ? '#7042f8' : 'transparent', justifyContent: 'center', alignItems: 'center', marginRight: space(3) }}>
                      {hasConsent && <Icon name="checkmark" size={wp(3.5)} color="#fff" />}
                    </View>
                    <Text style={{ color: '#e5e7eb', fontSize: font(12), fontFamily: Fonts.medium, flex: 1 }}>
                      I understand that this wallet will be permanently linked to my account for this ICO.
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={[styles.doneBtn, (!(isWrongWallet || isAlreadyUsed) && (!hasConsent || isVerifying)) && { backgroundColor: '#3f3f46' }]}
                onPress={() => {
                  if (isWrongWallet || isAlreadyUsed) {
                    if (wallet) disconnect(wallet);
                    setIsAlreadyUsed(false);
                    setHasConsent(false);
                  } else {
                    handleVerifyWallet();
                  }
                }}
                disabled={!(isWrongWallet || isAlreadyUsed) && (!hasConsent || isVerifying)}
              >
                <Text style={[styles.doneBtnText, (!(isWrongWallet || isAlreadyUsed) && (!hasConsent || isVerifying)) && { color: '#9ca3af' }]}>
                  {(isWrongWallet || isAlreadyUsed) ? 'Disconnect Wallet' : isVerifying ? 'Verifying...' : 'Sign & Verify'}
                </Text>
              </TouchableOpacity>

            </View>
          </View>
        </Modal>


      </ScrollView>
      <Toast />
    </SafeAreaView >
  );
}

const createStyles = (
  wp: { (percent: number): number; (arg0: number): any },
  hp: { (percent: number): number; (arg0: number): number },
  font: { (size: number): number; (arg0: number): any },
  radius: { (size: number): number; (arg0: number): any },
  space: { (size: number): number; (arg0: number): any },
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: space(5),
    },
    topNav: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: hp(4),
      marginTop: hp(1),
    },
    navLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    brandTitle: {
      color: '#fff',
      fontSize: font(18),
      fontFamily: Fonts.bold,
      marginLeft: space(2),
      letterSpacing: 0.5,
    },
    brandHighlight: {
      color: '#7042f8',
    },
    walletBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#161618',
      borderRadius: radius(10),
      padding: space(1),
      borderWidth: 1,
      borderColor: '#202124',
    },
    networkBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(231, 225, 53, 0.1)',
      paddingHorizontal: space(2.5),
      paddingVertical: space(1.5),
      borderRadius: radius(10),
      marginRight: space(1),
    },
    miniBnbIcon: {
      width: wp(3.5),
      height: wp(3.5),
      marginRight: space(1.5),
    },
    networkName: {
      color: '#e7e135',
      fontSize: font(10),
      fontFamily: Fonts.bold,
    },
    addressPill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: space(2),
      paddingRight: space(0.5),
    },
    truncatedAddress: {
      color: '#d1d5db',
      fontSize: font(13),
      fontFamily: Fonts.medium,
      marginRight: space(2),
    },
    jazziconBox: {
      width: wp(8),
      height: wp(8),
      borderRadius: wp(4),
      overflow: 'hidden',
      backgroundColor: '#202124',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#303036',
    },
    navTokenText: {
      color: '#7042f8',
      fontSize: font(14),
      fontFamily: Fonts.bold,
      letterSpacing: 0.5,
      marginRight: space(2),
    },
    navTokenIconContainer: {
      width: wp(6),
      height: wp(6),
      backgroundColor: '#7042f8',
      borderRadius: wp(1.5),
      justifyContent: 'center',
      alignItems: 'center',
    },
    heroSection: {
      marginBottom: hp(4),
    },
    heroTitleLine1: {
      color: '#fff',
      fontSize: font(36),
      fontFamily: Fonts.bold,
      lineHeight: font(40),
    },
    heroTitleLine2: {
      color: '#fff',
      fontSize: font(36),
      fontFamily: Fonts.bold,
      lineHeight: font(40),
      marginBottom: hp(2),
    },
    heroTitleHighlight: {
      color: '#7042f8',
    },
    heroSubtitle: {
      color: '#9ca3af',
      fontSize: font(14),
      fontFamily: Fonts.regular,
      lineHeight: 22,
    },
    mainSwapCard: {
      backgroundColor: '#161618',
      borderRadius: radius(4),
      padding: space(4),
      marginBottom: hp(5),
      marginTop: hp(4),
    },
    swapSectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: hp(1.5),
    },
    swapSectionTitle: {
      color: '#d1d5db',
      fontSize: font(12),
      fontFamily: Fonts.medium,
      letterSpacing: 1,
    },
    swapSectionSubtitle: {
      color: '#6b7280',
      fontSize: font(11),
      marginTop: hp(1),
      fontFamily: Fonts.regular,
    },
    swapInputRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: '#202124',
      borderRadius: radius(3),
      padding: space(4),
      marginBottom: hp(2),
    },
    swapInputCol: {
      flex: 1,
    },
    swapInputPrimary: {
      color: '#fff',
      fontSize: font(28),
      fontFamily: Fonts.bold,
      padding: 0,
      marginBottom: 4,
    },
    swapInputSecondary: {
      color: '#6b7280',
      fontSize: font(12),
      fontFamily: Fonts.regular,
    },
    tokenPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#303036',
      paddingHorizontal: space(3),
      paddingVertical: space(2),
      borderRadius: radius(5),
    },
    pillIcon: {
      width: wp(7.5),
      height: wp(7.5),
      marginRight: space(2),
    },
    pillText: {
      color: '#fff',
      fontSize: font(14),
      fontFamily: Fonts.bold,
      marginRight: space(1),
    },
    centerArrowContainer: {
      alignItems: 'center',
      marginVertical: -hp(3.5),
      zIndex: 10,
    },
    centerArrowCircle: {
      backgroundColor: '#0f0f11',
      width: wp(11),
      height: wp(11),
      borderRadius: wp(5.5),
      justifyContent: 'center',
      alignItems: 'center',
    },
    buyBtn: {
      backgroundColor: '#7042f8',
      borderRadius: radius(3),
      height: hp(7),
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: hp(4),
    },
    buyBtnText: {
      color: '#fff',
      fontSize: font(16),
      fontFamily: Fonts.bold,
      letterSpacing: 1,
    },
    progressSection: {
      marginBottom: hp(4),
    },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: hp(1.5),
    },
    progressTitle: {
      color: '#fff',
      fontSize: font(18),
      fontFamily: Fonts.bold,
    },
    progressPercent: {
      color: '#7042f8',
      fontSize: font(16),
      fontFamily: Fonts.bold,
    },
    progressBarTrack: {
      height: hp(1.5),
      backgroundColor: '#202124',
      borderRadius: radius(2),
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: '#7042f8',
      borderRadius: radius(2),
    },
    progressSubInfo: {
      color: '#6b7280',
      fontSize: font(9),
      fontFamily: Fonts.medium,
      marginTop: space(1),
      textAlign: 'right',
      letterSpacing: 0.5,
    },
    balanceHeroCard: {
      backgroundColor: '#1a1b1e',
      borderRadius: radius(4),
      padding: space(5),
      marginBottom: hp(2.5),
      borderWidth: 1,
      borderColor: '#2d2d30',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    balanceHeroHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    balanceHeroTitle: {
      color: '#9ca3af',
      fontSize: font(12),
      fontFamily: Fonts.medium,
      letterSpacing: 1,
      marginBottom: space(1),
    },
    balanceHeroAmount: {
      color: '#fff',
      fontSize: font(28),
      fontFamily: Fonts.bold,
      letterSpacing: 0.5,
    },
    balanceHeroUsd: {
      color: '#4ade80',
      fontSize: font(14),
      fontFamily: Fonts.medium,
      marginTop: space(0.5),
    },
    balanceHeroIcon: {
      width: wp(14),
      height: wp(14),
      opacity: 0.9,
    },
    balanceHeroDivider: {
      height: 1,
      backgroundColor: '#2d2d30',
      marginVertical: space(4),
    },
    balanceHeroFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    balanceHeroStat: {
      flex: 1,
    },
    balanceHeroStatLabel: {
      color: '#6b7280',
      fontSize: font(10),
      fontFamily: Fonts.bold,
      letterSpacing: 0.5,
      marginBottom: space(0.5),
    },
    balanceHeroStatValue: {
      color: '#fff',
      fontSize: font(15),
      fontFamily: Fonts.bold,
    },
    verticalDivider: {
      width: 1,
      height: hp(3),
      backgroundColor: '#2d2d30',
      marginHorizontal: space(4),
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: hp(4),
    },
    simpleGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: hp(5),
    },
    simpleStatCard: {
      width: '48.5%',
      backgroundColor: '#161618',
      borderRadius: radius(3),
      padding: space(3.5),
      marginBottom: space(3),
      flexDirection: 'row',
      alignItems: 'flex-start', // Align to top
      borderWidth: 1,
      borderColor: '#202124',
    },
    statIconFix: {
      marginTop: space(4.2), // Drops the icon center to match the big white value text center
    },



    simpleStatTextCol: {
      marginLeft: space(3),
      flex: 1,
    },
    simpleLabel: {
      color: '#6b7280',
      fontSize: font(9),
      fontFamily: Fonts.medium,
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    simpleValue: {
      color: '#fff',
      fontSize: font(13),
      fontFamily: Fonts.bold,
    },
    simpleSubValue: {
      color: '#7042f8',
      fontSize: font(12),
      fontFamily: Fonts.medium,
      marginTop: 2,
    },
    securityFooter: {
      flexDirection: 'row',
      backgroundColor: '#161618',
      padding: space(4),
      borderRadius: radius(3),
      alignItems: 'flex-start',
      marginBottom: hp(10),
    },
    securityTexts: {
      flex: 1,
      marginLeft: space(3),
    },
    securityTitle: {
      color: '#fff',
      fontSize: font(14),
      fontFamily: Fonts.bold,
      marginBottom: space(1),
    },
    securityDesc: {
      color: '#9ca3af',
      fontSize: font(12),
      fontFamily: Fonts.regular,
      lineHeight: 18,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.8)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: '#161618',
      borderRadius: radius(5),
      paddingHorizontal: space(4),
      paddingVertical: space(5),
      width: '88%',
      maxHeight: '65%',
      borderWidth: 1,
      borderColor: '#2d2d33',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: space(4),
    },
    modalCloseBtn: {
      padding: space(1),
    },
    modalTitle: {
      fontSize: font(20),
      color: '#fff',
      fontFamily: Fonts.bold,
    },
    tokenOptionCard: {
      backgroundColor: '#1b1b1e',
      borderRadius: radius(3),
      paddingVertical: space(2.5),
      paddingHorizontal: space(3.5),
      marginBottom: space(2),
      borderWidth: 1,
      borderColor: '#2d2d33',
    },
    tokenOptionLayout: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    tokenIconWrapper: {
      width: wp(9.5),
      height: wp(9.5),
      borderRadius: wp(5),
      backgroundColor: '#202124',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: space(3),
    },
    modalTokenIcon: {
      width: '85%',
      height: '85%',
    },
    tokenNameCol: {
      flex: 1,
    },
    tokenSymbolText: {
      fontSize: font(15),
      color: '#fff',
      fontFamily: Fonts.bold,
    },
    tokenSubtitleText: {
      fontSize: font(10),
      color: '#6b7280',
      fontFamily: Fonts.medium,
      marginTop: 1,
    },
    tokenBalanceCol: {
      alignItems: 'flex-end',
    },
    tokenBalanceText: {
      fontSize: font(14),
      color: '#fff',
      fontFamily: Fonts.bold,
    },
    tokenBalanceLabel: {
      fontSize: font(9),
      color: '#7042f8',
      fontFamily: Fonts.medium,
      marginTop: 0,
    },
    roundBanner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: '#161618',
      borderRadius: radius(4),
      padding: space(4),
      marginTop: hp(1),
      marginBottom: hp(10),
      borderWidth: 1,
      borderColor: '#202124',
    },
    roundLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    activeDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#4ade80',
      marginRight: space(2),
    },
    roundLabel: {
      color: '#fff',
      fontFamily: Fonts.bold,
      fontSize: font(12),
      letterSpacing: 0.5,
    },
    roundRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    priceLabel: {
      color: '#6b7280',
      fontFamily: Fonts.medium,
      fontSize: font(12),
      marginRight: space(2),
    },
    priceValue: {
      color: '#7042f8',
      fontFamily: Fonts.bold,
      fontSize: font(14),
    },
    successIconCircle: {
      width: hp(14),
      height: hp(14),
      borderRadius: hp(7),
      backgroundColor: 'rgba(74, 222, 128, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: space(4),
    },
    successTitle: {
      color: '#fff',
      fontSize: font(24),
      fontFamily: Fonts.bold,
      marginBottom: space(2),
    },
    successDesc: {
      color: '#9ca3af',
      fontSize: font(14),
      fontFamily: Fonts.medium,
      textAlign: 'center',
      paddingHorizontal: space(4),
      lineHeight: 20,
      marginBottom: space(6),
    },
    txnHashSection: {
      width: '100%',
      backgroundColor: '#1b1b1e',
      borderRadius: radius(4),
      padding: space(4),
      marginBottom: space(6),
      borderWidth: 1,
      borderColor: '#2d2d33',
    },
    txnHashLabel: {
      color: '#6b7280',
      fontSize: font(10),
      fontFamily: Fonts.bold,
      letterSpacing: 1,
      marginBottom: space(2),
    },
    hashLine: {
      height: 1,
      backgroundColor: '#2d2d33',
      marginBottom: space(3),
    },
    txnHashValue: {
      color: '#d1d5db',
      fontSize: font(12),
      fontFamily: Fonts.medium,
      marginBottom: space(3),
    },
    explorerLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(112, 66, 248, 0.1)',
      paddingVertical: space(2),
      borderRadius: radius(2),
    },
    explorerLinkText: {
      color: '#7042f8',
      fontSize: font(13),
      fontFamily: Fonts.bold,
      marginRight: space(2),
    },
    doneBtn: {
      width: '100%',
      backgroundColor: '#7042f8',
      paddingVertical: space(4),
      borderRadius: radius(3),
      alignItems: 'center',
    },
    doneBtnText: {
      color: '#fff',
      fontSize: font(16),
      fontFamily: Fonts.bold,
    },
    addTokenBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#161618',
      padding: space(4),
      borderRadius: radius(4),
      marginBottom: hp(5),
      borderWidth: 1,
      borderColor: '#202124',
      marginTop: hp(2),
    },
    addTokenLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    addTokenIconBox: {
      width: wp(12),
      height: wp(12),
      borderRadius: wp(6),
      backgroundColor: '#1b1b1e',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: space(3),
      borderWidth: 1,
      borderColor: '#2d2d33',
    },
    addTokenTitle: {
      color: '#fff',
      fontSize: font(13),
      fontFamily: Fonts.bold,
    },
    addTokenSub: {
      color: '#6b7280',
      fontSize: font(10),
      fontFamily: Fonts.medium,
      marginTop: 2,
    },
    addTokenBtn: {
      backgroundColor: 'rgba(112, 66, 248, 0.1)',
      paddingHorizontal: space(6),
      paddingVertical: space(2),
      borderRadius: radius(2),
      borderWidth: 1,
      borderColor: 'rgba(112, 66, 248, 0.3)',
    },
    addTokenBtnText: {
      color: '#7042f8',
      fontSize: font(12),
      fontFamily: Fonts.bold,
    },
    wrongNetworkBanner: {
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      paddingVertical: space(2),
      paddingHorizontal: space(4),
      borderRadius: radius(2),
      marginBottom: hp(2),
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.3)',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: hp(-2),
    },
    wrongNetworkText: {
      color: '#ef4444',
      fontSize: font(12),
      fontFamily: Fonts.bold,
      marginLeft: space(2),
    },
    vestingHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: space(4),
      paddingHorizontal: space(1),
    },
    vestingTitle: {
      color: '#fff',
      fontSize: font(20),
      fontFamily: Fonts.bold,
    },
    vestingSubtitle: {
      color: '#6b7280',
      fontSize: font(12),
      fontFamily: Fonts.medium,
      marginTop: 2,
    },
    claimAllBtn: {
      backgroundColor: 'rgba(112, 66, 248, 0.1)',
      borderWidth: 1,
      borderColor: '#7042f8',
      paddingHorizontal: space(4),
      paddingVertical: space(2),
      borderRadius: radius(2),
    },
    claimAllBtnText: {
      color: '#7042f8',
      fontSize: font(12),
      fontFamily: Fonts.bold,
    },
    refinedScheduleCard: {
      backgroundColor: '#1a1b1e',
      borderRadius: radius(4),
      padding: space(4),
      marginBottom: hp(2),
      borderWidth: 1,
      borderColor: '#2d2d30',
    },
    cardHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: space(4),
    },
    cardHeaderInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    roundIconSmall: {
      width: wp(8),
      height: wp(8),
      borderRadius: radius(2),
      backgroundColor: 'rgba(112, 66, 248, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: space(2),
    },
    cardRoundName: {
      color: '#fff',
      fontSize: font(14),
      fontFamily: Fonts.bold,
    },
    statusBadge: {
      backgroundColor: 'rgba(112, 66, 248, 0.1)',
      paddingHorizontal: space(3),
      paddingVertical: space(1),
      borderRadius: radius(1.5),
      borderWidth: 1,
      borderColor: 'rgba(112, 66, 248, 0.2)',
    },
    statusBadgeText: {
      color: '#7042f8',
      fontSize: font(10),
      fontFamily: Fonts.bold,
    },
    cardMetricsGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: space(4),
    },
    metricItem: {
      flex: 1,
    },
    metricLabel: {
      color: '#6b7280',
      fontSize: font(9),
      fontFamily: Fonts.bold,
      marginBottom: 4,
      letterSpacing: 0.5,
    },
    metricValue: {
      color: '#fff',
      fontSize: font(14),
      fontFamily: Fonts.medium,
    },
    cardProgressContainer: {
      marginBottom: space(5),
    },
    cardProgressTrack: {
      height: 4,
      backgroundColor: '#2d2d30',
      borderRadius: 2,
      overflow: 'hidden',
    },
    cardProgressFill: {
      height: '100%',
      backgroundColor: '#7042f8',
      borderRadius: 2,
    },
    claimHeroSection: {
      backgroundColor: 'rgba(32, 33, 36, 0.5)',
      borderRadius: radius(3),
      padding: space(3.5),
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#2d2d30',
    },
    claimHeroLabel: {
      color: '#9ca3af',
      fontSize: font(9),
      fontFamily: Fonts.bold,
      marginBottom: 2,
      letterSpacing: 0.5,
    },
    claimHeroValue: {
      color: '#4ade80',
      fontSize: font(16),
      fontFamily: Fonts.bold,
    },
    claimActionButton: {
      backgroundColor: '#7042f8',
      paddingHorizontal: space(6),
      paddingVertical: space(2),
      borderRadius: radius(2),
    },
    claimActionDisabled: {
      backgroundColor: '#2d2d30',
      opacity: 0.5,
    },
    claimActionText: {
      color: '#fff',
      fontSize: font(12),
      fontFamily: Fonts.bold,
    },
    summaryClaimCard: {
      backgroundColor: '#1a1b1e',
      borderRadius: radius(4),
      padding: space(5),
      marginBottom: hp(2.5),
      borderWidth: 2,
      borderColor: '#7042f8',
      alignItems: 'center',
    },
    summaryClaimContent: {
      alignItems: 'center',
      marginBottom: space(5),
    },
    summaryClaimLabel: {
      color: '#9ca3af',
      fontSize: font(10),
      fontFamily: Fonts.bold,
      letterSpacing: 1.5,
      marginBottom: space(2),
    },
    summaryClaimValue: {
      color: '#fff',
      fontSize: font(26),
      fontFamily: Fonts.bold,
    },
    summaryClaimSub: {
      color: '#6b7280',
      fontSize: font(12),
      fontFamily: Fonts.medium,
      marginTop: space(1),
    },
    summaryClaimBtn: {
      backgroundColor: '#7042f8',
      width: '100%',
      paddingVertical: space(3.5),
      borderRadius: radius(2),
      alignItems: 'center',
      marginBottom: space(4),
      shadowColor: '#7042f8',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    summaryClaimBtnText: {
      color: '#fff',
      fontSize: font(14),
      fontFamily: Fonts.bold,
      letterSpacing: 1,
    },
    summaryClaimBtnDisabled: {
      backgroundColor: '#2d2d30',
      shadowOpacity: 0,
      elevation: 0,
    },
    detailsToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: space(1),
    },
    detailsToggleText: {
      color: '#7042f8',
      fontSize: font(13),
      fontFamily: Fonts.bold,
      marginRight: space(1),
    },
    claimableGroup: {
      flex: 1,
    },
    claimableLabel: {
      color: '#4ade80',
      fontSize: font(9),
      fontFamily: Fonts.bold,
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    claimableValue: {
      color: '#fff',
      fontSize: font(15),
      fontFamily: Fonts.bold,
    },
    miniClaimBtn: {
      backgroundColor: '#7042f8',
      paddingHorizontal: space(6),
      paddingVertical: space(2.5),
      borderRadius: radius(2),
    },
    miniClaimBtnDisabled: {
      backgroundColor: '#2d2d30',
    },
    miniClaimBtnText: {
      color: '#fff',
      fontSize: font(12),
      fontFamily: Fonts.bold,
    },
  });
