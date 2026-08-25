import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../Utils/Colors';
import Fonts from '../../Utils/Fonts';
import { useResponsive } from '../../Utils/Responsive';

// ─────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

// ─────────────────────────────────────────────
//  QUICK PROMPT SUGGESTIONS
// ─────────────────────────────────────────────
const QUICK_PROMPTS = [
  { label: '📊 Portfolio Analysis', prompt: 'Analyze my current portfolio and give me investment advice.' },
  { label: '🤝 Best Loan Terms', prompt: 'What are the best loan terms I can offer as a lender on ABCDeFi?' },
  { label: '🛡️ Risk Assessment', prompt: 'What is my current risk profile and how can I improve it?' },
  { label: '💰 Staking Returns', prompt: 'Explain how staking rewards work in the ABCDeFi eLIC model.' },
  { label: '🖼 NFT Legion', prompt: 'How do ABCDeFi NFT Legions benefit me as an investor?' },
  { label: '📋 KYC Process', prompt: 'Walk me through the ABCDeFi KYC verification steps.' },
];

// ─────────────────────────────────────────────
//  MOCK AI RESPONSES
// ─────────────────────────────────────────────
const MOCK_RESPONSES: Record<string, string> = {
  default: `I'm your **59C AI Financial Copilot** — powered by the ABCDeFi intelligence layer.\n\nI can help you with:\n• 📊 Portfolio analysis & performance insights\n• 🤝 Lending & borrowing strategy\n• 🛡️ Risk assessment & credit scoring\n• 💰 Staking rewards & eLIC mechanics\n• 🖼 NFT Legion benefits & hierarchy\n• 📋 KYC & AML compliance guidance\n\nWhat would you like to know?`,
  portfolio: `📊 **Portfolio Analysis**\n\nBased on your current holdings:\n• Total Value: **$35,840 USD** (+8.25%)\n• ABCD Tokens: 52.3% allocation ✅ (Healthy)\n• ETH Exposure: 26.8% (Well-diversified)\n• Active Loan: LOAN-1001 (42% repaid)\n\n**Recommendations:**\n1. Your health score of 92% is excellent — maintain EMI payments\n2. Consider adding to your ETH position on dips\n3. Staking 200 ABCD could yield ~14% APY additional income\n4. NFT Legion upgrade at 50 referrals unlocks 10% commission`,
  loan: `🤝 **Optimal Lender Strategy**\n\nFor ABCDeFi P2P Lending:\n• Target **8-10% APY** interest — market sweet spot\n• Only fund loans where **LTV < 70%** — lower liquidation risk\n• Prioritize borrowers with:\n  - KYC ✅ Approved\n  - AML ✅ Cleared\n  - Repayment Rate: 95%+\n  - Score: 700+\n\n**Best Current Listing:** LOAN-1003 (Rafael Torres)\n• 7% APY · LTV 55% · Score 750 · 100% repayment history\n• Risk Profile: **Low Risk** — Recommended ✅`,
  risk: `🛡️ **Your Risk Assessment**\n\nOn-Chain Credit Score: **720 / 850**\nRisk Profile: **Medium Risk**\n\nKey Factors:\n• ✅ KYC & AML: Fully Approved\n• ✅ Repayment Rate: 100% (8 loans)\n• ✅ Collateral Coverage: 512% (2 ETH on 1,000 ABCD)\n• ⚠️ Score could improve with more loan history\n\n**How to improve to Low Risk (750+):**\n1. Complete 3 more loans without default\n2. Increase collateral ratio above 400%\n3. Maintain 6+ months wallet activity\n4. Add staking history to your profile`,
  staking: `💰 **eLIC Staking Mechanics**\n\nThe ABCDeFi eLIC model stands for:\n**Earnings for Lenders & Incentive for Community**\n\n**How it works:**\n1. Stake ABCD tokens in the Treasury\n2. Earn staking rewards proportional to your stake\n3. Lenders earn **8-12% APY** on funded loans\n4. Community incentives distributed via Legion hierarchy\n\n**Your Current Staking Yield:**\n• Staked: 500 ABCD\n• Monthly Reward: ~87.5 ABCD\n• Annual Return: ~1,050 ABCD (14% APY)\n\n**Tip:** Compounding rewards monthly maximizes returns.`,
  nft: `🖼 **ABCDeFi NFT Legion System**\n\n**Legion Hierarchy:**\n1. 🟣 ABCD Recruit — Entry level\n2. 🔵 ABCD Knight — 10+ referrals (5% commission)\n3. 🟡 ABCD Master — 25+ referrals (8% commission)\n4. 🔴 ABCD Grand Master — 50+ referrals (10% commission)\n5. ⚪ ABCD Supreme — 100+ referrals (12% commission)\n\n**Your Current Status:**\n• Rank: **ABCD Master** (Level 4)\n• Referrals: 12 active\n• Team Size: 48 members\n• Commission Rate: **8%**\n\n**Next Milestone:** 13 more referrals → Grand Master (10% commission)`,
  kyc: `📋 **KYC Verification Process**\n\nABCDeFi uses **Sumsub** for identity verification:\n\n**Steps:**\n1. 📄 Upload Government ID (National ID / Passport)\n2. 🤳 Take a selfie (face match)\n3. 👁️ Liveness check (anti-spoofing)\n4. 🤖 AI Document Verification\n5. 🛡️ AML Screening & Fraud Check\n6. ✅ Approved or ❌ Rejected\n\n**Required Documents:**\n• Full Name · Date of Birth · Nationality\n• Registered Address · National ID Number\n• Workplace ID (optional)\n\n**Benefits of KYC Completion:**\n• 50 ABCD Bonus tokens\n• Access to P2P Lending & Borrowing\n• ICO participation & bonus claims`,
};

const getAIResponse = (prompt: string): string => {
  const lower = prompt.toLowerCase();
  if (lower.includes('portfolio') || lower.includes('analysis') || lower.includes('invest')) return MOCK_RESPONSES.portfolio;
  if (lower.includes('loan') || lower.includes('lend') || lower.includes('borrow') || lower.includes('fund')) return MOCK_RESPONSES.loan;
  if (lower.includes('risk') || lower.includes('score') || lower.includes('credit')) return MOCK_RESPONSES.risk;
  if (lower.includes('stak') || lower.includes('elic') || lower.includes('earn') || lower.includes('reward')) return MOCK_RESPONSES.staking;
  if (lower.includes('nft') || lower.includes('legion') || lower.includes('referral') || lower.includes('commission')) return MOCK_RESPONSES.nft;
  if (lower.includes('kyc') || lower.includes('verif') || lower.includes('identity') || lower.includes('aml')) return MOCK_RESPONSES.kyc;
  return MOCK_RESPONSES.default;
};

// ─────────────────────────────────────────────
//  CHAT BUBBLE
// ─────────────────────────────────────────────
const ChatBubble = ({ message }: { message: Message }) => {
  const { wp, hp, font, radius } = useResponsive();
  const isUser = message.role === 'user';

  // Simple markdown-like formatting
  const renderText = (text: string) => {
    return text.split('\n').map((line, i) => {
      const isBold = line.includes('**');
      const cleaned = line.replace(/\*\*/g, '');
      return (
        <Text
          key={i}
          style={[
            styles.bubbleText,
            { fontSize: font(13), color: isUser ? '#FFF' : '#1A1A2E' },
            isBold && line.startsWith('**') ? { fontFamily: Fonts.bold } : {},
          ]}
        >
          {cleaned}
        </Text>
      );
    });
  };

  return (
    <View
      style={[
        styles.bubbleRow,
        { marginBottom: hp(1.5), justifyContent: isUser ? 'flex-end' : 'flex-start' },
      ]}
    >
      {!isUser && (
        <LinearGradient
          colors={['#6C3CF0', '#4A1FB8']}
          style={[styles.avatarCircle, { borderRadius: radius(10), width: 36, height: 36 }]}
        >
          <Text style={styles.avatarText}>AI</Text>
        </LinearGradient>
      )}
      <View
        style={[
          styles.bubble,
          {
            borderRadius: radius(3),
            maxWidth: '78%',
            padding: hp(1.5),
            marginHorizontal: wp(2),
          },
          isUser
            ? { backgroundColor: Colors.primary, borderBottomRightRadius: 4 }
            : { backgroundColor: '#F8F6FF', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E3D8FF' },
        ]}
      >
        {renderText(message.text)}
        <Text
          style={[
            styles.timestamp,
            { fontSize: font(9.5), color: isUser ? 'rgba(255,255,255,0.6)' : '#B8B8B8', marginTop: 6 },
          ]}
        >
          {message.timestamp}
        </Text>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────
//  TYPING INDICATOR
// ─────────────────────────────────────────────
const TypingIndicator = () => {
  const { hp, font, radius } = useResponsive();
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -6, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      ).start();
    };
    animate(dot1, 0);
    animate(dot2, 150);
    animate(dot3, 300);
  }, []);

  return (
    <View style={[styles.bubbleRow, { marginBottom: hp(1.5) }]}>
      <LinearGradient
        colors={['#6C3CF0', '#4A1FB8']}
        style={[styles.avatarCircle, { borderRadius: 18, width: 36, height: 36 }]}
      >
        <Text style={styles.avatarText}>AI</Text>
      </LinearGradient>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: '#F8F6FF',
            borderWidth: 1,
            borderColor: '#E3D8FF',
            borderRadius: 12,
            borderBottomLeftRadius: 4,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            marginLeft: 8,
            gap: 5,
          },
        ]}
      >
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View
            key={i}
            style={[styles.typingDot, { transform: [{ translateY: dot }] }]}
          />
        ))}
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────
//  MAIN AI SCREEN
// ─────────────────────────────────────────────
export default function AIScreen() {
  const { wp, hp, font, radius } = useResponsive();
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: 'assistant',
      text: MOCK_RESPONSES.default,
      timestamp: 'Now',
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const sendMessage = (text?: string) => {
    const prompt = text || input.trim();
    if (!prompt) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    scrollToBottom();

    setTimeout(() => {
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: getAIResponse(prompt),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
      scrollToBottom();
    }, 1600);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={['#2B0A57', '#1A1A2E']}
        style={[styles.header, { paddingHorizontal: wp(5), paddingBottom: hp(2) }]}
      >
        <View style={styles.headerRow}>
          <LinearGradient
            colors={['#6C3CF0', '#F7A41D']}
            style={[styles.headerAvatar, { borderRadius: radius(10) }]}
          >
            <Text style={[styles.headerAvatarText, { fontSize: font(18) }]}>🤖</Text>
          </LinearGradient>
          <View style={{ marginLeft: wp(3) }}>
            <Text style={[styles.headerTitle, { fontSize: font(18) }]}>59C AI Copilot</Text>
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={[styles.onlineText, { fontSize: font(10.5) }]}>
                ABCDeFi Financial Intelligence
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Quick Prompts */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ backgroundColor: '#F3F3F5', maxHeight: hp(7) }}
        contentContainerStyle={{ paddingHorizontal: wp(4), paddingVertical: hp(1), gap: wp(2) }}
      >
        {QUICK_PROMPTS.map((p, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => sendMessage(p.prompt)}
            style={[styles.quickBtn, { borderRadius: radius(3), paddingHorizontal: wp(3.5), paddingVertical: hp(0.8) }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.quickBtnText, { fontSize: font(11.5) }]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Chat Area */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1, backgroundColor: '#F3F3F5' }}
          contentContainerStyle={{ padding: wp(4), paddingBottom: hp(2) }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
        >
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
          {isTyping && <TypingIndicator />}
        </ScrollView>

        {/* Input Bar */}
        <View
          style={[
            styles.inputBar,
            { paddingHorizontal: wp(4), paddingVertical: hp(1.2), paddingBottom: hp(2.5) },
          ]}
        >
          <View style={[styles.inputWrapper, { borderRadius: radius(3), flex: 1, marginRight: wp(2) }]}>
            <TextInput
              style={[styles.inputField, { fontSize: font(13), paddingVertical: hp(1.2), paddingHorizontal: wp(4) }]}
              placeholder="Ask your AI financial advisor..."
              placeholderTextColor="#B8B8B8"
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={500}
              onSubmitEditing={() => sendMessage()}
            />
          </View>
          <TouchableOpacity onPress={() => sendMessage()} activeOpacity={0.85} disabled={isTyping || !input.trim()}>
            <LinearGradient
              colors={input.trim() ? ['#6C3CF0', '#F7A41D'] : ['#CCC', '#BBB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.sendBtn, { borderRadius: radius(2.5), width: 48, height: 48 }]}
            >
              <Icon name="send" size={font(18)} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#2B0A57' },
  header: { paddingTop: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerAvatar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: {},
  headerTitle: { color: '#FFF', fontFamily: Fonts.bold },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' },
  onlineText: { color: '#A5F3B5', fontFamily: Fonts.regular },

  quickBtn: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E3D8FF' },
  quickBtnText: { color: Colors.primary, fontFamily: Fonts.semiBold },

  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end' },
  avatarCircle: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFF', fontFamily: Fonts.bold, fontSize: 12 },
  bubble: {},
  bubbleText: { fontFamily: Fonts.regular, lineHeight: 20 },
  timestamp: { fontFamily: Fonts.regular },

  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },

  inputBar: { backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E3E3E6', flexDirection: 'row', alignItems: 'flex-end' },
  inputWrapper: { backgroundColor: '#F8F6FF', borderWidth: 1, borderColor: '#E3D8FF' },
  inputField: { color: '#1A1A2E', fontFamily: Fonts.regular, maxHeight: 100 },
  sendBtn: { alignItems: 'center', justifyContent: 'center' },
});