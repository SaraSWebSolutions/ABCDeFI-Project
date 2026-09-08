import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  FlatList,
  TextInput,
  Platform,
  StatusBar
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import { useResponsive } from "../Utils/Responsive";
import { InputField } from "../Components/InputField";
import { GradientButton } from "../Components/GradientButton";
import Fonts from "../Utils/Fonts";
import { Colors } from "../Utils/Colors";
import { countryList } from "../Utils/Countrylist";
import {
  request,
  PERMISSIONS,
  RESULTS,
} from "react-native-permissions";
import { useDispatch, useSelector } from "react-redux";
import { updateProfile, fetchProfile } from "../Store/Slices/profileSlice";
import { RootState } from "../Store/Store";
import LinearGradient from "react-native-linear-gradient";
import { IMAGE_URL } from "@/src/env";
import AsyncStorage from "@react-native-async-storage/async-storage";
import FastImage from "react-native-fast-image";
export const EditProfileScreen = ({ navigation }: any) => {
  const { wp, hp, font, space } = useResponsive();
  const styles = createStyles(wp, hp, font, space); 
  const dispatch = useDispatch<any>();

  const { profileData } = useSelector((state: RootState) => state.profile);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [country, setCountry] = useState("");
  const [image, setImage] = useState<any>(null);
const [imgError, setImgError] = useState(false);

  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [search, setSearch] = useState("");
const [countryCode, setCountryCode] = useState("");
  const genders = ["Male", "Female", "Other"];

 useEffect(() => {
  dispatch(fetchProfile());

  const loadCountryCode = async () => {
    const code = await AsyncStorage.getItem("countrycode");
    
    if (code) {
      setCountryCode(code);
    }
  };

  loadCountryCode();
}, []);

  useEffect(() => {
    if (profileData) {
      setName(profileData.name || "");
      setEmail(profileData.email || "");
      setPhone(String(profileData.mobileNumber || ""));
      setGender(profileData.gender || "");
      setCountry(profileData.country || "");
    }
  }, [profileData]);
const requestCameraPermission = async () => {
  let permission;

  if (Platform.OS === "android") {
    permission = PERMISSIONS.ANDROID.CAMERA;
  } else {
    permission = PERMISSIONS.IOS.CAMERA;
  }

  const result = await request(permission);
  return result === RESULTS.GRANTED;
};

const requestGalleryPermission = async () => {
  let permission;

  if (Platform.OS === "android") {
    if (Platform.Version >= 33) {
      //  Android 13+
      permission = PERMISSIONS.ANDROID.READ_MEDIA_IMAGES;
    } else {
      //  Android 12 and below
      permission = PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE;
    }
  } else {
    permission = PERMISSIONS.IOS.PHOTO_LIBRARY;
  }

  const result = await request(permission);

  return result === RESULTS.GRANTED;
};



  // 📸 Image Picker
 const pickImage = () => {
  Alert.alert("Select Image", "Choose option", [
    {
      text: "Camera",
      onPress: async () => {
        const granted = await requestCameraPermission();
        if (!granted) return Alert.alert("Permission denied");

        launchCamera({ mediaType: "photo" }, (res) => {
          if (res.assets) setImage(res.assets[0].uri);
        });
      },
    },
    {
      text: "Gallery",
      onPress: async () => {
        const granted = await requestGalleryPermission();
        if (!granted) return Alert.alert("Permission denied");

        launchImageLibrary({ mediaType: "photo" }, (res) => {
          if (res.assets) setImage(res.assets[0].uri);
        });
      },
    },
    { text: "Cancel", style: "cancel" },
  ]);
};

  // 💾 Save Profile
  const handleUpdate = async () => {
    try {
      const formData = new FormData();

      formData.append("name", name);
      formData.append("gender", gender.toLowerCase());
      formData.append("country", country);
let file;

if (image) {
  file = {
    uri: image,
    type: "image/jpeg",
    name: image.split("/").pop() || "profile.jpg",
  };

  formData.append("image", file);
}
      // if (image) {
      //   formData.append("profileImage", {
      //     uri: image,
      //     type: "image/jpeg",
      //     name: "profile.jpg",
      //   });
      // }

      await dispatch(updateProfile(formData)).unwrap();

      Alert.alert("Success", "Profile updated successfully");
      navigation.goBack();
    } catch (err) {
      
      Alert.alert("Error", "Failed to update profile");
    }
  };

  const filteredCountries = countryList.filter((item) =>
    item.label.toLowerCase().includes(search.toLowerCase())
  );
const capitalize = (text: string) => {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
};
const imageUrl = profileData?.image
  ? `${IMAGE_URL.replace(/\/$/, "")}/${profileData.image.replace(/^\//, "")}`
  : null;
  return (
    
    <View style={{ flex: 1, backgroundColor: "#F5F5F5" }}>
  <SafeAreaView
    edges={['top']}
    style={{ backgroundColor: '#7B3EF0' }}
  />

  <StatusBar
    barStyle="light-content"
    backgroundColor="#3B0D97"
  />

          <LinearGradient
         colors={["#7B3EF0", "#3F0D97"]}
         style={styles.header}
       >
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back-outline" size={26} color={'#FFF'}/>
          </TouchableOpacity>
          <Text style={[styles.title, { fontSize: font(20),textAlign:'center' }]}>
            Edit Profile
          </Text>
        </LinearGradient>
      <ScrollView contentContainerStyle={styles.container}>

        {/* HEADER */}
         

        {/* PROFILE IMAGE */}
        <TouchableOpacity style={styles.imageWrapper} onPress={pickImage}>
          <FastImage

  key={image || imageUrl}
  source={
    image
      ? { uri: image }
      : imageUrl && !imgError
      ? { uri: imageUrl }
      : require("../../assets/Images/place.jpg")
  }
  style={styles.profileImage}
  onError={() => setImgError(true)}
  resizeMode="cover"

    defaultSource={require("../../assets/Images/place.jpg")}

/>
         {/* <Image
  source={
    imageUrl
      ? { uri: imageUrl }
      : require("../../assets/Images/place.jpg")
  }
  style={styles.profileImage}
/> */}
          <View style={styles.cameraIcon}>
            <Icon name="camera" size={16} color="#fff" />
          </View>
        </TouchableOpacity>

        {/* INPUTS */}

        <InputField
          value={name}
          leftIcon="user"
          placeholder="User Name"
          onChange={setName}
          editable={true}
                    inputStyle={{}}

        />

        {/*  EMAIL (Disabled) */}
        <InputField
          value={email}
          leftIcon="mail"
          placeholder="Email Address"
          onChange={() => {}}
          editable={false}
                    inputStyle={{backgroundColor:'#E5E5E5'}}

        />

        {/*  PHONE (Disabled) */}
        <InputField
  value={`${countryCode ? "+" + countryCode + " " : "+91 "}${phone}`}
          leftIcon="phone-call"
          placeholder="Phone Number"
          onChange={() => {}}
          editable={false}
          
          inputStyle={{backgroundColor:'#E5E5E5'}}
          
        />

        {/* GENDER */}
        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => setShowGenderModal(true)}
        >
          <Text style={{fontFamily:Fonts.medium}}>{capitalize(gender) || "Select Gender"}</Text>
          <Icon name="caret-down-outline" />
        </TouchableOpacity>

        {/* COUNTRY */}
        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => setShowCountryModal(true)}
        >
          <Text style={{fontFamily:Fonts.medium}}>{capitalize(country) || "Select Country"}</Text>
          <Icon name="caret-down-outline" />
        </TouchableOpacity>

        {/* SAVE BUTTON */}
        {/* <GradientButton title="Update Profile" onPress={handleUpdate} /> */}

      </ScrollView>
<View style={styles.bottomBtn}>
    <GradientButton title="Update Profile" onPress={handleUpdate} />
  </View>
      {/* COUNTRY MODAL */}
      <Modal visible={showCountryModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>

            <Text style={styles.modalTitle}>Select Country</Text>

            <TextInput
              placeholder="Search..."
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
            />

            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.item}
                  onPress={() => {
                    setCountry(item.value);
                    setShowCountryModal(false);
                    setSearch("");
                  }}
                >
                  <Text>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* GENDER MODAL */}
      <Modal visible={showGenderModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {genders.map((g) => (
              <TouchableOpacity
                key={g}
                style={styles.item}
                onPress={() => {
                  setGender(g);
                  setShowGenderModal(false);
                }}
              >
                <Text>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

    </View>

  );
};

const createStyles = (wp: (percent: number) => number, hp: { (percent: number): number; (arg0: number): any; }, font: { (size: number): number; (arg0: number): any; }, space: { (size: number): number; (arg0: number): any; }) =>
  StyleSheet.create({
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
backButton: {
  width: 42,
  height: 42,
  borderRadius: 21,
  backgroundColor: 'rgba(255,255,255,0.16)',
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.12)',
  marginHorizontal:wp(3)
},
      
  container: { padding: 20 },

 

  imageWrapper: {
    alignItems: "center",
    marginBottom: 20,
  },

  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },

  cameraIcon: {
    position: "absolute",
    bottom: 0,
    right: 130,
    backgroundColor: Colors.primary,
    padding: 6,
    borderRadius: 20,
  },

  dropdown: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginTop: 10,
  },
bottomBtn: {
  padding: 15,
  backgroundColor: "#fff",
  borderTopWidth: 1,
  borderColor: "#eee",
},
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },

  modalContainer: {
    backgroundColor: "#fff",
    padding: 15,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "60%",
  },

  modalTitle: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    marginBottom: 10,
  },

  item: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },

  searchInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
});