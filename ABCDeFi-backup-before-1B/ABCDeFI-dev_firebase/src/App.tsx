import React, { useEffect } from "react"
// this needs to be imported before anything else
import "@thirdweb-dev/react-native-adapter"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { NavigationContainer } from "@react-navigation/native"
import AppNavigator from "./Navigation/AppNavigator"
import { Provider } from "react-redux";
import { store } from "./Store/Store"
import { ThirdwebProvider, thirdwebClient } from "./Config/thirdwebConfig"
import { Loader } from "./Components/CommanLoader"
import { useAutoConnect } from "thirdweb/react"
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';

const queryClient = new QueryClient()

function AutoConnectHandler() {
  useAutoConnect({
    client: thirdwebClient,
  });
  return null;
}


export default function App() {
 useEffect(() => {
    async function createChannel() {
      await notifee.createChannel({
        id: 'default',
        name: 'Default Channel',
      });
    }

    createChannel();
  }, []);

  useEffect(() => {
    const initFCM = async () => {
      await messaging().registerDeviceForRemoteMessages();

      const token = await messaging().getToken();

      console.log('FCM TOKEN =>', token);
    };

    initFCM();
  }, []);

  useEffect(() => {
    const unsubscribe = messaging().onMessage(
      async remoteMessage => {
        console.log(
          'FCM RECEIVED =>',
          JSON.stringify(remoteMessage, null, 2),
        );

       await notifee.displayNotification({
  title: remoteMessage.notification?.title || 'Notification',
  body: remoteMessage.notification?.body || '',
  android: {
    channelId: 'default',
    smallIcon: 'appicon',
    pressAction: {
      id: 'default',
    },
  },
});
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe =
      messaging().onNotificationOpenedApp(
        remoteMessage => {
          console.log(
            'OPENED FROM BACKGROUND =>',
            JSON.stringify(
              remoteMessage,
              null,
              2,
            ),
          );
        },
      );

    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log(
            'OPENED FROM QUIT STATE =>',
            JSON.stringify(
              remoteMessage,
              null,
              2,
            ),
          );
        }
      });

    return unsubscribe;
  }, []);
  return (
    <SafeAreaProvider >
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <ThirdwebProvider>
            <AutoConnectHandler />
            <NavigationContainer>
              <AppNavigator />
              <Loader/>
            </NavigationContainer>
          </ThirdwebProvider>
        </QueryClientProvider>
      </Provider>
    </SafeAreaProvider>
  )
}
