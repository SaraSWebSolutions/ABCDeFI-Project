import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import { Colors } from '../../Utils/Colors';
import Fonts from '../../Utils/Fonts';
import { useResponsive } from '../../Utils/Responsive';

// ─────────────────────────────────────────────
//  MOCK DATA — Loan Marketplace Listings (Default loans hidden)
// ─────────────────────────────────────────────
const LISTED_LOANS: any[] = [];

// ─────────────────────────────────────────────
//  BORROWER REQUEST FORM — Whitepaper Fields
// ─────────────────────────────────────────────
const DEFAULT_BORROW_FORM = {
  amount: '',
  duration: '',
  purpose: '',
  interestRate: '',
  collateral: '',
  collateralType: 'ETH',
  documents: '',
  monthlyIncome: '',
};

// ─────────────────────────────────────────────
//  LOAN CARD
// ─────────────────────────────────────────────
const LoanCard = ({ loan, onFund }: { loan: any; onFund: (loan: any) => void }) => {
  const { wp, hp, font, radius } = useResponsive();

  const riskColor =
    loan.riskProfile === 'Low Risk'
      ? '#22C55E'
      : loan.riskProfile === 'Medium Risk'
      ? '#F59E0B'
      : '#EF4444';

  return (
    <View style={[styles.loanCard, { borderRadius: radius(3), marginBottom: hp(2) }]}>
      {/* Header */}
      <LinearGradient
        colors={['#6C3CF0', '#4A1FB8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.cardHeader, { borderTopLeftRadius: radius(3), borderTopRightRadius: radius(3) }]}
      >
        <View>
          <Text style={[styles.loanId, { fontSize: font(11) }]}>{loan.id}</Text>
          <Text style={[styles.borrowerName, { fontSize: font(15) }]}>{loan.borrower}</Text>
          <Text style={[styles.borrowerCountry, { fontSize: font(11) }]}>
            <Icon name="location-outline" size={font(11)} color="#D0B8FF" /> {loan.country}
          </Text>
        </View>
        <View style={styles.riskBadge}>
          <Text style={[styles.riskText, { fontSize: font(10), color: riskColor }]}>
            {loan.riskProfile}
          </Text>
        </View>
      </LinearGradient>

      {/* Body */}
      <View style={[styles.cardBody, { padding: hp(1.8) }]}>
        {/* KYC & AML Row */}
        <View style={[styles.badgeRow, { marginBottom: hp(1.2) }]}>
          <View style={[styles.verBadge, { backgroundColor: '#DCF7E3' }]}>
            <Icon name="shield-checkmark" size={font(11)} color="#22C55E" />
            <Text style={[styles.verBadgeText, { fontSize: font(10), color: '#22C55E' }]}>
              KYC {loan.kycStatus}
            </Text>
          </View>
          <View style={[styles.verBadge, { backgroundColor: '#DCF7E3', marginLeft: wp(2) }]}>
            <Icon name="checkmark-circle" size={font(11)} color="#22C55E" />
            <Text style={[styles.verBadgeText, { fontSize: font(10), color: '#22C55E' }]}>
              AML {loan.amlStatus}
            </Text>
          </View>
        </View>

        {/* Loan Info Grid */}
        <View style={styles.infoGrid}>
          <InfoCell label="Loan Amount" value={`${loan.amount} ABCD`} />
          <InfoCell label="Duration" value={`${loan.duration} Months`} />
          <InfoCell label="Interest APY" value={`${loan.interestRate}%`} accent />
          <InfoCell label="Monthly EMI" value={`${loan.monthlyEMI} ABCD`} accent />
          <InfoCell label="Collateral" value={loan.collateral} />
          <InfoCell label="LTV Ratio" value={loan.ltv} />
        </View>

        {/* LTV Bar */}
        <View style={[styles.ltvBarBg, { marginTop: hp(1.2), borderRadius: radius(2) }]}>
          <View
            style={[
              styles.ltvBarFill,
              { width: `${loan.ltvRaw}%`, backgroundColor: riskColor, borderRadius: radius(2) },
            ]}
          />
        </View>
        <Text style={[styles.ltvLabel, { fontSize: font(9.5), marginBottom: hp(1.2) }]}>
          LTV Coverage: {loan.ltv} (Liquidation at 80%)
        </Text>

        {/* Purpose */}
        <View style={[styles.purposeBox, { borderRadius: radius(2), padding: hp(1.2) }]}>
          <Text style={[styles.purposeLabel, { fontSize: font(10) }]}>Loan Purpose</Text>
          <Text style={[styles.purposeValue, { fontSize: font(13) }]}>{loan.purpose}</Text>
        </View>

        {/* Contract */}
        <View style={[styles.contractRow, { marginTop: hp(1) }]}>
          <Icon name="document-text" size={font(12)} color={Colors.primary} />
          <Text style={[styles.contractText, { fontSize: font(10.5) }]}>
            Contract: {loan.contract} — Verified ✅
          </Text>
        </View>

        {/* Fund Button */}
        <TouchableOpacity
          onPress={() => onFund(loan)}
          activeOpacity={0.85}
          style={{ marginTop: hp(1.5) }}
        >
          <LinearGradient
            colors={['#6C3CF0', '#F7A41D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.fundBtn, { borderRadius: radius(2.5), paddingVertical: hp(1.5) }]}
          >
            <Icon name="handshake-outline" size={font(15)} color="#FFF" />
            <Text style={[styles.fundBtnText, { fontSize: font(13.5) }]}>
              Approve & Fund Loan
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────
//  INFO CELL
// ─────────────────────────────────────────────
const InfoCell = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => {
  const { font } = useResponsive();
  return (
    <View style={styles.infoCell}>
      <Text style={[styles.infoLabel, { fontSize: font(9.5) }]}>{label}</Text>
      <Text
        style={[
          styles.infoValue,
          { fontSize: font(12.5), color: accent ? Colors.primary : '#1A1A2E' },
        ]}
      >
        {value}
      </Text>
    </View>
  );
};

// ─────────────────────────────────────────────
//  FUNDED LOANS PORTFOLIO DATA
// ─────────────────────────────────────────────
const FUNDED_LOANS_PORTFOLIO = [
  {
    id: '#1001',
    rawId: '1001',
    borrower: 'Dinesh Kumar',
    amount: '1,000 ABCD',
    interest: '8%',
    paid: '3/12',
    paidNum: 3,
    totalNum: 12,
    status: 'Active',
    monthlyEmi: '87.5 ABCD',
    collateral: '2 ETH',
  },
  {
    id: '#984',
    rawId: '984',
    borrower: 'Elena Rostova',
    amount: '4,000 ABCD',
    interest: '9%',
    paid: '12/12',
    paidNum: 12,
    totalNum: 12,
    status: 'Completed',
    monthlyEmi: '363.33 ABCD',
    collateral: '5 ETH',
  },
];

// ─────────────────────────────────────────────
//  MAIN FINANCE SCREEN
// ─────────────────────────────────────────────
export default function FinanceScreen({ navigation }: any) {
  const { wp, hp, font, radius } = useResponsive();
  const [activeTab, setActiveTab] = useState<'lend' | 'borrow' | 'funded'>('lend');
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [selectedEmiModalLoan, setSelectedEmiModalLoan] = useState<any>(null);
  const [showAgreement, setShowAgreement] = useState(false);
  const [borrowForm, setBorrowForm] = useState(DEFAULT_BORROW_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleFund = (loan: any) => {
    setSelectedLoan(loan);
    setShowAgreement(true);
  };

  const handleConfirmFund = () => {
    setShowAgreement(false);
    setTimeout(() => {
      Alert.alert(
        '✅ Loan Funded',
        `You have successfully funded ${selectedLoan?.amount} ABCD to ${selectedLoan?.borrower}.\n\nSmart contract agreement is now active on Ethereum Sepolia.`,
        [{ text: 'OK', style: 'default' }]
      );
    }, 300);
  };

  const handleBorrowSubmit = () => {
    if (!borrowForm.amount || !borrowForm.duration || !borrowForm.purpose || !borrowForm.collateral) {
      Alert.alert('Missing Fields', 'Please fill all required loan fields before submitting.');
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setBorrowForm(DEFAULT_BORROW_FORM);
      Alert.alert(
        '✅ Loan Request Submitted',
        'Your borrowing request has been listed on the ABCDeFi marketplace. Lenders will review your KYC, collateral, and loan details.',
        [{ text: 'OK' }]
      );
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={['#2B0A57', '#1A1A2E']}
        style={[styles.header, { paddingHorizontal: wp(5), paddingBottom: hp(2) }]}
      >
        <Text style={[styles.headerTitle, { fontSize: font(20) }]}>eLIC Finance</Text>
        <Text style={[styles.headerSubtitle, { fontSize: font(11) }]}>
          Earnings for Lenders · Incentives for Community
        </Text>

        {/* Tabs */}
        <View style={[styles.tabRow, { marginTop: hp(2), borderRadius: radius(3) }]}>
          {(['lend', 'borrow', 'funded'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[
                styles.tabBtn,
                { borderRadius: radius(2.5) },
                activeTab === tab && styles.tabBtnActive,
              ]}
              activeOpacity={0.8}
            >
              <Icon
                name={tab === 'lend' ? 'trending-up-outline' : tab === 'borrow' ? 'cash-outline' : 'receipt-outline'}
                size={font(13)}
                color={activeTab === tab ? '#FFF' : '#B8A8E0'}
              />
              <Text
                style={[
                  styles.tabText,
                  { fontSize: font(11.5), color: activeTab === tab ? '#FFF' : '#B8A8E0' },
                ]}
              >
                {tab === 'lend' ? '💰 Lend' : tab === 'borrow' ? '🤝 Borrow' : '📊 Funded'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1, backgroundColor: '#F3F3F5' }}
        contentContainerStyle={{ padding: wp(4), paddingBottom: hp(12) }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ────── LEND TAB ────── */}
        {activeTab === 'lend' && (
          <>
            <View style={[styles.sectionHeader, { marginBottom: hp(2) }]}>
              <Text style={[styles.sectionTitle, { fontSize: font(15) }]}>
                📋 Loan Marketplace
              </Text>
              <Text style={[styles.sectionSub, { fontSize: font(11) }]}>
                Review borrower KYC, collateral & terms before funding
              </Text>
            </View>
            {LISTED_LOANS.length === 0 ? (
              <View style={{ padding: hp(4), alignItems: 'center', backgroundColor: '#FFF', borderRadius: radius(3), marginTop: hp(1) }}>
                <Icon name="receipt-outline" size={font(36)} color="#A0A0A0" />
                <Text style={{ marginTop: hp(1.5), fontFamily: Fonts.bold, fontSize: font(14), color: '#1A1A2E' }}>
                  No Loans Available
                </Text>
                <Text style={{ marginTop: hp(0.5), fontFamily: Fonts.regular, fontSize: font(11), color: '#7A7A7A', textAlign: 'center' }}>
                  Default loans have been hidden. Submit a borrowing request to create a new loan.
                </Text>
              </View>
            ) : (
              LISTED_LOANS.map((loan) => (
                <LoanCard key={loan.id} loan={loan} onFund={handleFund} />
              ))
            )}
          </>
        )}

        {/* ────── BORROW TAB ────── */}
        {activeTab === 'borrow' && (
          <>
            <View style={[styles.sectionHeader, { marginBottom: hp(2) }]}>
              <Text style={[styles.sectionTitle, { fontSize: font(15) }]}>📝 Submit Loan Request</Text>
              <Text style={[styles.sectionSub, { fontSize: font(11) }]}>
                Your KYC & AML compliance will be shown to lenders
              </Text>
            </View>

            {/* Identity Banner */}
            <LinearGradient
              colors={['#6C3CF0', '#4A1FB8']}
              style={[styles.identityBanner, { borderRadius: radius(3), marginBottom: hp(2), padding: hp(2) }]}
            >
              <View style={styles.identityRow}>
                <Icon name="shield-checkmark" size={font(22)} color="#A5F3B5" />
                <View style={{ marginLeft: wp(3) }}>
                  <Text style={[styles.identityName, { fontSize: font(14) }]}>Dinesh Kumar</Text>
                  <Text style={[styles.identityInfo, { fontSize: font(10.5) }]}>
                    KYC ✅ Approved · AML ✅ Cleared
                  </Text>
                  <Text style={[styles.identityWallet, { fontSize: font(10) }]}>
                    0x7099...79C8
                  </Text>
                </View>
              </View>
            </LinearGradient>

            {/* Form */}
            <View style={[styles.formCard, { borderRadius: radius(3), padding: hp(2.5) }]}>
              <FormField
                label="Loan Amount (ABCD) *"
                placeholder="e.g. 1000"
                value={borrowForm.amount}
                onChangeText={(v: string) => setBorrowForm({ ...borrowForm, amount: v })}
                keyboardType="numeric"
              />
              <FormField
                label="Loan Duration (Months) *"
                placeholder="e.g. 12"
                value={borrowForm.duration}
                onChangeText={(v: string) => setBorrowForm({ ...borrowForm, duration: v })}
                keyboardType="numeric"
              />
              <FormField
                label="Interest Rate APY (%) *"
                placeholder="e.g. 8"
                value={borrowForm.interestRate}
                onChangeText={(v: string) => setBorrowForm({ ...borrowForm, interestRate: v })}
                keyboardType="numeric"
              />
              <FormField
                label="Loan Purpose *"
                placeholder="e.g. Business Expansion"
                value={borrowForm.purpose}
                onChangeText={(v: string) => setBorrowForm({ ...borrowForm, purpose: v })}
              />
              <FormField
                label="Collateral Amount (ETH) *"
                placeholder="e.g. 2 ETH"
                value={borrowForm.collateral}
                onChangeText={(v: string) => setBorrowForm({ ...borrowForm, collateral: v })}
              />
              <FormField
                label="Monthly Income (ABCD)"
                placeholder="e.g. 2000"
                value={borrowForm.monthlyIncome}
                onChangeText={(v: string) => setBorrowForm({ ...borrowForm, monthlyIncome: v })}
                keyboardType="numeric"
              />
              <FormField
                label="Supporting Documents / Notes"
                placeholder="Describe any supporting documents..."
                value={borrowForm.documents}
                onChangeText={(v: string) => setBorrowForm({ ...borrowForm, documents: v })}
                multiline
              />

              {/* Calculated EMI Preview */}
              {borrowForm.amount && borrowForm.interestRate && borrowForm.duration ? (
                <View style={[styles.emiPreview, { borderRadius: radius(2), marginTop: hp(1), padding: hp(1.5) }]}>
                  <Text style={[styles.emiPreviewLabel, { fontSize: font(10.5) }]}>
                    Estimated Monthly EMI
                  </Text>
                  <Text style={[styles.emiPreviewValue, { fontSize: font(18) }]}>
                    {(
                      (parseFloat(borrowForm.amount) * (1 + parseFloat(borrowForm.interestRate) / 100)) /
                      parseFloat(borrowForm.duration)
                    ).toFixed(2)}{' '}
                    ABCD / month
                  </Text>
                </View>
              ) : null}

              {/* Submit */}
              <TouchableOpacity
                onPress={handleBorrowSubmit}
                activeOpacity={0.85}
                style={{ marginTop: hp(2) }}
                disabled={submitting}
              >
                <LinearGradient
                  colors={['#6C3CF0', '#F7A41D']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.fundBtn, { borderRadius: radius(2.5), paddingVertical: hp(1.8) }]}
                >
                  <Icon name="paper-plane-outline" size={font(15)} color="#FFF" />
                  <Text style={[styles.fundBtnText, { fontSize: font(14) }]}>
                    {submitting ? 'Submitting...' : 'Submit Loan Request'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ────── FUNDED LOANS PORTFOLIO TAB ────── */}
        {activeTab === 'funded' && (
          <>
            <View style={[styles.sectionHeader, { marginBottom: hp(2) }]}>
              <Text style={[styles.sectionTitle, { fontSize: font(15) }]}>
                📊 Funded Loans Portfolio
              </Text>
              <Text style={[styles.sectionSub, { fontSize: font(11) }]}>
                Track active funded loans, borrower EMI progress, and repayment schedule
              </Text>
            </View>

            {FUNDED_LOANS_PORTFOLIO.map((loan) => (
              <View
                key={loan.id}
                style={[
                  styles.formCard,
                  { borderRadius: radius(3), padding: hp(2), marginBottom: hp(2) },
                ]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F0F0F3', paddingBottom: hp(1.2) }}>
                  <View>
                    <Text style={{ fontFamily: Fonts.bold, fontSize: font(14), color: Colors.primary }}>
                      {loan.id}
                    </Text>
                    <Text style={{ fontFamily: Fonts.bold, fontSize: font(15), color: '#1A1A2E', marginTop: 2 }}>
                      {loan.borrower}
                    </Text>
                  </View>
                  <View
                    style={{
                      paddingHorizontal: wp(3),
                      paddingVertical: hp(0.5),
                      borderRadius: radius(2),
                      backgroundColor: loan.status === 'Active' ? 'rgba(247,164,29,0.15)' : 'rgba(34,197,94,0.15)',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: Fonts.bold,
                        fontSize: font(10),
                        color: loan.status === 'Active' ? '#D97706' : '#16A34A',
                        textTransform: 'uppercase',
                      }}
                    >
                      {loan.status}
                    </Text>
                  </View>
                </View>

                {/* Details Grid */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: hp(1.5) }}>
                  <View style={{ width: '50%', marginBottom: hp(1) }}>
                    <Text style={{ fontSize: font(10), color: '#7A7A7A', fontFamily: Fonts.regular }}>Loan Amount</Text>
                    <Text style={{ fontSize: font(13), color: '#1A1A2E', fontFamily: Fonts.bold }}>{loan.amount}</Text>
                  </View>
                  <View style={{ width: '50%', marginBottom: hp(1) }}>
                    <Text style={{ fontSize: font(10), color: '#7A7A7A', fontFamily: Fonts.regular }}>Interest APY</Text>
                    <Text style={{ fontSize: font(13), color: '#22C55E', fontFamily: Fonts.bold }}>{loan.interest}</Text>
                  </View>
                  <View style={{ width: '50%', marginBottom: hp(1) }}>
                    <Text style={{ fontSize: font(10), color: '#7A7A7A', fontFamily: Fonts.regular }}>EMIs Paid</Text>
                    <Text style={{ fontSize: font(13), color: Colors.primary, fontFamily: Fonts.bold }}>{loan.paid}</Text>
                  </View>
                  <View style={{ width: '50%', marginBottom: hp(1) }}>
                    <Text style={{ fontSize: font(10), color: '#7A7A7A', fontFamily: Fonts.regular }}>Monthly EMI</Text>
                    <Text style={{ fontSize: font(13), color: '#1A1A2E', fontFamily: Fonts.bold }}>{loan.monthlyEmi}</Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={{ marginTop: hp(1), marginBottom: hp(1.5) }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: font(10), color: '#7A7A7A', fontFamily: Fonts.regular }}>Completion Progress</Text>
                    <Text style={{ fontSize: font(10), color: Colors.primary, fontFamily: Fonts.bold }}>
                      {Math.round((loan.paidNum / loan.totalNum) * 100)}%
                    </Text>
                  </View>
                  <View style={{ height: 6, backgroundColor: '#F0F0F3', borderRadius: radius(1), overflow: 'hidden' }}>
                    <View
                      style={{
                        height: '100%',
                        width: `${(loan.paidNum / loan.totalNum) * 100}%`,
                        backgroundColor: loan.status === 'Completed' ? '#22C55E' : Colors.primary,
                        borderRadius: radius(1),
                      }}
                    />
                  </View>
                </View>

                {/* Track EMI Action */}
                <TouchableOpacity
                  onPress={() => setSelectedEmiModalLoan(loan)}
                  activeOpacity={0.85}
                  style={{ marginTop: hp(0.5) }}
                >
                  <LinearGradient
                    colors={['#6C3CF0', '#4A1FB8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.fundBtn, { borderRadius: radius(2), paddingVertical: hp(1.2) }]}
                  >
                    <Icon name="stats-chart-outline" size={font(14)} color="#FFF" />
                    <Text style={[styles.fundBtnText, { fontSize: font(12.5) }]}>
                      Track EMI & Schedule
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* ─── SMART CONTRACT AGREEMENT MODAL ─── */}
      <Modal
        visible={showAgreement}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAgreement(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { borderTopLeftRadius: radius(5), borderTopRightRadius: radius(5) }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Modal Header */}
              <LinearGradient
                colors={['#2B0A57', '#1A1A2E']}
                style={[styles.modalHeader, { borderTopLeftRadius: radius(5), borderTopRightRadius: radius(5) }]}
              >
                <Text style={[styles.modalTitle, { fontSize: font(16) }]}>
                  🤝 Smart Contract Agreement
                </Text>
                <TouchableOpacity onPress={() => setShowAgreement(false)}>
                  <Icon name="close-circle-outline" size={font(22)} color="#D0B8FF" />
                </TouchableOpacity>
              </LinearGradient>

              <View style={{ padding: wp(5) }}>
                {/* TX Details */}
                <View style={[styles.txCard, { borderRadius: radius(3), marginBottom: hp(2) }]}>
                  <Text style={[styles.txCardTitle, { fontSize: font(12) }]}>Transaction Details</Text>
                  <TxRow label="Signing Address" value="0x709979...dc79C8" />
                  <TxRow label="Target Contract" value="P2PLendingPool" />
                  <TxRow label="Method" value="fundLoan()" code />
                  <TxRow label="Transaction Value" value={`${selectedLoan?.amount} ABCD`} accent />
                  <TxRow label="Agreement Type" value="P2P Lender-Borrower Direct Escrow" />
                  <TxRow label="Network" value="Ethereum Sepolia" />
                  <TxRow label="Est. Gas Fee" value="0.0012 ETH (2.3 Gwei)" />
                </View>

                {/* Borrower */}
                <View style={[styles.txCard, { borderRadius: radius(3), marginBottom: hp(2) }]}>
                  <Text style={[styles.txCardTitle, { fontSize: font(12) }]}>Borrower Profile</Text>
                  <TxRow label="Name" value={selectedLoan?.borrower + ' (KYC Verified ✅)'} />
                  <TxRow label="Wallet" value={selectedLoan?.wallet} code />
                  <TxRow label="Risk Score" value={`${selectedLoan?.score} — ${selectedLoan?.riskProfile}`} />
                  <TxRow label="Repayment Rate" value={selectedLoan?.repaymentRate} accent />
                  <TxRow label="Purpose" value={selectedLoan?.purpose} />
                </View>

                {/* Loan Terms */}
                <View style={[styles.txCard, { borderRadius: radius(3), marginBottom: hp(2) }]}>
                  <Text style={[styles.txCardTitle, { fontSize: font(12) }]}>Loan Terms</Text>
                  <TxRow label="Collateral Locked" value={`${selectedLoan?.collateral} (${selectedLoan?.ltv} LTV)`} />
                  <TxRow label="Interest APY" value={`${selectedLoan?.interestRate}% Fixed`} accent />
                  <TxRow label="Monthly EMI" value={`${selectedLoan?.monthlyEMI} ABCD`} accent />
                  <TxRow label="Term Duration" value={`${selectedLoan?.duration} Months`} />
                  <TxRow label="Liquidation Threshold" value="80% LTV (Auto-Auction Guard)" />
                </View>

                {/* Lender */}
                <View style={[styles.txCard, { borderRadius: radius(3), marginBottom: hp(2) }]}>
                  <Text style={[styles.txCardTitle, { fontSize: font(12) }]}>Lender Identity</Text>
                  <TxRow label="Name" value="Elena Rostova (Account 2)" />
                  <TxRow label="Wallet" value="0x3C44...93BC" code />
                </View>

                {/* Approve Button */}
                <TouchableOpacity onPress={handleConfirmFund} activeOpacity={0.85}>
                  <LinearGradient
                    colors={['#22C55E', '#16A34A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.approveBtn, { borderRadius: radius(3), paddingVertical: hp(2) }]}
                  >
                    <Icon name="checkmark-circle-outline" size={font(20)} color="#FFF" />
                    <Text style={[styles.approveBtnText, { fontSize: font(15) }]}>
                      Approve & Sign Agreement
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setShowAgreement(false)}
                  style={{ marginTop: hp(1.5), alignItems: 'center' }}
                >
                  <Text style={[{ fontSize: font(13), color: '#7A7A7A', fontFamily: Fonts.medium }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      {/* ─── TRACK EMI SCHEDULE MODAL ─── */}
      <Modal
        visible={!!selectedEmiModalLoan}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedEmiModalLoan(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { borderRadius: radius(4) }]}>
            <LinearGradient colors={['#2B0A57', '#1A0048']} style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { fontSize: font(16) }]}>
                  📈 Track EMI Schedule ({selectedEmiModalLoan?.id})
                </Text>
                <Text style={{ fontSize: font(11), color: '#D0B8FF', fontFamily: Fonts.regular, marginTop: 2 }}>
                  Borrower: {selectedEmiModalLoan?.borrower} · {selectedEmiModalLoan?.amount}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedEmiModalLoan(null)} padding={4}>
                <Icon name="close" size={font(22)} color="#FFF" />
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView contentContainerStyle={{ padding: wp(5) }} showsVerticalScrollIndicator={false}>
              {/* Stat Highlights */}
              <View style={{ flexDirection: 'row', backgroundColor: '#F8F6FF', padding: hp(1.5), borderRadius: radius(2), marginBottom: hp(2) }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: font(10), color: '#7A7A7A', fontFamily: Fonts.regular }}>Monthly EMI</Text>
                  <Text style={{ fontSize: font(14), color: Colors.primary, fontFamily: Fonts.bold, marginTop: 2 }}>
                    {selectedEmiModalLoan?.monthlyEmi}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: font(10), color: '#7A7A7A', fontFamily: Fonts.regular }}>EMIs Settled</Text>
                  <Text style={{ fontSize: font(14), color: '#22C55E', fontFamily: Fonts.bold, marginTop: 2 }}>
                    {selectedEmiModalLoan?.paid}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: font(10), color: '#7A7A7A', fontFamily: Fonts.regular }}>Loan Status</Text>
                  <Text style={{ fontSize: font(14), color: selectedEmiModalLoan?.status === 'Completed' ? '#16A34A' : '#D97706', fontFamily: Fonts.bold, marginTop: 2 }}>
                    {selectedEmiModalLoan?.status}
                  </Text>
                </View>
              </View>

              {/* 12 EMI Installment Schedule List */}
              <Text style={{ fontSize: font(13), fontFamily: Fonts.bold, color: '#1A1A2E', marginBottom: hp(1.5) }}>
                🗓️ 12-Month Payment Installment Schedule
              </Text>

              {Array.from({ length: 12 }).map((_, i) => {
                const paidCount = selectedEmiModalLoan?.paidNum || 0;
                const isPaid = i < paidCount || selectedEmiModalLoan?.status === 'Completed';
                const isNext = !isPaid && i === paidCount;
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const month = monthNames[(i + 4) % 12];

                return (
                  <View
                    key={i}
                    style={{
                      flexDirection: 'row',
                      justify: 'space-between',
                      alignItems: 'center',
                      backgroundColor: isNext ? '#FFFBEB' : '#FFF',
                      borderWidth: 1,
                      borderColor: isNext ? '#FCD34D' : '#EFEFEF',
                      padding: hp(1.5),
                      borderRadius: radius(2),
                      marginBottom: hp(1),
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: wp(2) }}>
                      <Icon
                        name={isPaid ? 'checkmark-circle' : isNext ? 'time-outline' : 'calendar-outline'}
                        size={font(18)}
                        color={isPaid ? '#22C55E' : isNext ? '#D97706' : '#9CA3AF'}
                      />
                      <View>
                        <Text style={{ fontSize: font(12.5), fontFamily: Fonts.bold, color: '#1A1A2E' }}>
                          Installment #{i + 1}
                        </Text>
                        <Text style={{ fontSize: font(10.5), color: '#7A7A7A', fontFamily: Fonts.regular }}>
                          Due: 12 {month} 2026
                        </Text>
                      </View>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: font(12.5), fontFamily: Fonts.bold, color: '#1A1A2E' }}>
                        {selectedEmiModalLoan?.monthlyEmi}
                      </Text>
                      <Text
                        style={{
                          fontSize: font(10),
                          fontFamily: Fonts.bold,
                          color: isPaid ? '#16A34A' : isNext ? '#D97706' : '#9CA3AF',
                        }}
                      >
                        {isPaid ? 'PAID ✅' : isNext ? 'NEXT DUE ⏳' : 'UPCOMING 📅'}
                      </Text>
                    </View>
                  </View>
                );
              })}

              <TouchableOpacity
                onPress={() => setSelectedEmiModalLoan(null)}
                style={{
                  marginTop: hp(2),
                  marginBottom: hp(2),
                  backgroundColor: Colors.primary,
                  paddingVertical: hp(1.5),
                  borderRadius: radius(2.5),
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#FFF', fontFamily: Fonts.bold, fontSize: font(13) }}>
                  Close EMI Tracker
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
//  FORM FIELD HELPER
// ─────────────────────────────────────────────
const FormField = ({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType,
  multiline,
}: any) => {
  const { hp, font, radius } = useResponsive();
  return (
    <View style={{ marginBottom: hp(1.8) }}>
      <Text style={[styles.formLabel, { fontSize: font(11.5) }]}>{label}</Text>
      <TextInput
        style={[
          styles.formInput,
          { fontSize: font(13), borderRadius: radius(2), paddingVertical: hp(1.3) },
          multiline && { height: hp(10), textAlignVertical: 'top' },
        ]}
        placeholder={placeholder}
        placeholderTextColor="#B8B8B8"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
      />
    </View>
  );
};

// ─────────────────────────────────────────────
//  TX ROW
// ─────────────────────────────────────────────
const TxRow = ({
  label,
  value,
  accent,
  code,
}: {
  label: string;
  value?: string;
  accent?: boolean;
  code?: boolean;
}) => {
  const { hp, font } = useResponsive();
  return (
    <View style={[styles.txRow, { paddingVertical: hp(0.8) }]}>
      <Text style={[styles.txLabel, { fontSize: font(10.5) }]}>{label}</Text>
      <Text
        style={[
          styles.txValue,
          { fontSize: font(11), color: accent ? Colors.primary : code ? '#5B21B6' : '#1A1A2E' },
          code && styles.codeText,
        ]}
      >
        {value}
      </Text>
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
  headerSubtitle: { color: '#D0B8FF', fontFamily: Fonts.regular, marginTop: 2 },

  tabRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', padding: 4 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabText: { fontFamily: Fonts.semiBold },

  sectionHeader: {},
  sectionTitle: { fontFamily: Fonts.bold, color: '#1A1A2E' },
  sectionSub: { fontFamily: Fonts.regular, color: '#7A7A7A', marginTop: 3 },

  loanCard: { backgroundColor: '#FFF', elevation: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  cardHeader: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  loanId: { color: '#D0B8FF', fontFamily: Fonts.regular },
  borrowerName: { color: '#FFF', fontFamily: Fonts.bold, marginTop: 2 },
  borrowerCountry: { color: '#D0B8FF', fontFamily: Fonts.regular, marginTop: 2 },
  riskBadge: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  riskText: { fontFamily: Fonts.semiBold },
  cardBody: { backgroundColor: '#FFF' },

  badgeRow: { flexDirection: 'row' },
  verBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, gap: 4 },
  verBadgeText: { fontFamily: Fonts.semiBold },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  infoCell: { width: '50%', marginBottom: 12 },
  infoLabel: { color: '#7A7A7A', fontFamily: Fonts.regular, marginBottom: 2 },
  infoValue: { fontFamily: Fonts.bold },

  ltvBarBg: { height: 6, backgroundColor: '#F0F0F0' },
  ltvBarFill: { height: 6 },
  ltvLabel: { color: '#7A7A7A', fontFamily: Fonts.regular, marginTop: 4 },

  purposeBox: { backgroundColor: '#F8F6FF' },
  purposeLabel: { color: '#7A7A7A', fontFamily: Fonts.regular },
  purposeValue: { color: '#1A1A2E', fontFamily: Fonts.semiBold, marginTop: 2 },

  contractRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contractText: { color: Colors.primary, fontFamily: Fonts.medium },

  fundBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  fundBtnText: { color: '#FFF', fontFamily: Fonts.bold },

  identityBanner: {},
  identityRow: { flexDirection: 'row', alignItems: 'center' },
  identityName: { color: '#FFF', fontFamily: Fonts.bold },
  identityInfo: { color: '#A5F3B5', fontFamily: Fonts.regular, marginTop: 2 },
  identityWallet: { color: '#D0B8FF', fontFamily: Fonts.regular, marginTop: 2 },

  formCard: { backgroundColor: '#FFF', elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  formLabel: { color: '#1A1A2E', fontFamily: Fonts.semiBold, marginBottom: 6 },
  formInput: { borderWidth: 1, borderColor: '#E3E3E6', paddingHorizontal: 14, color: '#1A1A2E', fontFamily: Fonts.regular },

  emiPreview: { backgroundColor: '#F0EBFF', alignItems: 'center' },
  emiPreviewLabel: { color: '#7A7A7A', fontFamily: Fonts.regular },
  emiPreviewValue: { color: Colors.primary, fontFamily: Fonts.bold, marginTop: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFF', maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  modalTitle: { color: '#FFF', fontFamily: Fonts.bold, flex: 1 },

  txCard: { backgroundColor: '#F8F8FB', borderWidth: 1, borderColor: '#E3E3E6', padding: 14 },
  txCardTitle: { color: '#7A7A7A', fontFamily: Fonts.semiBold, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: '#EFEFEF' },
  txLabel: { color: '#7A7A7A', fontFamily: Fonts.regular, flex: 1 },
  txValue: { fontFamily: Fonts.semiBold, flex: 1.5, textAlign: 'right' },
  codeText: { fontFamily: Fonts.regular },

  approveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  approveBtnText: { color: '#FFF', fontFamily: Fonts.bold },
});
