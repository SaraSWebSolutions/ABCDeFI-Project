import { useWindowDimensions, PixelRatio } from "react-native";

export const useResponsive = () => {
  const { width, height } = useWindowDimensions();

  // width percentage
  const wp = (percent: number) => {
    return (width * percent) / 100;
  };

  // height percentage
  const hp = (percent: number) => {
    return (height * percent) / 100;
  };

  // responsive font
  const font = (size: number) => {
    const scale = width / 375;
    return Math.round(PixelRatio.roundToNearestPixel(size * scale));
  };

  // border radius
  const radius = (size: number) => {
    return wp(size);
  };

  // spacing
  const space = (size: number) => {
    return wp(size);
  };

  // detect device size
  const isSmallDevice = width < 360;
  const isTablet = width >= 768;
  const isFold = width >= 600 && width < 768;

  return {
    width,
    height,
    wp,
    hp,
    font,
    radius,
    space,
    isSmallDevice,
    isTablet,
    isFold
  };
};