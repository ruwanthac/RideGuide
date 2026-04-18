import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

export type ScreenSize = 'small' | 'medium' | 'large';

export function useResponsive() {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const screenSize: ScreenSize =
      width < 375 ? 'small' : width < 428 ? 'medium' : 'large';

    const scale = (size: number) => (width / BASE_WIDTH) * size;
    const verticalScale = (size: number) => (height / BASE_HEIGHT) * size;
    const moderateScale = (size: number, factor = 0.5) =>
      size + (scale(size) - size) * factor;

    const spacing = {
      xs: Math.round(scale(4)),
      sm: Math.round(scale(8)),
      md: Math.round(scale(16)),
      lg: Math.round(scale(20)),
      xl: Math.round(scale(24)),
    };

    const fontSizes = {
      xs: Math.round(scale(12)),
      sm: Math.round(scale(14)),
      md: Math.round(scale(16)),
      lg: Math.round(scale(18)),
      xl: Math.round(scale(20)),
      xxl: Math.round(scale(24)),
      xxxl: Math.round(scale(28)),
    };

    const iconSizes = {
      sm: Math.round(scale(18)),
      md: Math.round(scale(24)),
      lg: Math.round(scale(32)),
      xl: Math.round(scale(48)),
    };

    const borderRadius = {
      sm: Math.round(scale(8)),
      md: Math.round(scale(12)),
      lg: Math.round(scale(16)),
      xl: Math.round(scale(24)),
    };

    const isSmallScreen = width < 375;
    const isLargeScreen = width >= 428;
    const isLandscape = width > height;

    const cardMinHeight = verticalScale(100);
    const inputHeight = Math.round(verticalScale(52));
    const buttonHeight = Math.round(verticalScale(52));

    return {
      width,
      height,
      screenSize,
      scale,
      verticalScale,
      moderateScale,
      spacing,
      fontSizes,
      iconSizes,
      borderRadius,
      isSmallScreen,
      isLargeScreen,
      isLandscape,
      cardMinHeight,
      inputHeight,
      buttonHeight,
    };
  }, [width, height]);
}
