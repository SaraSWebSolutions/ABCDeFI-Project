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
import { Colors } from '../../Utils/Colors';
import Fonts from '../../Utils/Fonts';
import { useResponsive } from '../../Utils/Responsive';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─────────────────────────────────────────────
//  LEGION HIERARCHY DATA
// ─────────────────────────────────────────────
const LEGION_TIERS = [
  {
    rank: 'ABCD Supreme',
    level: 5,
    emoji: '⚪',
    referrals: '100+',
    commission: '12%',
    color1: '#C0C0C0',
    color2: '#A0A0A0',
    description: 'The highest honour in the ABCDeFi ecosystem. Supreme commanders lead global communities.',
    unlocked: false,
  },
  {
    rank: 'ABCD Grand Master',
    level: 4,
    emoji: '🔴',
    referrals: '50+',
    commission: '10%',
    color1: '#EF4444',
    color2: '#B91C1C',
    description: 'Proven community builders who have created thriving sub-networks.',
    unlocked: false,
  },
  {
    rank: 'ABCD Master',
    level: 3,
    emoji: '🟡',
    referrals: '25+',
    commission: '8%',
    color1: '#F7A41D',
    color2: '#D97706',
    description: 'Respected leaders with a strong referral network and active community presence.',
    unlocked: true,
    current: true,
  },
  {
    rank: 'ABCD Knight',
    level: 2,
    emoji: '🔵',
    referrals: '10+',
    commission: '5%',
    color1: '#3B82F6',
    color2: '#1D4ED8',
    description: 'Rising members who have demonstrated commitment to the ABCDeFi community.',
    unlocked: true,
  },
  {
    rank: 'ABCD Recruit',
    level: 1,
    emoji: '🟣',
    referrals: '1+',
    commission: '2%',
    color1: '#8B5CF6',
    color2: '#6C3CF0',
    description: 'Entry-level members who have completed KYC and begun their ABCDeFi journey.',
    unlocked: true,
  },
];

// ─────────────────────────────────────────────
//  USER NFT HOLDINGS
// ─────────────────────────────────────────────
const MY_NFTS = [
  {
    id: 'NFT-001',
    name: 'ABCDeFi Genesis #001',
    legion: 'ABCD Master',
    tier: 3,
    rarity: 'Legendary',
    value: 2100,
    change: +12.5,
    mintDate: '01 Jul 2026',
    color1: '#F7A41D',
    color2: '#D97706',
    attributes: [
      { trait: 'Commission Boost', value: '8%' },
      { trait: 'Staking Multiplier', value: '1.5×' },
      { trait: 'Governance Votes', value: '3' },
    ],
  },
  {
    id: 'NFT-002',
    name: 'ABCDeFi Pioneer #044',
    legion: 'ABCD Knight',
    tier: 2,
    rarity: 'Rare',
    value: 1400,
    change: +5.2,
    mintDate: '10 Jul 2026',
    color1: '#3B82F6',
    color2: '#1D4ED8',
    attributes: [
      { trait: 'Commission Boost', value: '5%' },
      { trait: 'Staking Multiplier', value: '1.2×' },
      { trait: 'Governance Votes', value: '1' },
    ],
  },
  {
    id: 'NFT-003',
    name: 'ABCDeFi Recruit #187',
    legion: 'ABCD Recruit',
    tier: 1,
    rarity: 'Common',
    value: 700,
    change: -2.1,
    mintDate: '15 Jul 2026',
    color1: '#8B5CF6',
    color2: '#6C3CF0',
    attributes: [
      { trait: 'Commission Boost', value: '2%' },
      { trait: 'Staking Multiplier', value: '1.0×' },
      { trait: 'Governance Votes', value: '0' },
    ],
  },
];

// ─────────────────────────────────────────────
//  REFERRAL DATA
// ─────────────────────────────────────────────
const MY_REFERRALS = [
  { name: 'Priya Sharma', joined: '05 Jul 2026', status: 'Active', kycDone: true },
  { name: 'Ankit Verma', joined: '08 Jul 2026', status: 'Active', kycDone: true },
  { name: 'Elena Rostova', joined: '12 Jul 2026', status: 'KYC Pending', kycDone: false },
  { name: 'Rafael Torres', joined: '20 Jul 2026', status: 'Active', kycDone: true },
];

// ─────────────────────────────────────────────
//  MAIN NFT SCREEN
// ─────────────────────────────────────────────
export default function NFTScreen({ navigation }: any) {
  const { wp, hp, font, radius } = useResponsive();
  const [activeTab, setActiveTab] = useState<'legion' | 'my-nfts' | 'referrals'>('legion');
  const [expandedNft, setExpandedNft] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={['#2B0A57', '#1A1A2E']}
        style={[styles.header, { paddingHorizontal: wp(5), paddingBottom: hp(2) }]}
      >
        <Text style={[styles.headerTitle, { fontSize: font(20) }]}>NFT Legion Hub</Text>
        <Text style={[styles.headerSub, { fontSize: font(11) }]}>
          ABCDeFi Community Identity & Rewards
        </Text>

        {/* My Status Card */}
        <LinearGradient
          colors={['rgba(247,164,29,0.25)', 'rgba(108,60,240,0.25)']}
          style={[styles.myStatusCard, { borderRadius: radius(3), padding: hp(2), marginTop: hp(2) }]}
        >
          <View style={styles.statusRow}>
            <Text style={[styles.statusEmoji, { fontSize: font(30) }]}>🟡</Text>
            <View style={{ flex: 1, marginLeft: wp(3) }}>
              <Text style={[styles.statusRank, { fontSize: font(16) }]}>ABCD Master</Text>
              <Text style={[styles.statusLevel, { fontSize: font(11) }]}>Level 3 · 12 Referrals · 8% Commission</Text>
            </View>
            <View style={[styles.nextBadge, { borderRadius: radius(2) }]}>
              <Text style={[styles.nextText, { fontSize: font(9) }]}>Next: Grand Master</Text>
              <Text style={[styles.nextReq, { fontSize: font(10) }]}>13 more refs</Text>
            </View>
          </View>

          {/* Progress to next tier */}
          <View style={{ marginTop: hp(1.5) }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={[{ color: '#D0B8FF', fontSize: font(10), fontFamily: Fonts.regular }]}>
                Progress to Grand Master
              </Text>
              <Text style={[{ color: '#FFF', fontSize: font(10), fontFamily: Fonts.bold }]}>
                12 / 25 (48%)
              </Text>
            </View>
            <View style={[styles.progressBg, { borderRadius: radius(1) }]}>
              <LinearGradient
                colors={['#F7A41D', '#EF4444']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: '48%', borderRadius: radius(1) }]}
              />
            </View>
          </View>
        </LinearGradient>
      </LinearGradient>

      {/* Tabs */}
      <View style={[styles.tabsWrapper, { paddingHorizontal: wp(4) }]}>
        {(['legion', 'my-nfts', 'referrals'] as const).map((tab) => (
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
                activeTab === tab && styles.tabTextActive,
              ]}
            >
              {tab === 'legion' ? '🏛 Hierarchy' : tab === 'my-nfts' ? '🖼 My NFTs' : '👥 Referrals'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: '#F3F3F5' }}
        contentContainerStyle={{ padding: wp(4), paddingBottom: hp(14) }}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── LEGION HIERARCHY TAB ─── */}
        {activeTab === 'legion' && (
          <>
            <Text style={[styles.sectionTitle, { fontSize: font(14), marginBottom: hp(2) }]}>
              🏛 Legion Hierarchy
            </Text>
            {LEGION_TIERS.map((tier, i) => (
              <View
                key={i}
                style={[
                  styles.tierCard,
                  {
                    borderRadius: radius(3),
                    marginBottom: hp(1.5),
                    opacity: tier.unlocked ? 1 : 0.6,
                    borderWidth: tier.current ? 2 : 0,
                    borderColor: tier.current ? '#F7A41D' : 'transparent',
                  },
                ]}
              >
                <LinearGradient
                  colors={[tier.color1 + '22', tier.color2 + '11']}
                  style={[styles.tierGradient, { padding: hp(2) }]}
                >
                  <View style={styles.tierTop}>
                    <Text style={[styles.tierEmoji, { fontSize: font(28) }]}>{tier.emoji}</Text>
                    <View style={{ flex: 1, marginLeft: wp(3) }}>
                      <View style={styles.tierTitleRow}>
                        <Text style={[styles.tierRank, { fontSize: font(14), color: tier.color1 }]}>
                          {tier.rank}
                        </Text>
                        {tier.current && (
                          <View style={[styles.currentBadge, { backgroundColor: '#F7A41D22', borderRadius: radius(1.5) }]}>
                            <Text style={[styles.currentText, { fontSize: font(9.5) }]}>YOUR RANK</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.tierDesc, { fontSize: font(11) }]}>{tier.description}</Text>
                    </View>
                  </View>

                  <View style={[styles.tierMeta, { marginTop: hp(1.5) }]}>
                    <MetaChip label="Min Referrals" value={tier.referrals} color={tier.color1} />
                    <MetaChip label="Commission" value={tier.commission} color={tier.color1} />
                    <MetaChip label="Level" value={`${tier.level}`} color={tier.color1} />
                    <MetaChip label="Status" value={tier.unlocked ? (tier.current ? 'Current' : 'Unlocked') : 'Locked'} color={tier.unlocked ? '#22C55E' : '#9CA3AF'} />
                  </View>
                </LinearGradient>
              </View>
            ))}
          </>
        )}

        {/* ─── MY NFTs TAB ─── */}
        {activeTab === 'my-nfts' && (
          <>
            <Text style={[styles.sectionTitle, { fontSize: font(14), marginBottom: hp(2) }]}>
              🖼 My NFT Collection
            </Text>
            {MY_NFTS.map((nft) => {
              const isExpanded = expandedNft === nft.id;
              const isUp = nft.change >= 0;
              return (
                <TouchableOpacity
                  key={nft.id}
                  onPress={() => setExpandedNft(isExpanded ? null : nft.id)}
                  activeOpacity={0.9}
                >
                  <View style={[styles.nftCard, { borderRadius: radius(3), marginBottom: hp(1.8), overflow: 'hidden' }]}>
                    <LinearGradient
                      colors={[nft.color1, nft.color2]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.nftBanner, { padding: hp(2) }]}
                    >
                      {/* NFT Visual Placeholder */}
                      <View style={[styles.nftVisual, { borderRadius: radius(2.5), width: 60, height: 60 }]}>
                        <Text style={[styles.nftVisualText, { fontSize: font(22) }]}>🏆</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: wp(3) }}>
                        <Text style={[styles.nftName, { fontSize: font(14) }]}>{nft.name}</Text>
                        <Text style={[styles.nftLegion, { fontSize: font(10.5) }]}>{nft.legion}</Text>
                        <View style={styles.nftBottomRow}>
                          <Text style={[styles.nftValue, { fontSize: font(16) }]}>${nft.value.toLocaleString()}</Text>
                          <View style={[styles.nftChangeBadge, { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: radius(1.5) }]}>
                            <Icon name={isUp ? 'trending-up' : 'trending-down'} size={font(11)} color={isUp ? '#A5F3B5' : '#FCA5A5'} />
                            <Text style={[styles.nftChange, { fontSize: font(10.5), color: isUp ? '#A5F3B5' : '#FCA5A5' }]}>
                              {isUp ? '+' : ''}{nft.change}%
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <View style={[styles.rarityBadge, { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius(1.5) }]}>
                          <Text style={[styles.rarityText, { fontSize: font(10) }]}>{nft.rarity}</Text>
                        </View>
                        <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={font(16)} color="rgba(255,255,255,0.7)" style={{ marginTop: 8 }} />
                      </View>
                    </LinearGradient>

                    {/* Expanded Attributes */}
                    {isExpanded && (
                      <View style={[styles.attrSection, { padding: hp(2) }]}>
                        <Text style={[styles.attrTitle, { fontSize: font(12) }]}>NFT Attributes</Text>
                        {nft.attributes.map((attr, i) => (
                          <View key={i} style={styles.attrRow}>
                            <Text style={[styles.attrLabel, { fontSize: font(11.5) }]}>{attr.trait}</Text>
                            <Text style={[styles.attrValue, { fontSize: font(11.5), color: Colors.primary }]}>{attr.value}</Text>
                          </View>
                        ))}
                        <Text style={[styles.mintDate, { fontSize: font(10), marginTop: hp(1) }]}>
                          Minted: {nft.mintDate} · Token ID: {nft.id}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* ─── REFERRALS TAB ─── */}
        {activeTab === 'referrals' && (
          <>
            {/* Stats */}
            <View style={[styles.refStatsRow, { marginBottom: hp(2) }]}>
              <View style={[styles.refStatCard, { borderRadius: radius(3), flex: 1, marginRight: wp(2), padding: hp(2) }]}>
                <Text style={[styles.refStatValue, { fontSize: font(24), color: Colors.primary }]}>12</Text>
                <Text style={[styles.refStatLabel, { fontSize: font(11) }]}>Total Referrals</Text>
              </View>
              <View style={[styles.refStatCard, { borderRadius: radius(3), flex: 1, marginLeft: wp(2), padding: hp(2) }]}>
                <Text style={[styles.refStatValue, { fontSize: font(24), color: '#22C55E' }]}>48</Text>
                <Text style={[styles.refStatLabel, { fontSize: font(11) }]}>Team Size</Text>
              </View>
            </View>

            {/* Referral Link */}
            <View style={[styles.refLinkCard, { borderRadius: radius(3), padding: hp(2), marginBottom: hp(2) }]}>
              <Text style={[styles.refLinkLabel, { fontSize: font(11) }]}>Your Referral Link</Text>
              <View style={[styles.refLinkRow, { marginTop: hp(1), borderRadius: radius(2) }]}>
                <Text style={[styles.refLinkText, { fontSize: font(12) }]} numberOfLines={1}>
                  https://abcdefi.io/ref/DKUMAR2026
                </Text>
                <TouchableOpacity style={[styles.copyBtn, { borderRadius: radius(1.5) }]}>
                  <Icon name="copy-outline" size={font(14)} color={Colors.primary} />
                  <Text style={[styles.copyText, { fontSize: font(11) }]}>Copy</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Referral List */}
            <Text style={[styles.sectionTitle, { fontSize: font(13), marginBottom: hp(1.5) }]}>
              👥 Your Direct Referrals
            </Text>
            {MY_REFERRALS.map((ref, i) => (
              <View key={i} style={[styles.refItem, { borderRadius: radius(2.5), marginBottom: hp(1.2), padding: hp(1.8) }]}>
                <View style={[styles.refAvatar, { borderRadius: radius(5) }]}>
                  <Text style={[styles.refAvatarText, { fontSize: font(14) }]}>
                    {ref.name.charAt(0)}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: wp(3) }}>
                  <Text style={[styles.refName, { fontSize: font(13) }]}>{ref.name}</Text>
                  <Text style={[styles.refJoined, { fontSize: font(10.5) }]}>Joined: {ref.joined}</Text>
                </View>
                <View
                  style={[
                    styles.refStatusBadge,
                    {
                      borderRadius: radius(1.5),
                      backgroundColor: ref.kycDone ? '#DCF7E3' : '#FEF3C7',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.refStatusText,
                      { fontSize: font(10), color: ref.kycDone ? '#22C55E' : '#D97706' },
                    ]}
                  >
                    {ref.status}
                  </Text>
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
//  META CHIP
// ─────────────────────────────────────────────
const MetaChip = ({ label, value, color }: { label: string; value: string; color: string }) => {
  const { wp, hp, font, radius } = useResponsive();
  return (
    <View style={[styles.metaChip, { borderRadius: radius(1.5), padding: hp(0.8), paddingHorizontal: wp(2.5), borderColor: color + '44', backgroundColor: color + '11' }]}>
      <Text style={[styles.metaChipLabel, { fontSize: font(9) }]}>{label}</Text>
      <Text style={[styles.metaChipValue, { fontSize: font(11.5), color }]}>{value}</Text>
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

  myStatusCard: { borderWidth: 1, borderColor: 'rgba(247,164,29,0.3)' },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusEmoji: {},
  statusRank: { color: '#FFF', fontFamily: Fonts.bold },
  statusLevel: { color: '#D0B8FF', fontFamily: Fonts.regular, marginTop: 2 },
  nextBadge: { backgroundColor: 'rgba(247,164,29,0.2)', padding: 6, alignItems: 'center' },
  nextText: { color: '#D0B8FF', fontFamily: Fonts.regular },
  nextReq: { color: '#F7A41D', fontFamily: Fonts.bold, marginTop: 2 },
  progressBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.15)' },
  progressFill: { height: 8 },

  tabsWrapper: { flexDirection: 'row', backgroundColor: '#F3F3F5', paddingTop: 8, paddingBottom: 4, gap: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontFamily: Fonts.medium },
  tabTextActive: { fontFamily: Fonts.bold },

  sectionTitle: { fontFamily: Fonts.bold, color: '#1A1A2E' },

  tierCard: { backgroundColor: '#FFF', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  tierGradient: {},
  tierTop: { flexDirection: 'row', alignItems: 'flex-start' },
  tierEmoji: {},
  tierTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierRank: { fontFamily: Fonts.bold },
  currentBadge: { paddingHorizontal: 8, paddingVertical: 3 },
  currentText: { color: '#F7A41D', fontFamily: Fonts.bold },
  tierDesc: { color: '#7A7A7A', fontFamily: Fonts.regular, marginTop: 4 },
  tierMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaChip: { borderWidth: 1 },
  metaChipLabel: { color: '#7A7A7A', fontFamily: Fonts.regular },
  metaChipValue: { fontFamily: Fonts.bold, marginTop: 2 },

  nftCard: { elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, backgroundColor: '#FFF' },
  nftBanner: { flexDirection: 'row', alignItems: 'center' },
  nftVisual: { backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  nftVisualText: {},
  nftName: { color: '#FFF', fontFamily: Fonts.bold },
  nftLegion: { color: 'rgba(255,255,255,0.75)', fontFamily: Fonts.regular, marginTop: 2 },
  nftBottomRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
  nftValue: { color: '#FFF', fontFamily: Fonts.bold },
  nftChangeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, gap: 3 },
  nftChange: { fontFamily: Fonts.semiBold },
  rarityBadge: { paddingHorizontal: 8, paddingVertical: 3 },
  rarityText: { color: '#FFF', fontFamily: Fonts.semiBold },
  attrSection: { backgroundColor: '#FFF' },
  attrTitle: { color: '#7A7A7A', fontFamily: Fonts.semiBold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  attrRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  attrLabel: { color: '#1A1A2E', fontFamily: Fonts.medium },
  attrValue: { fontFamily: Fonts.bold },
  mintDate: { color: '#B8B8B8', fontFamily: Fonts.regular },

  refStatsRow: { flexDirection: 'row' },
  refStatCard: { backgroundColor: '#FFF', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, alignItems: 'center' },
  refStatValue: { fontFamily: Fonts.bold },
  refStatLabel: { color: '#7A7A7A', fontFamily: Fonts.regular, marginTop: 4 },

  refLinkCard: { backgroundColor: '#FFF', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  refLinkLabel: { color: '#7A7A7A', fontFamily: Fonts.semiBold },
  refLinkRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F6FF', paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#E3D8FF' },
  refLinkText: { flex: 1, color: Colors.primary, fontFamily: Fonts.medium },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary + '15', paddingHorizontal: 10, paddingVertical: 6 },
  copyText: { color: Colors.primary, fontFamily: Fonts.semiBold },

  refItem: { backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  refAvatar: { width: 40, height: 40, backgroundColor: Colors.primary + '20', alignItems: 'center', justifyContent: 'center' },
  refAvatarText: { color: Colors.primary, fontFamily: Fonts.bold },
  refName: { color: '#1A1A2E', fontFamily: Fonts.semiBold },
  refJoined: { color: '#7A7A7A', fontFamily: Fonts.regular, marginTop: 2 },
  refStatusBadge: { paddingHorizontal: 8, paddingVertical: 4 },
  refStatusText: { fontFamily: Fonts.semiBold },
});