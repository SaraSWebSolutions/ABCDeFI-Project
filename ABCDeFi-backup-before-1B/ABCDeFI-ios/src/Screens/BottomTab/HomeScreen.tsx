
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
  BackHandler,
  PermissionsAndroid,
  Platform,
  StatusBar
} from "react-native";

import LinearGradient from "react-native-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";
import { Colors } from "../../Utils/Colors";
import Fonts from "../../Utils/Fonts";
import { useActiveAccount, useActiveWalletChain, useActiveWalletConnectionStatus, useDisconnect, useSwitchActiveWalletChain, useConnect, useActiveWallet, ConnectButton } from 'thirdweb/react';
import { bscTestnet_custom, thirdwebClient} from '../../Config/thirdwebConfig';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../Store/Store';
import { useFocusEffect } from "@react-navigation/native";
import { fetchTimerIco, fetchReward, fetchRewardStatus } from '../../Store/Slices/homeSlice';
import { downloadWhitepaper } from '../../Store/Slices/authSlice';
import { ethers } from 'ethers';
import icoABI from '../../abi/ico.json';

import ReactNativeBlobUtil from 'react-native-blob-util';
import { IMAGE_URL } from '@env';
import FastImage from 'react-native-fast-image';
import { fetchProfile } from '../../Store/Slices/profileSlice';
import { WalletModal } from '../../Components/WalletModal';
import { createWallet, WalletId } from 'thirdweb/wallets';
import { PROJECT_ID } from '@env';
import { bscTestnet } from 'thirdweb/chains';
import { checkWalletInstalled, showInstallationAlert, WALLET_METADATA } from '../../Utils/WalletDetection';
import { expected_chainID, ICO_CONTRACT_ADDRESS } from './IcoScreen';


export default function HomeScreen({ navigation }: any) {
  const { disconnect } = useDisconnect();
  const { connect } = useConnect();
  const { user, loading } = useSelector(
    (state: RootState) => state.auth
  );
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const chain = useActiveWalletChain();
   console.log(chain, 'chain');
  const switchChain = useSwitchActiveWalletChain();
  const address = account?.address;
  const isConnected = !!account;
const dispatch = useDispatch<any>();
const [imgError, setImgError] = useState(false);

const { timerIcoData, error } = useSelector(
  (state: RootState) => state.home
);
const { rewardStatus,rewardData } = useSelector(
  (state: RootState) => state.home
);
  const { profileData } = useSelector((state: RootState) => state.profile);

  const [timeLeft, setTimeLeft] = useState({
    days: "0",
    hours: "0",
    minutes: "0",
    seconds: "0",
  });
  const [rewardShow, setRewardShow] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const activeAccount = useActiveAccount();
  const status = useActiveWalletConnectionStatus();

  const [icoStats, setIcoStats] = useState({
    startTime: 0,
    endTime: 0,
    totalCap: '0',
    totalSold: '0',
    isLoading: true
  });

  const fetchHomeScreenData = async (showLoading = true) => {
    if (showLoading) setIcoStats(prev => ({ ...prev, isLoading: true }));
    try {
      const provider = new ethers.JsonRpcProvider('https://bsc-testnet.publicnode.com');
      const icoContract = new ethers.Contract(ICO_CONTRACT_ADDRESS, icoABI, provider);


      // Fetch summary, current stage, and start time in parallel (exactly like IcoScreen)
      const [summary, stageData, startTimeBN, endTimeBN] = await Promise.all([
        icoContract.getIcoSummary(),
        icoContract.getCurrentStageData(),
        icoContract.icoStartTime(),
        icoContract.icoEndTime()
      ]);

      const [totalSoldGlobal, totalCapGlobal] = summary;

      setIcoStats({
        startTime: Number(startTimeBN),
        endTime: Number(endTimeBN),
        totalCap: ethers.formatUnits(totalCapGlobal, 18),
        totalSold: ethers.formatUnits(totalSoldGlobal, 18),
        isLoading: false
      });
    } catch (error) {
      console.error("Error fetching HomeScreen contract data:", error);
      setIcoStats(prev => ({ ...prev, isLoading: false }));
    }
  };

  useEffect(() => {
    dispatch(fetchProfile());
    fetchHomeScreenData(true);
    dispatch(fetchRewardStatus());

    // Refresh data every 15 seconds
    const refreshInterval = setInterval(() => fetchHomeScreenData(false), 15000);
    return () => clearInterval(refreshInterval);
  }, []);

  // Per-second timer for the countdown clock
  useEffect(() => {
    const timerInterval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      
      // LOGIC: If startTime is in the future, target startTime. If not, target endTime.
      let targetTime = 0;
      if (icoStats.startTime > 0 && now < icoStats.startTime) {
        targetTime = icoStats.startTime;
      } else if (icoStats.endTime > 0) {
        targetTime = icoStats.endTime;
      }

      if (!targetTime || targetTime <= now) {
        setTimeLeft({ days: "00", hours: "00", minutes: "00", seconds: "00" });
        return;
      }

      const diff = targetTime - now;
      const d = Math.floor(diff / 86400);
      const h = Math.floor((diff % 86400) / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;

      setTimeLeft({
        days: String(d).padStart(2, "0"),
        hours: String(h).padStart(2, "0"),
        minutes: String(m).padStart(2, "0"),
        seconds: String(s).padStart(2, "0"),
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [icoStats.startTime, icoStats.endTime]);




  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        Alert.alert(
          "Exit App",
          "Are you sure you want to exit?",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Exit", onPress: () => BackHandler.exitApp() },
          ]
        );
        return true;
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress
      );

      return () => subscription.remove();
    }, [])
  );


  const handleWalletConnect = async (walletId: string) => {
    try {
      if (WALLET_METADATA[walletId]) {
        const isInstalled = await checkWalletInstalled(walletId);
        if (!isInstalled) {
          showInstallationAlert(walletId);
          return;
        }
      }

      const wallet = createWallet(walletId as WalletId);
      await connect(async () => {
        await wallet.connect({
          client: thirdwebClient,
          chain: bscTestnet_custom,
          walletConnect: {
            projectId: PROJECT_ID,
            appMetadata: {
              name: "ABCDefi",
              url: "https://abcdefi.com",
              description: "ABCDefi - Your DeFi Platform",
              logoUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRLY6djbwpi-PHMMo0y-UaZbdAticD21Of3XQ&s",
            },
          },

        });
        return wallet;
      });
      setShowWalletModal(false);
    } catch (error) {
      console.log("Local handle error:", error);
    }
  };

  
  useEffect(() => {
     if (isConnected && chain && chain.id !== expected_chainID) {
       console.log('Wrong network:', chain.name || `Chain ${chain.id}`);
       try {
         switchChain(bscTestnet_custom);
 
       } catch (error) {
         console.error('Error switching chain:', error);
       }
     }
   }, [isConnected, chain, bscTestnet_custom, switchChain]);







  const requestStoragePermission = async () => {

  if (Platform.OS !== "android") return true;
 
   //  Android 13+
   if (Platform.Version >= 29) {
     return true; // no permission needed
   }
 const granted = await PermissionsAndroid.request(
     PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
   );
 
   return granted === PermissionsAndroid.RESULTS.GRANTED;
};
const handleDownloadWhitepaper = async () => {
  try {
    const hasPermission = await requestStoragePermission();

      if (!hasPermission) {
        Alert.alert("Permission denied");
        return;
      }

      const res = await dispatch(downloadWhitepaper({})).unwrap();

      const fileName = res?.data?.[0]?.file;

      if (!fileName) {
        Alert.alert("File not found");
        return;
      }

      const fileUrl = encodeURI(IMAGE_URL + fileName);

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
const handleAnswer = (value: "yes" | "no") => {
  dispatch(fetchReward({ response: value }))
    .unwrap()
    .then(() => {
      dispatch(fetchRewardStatus()); // optional refresh
    });
};
const imageUrl = profileData?.image
  ? `${IMAGE_URL.replace(/\/$/, "")}/${profileData.image.replace(/^\//, "")}`
  : null;
// console.log("IMAGE_URL:", imgError,IMAGE_URL);
// console.log("FINAL URL:", IMAGE_URL + profileData?.image);
 const isIOS = Platform.OS === 'ios';
  if (isIOS) {
return (
 <View style={{ flex: 1, backgroundColor: '#1A0048' }}>

    {/* Status Bar Area */}
    <SafeAreaView
      edges={['top']}
      style={{ backgroundColor: '#1A0048' }}
    />

    {/* Main Screen */}
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={{ flex: 1, backgroundColor: '#fff' }}
    >
  <ScrollView
  bounces={false}
    contentInsetAdjustmentBehavior="never"
  automaticallyAdjustContentInsets={false}

contentContainerStyle={{
    paddingBottom: Platform.OS === "ios" ? 120 : 100,
  }}    showsVerticalScrollIndicator={false}
  >

        <View style={iosStyles.container}>

          {/* TOP GRADIENT AREA */}

          <LinearGradient
            colors={["#1A0048", "#5B2BD6", "#9F7BFF"]}
            style={iosStyles.topSection}
          >

            {/* HEADER */}

            <View style={iosStyles.header}>

  <TouchableOpacity
    onPress={() => navigation.navigate("SettingsScreen")}
    style={{ flexDirection: "row", alignItems: "center" ,marginHorizontal:10}}
  >
    <FastImage

  key={imageUrl}
  source={
    imageUrl && !imgError
      ? { uri: imageUrl }
      : require("../../../assets/Images/place.jpg")
  }
  style={iosStyles.avatar}
  onError={() => setImgError(true)}
  resizeMode="cover"

    defaultSource={require("../../../assets/Images/place.jpg")}

/>

                <View style={{ marginLeft: 10 }}>
                  <Text style={iosStyles.greet}>Welcome back !</Text>
                  <Text style={iosStyles.name}>
                    {profileData?.name || user?.name || "Guest"}
                  </Text>
                </View>
              </TouchableOpacity>

  {/*  Separate bell */}
  <TouchableOpacity onPress={()=>navigation.navigate('NotificationScreen')} style={styles.bell}>
    <Icon name="notifications-outline" size={24} color="#FFF" />
  </TouchableOpacity>

            </View>


            {/* TIMER BOX */}

            <View style={iosStyles.timerBox}>

              <View style={iosStyles.timerTitleRow}>
                <View style={iosStyles.line} />
                <Text style={iosStyles.icoTitle}>
                  {Math.floor(Date.now() / 1000) < icoStats.startTime ? 'ICO Starts In' : 'ICO Ends In'}
                </Text>
                <View style={iosStyles.line} />
              </View>


              <View style={iosStyles.timerRow}>
                {[
                  timeLeft.days,
                  timeLeft.hours,
                  timeLeft.minutes,
                  timeLeft.seconds,
                ].map((item, i) => (
                  <View key={i} style={iosStyles.timerItem}>
                    <View style={iosStyles.timerCircle}>
                      <Text style={iosStyles.timerNumber}>{item}</Text>
                    </View>

                    <Text style={iosStyles.timerLabel}>
                      {["Days", "Hours", "Minutes", "Seconds"][i]}
                    </Text>
                  </View>
                ))}

              </View>

            </View>


            {/* CONNECT WALLET */}
            <View style={{ marginTop: 25 }}>
              {!isConnected ? (
                <TouchableOpacity
                  style={iosStyles.connectWalletButton}
                  onPress={() => setShowWalletModal(true)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={["#7B3EF0", "#3F0D97"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={iosStyles.connectButtonGradient}
                  >
                    <Icon name="wallet-outline" size={20} color="#FFF" style={iosStyles.walletIcon} />
                    <Text style={iosStyles.connectButtonText}>Connect Wallet</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                // <View style={styles.connectedWalletContainer}>
                //   <View style={styles.walletInfo}>
                //     <Icon name="checkmark-circle" size={20} color="#4CAF50" />
                //     <Text style={styles.connectedText}>Connected</Text>
                //     <Text style={styles.addressText}>
                //       {`${address?.slice(0, 6)}....${address?.slice(-4)}`}
                //     </Text>
                //   </View>
                //   <TouchableOpacity
                //     style={styles.disconnectButton}
                //     onPress={() => wallet && disconnect(wallet)}
                //   >
                //     <Icon name="log-out-outline" size={18} color="#FF5252" />
                //   </TouchableOpacity>
                // </View>

                <ConnectButton
                  client={thirdwebClient}
                  chain={bscTestnet}
                  theme="dark"
                />
              )}
            </View>


            <Text style={iosStyles.joinText}>
              Join ICO Before Timer Ends
            </Text>

          </LinearGradient>
          {/* JOIN ICO BUTTON */}

          <View style={iosStyles.joinWrapper}>
            <TouchableOpacity onPress={() => navigation.navigate("ICO")}

              activeOpacity={0.8}>
              <LinearGradient
                colors={["#7B3EF0", "#3F0D97"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={iosStyles.joinGradient}

              >
                <Text style={iosStyles.joinBtnText}>Join ICO  »</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>


          {/* TOKEN CARD */}

          <View style={iosStyles.tokenCard}>

            <Text style={iosStyles.limit}>Limited allocation remaining</Text>

            <View style={iosStyles.tokenHeader}>

              <View>
                <Text style={iosStyles.tokenTitle}>Token allocation</Text>
                <Text style={iosStyles.tokenAmount}>
                  {`${(parseFloat(icoStats.totalCap) / 1e12).toFixed(1)} Trillion`}
                </Text>
              </View>

              <TouchableOpacity onPress={() => handleDownloadWhitepaper()} style={iosStyles.downloadIcon}>
                <Icon name="download-outline" size={24} color={Colors.primary} />

                {/* <Text style={{fontSize:18,color:"#6A35FF"}}>⬇</Text> */}
              </TouchableOpacity>

            </View>

            <TouchableOpacity onPress={() => handleDownloadWhitepaper()} style={iosStyles.whitePaper}>
              <Text style={{ color: "#fff", fontSize: 16, fontFamily: Fonts.medium, }}>
                Download White Paper
              </Text>
            </TouchableOpacity>

          </View>

          {/* JOIN ICO BUTTON */}

          {/* <View style={styles.joinWrapper}>

<LinearGradient
colors={["#7B3EF0","#3F0D97"]}
start={{x:0,y:0}}
end={{x:1,y:0}}
style={styles.joinGradient}
>

<Text style={styles.joinBtnText}>Join ICO  »</Text>

</LinearGradient>

</View>


{/* TOKEN CARD 

<View style={styles.tokenCard}>

<Text style={styles.limit}>Limited allocation remaining</Text>

<Text style={styles.tokenTitle}>Token allocation</Text>
<Text style={styles.tokenAmount}>1 Quadrillion</Text>

<TouchableOpacity style={styles.whitePaper}>
<Text style={{color:"#fff"}}>Download White Paper</Text>
</TouchableOpacity>

</View> */}


          {/* REWARD CARD */}
          {!rewardStatus ?
            <>
              <Image
                source={require("../../../assets/Images/trophy.png")}
                style={iosStyles.trophy}
              />
              <View style={iosStyles.rewardCard}>



                {/* REWARD BAR */}

                <LinearGradient
                  colors={["#A66CFF", "#6A35FF"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={iosStyles.rewardBar}
                >

                <Text style={iosStyles.rewardText}>Reward Points</Text>

              <View style={iosStyles.rewardRight}>
                <Text style={iosStyles.coin}>🪙</Text>
                <Text style={iosStyles.points}>800{rewardData?.points}</Text>
              </View>

                </LinearGradient>


                <Text style={iosStyles.question}>
                  Do you want full control over your finances?
                </Text>

                <View style={iosStyles.answerRow}>

                  <LinearGradient
                    colors={["#A88FE8", "#8A7BBF"]}
                    style={iosStyles.answerBtn}
                  >
                    <TouchableOpacity onPress={() => handleAnswer("no")}>

                      <Text style={iosStyles.answerText}>No</Text>
                    </TouchableOpacity>
                  </LinearGradient>

                  <LinearGradient
                    colors={["#C69AF7", "#B77CE8"]}
                    style={iosStyles.answerBtn}

                  >
                    <TouchableOpacity onPress={() => handleAnswer("yes")}>
                      <Text style={iosStyles.answerText}>Yes</Text>

                    </TouchableOpacity>
                  </LinearGradient>

                </View>

              </View>
            </> : null}



          {/* </View> */}

        </View>

      </ScrollView>

      {/* Wallet Modal */}
      <WalletModal
        visible={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        onWalletConnect={handleWalletConnect}
      />

    </SafeAreaView>
    </View>
  );
}else{
  return (
    <View style={{ flex: 1, backgroundColor: "#F5F5F5" }}>
  <SafeAreaView
    edges={['top']}
    style={{ backgroundColor: '#1A0048' }}
  />

  <StatusBar
    barStyle="light-content"
    backgroundColor="#3B0D97"
  />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={androidStyles.container}>
          {/* TOP GRADIENT AREA */}

          <LinearGradient
            colors={['#1A0048', '#5B2BD6', '#9F7BFF']}
            style={androidStyles.topSection}
          >
            <View style={androidStyles.header}>
              {/* LEFT SIDE */}
              <View style={{ flex: 1 }}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('SettingsScreen')}
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                  <FastImage
                    key={imageUrl}
                    source={
                      imageUrl && !imgError
                        ? { uri: imageUrl }
                        : require('../../../assets/Images/place.jpg')
                    }
                    style={androidStyles.avatar}
                    onError={() => setImgError(true)}
                    resizeMode="cover"
                    defaultSource={require('../../../assets/Images/place.jpg')}
                  />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={androidStyles.greet}>Welcome back !</Text>

                    <Text
                      style={androidStyles.name}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {profileData?.name || user?.name || 'Guest'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* RIGHT SIDE */}
              <TouchableOpacity
                onPress={() => navigation.navigate('NotificationScreen')}
                style={androidStyles.bell}
              >
                <Icon name="notifications-outline" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            {/* HEADER */}

            {/* TIMER BOX */}

            <View style={androidStyles.timerBox}>
              <View style={androidStyles.timerTitleRow}>
                <View style={androidStyles.line} />
                <Text style={androidStyles.icoTitle}>
                  {Math.floor(Date.now() / 1000) < icoStats.startTime
                    ? 'ICO Starts In'
                    : 'ICO Ends In'}
                </Text>
                <View style={androidStyles.line} />
              </View>

              <View style={androidStyles.timerRow}>
                {[
                  timeLeft.days,
                  timeLeft.hours,
                  timeLeft.minutes,
                  timeLeft.seconds,
                ].map((item, i) => (
                  <View key={i} style={androidStyles.timerItem}>
                    <View style={androidStyles.timerCircle}>
                      <Text style={androidStyles.timerNumber}>{item}</Text>
                    </View>

                    <Text style={androidStyles.timerLabel}>
                      {['Days', 'Hours', 'Minutes', 'Seconds'][i]}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* CONNECT WALLET */}
            <View style={{ marginTop: 25 }}>
              {!isConnected ? (
                <TouchableOpacity
                  style={androidStyles.connectWalletButton}
                  onPress={() => setShowWalletModal(true)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#7B3EF0', '#3F0D97']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={androidStyles.connectButtonGradient}
                  >
                    <Icon
                      name="wallet-outline"
                      size={20}
                      color="#FFF"
                      style={androidStyles.walletIcon}
                    />
                    <Text style={androidStyles.connectButtonText}>Connect Wallet</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                // <View style={styles.connectedWalletContainer}>
                //   <View style={styles.walletInfo}>
                //     <Icon name="checkmark-circle" size={20} color="#4CAF50" />
                //     <Text style={styles.connectedText}>Connected</Text>
                //     <Text style={styles.addressText}>
                //       {`${address?.slice(0, 6)}....${address?.slice(-4)}`}
                //     </Text>
                //   </View>
                //   <TouchableOpacity
                //     style={styles.disconnectButton}
                //     onPress={() => wallet && disconnect(wallet)}
                //   >
                //     <Icon name="log-out-outline" size={18} color="#FF5252" />
                //   </TouchableOpacity>
                // </View>

                <ConnectButton
                  client={thirdwebClient}
                  chain={bscTestnet}
                  theme="dark"
                />
              )}
            </View>

            <Text style={androidStyles.joinText}>Join ICO Before Timer Ends</Text>
          </LinearGradient>
          {/* JOIN ICO BUTTON */}

          <View style={androidStyles.joinWrapper}>
            <TouchableOpacity
              onPress={() => navigation.navigate('ICO')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#7B3EF0', '#3F0D97']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={androidStyles.joinGradient}
              >
                <Text style={androidStyles.joinBtnText}>Join ICO »</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* TOKEN CARD */}

          <View style={androidStyles.tokenCard}>
            <Text style={androidStyles.limit}>Limited allocation remaining</Text>

            <View style={androidStyles.tokenHeader}>
              <View>
                <Text style={androidStyles.tokenTitle}>Token allocation</Text>
                <Text style={androidStyles.tokenAmount}>
                  {`${(parseFloat(icoStats.totalCap) / 1e12).toFixed(
                    1,
                  )} Trillion`}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => handleDownloadWhitepaper()}
                style={androidStyles.downloadIcon}
              >
                <Icon
                  name="download-outline"
                  size={24}
                  color={Colors.primary}
                />

                {/* <Text style={{fontSize:18,color:"#6A35FF"}}>⬇</Text> */}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => handleDownloadWhitepaper()}
              style={androidStyles.whitePaper}
            >
              <Text
                style={{
                  color: '#fff',
                  fontSize: 16,
                  fontFamily: Fonts.medium,
                }}
              >
                Download White Paper
              </Text>
            </TouchableOpacity>
          </View>

          {/* JOIN ICO BUTTON */}

          {/* <View style={styles.joinWrapper}>

<LinearGradient
colors={["#7B3EF0","#3F0D97"]}
start={{x:0,y:0}}
end={{x:1,y:0}}
style={styles.joinGradient}
>

<Text style={styles.joinBtnText}>Join ICO  »</Text>

</LinearGradient>

</View>


{/* TOKEN CARD 

<View style={styles.tokenCard}>

<Text style={styles.limit}>Limited allocation remaining</Text>

<Text style={styles.tokenTitle}>Token allocation</Text>
<Text style={styles.tokenAmount}>1 Quadrillion</Text>

<TouchableOpacity style={styles.whitePaper}>
<Text style={{color:"#fff"}}>Download White Paper</Text>
</TouchableOpacity>

</View> */}

          {/* REWARD CARD */}
          {!rewardStatus ? (
            <>
              <Image
                source={require('../../../assets/Images/trophy.png')}
                style={androidStyles.trophy}
              />
              <View style={androidStyles.rewardCard}>
                {/* REWARD BAR */}

                <LinearGradient
                  colors={['#A66CFF', '#6A35FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={androidStyles.rewardBar}
                >
                  <Text style={androidStyles.rewardText}>Reward Points</Text>

                  <View style={androidStyles.rewardRight}>
                    <Text style={androidStyles.coin}>🪙</Text>
                    <Text style={androidStyles.points}>{rewardData?.points}</Text>
                  </View>
                </LinearGradient>

                <Text style={androidStyles.question}>
                  Do you want full control over your finances?
                </Text>

                <View style={androidStyles.answerRow}>
                  <LinearGradient
                    colors={['#A88FE8', '#8A7BBF']}
                    style={androidStyles.answerBtn}
                  >
                    <TouchableOpacity onPress={() => handleAnswer('no')}>
                      <Text style={androidStyles.answerText}>No</Text>
                    </TouchableOpacity>
                  </LinearGradient>

                  <LinearGradient
                    colors={['#C69AF7', '#B77CE8']}
                    style={androidStyles.answerBtn}
                  >
                    <TouchableOpacity onPress={() => handleAnswer('yes')}>
                      <Text style={androidStyles.answerText}>Yes</Text>
                    </TouchableOpacity>
                  </LinearGradient>
                </View>
              </View>
            </>
          ) : null}

          {/* </View> */}
        </View>
      </ScrollView>

      {/* Wallet Modal */}
      <WalletModal
        visible={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        onWalletConnect={handleWalletConnect}
      />
    </View>
  );
}
}


const iosStyles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F7F7F7",
  },

  scrollContent: {
    paddingBottom: 140,
  },

  container: {
    flex: 1,
    backgroundColor: "#F7F7F7",
  },

  /* TOP SECTION */

  topSection: {
    paddingTop: 0,
//   paddingBottom: Platform.OS === "ios" ? 140 : 90,
//   minHeight: 520, // increase gradient height
// height:130,
    // borderBottomLeftRadius: 38,
    // borderBottomRightRadius: 38,
 height: Platform.OS === "ios" ? 460 : 520,

    overflow: "hidden",
  },

  topInner: {
    paddingHorizontal: 20,
  },

  /* HEADER */

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",

    paddingTop: Platform.OS === "ios" ? 10 : 0,
  },

  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },

  greet: {
    color: "#D9D9D9",
    fontSize: 14,
    fontFamily: Fonts.regular,
  },

  name: {
    color: "#FFF",
    fontSize: 28,
    fontFamily: Fonts.bold,
    marginTop: 2,
  },

  bell: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },

  /* TIMER */

  timerBox: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    borderRadius: 24,

    paddingVertical: 12,
    paddingHorizontal: 16,
marginHorizontal:10,
    backgroundColor: "rgba(255,255,255,0.03)",
  },

  timerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 25,
  },

  line: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.20)",
  },

  icoTitle: {
    color: "#FFF",
    marginHorizontal: 14,
    fontSize: 20,
    fontFamily: Fonts.bold,
  },

  timerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  timerItem: {
    alignItems: "center",
    flex: 1,
  },

  timerCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,

    backgroundColor: "rgba(255,255,255,0.16)",

    justifyContent: "center",
    alignItems: "center",
  },

  timerNumber: {
    color: "#FFF",
    fontSize: 30,
    fontFamily: Fonts.bold,
  },

  timerLabel: {
    color: "#EEE",
    marginTop: 10,
    fontSize: 15,
    fontFamily: Fonts.medium,
  },

  /* CONNECT WALLET */

  connectWalletButton: {
    //marginTop: 8,
    borderRadius: 20,
    overflow: "hidden",
  },

  connectButtonGradient: {
    height: 68,

    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
marginHorizontal:20,
    borderRadius: 20,
  },

  walletIcon: {
    marginRight: 10,
  },

  connectButtonText: {
    color: "#FFF",
    fontSize: 18,
    fontFamily: Fonts.semiBold,
  },

  joinText: {
    textAlign: "center",
    color: "#FFF",

    marginTop: 8,
    marginBottom: 10,

    fontSize: 15,
    fontFamily: Fonts.medium,

    opacity: 0.9,
  },

  /* JOIN ICO BUTTON */

  joinWrapper: {
    alignItems: "center",

    marginTop: -55,
    //marginBottom: 20,

    zIndex: 999,
  },

  joinGradient: {
    width: 300,
    height: 62,

    borderRadius: 40,

    justifyContent: "center",
    alignItems: "center",

    shadowColor: "#6A35FF",
    shadowOpacity: 0.25,
    shadowRadius: 10,

    shadowOffset: {
      width: 0,
      height: 6,
    },

    elevation: 8,
  },

  joinBtnText: {
    color: "#FFF",
    fontSize: 18,
    fontFamily: Fonts.bold,
  },

  /* TOKEN CARD */

  tokenCard: {
    marginHorizontal: 20,
    //marginTop: 8,
 marginTop: -20,
    backgroundColor: "#FFF",

    borderBottomLeftRadius: 15, borderBottomRightRadius: 15,

    padding: 22,

    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,

    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 5,
  },

  limit: {
    color: "#FF3B30",

    textAlign: "center",

    fontSize: 14,
    fontFamily: Fonts.medium,

    marginBottom: 18,
  },

  tokenHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  tokenTitle: {
    fontSize: 18,
    color: "#000",
    fontFamily: Fonts.bold,
  },

  tokenAmount: {
    fontSize: 16,
    color: "#8E8E93",

    marginTop: 6,

    fontFamily: Fonts.medium,
  },

  downloadIcon: {
    width: 44,
    height: 44,

    borderRadius: 22,

    backgroundColor: "#F3F3F3",

    justifyContent: "center",
    alignItems: "center",
  },

  whitePaper: {
    marginTop: 24,

    backgroundColor: "#6A35FF",

    borderRadius: 18,

    paddingVertical: 16,

    alignItems: "center",
  },

  /* TROPHY */

  // trophy: {
  //   width: "90%",
  //   height: 240,

  //   alignSelf: "center",

  //   marginTop: 28,

  //   borderRadius: 22,
  // },

  /* REWARD CARD */

  // rewardCard: {
  //   width: "88%",

  //   alignSelf: "center",

  //   backgroundColor: "#FFF",

  //   borderRadius: 28,

  //   marginTop: -40,

  //   paddingTop: 72,
  //   paddingBottom: 28,

  //   shadowColor: "#000",
  //   shadowOpacity: 0.08,
  //   shadowRadius: 10,

  //   shadowOffset: {
  //     width: 0,
  //     height: 4,
  //   },

  //   elevation: 5,
  // },

  // rewardBar: {
  //   position: "absolute",

  //   top: -22,
  //   left: 12,
  //   right: 12,

  //   borderRadius: 40,

  //   paddingVertical: 14,
  //   paddingHorizontal: 20,

  //   flexDirection: "row",
  //   justifyContent: "space-between",
  //   alignItems: "center",
  // },

  rewardText: {
    color: "#FFF",
    fontSize: 16,
    fontFamily: Fonts.bold,
    marginBottom:20
  },

  rewardRight: {
    flexDirection: "row",
    alignItems: "center",
    marginRight:50,
    marginHorizontal:20,
    marginBottom:25,
  },

  coin: {
    marginRight: 6,
    fontSize: 16,
    
  },

  points: {
    color: "#FFF",
    fontSize: 16,
    fontFamily: Fonts.bold,
  },

  question: {
    textAlign: "center",

    fontSize: 18,

    color: "#000",

    paddingHorizontal: 24,

    marginTop: 10,

    lineHeight: 28,

    fontFamily: Fonts.medium,
  },

  answerRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",

    marginTop: 28,
  },

  answerBtn: {
    minWidth: 120,
    paddingVertical: 14,
    height: 72,
    borderRadius: 14,

    alignItems: "center",
  },

  answerText: {
    color: "#FFF",
    fontSize: 16,
    fontFamily: Fonts.bold,
  },

  /* CONNECTED WALLET */

  connectedWalletContainer: {
    marginTop: 28,

    backgroundColor: "rgba(255,255,255,0.12)",

    borderRadius: 18,

    padding: 16,

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  walletInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  connectedText: {
    color: "#4CD964",
    fontSize: 15,
    marginLeft: 8,
    fontFamily: Fonts.medium,
  },

  addressText: {
    color: "#FFF",
    fontSize: 14,
    marginLeft: 10,
    opacity: 0.8,
    fontFamily: Fonts.regular,
  },

  disconnectButton: {
    width: 38,
    height: 38,
    borderRadius: 19,

    backgroundColor: "rgba(255,82,82,0.12)",

    justifyContent: "center",
    alignItems: "center",
  },
  trophy: {
  width: "92%",
  height: 220,

  alignSelf: "center",

  marginTop: 30,

  resizeMode: "cover",

  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,

  overflow: "hidden",
},

rewardCard: {
  width: "85%",

  alignSelf: "center",

  backgroundColor: "#FFF",

  borderRadius: 18,
  // borderBottomRightRadius: 8,

  paddingTop: 55,
  paddingBottom: 18,

  marginTop: -18,

  shadowColor: "#000",
  shadowOpacity: 0.08,
  shadowRadius: 10,

  shadowOffset: {
    width: 0,
    height: 4,
  },

  elevation: 5,

  overflow: "visible",
},

rewardBar: {
  position: "absolute",
    height: 84,

  //top: -26,

  alignSelf: "center",
 width: "95%",
    borderRadius: 40,
    paddingVertical: 13,
    paddingHorizontal: 20,
 

  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",

  // zIndex: 999,

  // elevation: 10,
},
});
const androidStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tokenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },

  topSection: {
    padding: 20,
    paddingBottom: 90,
    // borderBottomLeftRadius:30,
    // borderBottomRightRadius:30
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 52 / 2,
  },

  greet: {
    color: '#ccc',
    fontSize: 14,
    fontFamily: Fonts.regular,
  },

  name: {
    color: '#FFF',
    fontSize: 20,
    fontFamily: Fonts.bold,
    fontWeight: '700',
    flexShrink: 1, // 🔥 IMPORTANT
    flexWrap: 'wrap',
  },

  bell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* TIMER BOX */

  timerBox: {
    marginTop: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 22,
    padding: 20,
  },

  timerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },

  line: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },

  icoTitle: {
    color: '#fff',
    marginHorizontal: 10,
    fontSize: 16,
    fontFamily: Fonts.medium,
    fontWeight: '600',
  },

  timerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  timerItem: {
    alignItems: 'center',
  },

  timerCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  timerNumber: {
    color: '#fff',
    fontSize: 22,
    fontFamily: Fonts.bold,
    fontWeight: '700',
  },

  timerLabel: {
    color: '#eee',
    marginTop: 6,
    fontFamily: Fonts.medium,
  },

  walletBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginTop: 25,
    padding: 14,
    borderRadius: 15,
    alignItems: 'center',
  },

  walletText: {
    color: '#fff',
    fontSize: 17,
    fontFamily: Fonts.semiBold,
  },

  walletAddress: {
    color: '#fff',
    fontSize: 14,
    fontFamily: Fonts.regular,
    marginTop: 10,
    textAlign: 'center',
    opacity: 0.8,
  },

  joinText: {
    textAlign: 'center',
    color: '#fff',
    marginTop: 20,
    fontFamily: Fonts.regular,
  },

  noBtn: {
    backgroundColor: '#E5E5E5',
    paddingHorizontal: 35,
    paddingVertical: 10,
    borderRadius: 20,
  },

  yesBtn: {
    backgroundColor: '#C084FC',
    paddingHorizontal: 35,
    paddingVertical: 10,
    borderRadius: 20,
  },

  rewardCard: {
    margin: 20,
    backgroundColor: '#fff',
    borderRadius: 25,
    top: -42,
    paddingBottom: 20,
    overflow: 'hidden',
    elevation: 6,
    alignSelf: 'center',
    width: '85%',
  },

  trophy: {
    width: '90%',
    alignSelf: 'center',
    height: 260,
    marginTop: 20,
    borderRadius: 12,
  },

  rewardBar: {
    position: 'absolute',
    //top:-5,
    alignSelf: 'center',
    width: '95%',
    borderRadius: 40,
    paddingVertical: 13,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 6,
  },

  rewardText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    fontWeight: '600',
  },

  rewardRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  coin: {
    marginRight: 6,
  },

  points: {
    color: '#fff',
    fontWeight: '700',
  },

  question: {
    textAlign: 'center',
    marginTop: 60,
    fontSize: 18,
    fontFamily: Fonts.medium,
    fontWeight: '500',
    paddingHorizontal: 30,
  },

  answerRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginTop: 25,
  },

  answerBtn: {
    paddingHorizontal: 35,
    paddingVertical: 5,
    borderRadius: 12,
  },

  answerText: {
    color: '#fff',
    fontSize: 16,

    fontFamily: Fonts.semiBold,
  },
  joinWrapper: {
    alignItems: 'center',
    marginTop: -20,
    zIndex: 10,
  },

  joinGradient: {
    paddingHorizontal: 110,
    paddingVertical: 14,
    borderRadius: 40,
    shadowColor: '#3F0D97',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    top: -40,
  },

  joinBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },

  // tokenCard:{
  //   marginHorizontal:20,
  //   padding:22,
  //   backgroundColor:"#fff",
  //   borderRadius:22,
  //   elevation:8,
  //   marginTop:-20
  // },

  tokenCard: {
    marginHorizontal: 20,
    padding: 22,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    elevation: 8,
    marginTop: -60,
  },

  downloadIcon: {
    width: 39,
    height: 39,
    borderRadius: 20,
    backgroundColor: '#F1F1F1',
    justifyContent: 'center',
    alignItems: 'center',
  },

  limit: {
    color: 'red',
    textAlign: 'center',
    fontSize: 13,
    fontFamily: Fonts.regular,
    marginTop: 10,
  },

  tokenTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    fontWeight: '600',
  },

  tokenAmount: {
    color: '#888',
    marginTop: 2,
    fontFamily: Fonts.regular,
  },

  whitePaper: {
    backgroundColor: '#6A35FF',
    padding: 14,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 20,
  },

  // Custom Wallet Button Styles
  connectWalletButton: {
    borderRadius: 15,
    overflow: 'hidden',
  },
  connectButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 15,
  },
  walletIcon: {
    marginRight: 8,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    fontWeight: '600',
  },
  connectedWalletContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  walletInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  connectedText: {
    color: '#4CAF50',
    fontSize: 14,
    fontFamily: Fonts.medium,
    marginLeft: 8,
  },
  addressText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: Fonts.regular,
    marginLeft: 12,
    opacity: 0.8,
  },
  disconnectButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
