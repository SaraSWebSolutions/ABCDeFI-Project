import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import LinearGradient from "react-native-linear-gradient";

import { useResponsive } from "../Utils/Responsive";
import Fonts from "../Utils/Fonts";
import { Colors } from "../Utils/Colors";

import { useDispatch, useSelector } from "react-redux";
import { getTerms,getAbout } from "../Store/Slices/contentSlice"; // reuse for all
import { getPrivacy } from "../Store/Slices/authSlice";
export default function ContentScreen({ navigation, route }: any) {
  const { wp, hp, font, space } = useResponsive();
  const dispatch = useDispatch<any>();

  const type = route?.params?.type || "terms"; 
  // "terms" | "privacy" | "about"

  useEffect(() => {
    dispatch(getTerms()); 
    dispatch(getPrivacy());
    dispatch(getAbout())
  }, []);

  const { terms, loading } = useSelector((state: any) => state.content);
  const { privacy } = useSelector(
      (state: any) => state.auth
    );

     const { about } = useSelector(
      (state: any) => state.content
    );

const contentList =
  type === "terms"
    ? terms?.[0]?.content || [] :type==='about'?about?.[0]?.content || []
    : privacy?.[0]?.content || [];

  const getTitle = () => {
    switch (type) {
      case "privacy":
        return "Privacy Policy";
      case "about":
        return "About Us";
      default:
        return "Terms & Conditions";
    }
  };

  const styles = createStyles(wp, hp, font, space);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      
      {/* HEADER */}
      <LinearGradient colors={["#7B3EF0", "#3F0D97"]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={font(26)} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.title}>{getTitle()}</Text>

        <View style={{ width: 22 }} />
      </LinearGradient>

      {/* CONTENT */}
      <ScrollView contentContainerStyle={{ padding: space(5) }}>
        
        {loading ? (
          <Text>Loading...</Text>
        ) : contentList.length ===0 ? <Text>No content available</Text>:(
          contentList.map((item: string, index: number) => (
            <Text key={index} style={styles.contentText}>
              {item}
            </Text>
          ))
        ) }

      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (wp: any, hp: any, font: any, space: any) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      padding: 18,
    },

    title: {
      fontSize: font(18),
      color: "#FFF",
      fontFamily: Fonts.semiBold,
      marginLeft: space(3),
      flex: 1,
      textAlign: "center",
    },

    contentText: {
      fontSize: font(14),
      lineHeight: 22,
      marginBottom: hp(2),
      color: "#444",
      fontFamily: Fonts.regular,
    },
  });