import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ImageBackground,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { InputField } from "../components/InputField";
import { GradientButton } from "../components/GradientButton";
import Fonts from "../Utils/Fonts";
import { Colors } from "../Utils/Colors";

import {
  validatePassword,
  validateConfirmPassword,
} from "../Utils/Validators";

import { useDispatch } from "react-redux";
import { changePassword } from "../Store/Slices/authSlice";

export const ChangePasswordScreen = ({ navigation }: any) => {
  const dispatch = useDispatch<any>();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [errors, setErrors] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const onChangePassword = async () => {
    const newErrors = {
      oldPassword: oldPassword ? "" : "Enter old password",
      newPassword: validatePassword(newPassword),
      confirmPassword: validateConfirmPassword(
        newPassword,
        confirmPassword
      ),
    };

    setErrors(newErrors);

    const hasError = Object.values(newErrors).some((e) => e !== "");
    if (hasError) return;

    try {
      const payload = {
        currentPassword: oldPassword,
        newPassword: newPassword,
      };

      // console.log("CHANGE PASSWORD PAYLOAD:", payload);

      const res = await dispatch(changePassword(payload)).unwrap();

      Alert.alert("Success", res?.message || "Password changed successfully");

      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");

      navigation.goBack();
    } catch (err: any) {
      // console.log("Change Password Error:", err);
      Alert.alert(
        "Failed",
        err?.message || "Something went wrong"
      );
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ImageBackground
        source={require("../../assets/Images/Signup_bg.png")}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Change Password</Text>

          {/* OLD PASSWORD */}
          <InputField
            value={oldPassword}
            leftIcon="lock"
            placeholder="Enter Old Password"
            secure
            onChange={setOldPassword}
          />
          {errors.oldPassword ? (
            <Text style={styles.errorText}>{errors.oldPassword}</Text>
          ) : null}

          {/* NEW PASSWORD */}
          <InputField
            value={newPassword}
            leftIcon="lock"
            placeholder="Enter New Password"
            secure
            onChange={setNewPassword}
          />
          {errors.newPassword ? (
            <Text style={styles.errorText}>{errors.newPassword}</Text>
          ) : null}

          {/* CONFIRM PASSWORD */}
          <InputField
            value={confirmPassword}
            leftIcon="lock"
            placeholder="Confirm New Password"
            secure
            onChange={setConfirmPassword}
          />
          {errors.confirmPassword ? (
            <Text style={styles.errorText}>
              {errors.confirmPassword}
            </Text>
          ) : null}
<View style={{marginTop:40}}></View>
          <GradientButton
            title="Update Password"
            onPress={onChangePassword}
          />
        </ScrollView>
      </ImageBackground>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
  },

  title: {
    fontSize: 24,
    textAlign: "center",
    marginBottom: 30,
    fontFamily: Fonts.bold,
  },

  errorText: {
    color: "#FF3B30",
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
    fontFamily: Fonts.regular,
  },
});