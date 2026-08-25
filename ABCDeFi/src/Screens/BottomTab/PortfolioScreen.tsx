import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import { Colors } from '../../Utils/Colors';
import Fonts from '../../Utils/Fonts';
import { useResponsive } from '../../Utils/Responsive';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─────────────────────────────────────────────
//  MOCK PORTFOLIO DATA
// ─────────────────────────────────────────────
const PORTFOLIO_DATA = {
  totalValue: 35840,
  changePercent: 8.25,
  changeAmount: 2730,
  abcdBalance: 1250,
  ethBalance: 3,
  usdcBalance: 800,
  healthScore: 92,
  currency: 'USD',
  lastUpdated: 'Just now',
  allocation: [
    { label: 'ABCD Tokens', value: 18750, percent: 52.3, color: '#6C3CF0' },
    { label: 'Ethereum (ETH)', value: 9600, percent: 26.8, color: '#627EEA' },
    { label: 'USDC Stablecoin', value: 800, percent: 2.2, color: '#22C55E' },
    { label: 'NFT Assets', value: 4200, percent: 11.7, color: '#F7A41D' },
    { label: 'Lending Yield', value: 2490, percent: 6.9, color: '#EC4899' },
  ],
  activeLoan: null, // Default loan hidden
  transactions: [
    { id: 'TXN-001', type: 'EMI Payment', amount: -87.5, currency: 'ABCD', date: '31 Jul 2026', status: 'Confirmed', icon: 'cash-outline' },
    { id: 'TXN-002', type: 'Staking Reward', amount: +87.5, currency: 'ABCD', date: '15 Jul 2026', status: 'Confirmed', icon: 'trending-up-outline' },
    { id: 'TXN-003', type: 'ICO Purchase', amount: -0.32, currency: 'ETH', date: '01 Jul 2026', status: 'Confirmed', icon: 'layers-outline' },
    { id: 'TXN-004', type: 'KYC Bonus', amount: +50, currency: 'ABCD', date: '02 Jul 2026', status: 'Claimed', icon: 'gift-outline' },
    { id: 'TXN-005', type: 'Referral Bonus', amount: +120, currency: 'ABCD', date: '20 Jul 2026', status: 'Pending', icon: 'people-outline' },
  ],
  nfts: [
    { id: 'NFT-001', name: 'ABCDeFi Genesis #001', legion: 'ABCD Master', value: 2100, change: +12.5 },
    { id: 'NFT-002', name: 'ABCDeFi Pioneer #044', legion: 'ABCD Knight', value: 1400, change: +5.2 },
    { id: 'NFT-003', name: 'ABCDeFi Recruit #187', legion: 'ABCD Recruit', value: 700, change: -2.1 },
  ],
};

// ─────────────────────────────────────────────
//  MAIN PORTFOLIO SCREEN
// ─────────────────────────────────────────────
export default function PortfolioScreen({ navigation }: any) {
  const { wp, hp, font, radius } = useResponsive();
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'nfts'>('overview');

  const isPositive = PORTFOLIO_DATA.changePercent >= 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header + Portfolio Value */}
      <LinearGradient
        colors={['#2B0A57', '#1A1A2E']}
        style={[styles.header, { paddingHorizontal: wp(5), paddingBottom: hp(3) }]}
      >
        <Text style={[styles.headerTitle, { fontSize: font(20) }]}>Portfolio</Text>
        <Text style={[styles.headerSub, { fontSize: font(11) }]}>
          Your ABCDeFi Asset Overview
        </Text>

        {/* Total Value Card */}
        <View style={[styles.totalCard, { borderRadius: radius(4), padding: hp(2.5), marginTop: hp(2) }]}>
          <Text style={[styles.totalLabel, { fontSize: font(11) }]}>Total Portfolio Value</Text>
          <Text style={[styles.totalValue, { fontSize: font(32) }]}>
            ${PORTFOLIO_DATA.totalValue.toLocaleString()}
          </Text>
          <View style={styles.changeRow}>
            <View
              style={[
                styles.changeBadge,
                { backgroundColor: isPositive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)' },
              ]}
            >
              <Icon
                name={isPositive ? 'trending-up' : 'trending-down'}
                size={font(13)}
                color={isPositive ? '#22C55E' : '#EF4444'}
              />
              <Text
                style={[
                  styles.changeText,
                  { fontSize: font(12), color: isPositive ? '#22C55E' : '#EF4444' },
                ]}
              >
                {isPositive ? '+' : ''}{PORTFOLIO_DATA.changePercent}% ($
                {PORTFOLIO_DATA.changeAmount.toLocaleString()})
              </Text>
            </View>
            <Text style={[styles.updatedText, { fontSize: font(10) }]}>
              {PORTFOLIO_DATA.lastUpdated}
            </Text>
          </View>

          {/* Token Balances Row */}
          <View style={[styles.tokenRow, { marginTop: hp(2) }]}>
            <TokenBadge symbol="ABCD" amount={PORTFOLIO_DATA.abcdBalance} color="#6C3CF0" />
            <TokenBadge symbol="ETH" amount={PORTFOLIO_DATA.ethBalance} color="#627EEA" />
            <TokenBadge symbol="USDC" amount={PORTFOLIO_DATA.usdcBalance} color="#22C55E" />
          </View>
        </View>

        {/* Health Score */}
        <View style={[styles.healthRow, { marginTop: hp(1.5) }]}>
          <View style={styles.healthInner}>
            <Icon name="heart-circle-outline" size={font(16)} color="#A5F3B5" />
            <Text style={[styles.healthLabel, { fontSize: font(11) }]}>Health Score</Text>
          </View>
          <Text style={[styles.healthScore, { fontSize: font(16) }]}>
            {PORTFOLIO_DATA.healthScore}%
          </Text>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={[styles.tabsWrapper, { paddingHorizontal: wp(4), paddingTop: hp(1.5) }]}>
        {(['overview', 'transactions', 'nfts'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabText,
                { fontSize: font(12), color: activeTab === tab ? Colors.primary : '#7A7A7A' },
                activeTab === tab && styles.tabTextActive,
              ]}
            >
              {tab === 'overview' ? '📊 Overview' : tab === 'transactions' ? '🔄 Activity' : '🖼 NFTs'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: '#F3F3F5' }}
        contentContainerStyle={{ padding: wp(4), paddingBottom: hp(14) }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <>
            {/* Asset Allocation */}
            <SectionCard title="Asset Allocation" icon="pie-chart-outline">
              {PORTFOLIO_DATA.allocation.map((asset, i) => (
                <View key={i} style={[styles.assetRow, { marginBottom: hp(1.3) }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={[styles.assetDot, { backgroundColor: asset.color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.assetLabel, { fontSize: font(12) }]}>{asset.label}</Text>
                      <View style={[styles.assetBar, { borderRadius: radius(1), marginTop: 4 }]}>
                        <View
                          style={[
                            styles.assetBarFill,
                            { width: `${asset.percent}%`, backgroundColor: asset.color, borderRadius: radius(1) },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', marginLeft: wp(3) }}>
                    <Text style={[styles.assetValue, { fontSize: font(12) }]}>
                      ${asset.value.toLocaleString()}
                    </Text>
                    <Text style={[styles.assetPercent, { fontSize: font(10) }]}>{asset.percent}%</Text>
                  </View>
                </View>
              ))}
            </SectionCard>

            {/* Active Loan Card */}
            {PORTFOLIO_DATA.activeLoan && (
              <SectionCard title="Active Loan" icon="receipt-outline">
                <LinearGradient
                  colors={['#6C3CF0', '#4A1FB8']}
                  style={[styles.loanCard, { borderRadius: radius(3), padding: hp(2) }]}
                >
                  <View style={styles.loanTopRow}>
                    <View>
                      <Text style={[styles.loanId, { fontSize: font(10) }]}>
                        {PORTFOLIO_DATA.activeLoan.id}
                      </Text>
                      <Text style={[styles.loanAmount, { fontSize: font(22) }]}>
                        {PORTFOLIO_DATA.activeLoan.amount} ABCD
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: 'rgba(34,197,94,0.2)', borderRadius: radius(2) },
                      ]}
                    >
                      <Text style={[styles.statusText, { fontSize: font(10.5) }]}>
                        ✅ {PORTFOLIO_DATA.activeLoan.status}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.loanMeta, { marginTop: hp(1.5) }]}>
                    <LoanMetaItem label="Monthly EMI" value={`${PORTFOLIO_DATA.activeLoan.monthlyEMI} ABCD`} />
                    <LoanMetaItem label="Next Due" value={PORTFOLIO_DATA.activeLoan.nextDueDate} />
                    <LoanMetaItem label="Days Left" value={`${PORTFOLIO_DATA.activeLoan.daysLeft} Days`} />
                  </View>

                  {/* Progress Bar */}
                  <View style={{ marginTop: hp(1.5) }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={[{ color: '#D0B8FF', fontSize: font(10), fontFamily: Fonts.regular }]}>
                        Repayment Progress
                      </Text>
                      <Text style={[{ color: '#FFF', fontSize: font(10), fontFamily: Fonts.bold }]}>
                        {PORTFOLIO_DATA.activeLoan.progress}%
                      </Text>
                    </View>
                    <View style={[styles.progressBg, { borderRadius: radius(2) }]}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${PORTFOLIO_DATA.activeLoan.progress}%`, borderRadius: radius(2) },
                        ]}
                      />
                    </View>
                  </View>
                </LinearGradient>
              </SectionCard>
            )}

            {/* Quick Stats */}
            <SectionCard title="Quick Stats" icon="stats-chart-outline">
              <View style={styles.statsGrid}>
                <StatCell label="Active Loans" value="0" icon="receipt-outline" />
                <StatCell label="Total Lent" value="0 ABCD" icon="trending-up-outline" />
                <StatCell label="Total Earned" value="257 ABCD" icon="gift-outline" />
                <StatCell label="NFT Holdings" value="3" icon="images-outline" />
              </View>
            </SectionCard>
          </>
        )}

        {/* ── TRANSACTIONS TAB ── */}
        {activeTab === 'transactions' && (
          <SectionCard title="Recent Activity" icon="time-outline">
            {PORTFOLIO_DATA.transactions.map((tx) => {
              const isIncoming = tx.amount > 0;
              return (
                <View key={tx.id} style={[styles.txRow, { paddingVertical: hp(1.5) }]}>
                  <View
                    style={[
                      styles.txIconBox,
                      {
                        backgroundColor: isIncoming ? 'rgba(34,197,94,0.12)' : 'rgba(108,60,240,0.1)',
                        borderRadius: radius(2.5),
                      },
                    ]}
                  >
                    <Icon
                      name={tx.icon}
                      size={font(18)}
                      color={isIncoming ? '#22C55E' : Colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: wp(3) }}>
                    <Text style={[styles.txType, { fontSize: font(13) }]}>{tx.type}</Text>
                    <Text style={[styles.txDate, { fontSize: font(10.5) }]}>
                      {tx.date} · {tx.status}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.txAmount,
                      { fontSize: font(13.5), color: isIncoming ? '#22C55E' : '#EF4444' },
                    ]}
                  >
                    {isIncoming ? '+' : ''}{tx.amount} {tx.currency}
                  </Text>
                </View>
              );
            })}
          </SectionCard>
        )}

        {/* ── NFTs TAB ── */}
        {activeTab === 'nfts' && (
          <SectionCard title="NFT Holdings" icon="images-outline">
            {PORTFOLIO_DATA.nfts.map((nft) => {
              const isUp = nft.change >= 0;
              return (
                <View
                  key={nft.id}
                  style={[
                    styles.nftCard,
                    { borderRadius: radius(3), marginBottom: hp(1.5), overflow: 'hidden' },
                  ]}
                >
                  <LinearGradient
                    colors={['#6C3CF0', '#2B0A57']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.nftGradient, { padding: hp(2) }]}
                  >
                    <View style={styles.nftTop}>
                      <View>
                        <Text style={[styles.nftName, { fontSize: font(13) }]}>{nft.name}</Text>
                        <Text style={[styles.nftLegion, { fontSize: font(10.5) }]}>{nft.legion}</Text>
                      </View>
                      <View style={[styles.nftChangeBadge, { backgroundColor: isUp ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)', borderRadius: radius(2) }]}>
                        <Icon name={isUp ? 'trending-up' : 'trending-down'} size={font(11)} color={isUp ? '#A5F3B5' : '#FCA5A5'} />
                        <Text style={[styles.nftChange, { fontSize: font(10.5), color: isUp ? '#A5F3B5' : '#FCA5A5' }]}>
                          {isUp ? '+' : ''}{nft.change}%
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.nftValue, { fontSize: font(20), marginTop: hp(1) }]}>
                      ${nft.value.toLocaleString()}
                    </Text>
                  </LinearGradient>
                </View>
              );
            })}
          </SectionCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
//  HELPER COMPONENTS
// ─────────────────────────────────────────────
const SectionCard = ({ title, icon, children }: any) => {
  const { wp, hp, font, radius } = useResponsive();
  return (
    <View style={[styles.sectionCard, { borderRadius: radius(3), marginBottom: hp(2), padding: hp(2) }]}>
      <View style={[styles.sectionHeader, { marginBottom: hp(1.5) }]}>
        <Icon name={icon} size={font(16)} color={Colors.primary} />
        <Text style={[styles.sectionTitle, { fontSize: font(14) }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
};

const TokenBadge = ({ symbol, amount, color }: { symbol: string; amount: number; color: string }) => {
  const { wp, hp, font, radius } = useResponsive();
  return (
    <View style={[styles.tokenBadge, { borderRadius: radius(2), backgroundColor: 'rgba(255,255,255,0.12)', padding: hp(0.8), paddingHorizontal: wp(3) }]}>
      <View style={[styles.tokenDot, { backgroundColor: color }]} />
      <Text style={[styles.tokenAmount, { fontSize: font(12) }]}>{amount}</Text>
      <Text style={[styles.tokenSymbol, { fontSize: font(10) }]}>{symbol}</Text>
    </View>
  );
};

const LoanMetaItem = ({ label, value }: { label: string; value: string }) => {
  const { font } = useResponsive();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[{ color: '#D0B8FF', fontSize: font(9.5), fontFamily: Fonts.regular }]}>{label}</Text>
      <Text style={[{ color: '#FFF', fontSize: font(12), fontFamily: Fonts.bold, marginTop: 2 }]}>{value}</Text>
    </View>
  );
};

const StatCell = ({ label, value, icon }: { label: string; value: string; icon: string }) => {
  const { wp, hp, font, radius } = useResponsive();
  return (
    <View style={[styles.statCell, { borderRadius: radius(2.5), padding: hp(1.8), width: '47%', marginBottom: hp(1.2) }]}>
      <Icon name={icon} size={font(20)} color={Colors.primary} />
      <Text style={[styles.statValue, { fontSize: font(16), marginTop: 6 }]}>{value}</Text>
      <Text style={[styles.statLabel, { fontSize: font(10.5) }]}>{label}</Text>
    </View>
  );
};

// ─────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#2B0A57' },
  header: { paddingTop: 12 },
  headerTitle: { color: '#FFF', fontFamily: Fonts.bold },
  headerSub: { color: '#D0B8FF', fontFamily: Fonts.regular, marginTop: 2 },

  totalCard: { backgroundColor: 'rgba(255,255,255,0.1)' },
  totalLabel: { color: '#D0B8FF', fontFamily: Fonts.regular },
  totalValue: { color: '#FFF', fontFamily: Fonts.bold, marginTop: 4 },
  changeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  changeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  changeText: { fontFamily: Fonts.semiBold },
  updatedText: { color: '#7A5A9A', fontFamily: Fonts.regular },
  tokenRow: { flexDirection: 'row', gap: 8 },
  tokenBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tokenDot: { width: 7, height: 7, borderRadius: 4 },
  tokenAmount: { color: '#FFF', fontFamily: Fonts.bold },
  tokenSymbol: { color: '#D0B8FF', fontFamily: Fonts.regular },

  healthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  healthInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  healthLabel: { color: '#D0B8FF', fontFamily: Fonts.regular },
  healthScore: { color: '#A5F3B5', fontFamily: Fonts.bold },

  tabsWrapper: { flexDirection: 'row', backgroundColor: '#F3F3F5', gap: 4, paddingBottom: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontFamily: Fonts.medium },
  tabTextActive: { fontFamily: Fonts.bold },

  sectionCard: { backgroundColor: '#FFF', elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontFamily: Fonts.bold, color: '#1A1A2E' },

  assetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  assetDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  assetLabel: { color: '#1A1A2E', fontFamily: Fonts.medium },
  assetBar: { height: 5, backgroundColor: '#F0F0F0', width: '100%' },
  assetBarFill: { height: 5 },
  assetValue: { color: '#1A1A2E', fontFamily: Fonts.bold },
  assetPercent: { color: '#7A7A7A', fontFamily: Fonts.regular },

  loanCard: {},
  loanTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  loanId: { color: '#D0B8FF', fontFamily: Fonts.regular },
  loanAmount: { color: '#FFF', fontFamily: Fonts.bold, marginTop: 2 },
  statusBadge: { padding: 6 },
  statusText: { color: '#A5F3B5', fontFamily: Fonts.semiBold },
  loanMeta: { flexDirection: 'row' },
  progressBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.2)' },
  progressFill: { height: 8, backgroundColor: '#F7A41D' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statCell: { backgroundColor: '#F8F6FF', alignItems: 'center' },
  statValue: { color: Colors.primary, fontFamily: Fonts.bold },
  statLabel: { color: '#7A7A7A', fontFamily: Fonts.regular, marginTop: 2, textAlign: 'center' },

  txRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  txIconBox: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  txType: { color: '#1A1A2E', fontFamily: Fonts.semiBold },
  txDate: { color: '#7A7A7A', fontFamily: Fonts.regular, marginTop: 2 },
  txAmount: { fontFamily: Fonts.bold },

  nftCard: { elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  nftGradient: {},
  nftTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  nftName: { color: '#FFF', fontFamily: Fonts.bold },
  nftLegion: { color: '#D0B8FF', fontFamily: Fonts.regular, marginTop: 2 },
  nftChangeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  nftChange: { fontFamily: Fonts.semiBold },
  nftValue: { color: '#FFF', fontFamily: Fonts.bold },
});
