import React,{useState,useEffect} from "react";
import {
View,
Text,
StyleSheet,
Image,
TextInput,
TouchableOpacity,
ScrollView,
Alert
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useResponsive } from "../Utils/Responsive";
import Fonts from "../Utils/Fonts";
import { useDispatch, useSelector } from "react-redux";
import { fetchProfile ,updateProfile} from "../Store/Slices/profileSlice";
import { RootState } from "../Store/Store";
import { logoutUser } from "../Store/Slices/authSlice";
import { Colors } from "../Utils/Colors";
import { IMAGE_URL } from "@/src/env";
import FastImage from "react-native-fast-image";
import Icon from "react-native-vector-icons/Ionicons";
export default function SettingsScreen({navigation}:any) {
const insets = useSafeAreaInsets();
const { wp, hp, font, radius, space } = useResponsive();
 const dispatch = useDispatch<any>();

const { profileData, loading } = useSelector(
  (state: RootState) => state.profile
);
const styles = createStyles(wp,hp,font,radius,space);
const [name,setName] = useState("");
const [email,setEmail] = useState("");
const [phone,setPhone] = useState("*****2565789");
const [address,setAddress] = useState("*************");
const [city,setCity] = useState("Hydrabad");
const [country,setCountry] = useState("India");
const [imgError, setImgError] = useState(false);

useEffect(() => {
  dispatch(fetchProfile());
}, []);
useEffect(() => {
  if (profileData) {
    const user = profileData;

    setName(user.name );
    setEmail(user.email);
    setPhone(String(user.mobileNumber || ""));
    setCountry(user.country || "");
  }
}, [profileData]);
const handleLogout = () => {
  Alert.alert(
    "Logout",
    "Are you sure you want to logout?",
    [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await dispatch(logoutUser()).unwrap();

            navigation.reset({
              index: 0,
              routes: [{ name: "Login" }],
            });

          } catch (err) {
            console.log("Logout error:", err);
          }
        },
      },
    ]
  );
};

const imageUrl = profileData?.image
  ? `${IMAGE_URL.replace(/\/$/, "")}/${profileData.image.replace(/^\//, "")}`
  : null;
return (

  <View style={{ flex: 1, backgroundColor: '#3B0D97' }}>

    {/* Status Bar Area */}
    <SafeAreaView
      edges={['top']}
      style={{ backgroundColor: '#7B3EF0' }}
    />

    {/* Main Screen */}
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={{ flex: 1, backgroundColor: '#fff' }}
    >
<LinearGradient
         colors={["#7B3EF0", "#3F0D97"]}
         style={styles.header}
       >
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back-outline" size={26} color={'#FFF'}/>
          </TouchableOpacity>
          <Text style={[styles.title, { fontSize: font(20),textAlign:'center' }]}>
            Settings
          </Text>
        </LinearGradient>
{/* <LinearGradient
  colors={['#3B0D97', '#3B0D97', '#3B0D97']}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
  style={[
    styles.settingsHeader,
    
  ]}
>

  <View style={styles.headerContent}>

    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => navigation.goBack()}
      style={styles.backButton}
    >
      <Icon
        name="arrow-back-outline"
        size={24}
        color="#FFF"
      />
    </TouchableOpacity>

    <Text style={styles.settingsTitle}>
      Settings
    </Text>

  </View>

</LinearGradient> */}
<ScrollView showsVerticalScrollIndicator={false}   contentContainerStyle={{ flexGrow: 1 }}>

<View style={styles.container}>

{/* HEADER */}
  
{/* <View style={styles.header}>

<TouchableOpacity  onPress={()=>navigation.goBack()}
style={styles.iconBtn}>
<Ionicons name="chevron-back" size={font(26)} color="#4A2AA7" />
</TouchableOpacity>

<Text style={styles.title}>Settings</Text>

<TouchableOpacity style={styles.iconBtn}>
{/* <Ionicons name="notifications-outline" size={font(20)} color="#4A2AA7" /> 
</TouchableOpacity>

</View> */}

  <View style={styles.profileCard}>
         <FastImage

  key={imageUrl}
  source={
    imageUrl && !imgError
      ? { uri: imageUrl }
      : require("../../assets/Images/place.jpg")
  }
  style={styles.profileImg}
  onError={() => setImgError(true)}
  resizeMode="cover"

    defaultSource={require("../../assets/Images/place.jpg")}

/>

          <View style={{ marginLeft: space(3), flex: 1 }}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.email}>{email}</Text>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate("EditProfile")}>
            {/* <Icon name="create-outline" size={20} color={Colors.primary} /> */}
          </TouchableOpacity>
        </View>
{/* PROFILE */}



<View style={styles.menu}>
<MenuItem 
  icon="account-edit" 
  text="Edit Profile" 
  onPress={() => navigation.navigate("EditProfileScreen")}
/>
<MenuItem icon="bank" text="Account Settings"  onPress={() => navigation.navigate("AccountSettingsScreen")}
/>
<MenuItem icon="headset" text="Support & FAQ"  onPress={()=>navigation.navigate('HelpSupportScreen')}/>
{/* <MenuItem icon="shield-outline" text="Security Settings" /> */}
<MenuItem  icon="logout" text="Log Out" onPress={handleLogout} isLogout={true}/>


</View>


{/* SIGN OUT */}

{/* <TouchableOpacity onPress={()=>handleLogout()} activeOpacity={0.9}>

<LinearGradient
colors={["#7B3EF0","#3F0D97"]}
style={styles.signOut}
>

<Text style={styles.signText}>Sign Out</Text>

</LinearGradient>

</TouchableOpacity> */}

</View>

</ScrollView>

</SafeAreaView>
</View>
);
}

const Field = ({label,value,onChangeText}:any) => {

const { wp, hp, font, radius, space } = useResponsive();

return (

<View style={{marginBottom:hp(2)}}>

<Text style={{fontSize:font(16),fontWeight:"600",fontFamily:Fonts.semiBold}}>
{label}
</Text>

<View
style={{
backgroundColor:"#FFF",
borderRadius:radius(2),
paddingVertical:hp(0.5),
paddingHorizontal:space(4),
marginTop:hp(1),
elevation:5
}}
>

<TextInput
value={value}
onChangeText={onChangeText}
placeholder={label}
placeholderTextColor="#999"
style={{
fontSize:font(16),
color:"#333"
}}
/>

</View>

</View>

);
};

const MenuItem = ({ icon, text, onPress,isLogout  }: any) => {
  const { wp, hp, font, radius, space } = useResponsive();

  return (
    <View>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: hp(1.8),   // 👈 vertical space
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <MaterialCommunityIcons
            name={icon}
            size={font(26)}
             color={isLogout ? "#FF3B30" : Colors.primary}
          />

          <Text
            style={{
              marginLeft: space(3),
              fontSize: font(16),
              fontFamily: Fonts.medium,
              color: isLogout ? "#FF3B30" : "#000", 
            }}
          >
            {text}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={font(20)} color="#000" />
      </TouchableOpacity>

      {/* Divider */}
      <View
        style={{
          height: 1,
          backgroundColor: "#E5E5E5", // 👈 lighter divider
          marginLeft: wp(10),         // 👈 align with text (not icon)
        }}
      />
    </View>
  );
};

const createStyles = (wp: (arg0: number) => any,hp: (arg0: number) => any,font: (arg0: number) => any,radius: (arg0: number) => any,space: (arg0: number) => any) =>
StyleSheet.create({

container:{
padding:space(5)

},
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
settingsHeader: {
  //paddingTop: 14,
  paddingBottom: 20,
 height: 80,
   marginBottom: hp(2),
  // borderBottomLeftRadius: 28,
  // borderBottomRightRadius: 28,

  // shadowColor: '#6C3BFF',
  // shadowOpacity: 0.3,
  // shadowRadius: 20,
  // shadowOffset: {
  //   width: 0,
  //   height: 10,
  // },
},

headerContent: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 20,
  marginTop: 16,
 // paddingBottom: 22, 
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
},
  //  settingsTitle: {
  //     fontSize: font(18),
  //     color: "#FFF",
  //     fontFamily: Fonts.semiBold,
  //     // marginLeft: space(1),
  //     flex: 1,
  //     textAlign: "center",
  //   },
settingsTitle: {
  color: '#FFF',
  fontSize:font(20),
  // fontWeight: '700',
  fontFamily: Fonts.bold,
 marginLeft: space(9),
  
},
//  header: {
//         flexDirection: "row",
//         alignItems: "center",
//         marginBottom: hp(2),
//         padding:18,
        
//       },

//       title: {
//         fontSize: font(20),
//         color:'#FFF',
//         marginTop:5,
//         fontFamily: Fonts.semiBold,
//         marginLeft: space(3),
//         textAlign:'center',
//         justifyContent:'center'
//       },
profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F7FF",
    padding: 15,
    marginTop:20,
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
        fontFamily: Fonts.medium,

  },
iconBtn:{
// width:wp(10),
// height:wp(10),
borderRadius:wp(5),
justifyContent:'flex-start',
alignItems:"center",

},

profileContainer:{
alignItems:"center",
marginTop:hp(6),
marginBottom:hp(2)
},

profileWrapper:{
position:"relative"
},

profile:{
width:wp(30),
height:wp(30),
borderRadius:wp(17.5),
borderWidth:3,
borderColor:"#7B3EF0",
alignSelf:'center'
},

editIcon:{
position:"absolute",
bottom:0,
right:0,
backgroundColor:"#7B3EF0",
width:wp(9),
height:wp(9),
borderRadius:wp(4.5),
justifyContent:"center",
alignItems:"center"
},

form:{
marginTop:hp(1)
},

menu:{
marginTop:hp(2),
},

signOut:{
marginTop:hp(3),
paddingVertical:hp(2),
borderRadius:radius(2),
alignItems:"center"
},

signText:{
color:"#fff",
fontSize:font(18),
fontWeight:"600"
}

});