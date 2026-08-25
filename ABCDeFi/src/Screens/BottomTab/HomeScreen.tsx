import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  BackHandler,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import FastImage from 'react-native-fast-image';
import { Colors } from '../../Utils/Colors';
import Fonts from '../../Utils/Fonts';
import { useResponsive } from '../../Utils/Responsive';
import {
  useActiveAccount,
  useActiveWalletChain,
  useActiveWalletConnectionStatus,
  useConnect,
  useActiveWallet,
  ConnectButton,
} from 'thirdweb/react';
import { bscTestnet_custom, thirdwebClient } from '../../Config/thirdwebConfig';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../Store/Store';
import { useFocusEffect } from '@react-navigation/native';
import { fetchTimerIco, fetchRewardStatus } from '../../Store/Slices/homeSlice';
import { downloadWhitepaper } from '../../Store/Slices/authSlice';
import { fetchProfile } from '../../Store/Slices/profileSlice';
import { WalletModal } from '../../components/WalletModal';
import { createWallet, WalletId } from 'thirdweb/wallets';
import { bscTestnet } from 'thirdweb/chains';
import { useDisconnect, useSwitchActiveWalletChain } from 'thirdweb/react';
import { PROJECT_ID, IMAGE_URL } from '@env';
import { ethers } from 'ethers';
import icoABI from '../../abi/ico.json';
import { checkWalletInstalled, showInstallationAlert, WALLET_METADATA } from '../../Utils/WalletDetection';
import { expected_chainID, ICO_CONTRACT_ADDRESS } from './IcoScreen';
import ReactNativeBlobUtil from 'react-native-blob-util';

// ─────────────────────────────────────────────
//  QUICK ACTIONS
// ─────────────────────────────────────────────
const QUICK_ACTIONS = [
  { icon: 'layers-outline', label: 'Buy Tokens', nav: 'ICO', color: '#6C3CF0' },
  { icon: 'cash-outline', label: 'Borrow', nav: 'Loans', color: '#3B82F6' },
  { icon: 'trending-up-outline', label: 'Lend', nav: 'Loans', color: '#22C55E' },
  { icon: 'images-outline', label: 'Mint NFT', nav: 'FranchiseNFT', color: '#F7A41D' },
];

// ─────────────────────────────────────────────
//  MOCK SUMMARY DATA (augmented by live data)
// ─────────────────────────────────────────────
const MOCK_PORTFOLIO = { value: '$35,840', change: '+8.25%', positive: true };
const MOCK_WALLET = { abcd: '1,250', eth: '3.00', usdc: '800' };
const MOCK_LOAN: any = null; // Default loan hidden
const MOCK_REWARDS = { claimable: '257.5 ABCD', pending: true };
const MOCK_TRANSACTIONS = [
  { icon: 'cash-outline', label: 'EMI Payment', amount: '-87.5 ABCD', date: '31 Jul 2026', positive: false },
  { icon: 'trending-up-outline', label: 'Staking Reward', amount: '+87.5 ABCD', date: '15 Jul 2026', positive: true },
  { icon: 'gift-outline', label: 'KYC Bonus', amount: '+50 ABCD', date: '02 Jul 2026', positive: true },
  { icon: 'layers-outline', label: 'ICO Purchase', amount: '-0.32 ETH', date: '01 Jul 2026', positive: false },
];

// ─────────────────────────────────────────────
//  MAIN HOME SCREEN
// ─────────────────────────────────────────────
export default function HomeScreen({ navigation }: any) {
  const { wp, hp, font, radius } = useResponsive();
  const { disconnect } = useDisconnect();
  const { connect } = useConnect();
  const { user } = useSelector((state: RootState) => state.auth);
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const chain = useActiveWalletChain();
  const switchChain = useSwitchActiveWalletChain();
  const address = account?.address;
  const isConnected = !!account;
  const dispatch = useDispatch<any>();
  const [imgError, setImgError] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  const { rewardStatus } = useSelector((state: RootState) => state.home);
  const { profileData } = useSelector((state: RootState) => state.profile);

  // ICO countdown
  const [icoStats, setIcoStats] = useState({
    startTime: 0, endTime: 0, totalCap: '0', totalSold: '0', isLoading: true,
  });
  const [timeLeft, setTimeLeft] = useState({ days: '00', hours: '00', minutes: '00', seconds: '00' });

  const fetchICOData = async () => {
    try {
      const provider = new ethers.JsonRpcProvider('https://bsc-testnet.publicnode.com');
      const icoContract = new ethers.Contract(ICO_CONTRACT_ADDRESS, icoABI, provider);
      const [summary, , startTimeBN, endTimeBN] = await Promise.all([
        icoContract.getIcoSummary(),
        icoContract.getCurrentStageData(),
        icoContract.icoStartTime(),
        icoContract.icoEndTime(),
      ]);
      const [totalSoldGlobal, totalCapGlobal] = summary;
      setIcoStats({
        startTime: Number(startTimeBN),
        endTime: Number(endTimeBN),
        totalCap: ethers.formatUnits(totalCapGlobal, 18),
        totalSold: ethers.formatUnits(totalSoldGlobal, 18),
        isLoading: false,
      });
    } catch {
      setIcoStats(prev => ({ ...prev, isLoading: false }));
    }
  };

  useEffect(() => {
    dispatch(fetchProfile());
    dispatch(fetchRewardStatus());
    fetchICOData();
    const interval = setInterval(() => fetchICOData(), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const tick = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      let target = icoStats.startTime > 0 && now < icoStats.startTime
        ? icoStats.startTime : icoStats.endTime;
      if (!target || target <= now) {
        setTimeLeft({ days: '00', hours: '00', minutes: '00', seconds: '00' });
        return;
      }
      const diff = target - now;
      setTimeLeft({
        days: String(Math.floor(diff / 86400)).padStart(2, '0'),
        hours: String(Math.floor((diff % 86400) / 3600)).padStart(2, '0'),
        minutes: String(Math.floor((diff % 3600) / 60)).padStart(2, '0'),
        seconds: String(diff % 60).padStart(2, '0'),
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [icoStats.startTime, icoStats.endTime]);

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        Alert.alert('Exit App', 'Are you sure you want to exit?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Exit', onPress: () => BackHandler.exitApp() },
        ]);
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [])
  );

  useEffect(() => {
    if (isConnected && chain && chain.id !== expected_chainID) {
      try { switchChain(bscTestnet_custom); } catch {}
    }
  }, [isConnected, chain]);

  const handleWalletConnect = async (walletId: string) => {
    try {
      if (WALLET_METADATA[walletId]) {
        const installed = await checkWalletInstalled(walletId);
        if (!installed) { showInstallationAlert(walletId); return; }
      }
      const w = createWallet(walletId as WalletId);
      await connect(async () => {
        await w.connect({
          client: thirdwebClient, chain: bscTestnet_custom,
          walletConnect: { projectId: PROJECT_ID, appMetadata: { name: 'ABCDefi', url: 'https://abcdefi.com', description: 'ABCDefi DeFi Platform', logoUrl: '' } },
        });
        return w;
      });
      setShowWalletModal(false);
    } catch {}
  };

  const imageUrl = profileData?.image
    ? `${IMAGE_URL.replace(/\/$/, '')}/${(profileData as any).image.replace(/^\//, '')}`
    : null;

  const kycStatus = (profileData as any)?.kycStatus || 'Pending';
  const userName = (profileData as any)?.name || (user as any)?.name || 'User';
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not Connected';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: '#2B0A57' }]} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: hp(14) }}
      >
        {/* ── HEADER ── */}
        <LinearGradient
          colors={['#2B0A57', '#1A1A2E']}
          style={[styles.header, { paddingHorizontal: wp(5), paddingBottom: hp(3) }]}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.navigate('SettingsScreen')}
              style={styles.headerLeft}
              activeOpacity={0.8}
            >
              <FastImage
                key={imageUrl}
                source={
                  imageUrl && !imgError
                    ? { uri: imageUrl }
                    : require('../../../assets/Images/place.jpg')
                }
                style={[styles.avatar, { borderRadius: radius(10) }]}
                onError={() => setImgError(true)}
                resizeMode="cover"
              />
              <View style={{ marginLeft: wp(3) }}>
                <Text style={[styles.greet, { fontSize: font(11) }]}>Welcome back 👋</Text>
                <Text style={[styles.name, { fontSize: font(17) }]}>{userName}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('NotificationScreen')}
              style={[styles.bellBtn, { borderRadius: radius(6) }]}
            >
              <Icon name="notifications-outline" size={font(20)} color="#FFF" />
              {/* Notification dot */}
              <View style={styles.notifDot} />
            </TouchableOpacity>
          </View>

          {/* ── PORTFOLIO VALUE CARD ── */}
          <View style={[styles.portfolioCard, { borderRadius: radius(4), marginTop: hp(2.5), padding: hp(2.5) }]}>
            <Text style={[styles.portfolioLabel, { fontSize: font(11) }]}>Total Portfolio Value</Text>
            <Text style={[styles.portfolioValue, { fontSize: font(30) }]}>{MOCK_PORTFOLIO.value}</Text>
            <View style={[styles.changeRow, { marginTop: 6 }]}>
              <View style={[styles.changeBadge, { backgroundColor: 'rgba(34,197,94,0.18)', borderRadius: radius(4) }]}>
                <Icon name="trending-up" size={font(12)} color="#22C55E" />
                <Text style={[styles.changeText, { fontSize: font(11.5), color: '#22C55E' }]}>
                  {MOCK_PORTFOLIO.change} today
                </Text>
              </View>
            </View>

            {/* Token Balances */}
            <View style={[styles.tokenRow, { marginTop: hp(2) }]}>
              <TokenBadge symbol="ABCD" amount={MOCK_WALLET.abcd} color="#6C3CF0" />
              <TokenBadge symbol="ETH" amount={MOCK_WALLET.eth} color="#627EEA" />
              <TokenBadge symbol="USDC" amount={MOCK_WALLET.usdc} color="#22C55E" />
            </View>
          </View>

          {/* ── WALLET STATUS ── */}
          <View style={[styles.walletRow, { marginTop: hp(1.5), borderRadius: radius(3), padding: hp(1.2) }]}>
            <View style={styles.walletLeft}>
              <View style={[styles.walletDot, { backgroundColor: isConnected ? '#22C55E' : '#9CA3AF' }]} />
              <Icon name="wallet-outline" size={font(14)} color={isConnected ? '#A5F3B5' : '#D0B8FF'} />
              <Text style={[styles.walletText, { fontSize: font(11), color: isConnected ? '#A5F3B5' : '#D0B8FF' }]}>
                {isConnected ? shortAddress : 'Wallet Not Connected'}
              </Text>
            </View>
            {!isConnected ? (
              <TouchableOpacity
                onPress={() => setShowWalletModal(true)}
                style={[styles.connectBtn, { borderRadius: radius(2) }]}
              >
                <Text style={[styles.connectBtnText, { fontSize: font(10.5) }]}>Connect</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.networkBadge, { borderRadius: radius(1.5) }]}>
                <Text style={[styles.networkText, { fontSize: font(9.5) }]}>BSC Testnet</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        <View style={[styles.body, { paddingHorizontal: wp(4), paddingTop: hp(2) }]}>

          {/* ── QUICK ACTIONS ── */}
          <Text style={[styles.sectionTitle, { fontSize: font(14), marginBottom: hp(1.5) }]}>
            Quick Actions
          </Text>
          <View style={[styles.quickActionsGrid, { marginBottom: hp(2.5) }]}>
            {QUICK_ACTIONS.map((action, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => navigation.navigate(action.nav)}
                style={[styles.quickCard, { borderRadius: radius(3.5), padding: hp(2) }]}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.quickIconBox,
                    { backgroundColor: action.color + '18', borderRadius: radius(2.5), width: 44, height: 44 },
                  ]}
                >
                  <Icon name={action.icon} size={font(20)} color={action.color} />
                </View>
                <Text style={[styles.quickLabel, { fontSize: font(12), marginTop: hp(0.8) }]}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── KYC STATUS ── */}
          <TouchableOpacity
            onPress={() => navigation.navigate('More')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={kycStatus === 'approved' ? ['#065F46', '#059669'] : ['#78350F', '#D97706']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.kycBanner, { borderRadius: radius(3), padding: hp(1.8), marginBottom: hp(2) }]}
            >
              <Icon
                name={kycStatus === 'approved' ? 'shield-checkmark' : 'alert-circle-outline'}
                size={font(22)}
                color={kycStatus === 'approved' ? '#A5F3B5' : '#FDE68A'}
              />
              <View style={{ flex: 1, marginLeft: wp(3) }}>
                <Text style={[styles.kycTitle, { fontSize: font(13) }]}>
                  KYC Status: {kycStatus}
                </Text>
                <Text style={[styles.kycSub, { fontSize: font(10.5) }]}>
                  {kycStatus === 'approved'
                    ? 'Identity verified. You have full access.'
                    : 'Complete verification to unlock all features.'}
                </Text>
              </View>
              <Icon name="chevron-forward" size={font(16)} color="rgba(255,255,255,0.6)" />
            </LinearGradient>
          </TouchableOpacity>

          {/* ── ICO COUNTDOWN ── */}
          <TouchableOpacity onPress={() => navigation.navigate('ICO')} activeOpacity={0.9}>
            <View style={[styles.card, { borderRadius: radius(3), padding: hp(2), marginBottom: hp(2) }]}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <Icon name="rocket-outline" size={font(16)} color="#F7A41D" />
                  <Text style={[styles.cardTitle, { fontSize: font(13.5) }]}>ICO Countdown</Text>
                </View>
                <Text style={[styles.cardLink, { fontSize: font(11) }]}>View ICO →</Text>
              </View>
              <View style={[styles.timerRow, { marginTop: hp(1.5) }]}>
                {[
                  { val: timeLeft.days, label: 'Days' },
                  { val: timeLeft.hours, label: 'Hours' },
                  { val: timeLeft.minutes, label: 'Mins' },
                  { val: timeLeft.seconds, label: 'Secs' },
                ].map((t, i) => (
                  <View key={i} style={[styles.timerItem, { borderRadius: radius(2.5), padding: hp(1.2) }]}>
                    <Text style={[styles.timerNum, { fontSize: font(22) }]}>{t.val}</Text>
                    <Text style={[styles.timerLabel, { fontSize: font(9.5) }]}>{t.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </TouchableOpacity>

          {/* ── ACTIVE LOAN ── */}
          {MOCK_LOAN && (
            <TouchableOpacity onPress={() => navigation.navigate('Loans')} activeOpacity={0.9}>
              <View style={[styles.card, { borderRadius: radius(3), padding: hp(2), marginBottom: hp(2) }]}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeaderLeft}>
                    <Icon name="receipt-outline" size={font(16)} color="#6C3CF0" />
                    <Text style={[styles.cardTitle, { fontSize: font(13.5) }]}>Active Loan</Text>
                  </View>
                  <View style={[styles.activeBadge, { borderRadius: radius(1.5) }]}>
                    <Text style={[styles.activeBadgeText, { fontSize: font(9.5) }]}>● Active</Text>
                  </View>
                </View>
                <View style={[styles.loanInfo, { marginTop: hp(1.5) }]}>
                  <View>
                    <Text style={[styles.loanId, { fontSize: font(10) }]}>{MOCK_LOAN.id}</Text>
                    <Text style={[styles.loanEmi, { fontSize: font(18) }]}>
                      {MOCK_LOAN.emi} <Text style={[{ fontSize: font(11), color: '#7A7A7A' }]}>/ month</Text>
                    </Text>
                    <Text style={[styles.loanDue, { fontSize: font(11), marginTop: 2 }]}>
                      Next due: {MOCK_LOAN.due}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.loanProgressLabel, { fontSize: font(10) }]}>Progress</Text>
                    <Text style={[styles.loanProgressVal, { fontSize: font(22) }]}>{MOCK_LOAN.progress}%</Text>
                  </View>
                </View>
                {/* Progress Bar */}
                <View style={[styles.progressBg, { borderRadius: radius(1), marginTop: hp(1.2) }]}>
                  <LinearGradient
                    colors={['#6C3CF0', '#F7A41D']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressFill, { width: `${MOCK_LOAN.progress}%`, borderRadius: radius(1) }]}
                  />
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* ── REWARDS ── */}
          <TouchableOpacity onPress={() => navigation.navigate('More')} activeOpacity={0.9}>
            <LinearGradient
              colors={['#4A1FB8', '#6C3CF0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.rewardCard, { borderRadius: radius(3), padding: hp(2), marginBottom: hp(2) }]}
            >
              <View style={styles.rewardRow}>
                <Icon name="gift-outline" size={font(24)} color="#F7A41D" />
                <View style={{ flex: 1, marginLeft: wp(3) }}>
                  <Text style={[styles.rewardTitle, { fontSize: font(13) }]}>Claimable Rewards</Text>
                  <Text style={[styles.rewardAmount, { fontSize: font(20) }]}>{MOCK_REWARDS.claimable}</Text>
                </View>
                <View style={[styles.claimBtn, { borderRadius: radius(2) }]}>
                  <Text style={[styles.claimText, { fontSize: font(11.5) }]}>Claim →</Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* ── RECENT TRANSACTIONS ── */}
          <View style={[styles.card, { borderRadius: radius(3), padding: hp(2), marginBottom: hp(2) }]}>
            <View style={[styles.cardHeaderRow, { marginBottom: hp(1.5) }]}>
              <View style={styles.cardHeaderLeft}>
                <Icon name="time-outline" size={font(16)} color={Colors.primary} />
                <Text style={[styles.cardTitle, { fontSize: font(13.5) }]}>Recent Transactions</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('More')}>
                <Text style={[styles.cardLink, { fontSize: font(11) }]}>See All →</Text>
              </TouchableOpacity>
            </View>
            {MOCK_TRANSACTIONS.slice(0, 3).map((tx, i) => (
              <View key={i} style={[styles.txRow, { paddingVertical: hp(1.2) }]}>
                <View
                  style={[
                    styles.txIcon,
                    {
                      borderRadius: radius(2.5),
                      width: 40,
                      height: 40,
                      backgroundColor: tx.positive ? 'rgba(34,197,94,0.1)' : 'rgba(108,60,240,0.1)',
                    },
                  ]}
                >
                  <Icon name={tx.icon} size={font(17)} color={tx.positive ? '#22C55E' : Colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: wp(3) }}>
                  <Text style={[styles.txLabel, { fontSize: font(12.5) }]}>{tx.label}</Text>
                  <Text style={[styles.txDate, { fontSize: font(10.5) }]}>{tx.date}</Text>
                </View>
                <Text
                  style={[
                    styles.txAmount,
                    { fontSize: font(12.5), color: tx.positive ? '#22C55E' : '#EF4444' },
                  ]}
                >
                  {tx.positive ? '' : ''}{tx.amount}
                </Text>
              </View>
            ))}
          </View>

        </View>
      </ScrollView>

      <WalletModal
        visible={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        onWalletConnect={handleWalletConnect}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
//  TOKEN BADGE HELPER
// ─────────────────────────────────────────────
const TokenBadge = ({ symbol, amount, color }: { symbol: string; amount: string; color: string }) => {
  const { wp, hp, font, radius } = useResponsive();
  return (
    <View style={[styles.tokenBadge, { borderRadius: radius(2), backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: wp(2.5), paddingVertical: hp(0.7) }]}>
      <View style={[styles.tokenDot, { backgroundColor: color }]} />
      <Text style={[styles.tokenAmount, { fontSize: font(12) }]}>{amount}</Text>
      <Text style={[styles.tokenSymbol, { fontSize: font(10) }]}>{symbol}</Text>
    </View>
  );
};

// ─────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1 },

  // Header
  header: { paddingTop: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 46, height: 46 },
  greet: { color: '#B8A0D8', fontFamily: Fonts.regular },
  name: { color: '#FFF', fontFamily: Fonts.bold, marginTop: 1 },
  bellBtn: { backgroundColor: 'rgba(255,255,255,0.12)', width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  notifDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: '#2B0A57' },

  // Portfolio Card
  portfolioCard: { backgroundColor: 'rgba(255,255,255,0.10)' },
  portfolioLabel: { color: '#D0B8FF', fontFamily: Fonts.regular },
  portfolioValue: { color: '#FFF', fontFamily: Fonts.bold, marginTop: 4 },
  changeRow: { flexDirection: 'row' },
  changeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4 },
  changeText: { fontFamily: Fonts.semiBold },
  tokenRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tokenBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tokenDot: { width: 7, height: 7, borderRadius: 4 },
  tokenAmount: { color: '#FFF', fontFamily: Fonts.bold },
  tokenSymbol: { color: '#D0B8FF', fontFamily: Fonts.regular },

  // Wallet Row
  walletRow: { backgroundColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  walletLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  walletDot: { width: 7, height: 7, borderRadius: 4 },
  walletText: { fontFamily: Fonts.medium },
  connectBtn: { backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 6 },
  connectBtnText: { color: '#FFF', fontFamily: Fonts.bold },
  networkBadge: { backgroundColor: 'rgba(34,197,94,0.2)', paddingHorizontal: 10, paddingVertical: 4 },
  networkText: { color: '#A5F3B5', fontFamily: Fonts.semiBold },

  // Body
  body: { backgroundColor: '#F3F3F5' },
  sectionTitle: { color: '#1A1A2E', fontFamily: Fonts.bold },

  // Quick Actions
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickCard: { backgroundColor: '#FFF', width: '47%', elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  quickIconBox: { alignItems: 'center', justifyContent: 'center' },
  quickLabel: { color: '#1A1A2E', fontFamily: Fonts.semiBold },

  // KYC Banner
  kycBanner: { flexDirection: 'row', alignItems: 'center' },
  kycTitle: { color: '#FFF', fontFamily: Fonts.bold },
  kycSub: { color: 'rgba(255,255,255,0.8)', fontFamily: Fonts.regular, marginTop: 2 },

  // Cards
  card: { backgroundColor: '#FFF', elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { color: '#1A1A2E', fontFamily: Fonts.bold },
  cardLink: { color: Colors.primary, fontFamily: Fonts.semiBold },

  // Timer
  timerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timerItem: { flex: 1, alignItems: 'center', backgroundColor: '#F8F6FF', marginHorizontal: 3 },
  timerNum: { color: Colors.primary, fontFamily: Fonts.bold },
  timerLabel: { color: '#7A7A7A', fontFamily: Fonts.regular, marginTop: 2 },

  // Loan
  activeBadge: { backgroundColor: 'rgba(34,197,94,0.12)', paddingHorizontal: 8, paddingVertical: 3 },
  activeBadgeText: { color: '#22C55E', fontFamily: Fonts.semiBold },
  loanInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  loanId: { color: '#7A7A7A', fontFamily: Fonts.regular },
  loanEmi: { color: '#1A1A2E', fontFamily: Fonts.bold, marginTop: 2 },
  loanDue: { color: '#7A7A7A', fontFamily: Fonts.regular },
  loanProgressLabel: { color: '#7A7A7A', fontFamily: Fonts.regular },
  loanProgressVal: { color: Colors.primary, fontFamily: Fonts.bold },
  progressBg: { height: 8, backgroundColor: '#F0F0F0' },
  progressFill: { height: 8 },

  // Rewards
  rewardCard: {},
  rewardRow: { flexDirection: 'row', alignItems: 'center' },
  rewardTitle: { color: '#D0B8FF', fontFamily: Fonts.regular },
  rewardAmount: { color: '#FFF', fontFamily: Fonts.bold, marginTop: 2 },
  claimBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8 },
  claimText: { color: '#FFF', fontFamily: Fonts.bold },

  // Transactions
  txRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  txIcon: { alignItems: 'center', justifyContent: 'center' },
  txLabel: { color: '#1A1A2E', fontFamily: Fonts.semiBold },
  txDate: { color: '#7A7A7A', fontFamily: Fonts.regular, marginTop: 2 },
  txAmount: { fontFamily: Fonts.bold },
});