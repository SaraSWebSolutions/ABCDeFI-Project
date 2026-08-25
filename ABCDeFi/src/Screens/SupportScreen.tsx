import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

import { useResponsive } from "../Utils/Responsive";
import Fonts from "../Utils/Fonts";
import { Colors } from "../Utils/Colors";
import LinearGradient from "react-native-linear-gradient";
import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";
import { getFaq } from "../Store/Slices/contentSlice";
export default function HelpSupportScreen({ navigation }: any) {
  const { wp, hp, font, space } = useResponsive();
const dispatch = useDispatch<any>();

useEffect(() => {
  dispatch(getFaq());
}, []);
const { faq, loading } = useSelector((state: any) => state.content);
  const styles = createStyles(wp, hp, font, space); 
const [activeIndex, setActiveIndex] = useState<number | null>(null);

// const toggleFAQ = (index: number) => {
//   setActiveIndex(activeIndex === index ? null : index);
// };
  const faqs1 = [
    {
      question: "How do I update my profile?",
      answer: "Go to Settings → Edit Profile and update your details.",
    },
    {
      question: "How to change password?",
      answer: "Navigate to Account Settings → Change Password.",
    },
    {
      question: "How to contact support?",
      answer: "Use the contact options below to reach us.",
    },
  ];

  const toggleFAQ = (index: number) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <LinearGradient
  colors={["#7B3EF0", "#3F0D97"]}
  style={styles.header}
>
  <TouchableOpacity onPress={() => navigation.goBack()}>
    <Ionicons name="chevron-back" size={font(26)} color="#fff" />
  </TouchableOpacity>

  <Text style={styles.title}>Help & Support</Text>

  <View style={{ width: 22 }} />
</LinearGradient>
      <ScrollView contentContainerStyle={{ padding: space(5) }}>

        {/* HEADER */}
      

        {/* FAQ SECTION */}
       <Text style={styles.sectionTitle}>FAQs</Text>

{loading ? (
  <Text>Loading...</Text>
) : faq?.length > 0 ? (
  faq.map((item: any, index: number) => (
    <TouchableOpacity
      key={index}
      style={styles.faqCard}
      onPress={() => toggleFAQ (index)}
    >
      <View style={styles.faqRow}>
        <Text style={styles.question}>{item.question}</Text>

        <Ionicons
          name={
            activeIndex === index
              ? "chevron-up"
              : "chevron-down"
          }
          size={18}
          color="#333"
        />
      </View>

      {activeIndex === index && (
        <Text style={styles.answer}>{item.answer}</Text>
      )}
    </TouchableOpacity>
  ))
) : (
  <Text>No FAQs available</Text>
)}
        {/* CONTACT SECTION */}
        <Text style={[styles.sectionTitle, { marginTop: hp(3) }]}>
          Contact Us
        </Text>

        <View style={styles.contactCard}>

          {/* CALL */}
          <TouchableOpacity
            style={styles.contactRow}
            onPress={() => Linking.openURL("tel:+919876543210")}
          >
            <MaterialCommunityIcons name="phone" size={font(20)} />
            <Text style={styles.contactText}>+919876543210</Text>
          </TouchableOpacity>

          {/* EMAIL */}
          <TouchableOpacity
            style={styles.contactRow}
            onPress={() => Linking.openURL("mailto:support@app.com")}
          >
            <MaterialCommunityIcons name="email-outline" size={font(20)} />
            <Text style={styles.contactText}>Email Support</Text>
          </TouchableOpacity>

        </View>

      </ScrollView>
    </SafeAreaView>
  );

 
  }
const createStyles = (wp: (percent: number) => number, hp: { (percent: number): number; (arg0: number): any; }, font: { (size: number): number; (arg0: number): any; }, space: { (size: number): number; (arg0: number): any; }) =>
  StyleSheet.create({

      header: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: hp(2),
        padding:18,
        
      },

      title: {
        fontSize: font(20),
        color:'#FFF',
        marginTop:5,
        fontFamily: Fonts.semiBold,
        marginLeft: space(3),
        textAlign:'center',
        justifyContent:'center'
      },

      sectionTitle: {
        fontSize: font(16),
        fontFamily: Fonts.semiBold,
        marginBottom: hp(1.5),
        marginTop:hp(2)
      },

      faqCard: {
        backgroundColor: "#F8F7FF",
        borderRadius: 12,
        padding: space(4),
        marginBottom: hp(1.5),
      },

      faqRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      },

      question: {
        fontSize: font(14),
        fontFamily: Fonts.medium,
        flex: 1,
      },

      answer: {
        marginTop: hp(1),
        fontSize: font(13),
        color: "#666",
        fontFamily: Fonts.regular,
      },

      contactCard: {
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: space(4),
        elevation: 3,
      },

      contactRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: hp(1.5),
        borderBottomWidth: 1,
        borderColor: "#eee",
      },

      contactText: {
        marginLeft: space(3),
        fontSize: font(14),
        fontFamily: Fonts.medium,
      },
   });