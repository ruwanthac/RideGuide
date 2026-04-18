import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';

export const TypingIndicator: React.FC = () => {
  const { spacing, borderRadius } = useResponsive();
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const a1 = animateDot(dot1, 0);
    const a2 = animateDot(dot2, 150);
    const a3 = animateDot(dot3, 300);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  const opacity1 = dot1.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const opacity2 = dot2.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const opacity3 = dot3.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });

  const styles = StyleSheet.create({
    container: {
      marginVertical: spacing.sm,
      alignItems: 'flex-start',
    },
    bubble: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      borderBottomLeftRadius: 4,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minWidth: 60,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.textSecondary,
      marginHorizontal: 2,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.bubble}>
        <Animated.View style={[styles.dot, { opacity: opacity1 }]} />
        <Animated.View style={[styles.dot, { opacity: opacity2 }]} />
        <Animated.View style={[styles.dot, { opacity: opacity3 }]} />
      </View>
    </View>
  );
};
