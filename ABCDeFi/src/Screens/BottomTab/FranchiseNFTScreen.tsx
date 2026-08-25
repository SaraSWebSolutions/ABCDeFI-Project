import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../Utils/Colors';
import Fonts from '../../Utils/Fonts';
import { useResponsive } from '../../Utils/Responsive';

const { width: SW } = Dimensions.get('window');

// ─────────────────────────────────────────────
//  FRANCHISE TIER DATA
// ─────────────────────────────────────────────
const FRANCHISE_TIERS = [
  {
    id: 'world',
    name: 'World NFT',
    emoji: '🌍',
    level: 5,
    price: '50,000 ABCD',
    supply: '1',
    owned: 0,
    revenueShare: '5% Global',
    description: 'Singular global franchise ownership. Access to 100% platform governance and all continental revenues.',
    color1: '#1A1A2E',
    color2: '#6C3CF0',
    badge: 'ULTRA RARE',
  },
  {
    id: 'continent',
    name: 'Continent NFT',
    emoji: '🌏',
    level: 4,
    price: '10,000 ABCD',
    supply: '7',
    owned: 0,
    revenueShare: '3% Continental',
    description: 'Continental franchise ownership covering entire continents. Revenue from all country-level activities.',
    color1: '#2B0A57',
    color2: '#7C3AED',
    badge: 'LEGENDARY',
  },
  {
    id: 'country',
    name: 'Country NFT',
    emoji: '🏳️',
    level: 3,
    price: '2,500 ABCD',
    supply: '195',
    owned: 1,
    revenueShare: '2% National',
    description: 'National franchise for a specific country. Earn revenue from all state-level franchise activities.',
    color1: '#3730A3',
    color2: '#4F46E5',
    badge: 'EPIC',
    current: true,
  },
  {
    id: 'state',
    name: 'State NFT',
    emoji: '🗺️',
    level: 2,
    price: '500 ABCD',
    supply: '5,000',
    owned: 2,
    revenueShare: '1.5% Regional',
    description: 'Regional franchise for a specific state or province. Earn from district-level activities.',
    color1: '#1D4ED8',
    color2: '#3B82F6',
    badge: 'RARE',
    current: true,
  },
  {
    id: 'district',
    name: 'District NFT',
    emoji: '📍',
    level: 1,
    price: '100 ABCD',
    supply: '50,000',
    owned: 0,
    revenueShare: '1% Local',
    description: 'Entry-level franchise for a local district. Earn revenue from local community transactions.',
    color1: '#0F766E',
    color2: '#0D9488',
    badge: 'COMMON',
  },
];

// ─────────────────────────────────────────────
//  MY FRANCHISE NFTs (owned)
// ─────────────────────────────────────────────
const MY_NFTS = [
  {
    id: 'FNFT-001',
    name: 'Country NFT — India',
    tier: 'country',
    emoji: '🏳️',
    tokenId: '#0042',
    mintedAt: '01 Jul 2026',
    value: '$2,800',
    revenueEarned: '128 ABCD',
    nextRevenue: '14 Aug 2026',
    color1: '#3730A3',
    color2: '#4F46E5',
  },
  {
    id: 'FNFT-002',
    name: 'State NFT — Karnataka',
    tier: 'state',
    emoji: '🗺️',
    tokenId: '#0318',
    mintedAt: '05 Jul 2026',
    value: '$620',
    revenueEarned: '42 ABCD',
    nextRevenue: '14 Aug 2026',
    color1: '#1D4ED8',
    color2: '#3B82F6',
  },
  {
    id: 'FNFT-003',
    name: 'State NFT — Maharashtra',
    tier: 'state',
    emoji: '🗺️',
    tokenId: '#0421',
    mintedAt: '10 Jul 2026',
    value: '$580',
    revenueEarned: '38 ABCD',
    nextRevenue: '14 Aug 2026',
    color1: '#1D4ED8',
    color2: '#3B82F6',
  },
];

// ─────────────────────────────────────────────
//  FRANCHISE DASHBOARD STATS
// ─────────────────────────────────────────────
const DASHBOARD = {
  totalNFTs: 3,
  totalValue: '$4,000',
  totalRevenue: '208 ABCD',
  pendingRevenue: '85 ABCD',
};

// ─────────────────────────────────────────────
//  MAIN SCREEN
// ─────────────────────────────────────────────
export default function FranchiseNFTScreen({ navigation }: any) {
  const { wp, hp, font, radius } = useResponsive();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'buy' | 'my-nfts' | 'marketplace'>('dashboard');

  const handleBuyNFT = (tier: any) => {
    Alert.alert(
      `Buy ${tier.name}`,
      `Price: ${tier.price}\nRevenue Share: ${tier.revenueShare}\n\nThis will initiate a smart contract transaction on the blockchain.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Proceed to Buy',
          onPress: () => Alert.alert('Transaction Initiated', 'Redirecting to wallet for approval...'),
        },
      ]
    );
  };

  const handleClaimRevenue = (nft: any) => {
    Alert.alert(
      '💰 Claim Revenue',
      `Claiming ${nft.revenueEarned} from ${nft.name}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Claim', onPress: () => Alert.alert('✅ Revenue Claimed', `${nft.revenueEarned} has been sent to your wallet.`) },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={['#1A0048', '#2B0A57']}
        style={[styles.header, { paddingHorizontal: wp(5), paddingBottom: hp(2) }]}
      >
        <Text style={[styles.headerTitle, { fontSize: font(20) }]}>🏛 Franchise NFT</Text>
        <Text style={[styles.headerSub, { fontSize: font(11) }]}>
          Geographic Ownership · Revenue Sharing · DeFi Franchise Model
        </Text>

        {/* Dashboard summary */}
        <View style={[styles.summaryRow, { marginTop: hp(2) }]}>
          <SummaryChip label="Total NFTs" value={String(DASHBOARD.totalNFTs)} icon="images-outline" />
          <SummaryChip label="Portfolio" value={DASHBOARD.totalValue} icon="bar-chart-outline" />
          <SummaryChip label="Revenue" value={DASHBOARD.totalRevenue} icon="cash-outline" />
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={[styles.tabsBar, { paddingHorizontal: wp(3) }]}>
        {(['dashboard', 'buy', 'my-nfts', 'marketplace'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabText,
                { fontSize: font(11.5), color: activeTab === tab ? Colors.primary : '#7A7A7A' },
                activeTab === tab && { fontFamily: Fonts.bold },
              ]}
            >
              {tab === 'dashboard' ? '📊 Overview'
                : tab === 'buy' ? '🛒 Buy NFT'
                  : tab === 'my-nfts' ? '🖼 My NFTs'
                    : '🏪 Market'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: '#F3F3F5' }}
        contentContainerStyle={{ padding: wp(4), paddingBottom: hp(14) }}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── DASHBOARD TAB ─── */}
        {activeTab === 'dashboard' && (
          <>
            {/* Revenue Card */}
            <LinearGradient
              colors={['#6C3CF0', '#1A0048']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.revenueCard, { borderRadius: radius(4), padding: hp(2.5), marginBottom: hp(2) }]}
            >
              <Text style={[styles.revenueLabel, { fontSize: font(11) }]}>Total Revenue Earned</Text>
              <Text style={[styles.revenueValue, { fontSize: font(28) }]}>{DASHBOARD.totalRevenue}</Text>
              <View style={[styles.pendingRow, { marginTop: hp(1.5) }]}>
                <Icon name="hourglass-outline" size={font(13)} color="#D0B8FF" />
                <Text style={[styles.pendingText, { fontSize: font(11) }]}>
                  {DASHBOARD.pendingRevenue} pending for next cycle
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.claimBtn, { borderRadius: radius(2.5), marginTop: hp(2), paddingVertical: hp(1.3) }]}
                onPress={() => Alert.alert('Claim All', 'Claiming all pending revenues...')}
              >
                <Text style={[styles.claimBtnText, { fontSize: font(13) }]}>Claim All Revenue</Text>
              </TouchableOpacity>
            </LinearGradient>

            {/* My NFT Summary */}
            <Text style={[styles.sectionTitle, { fontSize: font(14), marginBottom: hp(1.5) }]}>
              My Franchise NFTs
            </Text>
            {MY_NFTS.map((nft) => (
              <View key={nft.id} style={[styles.myNftCard, { borderRadius: radius(3), marginBottom: hp(1.5), overflow: 'hidden' }]}>
                <LinearGradient
                  colors={[nft.color1, nft.color2]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.myNftGradient, { padding: hp(2) }]}
                >
                  <View style={styles.myNftRow}>
                    <Text style={[styles.myNftEmoji, { fontSize: font(28) }]}>{nft.emoji}</Text>
                    <View style={{ flex: 1, marginLeft: wp(3) }}>
                      <Text style={[styles.myNftName, { fontSize: font(13) }]}>{nft.name}</Text>
                      <Text style={[styles.myNftToken, { fontSize: font(10.5) }]}>
                        Token {nft.tokenId} · Minted {nft.mintedAt}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.myNftValue, { fontSize: font(14) }]}>{nft.value}</Text>
                    </View>
                  </View>
                  <View style={[styles.revenueRow, { marginTop: hp(1.5) }]}>
                    <View>
                      <Text style={[styles.revLabel, { fontSize: font(9.5) }]}>Revenue Earned</Text>
                      <Text style={[styles.revVal, { fontSize: font(14) }]}>{nft.revenueEarned}</Text>
                    </View>
                    <View>
                      <Text style={[styles.revLabel, { fontSize: font(9.5) }]}>Next Cycle</Text>
                      <Text style={[styles.revVal, { fontSize: font(12) }]}>{nft.nextRevenue}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleClaimRevenue(nft)}
                      style={[styles.claimSmallBtn, { borderRadius: radius(2) }]}
                    >
                      <Text style={[styles.claimSmallText, { fontSize: font(11) }]}>Claim</Text>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </View>
            ))}
          </>
        )}

        {/* ─── BUY NFT TAB ─── */}
        {activeTab === 'buy' && (
          <>
            <Text style={[styles.sectionTitle, { fontSize: font(14), marginBottom: hp(0.5) }]}>
              Choose Your Franchise Tier
            </Text>
            <Text style={[styles.sectionSub, { fontSize: font(11), marginBottom: hp(2) }]}>
              Each tier grants geographic ownership and automatic revenue sharing from all sub-level activities.
            </Text>
            {FRANCHISE_TIERS.map((tier) => (
              <View
                key={tier.id}
                style={[
                  styles.tierCard,
                  { borderRadius: radius(3), marginBottom: hp(2), overflow: 'hidden' },
                  tier.current && { borderWidth: 2, borderColor: '#F7A41D' },
                ]}
              >
                <LinearGradient
                  colors={[tier.color1, tier.color2]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.tierHeader, { padding: hp(2) }]}
                >
                  <View style={styles.tierHeaderRow}>
                    <Text style={[styles.tierEmoji, { fontSize: font(32) }]}>{tier.emoji}</Text>
                    <View style={{ flex: 1, marginLeft: wp(3) }}>
                      <View style={styles.tierNameRow}>
                        <Text style={[styles.tierName, { fontSize: font(16) }]}>{tier.name}</Text>
                        {tier.current && (
                          <View style={[styles.ownedBadge, { borderRadius: radius(1.5) }]}>
                            <Text style={[styles.ownedText, { fontSize: font(9) }]}>OWNED ✓</Text>
                          </View>
                        )}
                      </View>
                      <View style={[styles.rarityBadge, { alignSelf: 'flex-start', borderRadius: radius(1.5), marginTop: 4 }]}>
                        <Text style={[styles.rarityText, { fontSize: font(9) }]}>{tier.badge}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.tierSupply, { fontSize: font(10) }]}>Supply: {tier.supply}</Text>
                      <Text style={[styles.tierPrice, { fontSize: font(16), marginTop: 2 }]}>{tier.price}</Text>
                    </View>
                  </View>
                </LinearGradient>

                <View style={[styles.tierBody, { padding: hp(2) }]}>
                  <Text style={[styles.tierDesc, { fontSize: font(12) }]}>{tier.description}</Text>
                  <View style={[styles.tierMeta, { marginTop: hp(1.5) }]}>
                    <MetaItem icon="cash-outline" label="Revenue Share" value={tier.revenueShare} />
                    <MetaItem icon="layers-outline" label="Hierarchy Level" value={`Level ${tier.level} / 5`} />
                  </View>
                  <TouchableOpacity
                    onPress={() => handleBuyNFT(tier)}
                    activeOpacity={0.85}
                    style={{ marginTop: hp(1.5) }}
                  >
                    <LinearGradient
                      colors={['#6C3CF0', '#F7A41D']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.buyBtn, { borderRadius: radius(2.5), paddingVertical: hp(1.5) }]}
                    >
                      <Icon name="cart-outline" size={font(15)} color="#FFF" />
                      <Text style={[styles.buyBtnText, { fontSize: font(13.5) }]}>
                        {tier.owned > 0 ? `Buy More (Own: ${tier.owned})` : `Buy ${tier.name}`}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        {/* ─── MY NFTs TAB ─── */}
        {activeTab === 'my-nfts' && (
          <>
            <Text style={[styles.sectionTitle, { fontSize: font(14), marginBottom: hp(2) }]}>
              My Franchise NFT Collection
            </Text>
            {MY_NFTS.map((nft) => (
              <View key={nft.id} style={[styles.myNftCard, { borderRadius: radius(3), marginBottom: hp(1.8), overflow: 'hidden' }]}>
                <LinearGradient
                  colors={[nft.color1, nft.color2]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ padding: hp(2.5) }}
                >
                  <View style={styles.myNftRow}>
                    <Text style={{ fontSize: font(36) }}>{nft.emoji}</Text>
                    <View style={{ flex: 1, marginLeft: wp(4) }}>
                      <Text style={[styles.myNftName, { fontSize: font(15) }]}>{nft.name}</Text>
                      <Text style={[styles.myNftToken, { fontSize: font(11) }]}>Token {nft.tokenId}</Text>
                      <Text style={[{ color: '#D0B8FF', fontFamily: Fonts.regular, fontSize: font(10.5) }]}>
                        Minted: {nft.mintedAt}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.nftStatsRow, { marginTop: hp(2) }]}>
                    <NFTStat label="Current Value" value={nft.value} />
                    <NFTStat label="Revenue Earned" value={nft.revenueEarned} />
                    <NFTStat label="Next Payout" value={nft.nextRevenue} />
                  </View>
                  <View style={[styles.nftActions, { marginTop: hp(2) }]}>
                    <TouchableOpacity
                      onPress={() => handleClaimRevenue(nft)}
                      style={[styles.nftActionBtn, { borderRadius: radius(2), backgroundColor: 'rgba(255,255,255,0.2)', flex: 1, marginRight: wp(2) }]}
                    >
                      <Icon name="cash-outline" size={font(14)} color="#FFF" />
                      <Text style={[{ color: '#FFF', fontFamily: Fonts.semiBold, fontSize: font(12) }]}>Claim Revenue</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => Alert.alert('Transfer NFT', 'Enter recipient wallet address to transfer this NFT.')}
                      style={[styles.nftActionBtn, { borderRadius: radius(2), backgroundColor: 'rgba(255,255,255,0.12)', flex: 1 }]}
                    >
                      <Icon name="send-outline" size={font(14)} color="#D0B8FF" />
                      <Text style={[{ color: '#D0B8FF', fontFamily: Fonts.semiBold, fontSize: font(12) }]}>Transfer</Text>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </View>
            ))}
          </>
        )}

        {/* ─── MARKETPLACE TAB ─── */}
        {activeTab === 'marketplace' && (
          <>
            <Text style={[styles.sectionTitle, { fontSize: font(14), marginBottom: hp(0.5) }]}>
              NFT Marketplace
            </Text>
            <Text style={[styles.sectionSub, { fontSize: font(11), marginBottom: hp(2) }]}>
              Buy and sell Franchise NFTs from other holders
            </Text>
            {FRANCHISE_TIERS.filter(t => t.id !== 'world').map((tier) => (
              <View
                key={tier.id}
                style={[styles.marketCard, { borderRadius: radius(3), marginBottom: hp(1.5) }]}
              >
                <View style={[styles.marketCardLeft, { padding: hp(1.8) }]}>
                  <Text style={{ fontSize: font(28) }}>{tier.emoji}</Text>
                  <View style={{ flex: 1, marginLeft: wp(3) }}>
                    <Text style={[styles.tierName, { fontSize: font(13.5), color: '#1A1A2E' }]}>{tier.name}</Text>
                    <Text style={[{ fontSize: font(10.5), color: '#7A7A7A', fontFamily: Fonts.regular }]}>
                      {tier.revenueShare} · Supply: {tier.supply}
                    </Text>
                    <Text style={[{ fontSize: font(13), color: Colors.primary, fontFamily: Fonts.bold, marginTop: 4 }]}>
                      Floor: {tier.price}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleBuyNFT(tier)}
                    style={[styles.marketBuyBtn, { borderRadius: radius(2) }]}
                  >
                    <Text style={[{ color: '#FFF', fontFamily: Fonts.bold, fontSize: font(11.5) }]}>Buy</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
//  HELPER COMPONENTS
// ─────────────────────────────────────────────
const SummaryChip = ({ label, value, icon }: any) => {
  const { wp, hp, font, radius } = useResponsive();
  return (
    <View style={[styles.summaryChip, { borderRadius: radius(2.5), padding: hp(1.2), paddingHorizontal: wp(3.5) }]}>
      <Icon name={icon} size={font(14)} color="#D0B8FF" />
      <Text style={[{ color: '#FFF', fontFamily: Fonts.bold, fontSize: font(14), marginTop: 3 }]}>{value}</Text>
      <Text style={[{ color: '#D0B8FF', fontFamily: Fonts.regular, fontSize: font(9.5) }]}>{label}</Text>
    </View>
  );
};

const MetaItem = ({ icon, label, value }: any) => {
  const { font } = useResponsive();
  return (
    <View style={styles.metaItem}>
      <Icon name={icon} size={font(13)} color={Colors.primary} />
      <View>
        <Text style={[{ fontSize: font(10), color: '#7A7A7A', fontFamily: Fonts.regular }]}>{label}</Text>
        <Text style={[{ fontSize: font(12.5), color: '#1A1A2E', fontFamily: Fonts.bold }]}>{value}</Text>
      </View>
    </View>
  );
};

const NFTStat = ({ label, value }: { label: string; value: string }) => {
  const { font } = useResponsive();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[{ color: '#D0B8FF', fontFamily: Fonts.regular, fontSize: font(9.5) }]}>{label}</Text>
      <Text style={[{ color: '#FFF', fontFamily: Fonts.bold, fontSize: font(13), marginTop: 2 }]}>{value}</Text>
    </View>
  );
};

// ─────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1A0048' },
  header: { paddingTop: 14 },
  headerTitle: { color: '#FFF', fontFamily: Fonts.bold },
  headerSub: { color: '#D0B8FF', fontFamily: Fonts.regular, marginTop: 2 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  summaryChip: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },

  tabsBar: { flexDirection: 'row', backgroundColor: '#F3F3F5', paddingTop: 8, paddingBottom: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontFamily: Fonts.medium },

  sectionTitle: { color: '#1A1A2E', fontFamily: Fonts.bold },
  sectionSub: { color: '#7A7A7A', fontFamily: Fonts.regular, marginTop: 2 },

  revenueCard: {},
  revenueLabel: { color: '#D0B8FF', fontFamily: Fonts.regular },
  revenueValue: { color: '#FFF', fontFamily: Fonts.bold, marginTop: 4 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pendingText: { color: '#D0B8FF', fontFamily: Fonts.regular },
  claimBtn: { backgroundColor: '#F7A41D', alignItems: 'center' },
  claimBtnText: { color: '#1A1A2E', fontFamily: Fonts.bold },

  myNftCard: { elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  myNftGradient: {},
  myNftRow: { flexDirection: 'row', alignItems: 'center' },
  myNftEmoji: {},
  myNftName: { color: '#FFF', fontFamily: Fonts.bold },
  myNftToken: { color: '#D0B8FF', fontFamily: Fonts.regular, marginTop: 2 },
  myNftValue: { color: '#FFF', fontFamily: Fonts.bold },
  revenueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  revLabel: { color: '#D0B8FF', fontFamily: Fonts.regular },
  revVal: { color: '#FFF', fontFamily: Fonts.bold, marginTop: 2 },
  claimSmallBtn: { backgroundColor: '#F7A41D', paddingHorizontal: 14, paddingVertical: 8 },
  claimSmallText: { color: '#1A1A2E', fontFamily: Fonts.bold },

  tierCard: { backgroundColor: '#FFF', elevation: 3, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  tierHeader: {},
  tierHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  tierEmoji: {},
  tierNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierName: { color: '#FFF', fontFamily: Fonts.bold },
  ownedBadge: { backgroundColor: '#F7A41D', paddingHorizontal: 6, paddingVertical: 2 },
  ownedText: { color: '#1A1A2E', fontFamily: Fonts.bold },
  rarityBadge: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 8, paddingVertical: 3 },
  rarityText: { color: '#FFF', fontFamily: Fonts.bold },
  tierSupply: { color: 'rgba(255,255,255,0.7)', fontFamily: Fonts.regular },
  tierPrice: { color: '#F7A41D', fontFamily: Fonts.bold },
  tierBody: {},
  tierDesc: { color: '#7A7A7A', fontFamily: Fonts.regular, lineHeight: 20 },
  tierMeta: { flexDirection: 'row', gap: 20 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buyBtnText: { color: '#FFF', fontFamily: Fonts.bold },

  nftStatsRow: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10, paddingVertical: 12 },
  nftActions: { flexDirection: 'row' },
  nftActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },

  marketCard: { backgroundColor: '#FFF', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  marketCardLeft: { flexDirection: 'row', alignItems: 'center' },
  marketBuyBtn: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 10 },
});
