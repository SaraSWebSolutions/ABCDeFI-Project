import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { LoginScreen } from "../Screens/Auth/LoginScreen";
import { SplashScreen } from "../Screens/SplashScreen";

import { AuthStackParamList } from "./types";
import { SignupScreen } from "../Screens/Auth/SignupScreen";
// import HomeScreen from "../HomeScreen";
import { OTPVerificationScreen } from "../Screens/Auth/OtpScreen";
import { ForgotPasswordScreen } from "../Screens/Auth/ForgotPassword";
import { ResetPasswordScreen } from "../Screens/Auth/ResetPassword";
import { BottomTabs } from "./BottomTab";
import SettingsScreen from "../Screens/SettingScreen";
import { EditProfileScreen } from "../Screens/Editprofile";
import AccountSettingsScreen from "../Screens/AccoutSettings";
import HelpSupportScreen from "../Screens/SupportScreen";
import { ChangePasswordScreen } from "../Screens/ChangePassword";
import ContentScreen from "../Screens/ContentScreen";
import NotificationScreen from "../Screens/Notificationlist";
const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator  initialRouteName={'Splash'} screenOptions={{ headerShown: false }}>
     <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignupScreen} />
       <Stack.Screen name="OtpVerify" component={OTPVerificationScreen} />
       <Stack.Screen name="Forgot" component={ForgotPasswordScreen} />
       <Stack.Screen name="Reset" component={ResetPasswordScreen} />
       {/* <Stack.Screen name="Home" component={HomeScreen} /> */}
       <Stack.Screen name='Main' component={BottomTabs}/>
       <Stack.Screen name='SettingsScreen' component={SettingsScreen}/>
       <Stack.Screen name='EditProfileScreen' component={EditProfileScreen}/>
       <Stack.Screen name='AccountSettingsScreen' component={AccountSettingsScreen}/>
       <Stack.Screen name='HelpSupportScreen' component={HelpSupportScreen}/>
        <Stack.Screen name='ChangePasswordScreen' component={ChangePasswordScreen}/>
<Stack.Screen name='ContentScreen' component={ContentScreen}/>
<Stack.Screen name='NotificationScreen' component={NotificationScreen}/>

    </Stack.Navigator>
  );
}