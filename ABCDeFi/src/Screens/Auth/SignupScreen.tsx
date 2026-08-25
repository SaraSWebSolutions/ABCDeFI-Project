import React, { useState,useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Alert,
  Image,
  Modal, FlatList,
  TextInput
} from "react-native";

import { useResponsive } from "../../Utils/Responsive";
import { InputField } from "../../components/InputField";
import { GradientButton } from "../../components/GradientButton";

import Icon from "react-native-vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import Fonts from "../../Utils/Fonts";
import { Colors } from "../../Utils/Colors";
import { countryList } from "../../Utils/Countrylist";
import {
  validateUsername,
  validateMobile,
  validateEmailOrPhone,
  validatePassword,
  validateConfirmPassword,
  validateDropdown,
  validateTerms,
} from "../../Utils/Validators";
import { useDispatch, useSelector } from "react-redux";
import { registerUser, getPrivacy } from "../../Store/Slices/authSlice";
import PhoneInput from "react-native-phone-number-input";
import {Snackbar} from "react-native-snackbar";
import AsyncStorage from "@react-native-async-storage/async-storage";
export const SignupScreen = ({ navigation }: any) => {
const phoneRef = useRef(null);
  const { font } = useResponsive();
  const dispatch = useDispatch<any>();
  const [username, setUsername] = useState("");
 const [mobile, setMobile] = useState("");       // full formatted
const [phone, setPhone] = useState("");         // only number
const [countryCode, setCountryCode] = useState("91"); // default India
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [gender, setGender] = useState("");
  const [country, setCountry] = useState("");
const [search, setSearch] = useState("");
  const [showGender, setShowGender] = useState(false);
  const [showCountry, setShowCountry] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [hasReadPolicy, setHasReadPolicy] = useState(false);
  const [agree, setAgree] = useState(false);

  const genders = ["Male", "Female", "Other"];
  // const countries = ["India", "USA", "UK", "Canada"];
  const [errors, setErrors] = useState({
    username: "",
    mobile: "",
    email: "",
    password: "",
    confirmPassword: "",
    gender: "",
    country: "",
    terms: "",
    dropdown: ''
  });
  
  const { privacy, loading } = useSelector(
    (state: any) => state.auth
  );
  const onRegister = async () => {

    const newErrors = {
      username: validateUsername(username),
      mobile: validateMobile(phone),
      email: validateEmailOrPhone(email),
      password: validatePassword(password),
      confirmPassword: validateConfirmPassword(password, confirmPassword),
      gender: validateDropdown(gender, "Gender"),
      country: validateDropdown(country, "Country"),
      terms: validateTerms(agree),
    };

    setErrors(newErrors);

    const hasError = Object.values(newErrors).some(e => e !== "");
    if (hasError) return;

    try {

      //  Prepare payload (IMPORTANT)
      const payload = {
        name: username,
        email: email.toLowerCase().trim(),
mobileNumber: phone,
//countryCode: countryCode,
        password: password,
        gender: gender.toLocaleLowerCase(),
        country: country,
        privacyData: agree

      };

      // console.log("REGISTER PAYLOAD:", payload);

      const res = await dispatch(registerUser(payload)).unwrap();

      // console.log("Register Success:", res);

Alert.alert(
  "Success",
  res?.message
  // `Registration completed successfully.\n\n Your One-Time Password (OTP): ${res?.otp}`
);
      
      navigation.navigate("OtpVerify", { isforgot: false, userId: res?.userId });
setUsername("");
setMobile("");
setPhone("");
setEmail("");
setPassword("");
setConfirmPassword("");
setGender("");
setCountry("");
setAgree(false);
phoneRef.current?.setState({
  number: "",
});
    } catch (err: any) {

      // console.log("Register Error:", err);

      Alert.alert("Register Failed", err?.message || "Something went wrong");
    }
  };
  const contentList = privacy?.[0]?.content || [];
  const filteredCountries = countryList.filter((item) =>
  item.label.toLowerCase().includes(search.toLowerCase())
);
  return (

    <SafeAreaView style={{ flex: 1 }}>

      <ImageBackground
        source={require("../../../assets/Images/Signup_bg.png")}
        style={{ flex: 1 }}
      >

        <ScrollView contentContainerStyle={styles.container}>

          <Text style={[styles.title, { fontSize: font(30), textAlign: 'center' }]}>
            Welcome!
          </Text>

          <Text style={styles.subtitle}>
            Login securely to continue...
          </Text>

          <InputField
            value={username}
            leftIcon="user"
            placeholder="User Name"
            onChange={setUsername}
          />
          {errors.username ? (
            <Text style={styles.errorText}>{errors.username}</Text>
          ) : null}
         <PhoneInput
         
  defaultValue={phone}
  defaultCode="IN"
  layout="first"
   ref={phoneRef}
  onChangeText={(text) => {
    setPhone(text); // only number
  }}
  textInputProps={{
    placeholder: "Enter Mobile Number",   //  placeholder here
    placeholderTextColor: "#999",
     keyboardType: "number-pad",
  }}
  onChangeFormattedText={(text) => {
    setMobile(text); // +91 9876543210
  }}
  onChangeCountry={(country) => {
        AsyncStorage.setItem("countrycode",country.callingCode[0]);

    setCountryCode(country.callingCode[0]); // 👈 important
  }}
  
 

  containerStyle={{
    width: "100%",
    height: 55,          
    borderRadius: 12,
  }}

  textContainerStyle={{
    height: 55,          
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    paddingVertical: 0,  
  }}

  textInputStyle={{
    height: 55,          
    fontSize: 14,
    fontFamily:Fonts.medium,
    paddingVertical: 7, 
    marginTop:8,
  }}

/>
          {errors.mobile ? (
            <Text style={styles.errorText}>{errors.mobile}</Text>
          ) : null}
          <InputField
            value={email}
            leftIcon="mail"
            placeholder="Email Address"
            onChange={setEmail}
          />
          {errors.email ? (
            <Text style={styles.errorText}>{errors.email}</Text>
          ) : null}
          <InputField
            value={password}
            leftIcon="lock"
            placeholder="Create a strong password"
            secure
            onChange={setPassword}
          />
          {errors.password ? (
            <Text style={styles.errorText}>{errors.password}</Text>
          ) : null}
          <InputField
            value={confirmPassword}
            leftIcon="lock"
            placeholder="Re-enter your password"
            secure
            onChange={setConfirmPassword}
          />
          {errors.confirmPassword ? (
            <Text style={styles.errorText}>{errors.confirmPassword}</Text>
          ) : null}
          {/* DROPDOWNS */}

          <View style={styles.dropdownRow}>

            {/* Gender Dropdown */}
            <View style={{ width: "48%" }}>

              <TouchableOpacity
                style={styles.dropdown}
                onPress={() => setShowGenderModal(true)}
              >
                <Text style={{ fontSize: 14, fontFamily: Fonts.medium }}>
                  {gender || "Select Gender"}
                </Text>

                <Icon name="caret-down-outline" color={Colors.primary} size={18} />
              </TouchableOpacity>

              {errors.gender ? (
                <Text style={styles.errorText}>{errors.gender}</Text>
              ) : null}



            </View>

            {/* Country Dropdown */}
            <View style={{ width: "48%" }}>

              <TouchableOpacity
                style={styles.dropdown}
                onPress={() => setShowCountryModal(true)}
              >
                <Text style={{ fontSize: 14, fontFamily: Fonts.medium }}>
                  {country || "Select Country"}
                </Text>

                <Icon name="caret-down-outline" color={Colors.primary} size={18} />
              </TouchableOpacity>

              {/* {showCountry &&
                countryList.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setCountry(item);
                      setShowCountry(false);
                    }}
                  >
                    <Text  style={{fontSize:14,fontFamily:Fonts.medium}}>{item}</Text>
                  </TouchableOpacity>
                ))
              } */}
              {errors.country ? (
                <Text style={styles.errorText}>{errors.country}</Text>
              ) : null}
            </View>

          </View>


          {/* Privacy Card */}

          <TouchableOpacity
            style={styles.policyCard}
            onPress={() => { setShowPolicyModal(true), dispatch(getPrivacy()); }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>

              <View style={styles.lockIcon}>
                <Image
                  source={require("../../../assets/Icons/privacy.png")}
                  style={styles.fileIcon}
                />
              </View>

              <View>
                <Text style={styles.policyTitle}>
                  Privacy & Data Consent
                </Text>

                <Text style={styles.policySub}>
                  Tap to read before continuing
                </Text>
              </View>

            </View>

            <Icon name="caret-forward-outline" color={Colors.primary} size={20} />

          </TouchableOpacity>

          {/* Terms */}

          <View style={styles.termsCard}>

            <TouchableOpacity
              style={styles.agreeRow}
              onPress={() => {
                if (!hasReadPolicy) {
                  Alert.alert("Please read Privacy & Data Consent first");
                  return;
                }
                setAgree(!agree);
              }}
            >

              <Icon
                name={agree ? "checkbox" : "square-outline"}
                size={22}
                color={agree ? "#6C3BFF" : "#999"}
              />

              <Text style={styles.agreeText}>
                I've read and agree to the{" "}
                <Text onPress={()=>navigation.navigate("ContentScreen", { type: "terms" })} style={styles.link}>Terms of Service</Text> and{" "}
                <Text onPress={()=>navigation.navigate("ContentScreen", { type: "privacy" })}style={styles.link}>Privacy Policy</Text>.
                I consent to the collection and processing of my personal data.
              </Text>

            </TouchableOpacity>

          </View>
          {errors.terms ? (
            <Text style={[styles.errorText, { marginBottom: 10 }]}>{errors.terms}</Text>
          ) : null}

          <GradientButton
            title="Next"
            //onPress={()=>navigation.navigate('OtpVerify')}
            onPress={onRegister}
          />

          <Text style={styles.bottom}>
            Already have an account?
            <Text onPress={() => navigation.navigate('Login')} style={{ color: "#6C3BFF", fontSize: 14, fontFamily: Fonts.semiBold }}> Sign In</Text>
          </Text>

        </ScrollView>

      </ImageBackground>
      <Modal
        visible={showCountryModal}
        animationType="slide"
        transparent
      >
        <View style={styles.modalOverlay}>

          <View style={styles.modalContainer}>

            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>

              <TouchableOpacity onPress={() => setShowCountryModal(false)}>
                <Icon name="close" size={22} />
              </TouchableOpacity>
            </View>

<View style={styles.searchBox}>
  <Icon name="search-outline" size={18} color="#777" />

  <TextInput
    placeholder="Search country..."
    value={search}
    onChangeText={setSearch}
    style={styles.searchInput}
    placeholderTextColor="#999"
  />
</View>
            {/* Country List */}
            <FlatList
              data={filteredCountries} // 👈 use label/value list
              keyExtractor={(item) => item.value}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setCountry(item.value);
                    setShowCountryModal(false);
                    setSearch('')
                  }}
                >
                  <Text style={styles.itemText}>{item.label}</Text>

                  {country === item.value && (
                    <Icon name="checkmark" size={18} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />

          </View>

        </View>
      </Modal>
      <Modal
        visible={showGenderModal}
        animationType="slide"
        transparent
      >
        <View style={styles.modalOverlay}>

          <View style={styles.modalContainer}>

            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Gender</Text>

              <TouchableOpacity onPress={() => setShowGenderModal(false)}>
                <Icon name="close" size={22} />
              </TouchableOpacity>
            </View>

            {/* Gender List */}
            {genders.map((item) => (
              <TouchableOpacity
                key={item}
                style={styles.dropdownItem}
                onPress={() => {
                  setGender(item);
                  setShowGenderModal(false);
                }}
              >
                <Text style={styles.itemText}>{item}</Text>

                {gender === item && (
                  <Icon name="checkmark" size={18} color={Colors.primary} />
                )}
              </TouchableOpacity>
            ))}

          </View>

        </View>
      </Modal>

      <Modal visible={showPolicyModal} animationType="slide">

        <SafeAreaView style={{ flex: 1, padding: 20 }}>

          <Text style={{ fontSize: 18, fontFamily: Fonts.bold }}>
            Privacy Policy
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 15 }}>

            {loading ? (
              <Text>Loading...</Text>
            ) : (
              contentList.map((item: string, index: number) => (
                <Text
                  key={index}
                  style={{ fontSize: 14, lineHeight: 22, marginBottom: 12, fontFamily: Fonts.regular }}
                >
                  {item}
                </Text>
              ))
            )}

          </ScrollView>

          <TouchableOpacity
            style={{
              backgroundColor: Colors.primary,
              padding: 15,
              borderRadius: 10,
              alignItems: "center"
            }}
            onPress={() => {
              setHasReadPolicy(true);
              setShowPolicyModal(false);
              setAgree(true)
            }}
          >
            <Text style={{ color: "#fff", fontFamily: Fonts.semiBold }}>
              I Have Read & Agree
            </Text>
          </TouchableOpacity>

        </SafeAreaView>

      </Modal>
    </SafeAreaView>

  );
};

const styles = StyleSheet.create({

  container: {
    flexGrow: 1,
    padding: 20
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 12,
    marginTop: 2,
    marginBottom: 4,
    fontFamily: Fonts.regular
  },
  title: {
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 50,
    fontFamily: Fonts.bold
  },
  fileIcon: {
    width: 20,
    height: 20,
  },
  subtitle: {
    color: "#777",
    marginBottom: 25,
    textAlign: 'center',
    fontSize: 14,
    fontFamily: Fonts.regular
  },

  dropdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 15
  },

  dropdown: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12
  },

  // dropdownItem: {
  //   backgroundColor: "#fff",
  //   padding: 12,
  //   borderBottomWidth: 1,

  //   borderColor: "#eee"
  // },

  policyCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 15
  },

  lockIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#6C3BFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10
  },

  policyTitle: {
    fontWeight: "600",
    fontSize: 14, fontFamily: Fonts.semiBold
  },

  policySub: {
    fontSize: 13,
    color: "#777",
    fontFamily: Fonts.regular
  },

  termsCard: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E5E8",
  },

  agreeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  agreeText: {
    flex: 1,
    color: "#555",
    marginLeft: 10,
    fontSize: 13,
    fontFamily: Fonts.medium,
    lineHeight: 18,
  },

  link: {
    color: "#6C3BFF",
    fontWeight: "600",
  },

  bottom: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 14, fontFamily: Fonts.medium
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },

  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    padding: 15,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  modalTitle: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
  },

  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },

  itemText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
  },
  searchBox: {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: "#f5f5f5",
  borderRadius: 10,
  paddingHorizontal: 10,
  marginBottom: 10,
},

searchInput: {
  flex: 1,
  height: 45,
  marginLeft: 8,
  fontSize: 14,
  fontFamily: Fonts.medium,
},

});