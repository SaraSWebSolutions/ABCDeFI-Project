import React, { useState } from "react";
import {
View,
Text,
TouchableOpacity,
StyleSheet,
Image,
ImageBackground,
Alert
} from "react-native";

import { useResponsive } from "../../Utils/Responsive";
import { InputField } from "../../components/InputField";
import { GradientButton } from "../../components/GradientButton";
import { SafeAreaView } from "react-native-safe-area-context";
import Fonts from "../../Utils/Fonts";
import { Colors } from "../../Utils/Colors";
import { useDispatch } from "react-redux";
import { forgotPasswordMobile ,forgotPasswordEmail} from "../../Store/Slices/authSlice";

export const ForgotPasswordScreen = ({navigation}:any) => {
const dispatch = useDispatch<any>();
const { hp,wp, font } = useResponsive();

const [method,setMethod] = useState("email");
const [value,setValue] = useState("");
const [error,setError] = useState("");

const validateEmail = (email:string)=>{
return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const validatePhone = (phone:string)=>{
return /^[0-9]{10}$/.test(phone);
};

const sendOtp = async () => {

  // 🔹 EMAIL FLOW (optional - if API exists)
 // 🔹 EMAIL FLOW
if (method === "email") {
  if (!validateEmail(value)) {
    setError("Enter valid email");
    return;
  }

  setError("");

  try {
    const res = await dispatch(
      forgotPasswordEmail({
        email: value
      })
    ).unwrap();

    // console.log("Email Forgot Success:", res);

    Alert.alert(
      "Success",
      "Reset link has been sent to your register email"
    );

    //  optional: go back or stay
    navigation.goBack();

  } catch (err: any) {
    // console.log("Email Forgot Error:", err);

    Alert.alert(
      "Error",
      err?.message || "Failed to send reset link"
    );
  }

  return;
}

  // 🔹 MOBILE FLOW (API CALL)
  if (method === "sms") {

    if (!validatePhone(value)) {
      setError("Enter valid phone number");
      return;
    }

    setError("");

    try {
      const res = await dispatch(
        forgotPasswordMobile({
          mobileNumber: value   // match API key
        })
      ).unwrap();

      // console.log("Forgot Success:", res);
Alert.alert(
  "Success",
   `Your One-Time Password (OTP): ${res?.otp}`
);
      //  Navigate after success
      navigation.navigate("OtpVerify", {
        contact: value,
        isforgot: true,
        type: "mobile",
        userId:res?.userId
      });

    } catch (err: any) {
      // console.log("Forgot Error:", err);
      Alert.alert(err?.message || "Failed to send OTP")

      // setError(err?.message || "Failed to send OTP");
    }
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
source={require("../../../assets/Icons/forgot.png")}
style={{
height: hp(18),
resizeMode: "contain",
marginBottom: 5,
alignSelf:'center',
}}
/>

<Text style={[styles.title,{fontSize:font(28)}]}>
Forgot Password?
</Text>

<Text style={styles.subtitle}>
No worries! Select how you'd like to receive your reset code.
</Text>

<View style={styles.methodRow}>

<TouchableOpacity
style={[
styles.methodBtn,
method==="email" && styles.active
]}
onPress={()=>setMethod("email")}
>

<Image
source={require('../../../assets/Icons/email.png')}
style={styles.methodIcon}
/>

<Text style={styles.methodText}>Email</Text>

</TouchableOpacity>

<TouchableOpacity
style={[
styles.methodBtn,
method==="sms" && styles.active
]}
onPress={()=>setMethod("sms")}
>

<Image
source={require('../../../assets/Icons/sms.png')}
style={styles.methodIcon}
/>

<Text style={styles.methodText}>Phone</Text>

</TouchableOpacity>

</View>

<InputField
value={value}
leftIcon={method==="email"?"mail":'phone-call'}
placeholder={method==="email"?"Email Address":"Phone Number"}
onChange={(text) => {
  setValue(text);
  setError("");
}}/>

{error ? <Text style={styles.error}>{error}</Text>:null}
{method === "sms"?
<Text style={styles.infoText}>
We'll send a 4-digit OTP to verify your identity.
</Text>:<Text style={[styles.infoText,{marginBottom:0}]}></Text>}

<GradientButton
  title={method === "email" ? "Send Reset Link →" : "Send OTP Code →"}
  onPress={sendOtp}
/>

<TouchableOpacity
style={[styles.cancelBtn,{height: hp(7),
            width:wp(90)}]}
onPress={()=>navigation.goBack()}
>
<Text style={styles.cancelText}>Cancel</Text>
</TouchableOpacity>

<Text style={styles.bottom}>
Remember your password?  
<Text
onPress={()=> navigation.navigate('Login')}
style={styles.signIn}
>
   Sign In
</Text>
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
marginBottom:25,
fontFamily:Fonts.regular,
fontSize:14
},

methodRow:{
flexDirection:"row",
gap:10,
marginBottom:20
},

methodBtn:{
flex:1,
padding:14,
backgroundColor:"#fff",
borderRadius:12,
alignItems:"center",
justifyContent:"center"
},

active:{
borderWidth:1,
borderColor:Colors.primary,
backgroundColor:"#F3EDFF"
},

methodIcon:{
width:22,
height:22,
marginBottom:6,
resizeMode:"contain"
},

methodText:{
fontSize:14,
fontFamily:Fonts.medium,
color:"#333"
},

infoText:{
marginTop:10,
marginBottom:15,
fontSize:13,
color:"#666",
fontFamily:Fonts.regular
},

cancelBtn:{
marginTop:15,
width:"100%",
backgroundColor:"#FFF",
padding:16,
borderRadius:12,
alignItems:"center"
},

cancelText:{
fontSize:16,
fontFamily:Fonts.semiBold,
color:Colors.primary
},

bottom:{
marginTop:20,
textAlign:"center",
fontSize:14,
fontFamily:Fonts.regular,
color:"#555",
marginRight:5,
},

signIn:{
color:Colors.primary,
fontFamily:Fonts.semiBold,

},

error:{
color:"red",
marginBottom:10,
fontSize:12,
fontFamily:Fonts.medium
}

});