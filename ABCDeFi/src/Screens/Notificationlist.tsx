import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from "react-native";

import LinearGradient from "react-native-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useResponsive } from "../Utils/Responsive";
import Fonts from "../Utils/Fonts";
import { Colors } from "../Utils/Colors";

export default function NotificationScreen({ navigation }: any) {
  const { wp, hp, font, space } = useResponsive();
  const styles = createStyles(wp, hp, font, space);

  // 🔥 Sample Data (replace with API)
  const [notifications, setNotifications] = useState([
    // {
    //   id: "1",
    //   title: "Order Placed",
    //   message: "Your order has been placed successfully",
    //   isRead: false,
    //   time: "2 mins ago",
    // },
    // {
    //   id: "2",
    //   title: "Payment Successful",
    //   message: "Your payment was completed",
    //   isRead: true,
    //   time: "1 hour ago",
    // },
  ]);

  // 🔥 Mark as read
  const markAsRead = (id: string) => {
    const updated = notifications.map((item) =>
      item.id === id ? { ...item, isRead: true } : item
    );
    setNotifications(updated);
  };

  // 🔥 Render Item
  const renderItem = ({ item }: any) => (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: item.isRead ? "#fff" : "#F3F0FF" },
      ]}
      onPress={() => markAsRead(item.id)}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.message}>{item.message}</Text>
        <Text style={styles.time}>{item.time}</Text>
      </View>

      {!item.isRead && <View style={styles.dot} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      
      {/* HEADER */}
      <LinearGradient
        colors={["#7B3EF0", "#3F0D97"]}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={"#FFF"} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Notifications</Text>
      </LinearGradient>

      {/* LIST */}
      {notifications.length === 0 ? (
        <View style={styles.noData}>
          <Ionicons name="notifications-off-outline" size={60} color="#ccc" />
          <Text style={styles.noDataText}>No Notifications Found</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 15 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
const createStyles = (wp, hp, font, space) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      padding: 18,
    },

    headerTitle: {
      fontSize: font(20),
      color: "#FFF",
      fontFamily: Fonts.semiBold,
      marginLeft: space(3),
    },

    card: {
      flexDirection: "row",
      padding: 15,
      borderRadius: 12,
      marginBottom: 12,
      alignItems: "center",
      elevation: 2,
    },

    title: {
      fontSize: font(15),
      fontFamily: Fonts.semiBold,
      color: "#000",
    },

    message: {
      fontSize: font(13),
      fontFamily: Fonts.medium,
      color: "#555",
      marginTop: 4,
    },

    time: {
      fontSize: font(11),
      color: "#999",
      marginTop: 6,
      fontFamily: Fonts.medium,
    },

    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: Colors.primary,
      marginLeft: 10,
    },

    noData: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },

    noDataText: {
      marginTop: 10,
      fontSize: font(14),
      color: "#999",
      fontFamily: Fonts.medium,
    },
  });