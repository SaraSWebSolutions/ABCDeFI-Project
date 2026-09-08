
import React from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Image,
} from "react-native";

import { useResponsive } from "../Utils/Responsive";
import { Colors } from "../Utils/Colors";
import Fonts from "../Utils/Fonts";
import Home from '../../assets/Icons/Home.svg';
import AI from '../../assets/Icons/AI.svg';
import ICO from '../../assets/Icons/ICO.svg';
import NFT from '../../assets/Icons/NFT.svg';
import Home_white from '../../assets/Icons/Home_white.svg';
import AI_white from '../../assets/Icons/AI_white.svg';
import ICO_white from '../../assets/Icons/ICO_white.svg';
import NFT_white from '../../assets/Icons/NFT_white.svg';

export const CustomTabBar = ({ state, navigation }: any) => {

  const { wp, hp, font, radius } = useResponsive();

 

  //  Return SVG COMPONENT (not require)
 const getIcon = (routeName: string, isFocused: boolean) => {
  switch (routeName) {
    case "Home":
      return isFocused ? Home_white : Home;

    case "ICO":
      return isFocused ? ICO_white : ICO;

    case "AIScreen":
      return isFocused ? AI_white : AI;

    case "NFT":
      return isFocused ? NFT_white : NFT;

    default:
      return isFocused ? Home_white : Home;
  }
};

  return (
    <View
      style={[
        styles.wrapper,
        {
          bottom: 0,
          left: 0,
          right: 0,
          //backgroundColor:'#FFF'
          
        },
      ]}
    >
      <View
        style={[
          styles.container,
          {
            // borderRadius: radius(5),
            //paddingVertical: hp(1.2),
            backgroundColor:'#FFF',
            borderTopLeftRadius:radius(5),
            borderTopRightRadius:radius(5)
          },
        ]}
      >
        {state.routes.map((route: any, index: number) => {

          const isFocused = state.index === index;

          const onPress = () => {
            navigation.navigate(route.name);
          };
          const IconComponent = getIcon(route.name,isFocused); //  get SVG

          return (
            <TouchableOpacity
              key={index}
              onPress={onPress}
              style={styles.tabItem}
            >

              {/* DROPLET SHAPE */}
              <View
                style={[
                  styles.iconContainer,
                  {
                    width: wp(12),
                    height: hp(6),
                    borderBottomRightRadius:radius(5),
                    borderBottomLeftRadius:radius(5),
                    // borderRadius: radius(5),
                  },
                  isFocused && styles.activeIcon
                ]}
              >
                 <IconComponent
                  width={wp(7)}
                  height={wp(7)}
                   
                //  fill={isFocused ? "#fff" : "#434246"} //  dynamic color
                />
              </View>

              {/* TEXT */}
              <Text
                style={{
                  marginTop: hp(0.5),
                  fontSize: font(12),
                  fontFamily: Fonts.medium,

                  color: isFocused?Colors.primary: "#434246",
                }}
              >
                {route.name === "AIScreen" ? "59C AI" : route.name}
              </Text>

            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({

  wrapper: {
    position: "absolute",
  },

  container: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#EFEFEF",
    elevation: 5,
  },

  tabItem: {
    alignItems: "center",
    justifyContent: "center",
  },

  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
  },

  activeIcon: {
    backgroundColor: Colors.primary,
    width: 55,
    height: 54,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    //marginTop: -20, // this creates the top droplet effect
  },
});