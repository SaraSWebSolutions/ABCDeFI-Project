import React, { useState ,useEffect} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
    Linking ,
    PermissionsAndroid,
    Platform,
    ActivityIndicator,

} from "react-native";

import { useResponsive } from "../../Utils/Responsive";
import { InputField } from "../../components/InputField";
import { GradientButton } from "../../components/GradientButton";
import Icon from "react-native-vector-icons/Ionicons";

import {
  validateEmailOrPhone,
  validatePassword,
} from "../../Utils/Validators";

import { handleError } from "../../Utils/ErrorHandler";
import { Colors } from "../../Utils/Colors";
import Fonts from "../../Utils/Fonts";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { loginUser,downloadWhitepaper } from "../../Store/Slices/authSlice";
import { IMAGE_URL } from "@/src/env";
import FileViewer from "react-native-file-viewer";
import ReactNativeBlobUtil from "react-native-blob-util";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Google from '../../../assets/Icons/google.svg';
import Fb from '../../../assets/Icons/fb.svg';
import Apple from '../../../assets/Icons/apple.svg';
import Logo from '../../../assets/Images/login_logo.svg';

export const LoginScreen = ({ navigation }: any) => {

  const { font, hp } = useResponsive();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const dispatch = useDispatch<any>();

const { loading, error } = useSelector((state: any) => state.auth);
const [errors, setErrors] = useState({
  email: "",
  password: ""
});
useEffect(() => {
  loadRememberedUser();
}, []);

const loadRememberedUser = async () => {
  try {
    const savedUser = await AsyncStorage.getItem("rememberUser");

    if (savedUser) {
      const user = JSON.parse(savedUser);

      setEmail(user.email);
      setPassword(user.password);
      setRemember(true);
    }
  } catch (error) {
    // console.log("Load Error:", error);
  }
};
 const onLogin = async () => {

  const newErrors = {
    email: validateEmailOrPhone(email),
    password: validatePassword(password),
  };

  setErrors(newErrors);

  const hasError = Object.values(newErrors).some(
    (error) => error !== ""
  );

  if (hasError) return;
 const payload = email.includes("@")
      ? { email: email.toLowerCase(), password }
      : { mobileNumber: email, password };
  try {
    const res = await dispatch(
      loginUser(payload)
    ).unwrap();

    // console.log("Login Success:", res);

    if (remember) {
      await AsyncStorage.setItem(
        "rememberUser",
        JSON.stringify({ email, password })
      );
    } else {
      await AsyncStorage.removeItem("rememberUser");
      setEmail('')
    setPassword('')
    }
    navigation.navigate("Main");

  } catch (err: any) {

    // console.log("Login Error:", err);

    Alert.alert("Login Failed", err.data?.message || "Something went wrong");
  }
};
const requestStoragePermission = async () => {
  if (Platform.OS !== "android") return true;
// console.log(Platform.Version,"Platform.Version");

  //  Android 13+
  if (Platform.Version >= 29) {
    return true; // no permission needed
  }
const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
  );

  return granted === PermissionsAndroid.RESULTS.GRANTED;
  // try {
  //   const granted = await PermissionsAndroid.request(
  //     PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
  //     {
  //       title: "Storage Permission",
  //       message: "App needs access to download files",
  //       buttonPositive: "Allow",
  //     }
  //   );

  //   return granted === PermissionsAndroid.RESULTS.GRANTED;
  // } catch (err) {
  //   console.log(err);
  //   return false;
  // }
};
const handleDownloadWhitepaper = async () => {
  try {
    const hasPermission = await requestStoragePermission();

   if (!hasPermission) {
  Alert.alert(
    "Permission Required",
    "Please enable storage permission from settings",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Open Settings",
        onPress: () => Linking.openSettings(),
      },
    ]
  );
  return;
}

    const res = await dispatch(downloadWhitepaper({})).unwrap();

    // console.log("API RESPONSE ", res);  //  STEP 1

    const fileName = res?.data?.[0]?.file;

    // console.log("FILE NAME ", fileName); //  STEP 2

    if (!fileName) {
      Alert.alert("File not found");
      return;
    }


const fileUrl = encodeURI(IMAGE_URL + fileName);

    // console.log("FINAL URL ", fileUrl); //  STEP 3 (MOST IMPORTANT)

    // validate URL before download
    if (!fileUrl || !fileUrl.startsWith("http")) {
      Alert.alert("Invalid URL", fileUrl);
      return;
    }
    const { config, fs } = ReactNativeBlobUtil;

    const path = `${fs.dirs.DownloadDir}/${fileName}`;

    await config({
      fileCache: true,
      path: path, // 👈 important
      addAndroidDownloads: {
        useDownloadManager: true,
        notification: true,
        path: path,
        title: fileName,
        description: "Downloading Whitepaper",
        mime: "application/pdf",
        mediaScannable: true,
      },
    }).fetch("GET", fileUrl);

    Alert.alert("Download started");

  } catch (err: any) {
    // console.log("Download error:", err);
    Alert.alert("Error", err?.message || "Download failed");
  }
};
  return (
    <SafeAreaView style={{flex:1}}>

    

    <ScrollView contentContainerStyle={styles.container}>
<View style={{ alignItems: "center" }}>
  <Logo width={160} height={160} />
</View>
      {/* Logo */}
      {/* <Image
        source={require("../../../assets/Images/login_logo.png")}
        style={{
          height: hp(20),
          resizeMode: "contain",
          marginBottom: 20,
          alignSelf:'center',
          marginTop:20,
        }}
      /> */}

      {/* Title */}
      <Text style={[styles.title, { fontSize: font(28) }]}>
        Welcome Back!
      </Text>

      <Text style={styles.subtitle}>
        Login securely to continue...
      </Text>

      {/* Inputs */}

      <InputField
      
        value={email}
        placeholder="Phone number or email"
        onChange={setEmail}
      />
{errors.email ? (
  <Text style={styles.errorText}>{errors.email}</Text>
) : null}
      <InputField
        value={password}
        placeholder="Password"
        secure={true}
        onChange={setPassword}
      />
{errors.password ? (
  <Text style={styles.errorText}>{errors.password}</Text>
) : null}
      {/* Remember + Forgot */}

      <View style={styles.row}>

        <TouchableOpacity
          style={styles.rememberRow}
          onPress={() => setRemember(!remember)}
        >

         <Icon
            name={remember ? "checkbox" : "square-outline"}
            size={20}
            color={Colors.primary}
          />

          <Text style={styles.rememberText}>
            Remember me
          </Text>

        </TouchableOpacity>

        <TouchableOpacity onPress={()=>navigation.navigate('Forgot')}>
          <Text style={styles.forgot}>
            Forgot Password ?
          </Text>
        </TouchableOpacity>

      </View>

      {/* Button */}

      {/* <GradientButton
        title="Sign In"
        onPress={()=>navigation.navigate('Main')}
         //onPress={onLogin}
      /> */}
      <GradientButton
  title={"Sign In"}
  onPress={onLogin}
/>

      {/* Divider */}

     <View style={styles.dividerRow}>
  <View style={styles.line} />
  <Text style={styles.or}>Or login with</Text>
  <View style={styles.line} />
</View>

      {/* Social Login */}

     <View style={styles.socialRow}>
  <TouchableOpacity style={styles.socialBtn}>
    <Google width={50} height={50}/>
    {/* <Image
      source={require("../../../assets/Icons/google.png")}
      style={styles.social}
    /> */}
  </TouchableOpacity>

  <TouchableOpacity style={styles.socialBtn}>
    <Fb width={50} height={50}/>
    {/* <Image
      source={require("../../../assets/Icons/fb.png")}
      style={styles.social}
    /> */}
  </TouchableOpacity>

  <TouchableOpacity style={styles.socialBtn}>
    <Apple width={50} height={50}/>
    {/* <Image
      source={require("../../../assets/Icons/apple.png")}
      style={styles.social}
    /> */}
  </TouchableOpacity>
</View>

      {/* Whitepaper Card */}
      {/* {loading?<ActivityIndicator size={'small'} color={Colors.primary}></ActivityIndicator>:null} */}

      <TouchableOpacity  onPress={()=>handleDownloadWhitepaper()}style={styles.card}>

  <View style={styles.cardLeft}>

    <View style={styles.iconBox}>
      <Image
        source={require("../../../assets/Icons/file.png")}
        style={styles.fileIcon}
      />
    </View>

    <View>
      <Text style={styles.cardTitle}>
        To know more about
        <Text style={{ color: "#6C3BFF" }}> ABCDeFI</Text>
      </Text>

      <Text style={styles.cardSub}>
        Click here → Download Whitepaper (PDF)
      </Text>
    </View>

  </View>

  <View style={styles.arrowCircle}>
    <Icon name="arrow-forward" size={18} color="#6C3BFF" />
  </View>

</TouchableOpacity>

      {/* Signup */}

      <Text style={styles.bottom}>
        Don’t have an account?
        <Text  onPress={()=> navigation.navigate('SignUp')}style={{ color: "#6C3BFF", fontSize:14,
    fontFamily:Fonts.semiBold, }}> Sign up</Text>
      </Text>

    </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({

  container: {
    flexGrow: 1,
    padding: 20,
    //alignItems: "center",
    backgroundColor: "#F5F5F7"
  },

  title: {
    fontWeight: "700",
    marginBottom: 5,
    textAlign:'center',
    fontFamily:Fonts.bold
  },

  subtitle: {
    color: "#777",
    marginBottom: 20,
    textAlign:'center',
    fontFamily:Fonts.regular
  },

  row: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
        marginTop:10,

  },

  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  checkbox: {
    width: 18,
    height: 18,
    marginRight: 8,
  },
errorText: {
  color: "#FF3B30",
  fontSize: 12,
  marginTop: 2,
  marginBottom: 4,
  fontFamily:Fonts.regular
},
  rememberText: {
    color: "#6C3BFF",
    marginLeft:8,
    fontSize:14,
    fontFamily:Fonts.medium,
  },

  forgot: {
    color: "red",
     fontSize:14,
    fontFamily:Fonts.medium,
  },

  // or: {
  //   marginTop: 25,
  //   marginBottom: 15,
  //   color: "#666",
  // },

  // socialRow: {
  //   flexDirection: "row",
  //   gap: 20,
  // },

  // socialBtn: {
  //   width: 50,
  //   height: 50,
  //   borderRadius: 12,
  //   backgroundColor: "#fff",
  //   justifyContent: "center",
  //   alignItems: "center",
  //   elevation: 2,
  // },

  social: {
    width: 48,
  height: 48,
    resizeMode: "contain",
  },



  arrow: {
    width: 25,
    height: 25,
    tintColor: "#6C3BFF",
    marginRight:4
  },

  bottom: {
    marginTop: 25,
    color: "#555",
     fontSize:14,
     alignItems:'center',
     alignSelf:'center',
     textAlign:'center',
    fontFamily:Fonts.regular,
  },
  dividerRow: {
  flexDirection: "row",
  alignItems: "center",
  width: "100%",
  marginTop: 25,
  marginBottom: 15,
},

line: {
  flex: 1,
  height: 1,
  backgroundColor: "#DADADA",
},

or: {
  marginHorizontal: 10,
  color: "#666",
  fontSize: 13,
    fontFamily:Fonts.regular,
},

socialRow: {
  flexDirection: "row",
  justifyContent: "center",
  gap: 18,
  marginBottom: 25,
},

socialBtn: {
  // width: 48,
  // height: 48,
  borderRadius: 12,
  //backgroundColor: "#fff",
  justifyContent: "center",
  alignItems: "center",
  elevation: 2,
},

card: {
  width: "100%",
  paddingVertical: 16,
  paddingHorizontal:8,
  borderRadius: 14,
  backgroundColor: "#fff",
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  borderLeftWidth: 5,
  borderLeftColor: "#6C3BFF",
  elevation: 3,
},

cardLeft: {
  flexDirection: "row",
  alignItems: "center",
},

iconBox: {
  width: 42,
  height: 42,
  borderRadius: 12,
  backgroundColor: "#6C3BFF",
  justifyContent: "center",
  alignItems: "center",
  marginRight: 10,
},

fileIcon: {
  width: 20,
  height: 20,
  tintColor: "#fff",
},

cardTitle: {
  fontWeight: "700",
   fontSize:14,
    fontFamily:Fonts.semiBold,
},

cardSub: {
  marginTop: 4,
  color: "#777",
  fontSize: 12,
    fontFamily:Fonts.regular,
},

arrowCircle: {
  width: 32,
  height: 32,
  borderRadius: 16,
  backgroundColor: "#F3EDFF",
  justifyContent: "center",
  alignItems: "center",
},

});