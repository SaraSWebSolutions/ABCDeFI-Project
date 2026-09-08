import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import LinearGradient from 'react-native-linear-gradient';
import { useResponsive } from "../Utils/Responsive";
import Fonts from "../Utils/Fonts";
interface Props {
  title: string;
  onPress: () => void;
}

export const GradientButton: React.FC<Props> = ({
  title,
  onPress,
}) => {

  const { hp,wp, font, radius } = useResponsive();

  return (
    <TouchableOpacity onPress={onPress}>
      <LinearGradient
        colors={["#7131E7", "#7131E7"]}
        style={[
          styles.button,
          {
            height: hp(7),
            width:wp(90),
            borderRadius: radius(3),
          },
        ]}
      >
        <Text
          style={[
            styles.text,
            { fontSize: font(16) },
          ]}
        >
          {title}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    justifyContent: "center",
    alignItems: "center",
  },

  text: {
    color: "#fff",
    fontWeight: "700",
     fontSize:16,
    fontFamily:Fonts.bold,
  },
});