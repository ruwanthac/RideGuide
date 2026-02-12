import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { Icon } from '../components';
import { useResponsive } from '../hooks';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const { fontSizes, scale } = useResponsive();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const subtitleAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Logo: fade in + scale
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Title: staggered fade
    Animated.sequence([
      Animated.delay(300),
      Animated.timing(titleAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();

    // Subtitle: fade after title
    Animated.sequence([
      Animated.delay(500),
      Animated.timing(subtitleAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();

    // Progress bar fill
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 2200,
      useNativeDriver: false,
      easing: Easing.inOut(Easing.ease),
    }).start();

    // Subtle pulse on icon
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1200,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ]),
      { iterations: -1 }
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  useEffect(() => {
    const timer = setTimeout(onFinish, 2500);
    return () => clearTimeout(timer);
  }, [onFinish]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 40,
        },
        content: {
          alignItems: 'center',
        },
        iconWrapper: {
          marginBottom: scale(32),
        },
        title: {
          fontSize: fontSizes.xxl,
          fontWeight: '600',
          color: '#111827',
          letterSpacing: -0.5,
          textAlign: 'center',
        },
        subtitle: {
          fontSize: fontSizes.sm,
          fontWeight: '400',
          color: '#6B7280',
          marginTop: scale(8),
          letterSpacing: 0.2,
        },
        progressContainer: {
          position: 'absolute',
          bottom: scale(80),
          left: scale(48),
          right: scale(48),
          height: 2,
          backgroundColor: '#F3F4F6',
          borderRadius: 1,
          overflow: 'hidden',
        },
        progressBar: {
          height: '100%',
          backgroundColor: '#2563EB',
          borderRadius: 1,
        },
      }),
    [fontSizes, scale]
  );

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.iconWrapper,
            {
              opacity: fadeAnim,
              transform: [
                { scale: Animated.multiply(scaleAnim, pulseAnim) },
              ],
            },
          ]}
        >
          <Icon
            name="car"
            size={scale(56)}
            color="#2563EB"
          />
        </Animated.View>

        <Animated.Text style={[styles.title, { opacity: titleAnim }]}>
          AI Vehicle Diagnosis
        </Animated.Text>
        <Animated.Text style={[styles.subtitle, { opacity: subtitleAnim }]}>
          Smart assistance for your vehicle
        </Animated.Text>
      </View>

      <View style={styles.progressContainer}>
        <Animated.View
          style={[styles.progressBar, { width: progressWidth }]}
        />
      </View>
    </View>
  );
};
