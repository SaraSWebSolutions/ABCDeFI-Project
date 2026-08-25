import React, { useEffect,useState } from "react";
import {
  View,
  Image,
  StyleSheet,
  Text,
  ImageBackground,
  Platform,
  PermissionsAndroid,
} from "react-native";

import { useResponsive } from "../Utils/Responsive";
import { SafeAreaView } from "react-native-safe-area-context";
import Fonts from "../Utils/Fonts";
import { Colors } from "../Utils/Colors";
import { fetchSplash } from "../Store/Slices/splashSlice";
import { useDispatch,useSelector } from "react-redux";
import { RootState } from "../Store/store";
import { IMAGE_URL } from "@/src/env";
import FastImage from "react-native-fast-image";
export const SplashScreen = ({ navigation }: any) => {

  const { hp, font } = useResponsive();

 const dispatch = useDispatch<any>();

  const { data, loading } = useSelector(
    (state: RootState) => state.splash
  );

  useEffect(() => {
    loadData();
    requestPermission()
  }, []);
const requestPermission = async () => {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
  }
};
  const loadData = async () => {
    try {
      await dispatch(fetchSplash()).unwrap();

      setTimeout(() => {
        navigation.replace("Login");
      }, 3000);

    } catch (error) {
      setTimeout(() => {
        navigation.replace("Login");
      }, 3000);
      //navigation.replace("Login");
    }
  };

  // format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
    });
  };

  return (
<SafeAreaView style={{flex:1}}>
<ImageBackground
      source={require("../../assets/Images/splash_bg.png")}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.container}>
<FastImage
source={require('../../assets/Images/splash_logo.png')}
  // source={
  //   data?.data?.[0]?.image
  //     ? {
  //         uri: `${IMAGE_URL}${data?.data?.[0].image}`,
  //         priority: FastImage.priority.high,
  //         cache: FastImage.cacheControl.immutable,
  //       }
  //     : require("../../assets/Images/splash_logo.png")
  // }
  style={{
    marginTop: hp(23),
    height: hp(24),
    width: hp(24),
    alignSelf: "center",
  }}
  resizeMode={FastImage.resizeMode.contain}
/>

        <Text style={styles.icoText}>
            ICO Starts on{" "}
            <Text style={styles.highlight}>
              {data?.icoStartDate
                ? formatDate(data.icoStartDate)
                : "Loading..."}
            </Text>
          </Text>
  <View style={styles.bottomSection}>

         <Text style={[styles.title, { fontSize: font(32) }]}>
              {data?.data?.[0]?.title}
            </Text>

            {/* CAPTION */}
            <Text style={styles.subtitle}>
              {data?.data?.[0]?.caption }
            </Text>
</View>
      </View>
    </ImageBackground>
</SafeAreaView>
    
  );
};

const styles = StyleSheet.create({

  bg: {
    flex: 1,
  },

  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  icoText: {
    marginTop: 20,
    fontSize: 16,
    color: Colors.textPrimary,
     fontFamily:Fonts.medium

  },

  highlight: {
    color: Colors.primary,
    fontWeight: "600",
    fontFamily:Fonts.semiBold
  },

  title: {
    marginTop:79,
    fontWeight: "800",
    fontFamily:Fonts.bold,
    color: Colors.primarydark1,
  },

  subtitle: {
    marginTop: 10,
    fontFamily:Fonts.regular,
    textAlign: "center",
    color: Colors.primary_light,
    fontSize: 15,
    lineHeight:28
  },
bottomSection: {
  marginTop: "auto",   // pushes content to bottom
  alignItems: "center",
  paddingBottom: 30,
},
});