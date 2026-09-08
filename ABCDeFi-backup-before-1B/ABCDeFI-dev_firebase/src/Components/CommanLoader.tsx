import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useSelector } from "react-redux";
import { RootState } from "../Store/Store";

export const Loader = () => {

  const loading = useSelector(
    (state: RootState) => state.loader.loading
  );
console.log("Loader state:", loading);
  if (!loading) return null;

  return (
    <View style={styles.overlay}>
      <ActivityIndicator size="large" color="#6A35FF" />
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
     position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 9999,
  elevation: 10,
  //backgroundColor: "rgba(0,0,0,0.3)",
  justifyContent: "center",
  alignItems: "center",

  },
});