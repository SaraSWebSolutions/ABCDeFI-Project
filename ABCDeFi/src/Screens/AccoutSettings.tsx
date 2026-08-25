import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Switch,
  ScrollView,
  Alert,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

import { useResponsive } from "../Utils/Responsive";
import Fonts from "../Utils/Fonts";
import { Colors } from "../Utils/Colors";
import LinearGradient from "react-native-linear-gradient";
export default function AccountSettingsScreen({ navigation }: any) {
  const { wp, hp, font, space } = useResponsive();
  const styles = createStyles(wp, hp, font, space); 

  const [notifications, setNotifications] = useState(true);

  const name = "Stephan Joseph";
  const email = "stephan@gmail.com";

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => navigation.replace("Login"),
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <LinearGradient
          colors={["#7B3EF0", "#3F0D97"]}
          style={styles.header}
        >
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="chevron-back" size={font(26)} color={'#FFF'} />
          </TouchableOpacity>
          <Text style={styles.title}>Account Settings</Text>
        </LinearGradient>
      <ScrollView contentContainerStyle={{ padding: space(5) }}>

        {/* HEADER */}
        

        {/* PROFILE CARD */}
        {/* <View style={styles.profileCard}>
          <Image
            source={require("../../assets/Images/place.jpg")}
            style={styles.profileImg}
          />

          <View style={{ marginLeft: space(3), flex: 1 }}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.email}>{email}</Text>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate("EditProfile")}>
            <Icon name="create-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View> */}

        {/* SETTINGS LIST */}
        <View style={styles.card}>

          {/* <MenuItem
            icon="account-edit"
            text="Edit Profile"
            onPress={() => navigation.navigate("EditProfile")}
          /> */}

          <MenuItem
          styles={styles}
            icon="lock-reset"
            text="Change Password"
            onPress={() => navigation.navigate("ChangePasswordScreen")}
          />

          {/* NOTIFICATION */}
          <View style={styles.row}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <MaterialCommunityIcons name="bell-outline" size={22}  color={Colors.primary}/>
              <Text style={styles.text}>Notifications</Text>
            </View>

            <Switch
              value={notifications}
              onValueChange={setNotifications}
              thumbColor="#fff"
              trackColor={{ true: Colors.primary }}
            />
          </View>

        </View>

        {/* MORE */}
        <View style={styles.card}>
          <MenuItem  onPress={()=>navigation.navigate("ContentScreen", { type: "terms" })}styles={styles} icon="file-document-outline" text="Terms & Conditions" />
          <MenuItem   onPress={()=>navigation.navigate("ContentScreen", { type: "privacy" })} styles={styles}icon="shield-outline" text="Privacy Policy" />
          <MenuItem  onPress={()=>navigation.navigate("ContentScreen", { type: "about" })}styles={styles} icon="information-outline" text="About App" />
        </View>

        {/* LOGOUT */}
        {/* <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity> */}

      </ScrollView>
    </SafeAreaView>
  );
}

const MenuItem = ({ icon, text, onPress, styles }: any) => {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <MaterialCommunityIcons name={icon} size={22} color={Colors.primary} />
        <Text style={styles.text}>{text}</Text>
      </View>

      <Icon name="chevron-forward" size={20} />
    </TouchableOpacity>
  );
};

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

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F7FF",
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },

  profileImg: {
    width: 55,
    height: 55,
    borderRadius: 30,
  },

  name: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
  },

  email: {
    fontSize: 13,
    color: "#666",
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 20,
    marginTop:20,
    elevation: 3,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },

  text: {
    marginLeft: 10,
    fontSize: 15,
    fontFamily: Fonts.medium,
  },

  logoutBtn: {
    backgroundColor: "#FF3B30",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },

  logoutText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: Fonts.semiBold,
  },
});