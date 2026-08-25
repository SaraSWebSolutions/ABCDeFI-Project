import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

//import HomeScreen from "../HomeScreen";
import IcoScreen from "../Screens/BottomTab/IcoScreen";
import AIScreen from "../Screens/BottomTab/AI59cScreen";
import NFTScreen from "../Screens/BottomTab/NFTScreen";
import HomeScreen from "../Screens/BottomTab/HomeScreen";
import FinanceScreen from "../Screens/BottomTab/FinanceScreen";
import PortfolioScreen from "../Screens/BottomTab/PortfolioScreen";
import { CustomTabBar } from "./CustomTabBar";

const Tab = createBottomTabNavigator();

export const BottomTabs = () => {

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >

      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="ICO" component={IcoScreen} />
      <Tab.Screen name="Finance" component={FinanceScreen} />
      <Tab.Screen name="Portfolio" component={PortfolioScreen} />
      <Tab.Screen name="NFT" component={NFTScreen} />
      <Tab.Screen name="AIScreen" component={AIScreen} />

    </Tab.Navigator>
  );
};