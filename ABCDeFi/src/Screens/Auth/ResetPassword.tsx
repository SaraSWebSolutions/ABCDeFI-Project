import React,{useState} from "react";
import {
View,
Text,
StyleSheet,
Image,
ImageBackground,
Alert,
} from "react-native";

import { useResponsive } from "../../Utils/Responsive";
import { InputField } from "../../components/InputField";
import { GradientButton } from "../../components/GradientButton";
import { SafeAreaView } from "react-native-safe-area-context";
import Fonts from "../../Utils/Fonts";
import { Colors } from "../../Utils/Colors";
import { useDispatch } from "react-redux";
import { resetPassword } from "../../Store/Slices/authSlice";
export const ResetPasswordScreen = ({navigation,route}:any)=>{
const userId=route?.params?.userId
const { hp,wp,font } = useResponsive();
const dispatch = useDispatch<any>();
const [password,setPassword] = useState("");
const [confirm,setConfirm] = useState("");
const [error,setError] = useState("");

const validatePassword = (pass:string)=>{

if(pass.length < 8) return "Minimum 8 characters required";
if(!/[A-Z]/.test(pass)) return "Add at least one uppercase letter";
if(!/[0-9]/.test(pass)) return "Add at least one number";

return "";

};

const updatePassword = async () => {

  const passError = validatePassword(password);

  if (passError) {
    setError(passError);
    return;
  }

  if (password !== confirm) {
    setError("Passwords do not match");
    return;
  }

  setError("");

  try {
    const payload = {
      userId: route?.params?.userId, // 👈 from previous screen
      password: password,
    };

    const res = await dispatch(resetPassword(payload)).unwrap();

    console.log("Password Reset Success:", res);

    //  Success Alert
    Alert.alert(res?.message || "Password updated successfully");

    //  Navigate to Login
    navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });

  } catch (err: any) {
    console.log("Reset Error:", err);
    setError(err?.message || "Failed to reset password");
  }
};

return(
<SafeAreaView style={{flex:1}}>

<ImageBackground
source={require('../../../assets/Images/otp_bg.png')}
style={{flex:1}}
resizeMode="cover"
>

<View style={styles.container}>

<Image
source={require("../../../assets/Icons/reset.png")}
style={{
height: hp(18),
resizeMode: "contain",
marginTop:20,
alignSelf:'center',
}}
/>

<Text style={[styles.title,{fontSize:font(28)}]}>
Reset Password
</Text>

<Text style={styles.subtitle}>
Create a strong new password for your ABCDeFi account.
</Text>

<InputField
value={password}
placeholder="New Password"
secure
leftIcon="lock"
onChange={setPassword}
/>
<View style={{marginTop:15}}></View>
<InputField
value={confirm}
placeholder="Confirm Password"
secure
leftIcon="lock"
onChange={setConfirm}
/>

{error ? <Text style={styles.error}>{error}</Text>:null}

<View style={[styles.requirements,{width: wp(90),}]}>

<Text style={styles.reqTitle}>
Password Requirements
</Text>

<Text style={styles.reqItem}>• At least 8 characters</Text>
<Text style={styles.reqItem}>• One uppercase letter</Text>
<Text style={styles.reqItem}>• One number or Symbol</Text>
<Text style={styles.reqItem}>• Must not match old password</Text>


</View>

<GradientButton
title="Update Password ✓"
onPress={updatePassword}
/>

<Text
style={styles.back}
onPress={()=>navigation.navigate("Login")}
>
← Back to Sign In
</Text>

</View>

</ImageBackground>
</SafeAreaView>
);
};

const styles = StyleSheet.create({

container:{
flex:1,
padding:25,
justifyContent:"center"
},

title:{
textAlign:"center",
fontFamily:Fonts.bold,
marginBottom:8
},

subtitle:{
textAlign:"center",
color:"#777",
marginBottom:20,
fontSize:14,
fontFamily:Fonts.regular
},

requirements:{
backgroundColor:"#FFF",
padding:16,
borderRadius:12,
marginBottom:20,
marginTop:20,
},

reqTitle:{
fontSize:14,
fontFamily:Fonts.semiBold,
marginBottom:6,
color:Colors.primary
},

reqItem:{
fontSize:13,
fontFamily:Fonts.regular,
color:"#555",
marginTop:2
},

error:{
color:"red",
marginBottom:10,
fontSize:12,
fontFamily:Fonts.medium
},

back:{
marginTop:15,
color:Colors.primary,
textAlign:"center",
fontFamily:Fonts.semiBold,
fontSize:14
}

});