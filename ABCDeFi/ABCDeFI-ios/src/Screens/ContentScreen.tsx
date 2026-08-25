import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar
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
   <View style={{ flex: 1, backgroundColor: "#F5F5F5" }}>
  <SafeAreaView
    edges={['top']}
    style={{ backgroundColor: '#7B3EF0' }}
  />

  <StatusBar
    barStyle="light-content"
    backgroundColor="#3B0D97"
  />


      
      {/* HEADER */}
      <LinearGradient colors={["#7B3EF0", "#3F0D97"]} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back-outline" size={font(26)} color="#fff" />
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
    </View>
  );
}

const createStyles = (wp: any, hp: any, font: any, space: any) =>
  StyleSheet.create({
   header: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: hp(2),
        //padding:18,
         height: 80,
         
      },
      title: {
     color: '#FFF',
  fontSize: font(22),
   marginLeft: space(9),
  fontWeight: '700',
  fontFamily: Fonts.bold,
  letterSpacing: 0.3,
    marginHorizontal:wp(3)
      },
backButton: {
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: 'rgba(255,255,255,0.14)',
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.12)',
      marginHorizontal:wp(3)

},    contentText: {
      fontSize: font(14),
      lineHeight: 22,
      marginBottom: hp(2),
      color: "#444",
      fontFamily: Fonts.regular,
    },
  });