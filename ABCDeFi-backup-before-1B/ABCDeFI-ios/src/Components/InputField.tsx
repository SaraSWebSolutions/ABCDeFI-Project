import React, { useState } from "react";
import { View, TextInput, StyleSheet, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/Feather";

import { Colors } from "../Utils/Colors";
import { useResponsive } from "../Utils/Responsive";
import Fonts from "../Utils/Fonts";

interface Props {
  value: string;
  placeholder: string;
  secure?: boolean;
  leftIcon?: string;
  onChange: (text: string) => void;
  editable:boolean;
  inputStyle: any
}

export const InputField: React.FC<Props> = ({
  value,
  placeholder,
  secure,
  leftIcon,
  onChange,
  editable,
  inputStyle,
}) => {

  const { hp, wp, radius } = useResponsive();

  const [hidePassword, setHidePassword] = useState(secure);
  const [focused, setFocused] = useState(false);

  return (

    <View style={styles.container}>

      <View
        style={[
          styles.inputContainer,
          {
            height: hp(7),
            width: wp(90),
            borderRadius: radius(3),
            paddingHorizontal: wp(4),
            borderColor: focused ? Colors.primary : Colors.border,
          },
          inputStyle,
        ]}
      >

        {/* Left Icon */}
        {leftIcon && (
          <Icon
            name={leftIcon}
            size={20}
            color={focused ? Colors.primary : "#777"}
            style={styles.leftIcon}
          />
        )}

        <TextInput
          value={value}
          placeholder={placeholder}
          placeholderTextColor={'#888'}
          secureTextEntry={hidePassword}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.input}
          editable={editable}
        />

        {/* Password Eye */}
        {secure && (
          <TouchableOpacity
            onPress={() => setHidePassword(!hidePassword)}
          >
            <Icon
              name={hidePassword ? "eye-off" : "eye"}
              size={20}
              color={focused ? Colors.primary : "#777"}
            />
          </TouchableOpacity>
        )}

      </View>

    </View>

  );
};

const styles = StyleSheet.create({

  container: {
    marginVertical: 4,
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
  },

  input: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    flex: 1,
    color:'black'
  },

  leftIcon: {
    marginRight: 10,
  },

});