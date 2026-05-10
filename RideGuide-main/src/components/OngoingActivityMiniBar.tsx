import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';
import { useOngoingActivity } from '../context/OngoingActivityContext';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 49 : 56;

export const OngoingActivityMiniBar: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { spacing, fontSizes, borderRadius } = useResponsive();
  const { activity, focusedRouteName, navigateToActivity } = useOngoingActivity();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.03,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const hide =
    !activity ||
    focusedRouteName === activity.navigateScreen ||
    focusedRouteName === 'VideoCall' ||
    focusedRouteName === 'RequestChat';

  if (hide) return null;

  const bottomOffset = TAB_BAR_HEIGHT + Math.max(insets.bottom, spacing.xs);

  const iconName =
    activity.kind === 'roadside_owner' || activity.kind === 'mechanic' ? 'construct' : 'car';

  const styles = StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: spacing.md,
      right: spacing.md,
      bottom: bottomOffset,
      zIndex: 999,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.full,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(37,99,235,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    textBlock: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: fontSizes.sm,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: fontSizes.xs,
      color: colors.textSecondary,
      marginTop: 2,
    },
  });

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <TouchableOpacity
          style={styles.pill}
          activeOpacity={0.9}
          onPress={navigateToActivity}
        >
          <View style={styles.iconCircle}>
            <Icon name={iconName} size={20} color={colors.primary} />
          </View>
          <View style={styles.textBlock}>
            <Text style={styles.title} numberOfLines={1}>
              {activity.title}
            </Text>
            {activity.subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {activity.subtitle}
              </Text>
            ) : null}
          </View>
          <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};
