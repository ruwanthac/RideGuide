import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Icon } from '../components';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';

const RINGTONE_SOURCE = require('../../assets/call.mp3');

interface VideoCallScreenProps {
  onEndCall: () => void;
}

export const VideoCallScreen: React.FC<VideoCallScreenProps> = ({ onEndCall }) => {
  const { spacing, fontSizes, scale } = useResponsive();
  const [status, setStatus] = useState<'calling' | 'connecting' | 'connected'>('calling');
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('back');
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const [permission, requestPermission] = useCameraPermissions();

  const toggleCamera = () => {
    setCameraFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  };

  const ringtonePlayer = useAudioPlayer(RINGTONE_SOURCE);

  useEffect(() => {
    const setupAudio = async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true });
      } catch {
        // Ignore
      }
    };
    setupAudio();
  }, []);

  const safePause = () => {
    try {
      ringtonePlayer.pause();
    } catch {
      // Native object may already be released on unmount
    }
  };

  useEffect(() => {
    if (status === 'calling') {
      ringtonePlayer.loop = true;
      ringtonePlayer.play();
    } else {
      safePause();
    }
    return () => safePause();
  }, [status]);

  useEffect(() => {
    if (status === 'calling') {
      const timer = setTimeout(() => {
        setStatus('connecting');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  useEffect(() => {
    if (status === 'connecting') {
      const timer = setTimeout(() => setStatus('connected'), 2500);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const handleEndCall = () => {
    safePause();
    onEndCall();
  };

  useEffect(() => {
    requestPermission();
  }, []);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      { iterations: -1 }
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const statusText =
    status === 'calling' ? 'Calling...' : status === 'connecting' ? 'Connecting...' : 'Connected';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: '#1a1a2e',
        },
        remoteVideo: {
          flex: 1,
          backgroundColor: '#16213e',
          overflow: 'hidden',
        },
        camera: {
          flex: 1,
        },
        remotePlaceholder: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
        avatarLarge: {
          width: scale(100),
          height: scale(100),
          borderRadius: scale(50),
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.md,
        },
        remoteName: {
          fontSize: fontSizes.xl,
          fontWeight: '600',
          color: '#FFFFFF',
        },
        localLabel: {
          fontSize: fontSizes.xs,
          color: 'rgba(255,255,255,0.8)',
          marginTop: spacing.xs,
        },
        enableCameraButton: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: spacing.lg,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.primary,
          borderRadius: 12,
        },
        statusBar: {
          position: 'absolute',
          top: spacing.xl * 2,
          left: 0,
          right: 0,
          alignItems: 'center',
        },
        statusText: {
          fontSize: fontSizes.lg,
          fontWeight: '600',
          color: '#FFFFFF',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          backgroundColor: 'rgba(0,0,0,0.4)',
          borderRadius: 20,
        },
        controls: {
          position: 'absolute',
          bottom: spacing.xl * 3,
          left: 0,
          right: 0,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
        },
        controlButton: {
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: 'rgba(255,255,255,0.2)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        endCallButton: {
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: '#DC2626',
          alignItems: 'center',
          justifyContent: 'center',
        },
      }),
    [spacing, fontSizes, scale]
  );

  const showCamera = permission?.granted;

  return (
    <View style={styles.container}>
      <View style={styles.remoteVideo}>
        {showCamera ? (
          <CameraView style={styles.camera} facing={cameraFacing} />
        ) : (
          <View style={styles.remotePlaceholder}>
            <Animated.View
              style={[
                styles.avatarLarge,
                { transform: [{ scale: status === 'calling' ? pulseAnim : 1 }] },
              ]}
            >
              <Icon name="person" size={scale(50)} color="#FFFFFF" />
            </Animated.View>
            <Text style={styles.remoteName}>Vehicle Expert</Text>
            {!permission?.granted && (
              <TouchableOpacity
                style={styles.enableCameraButton}
                onPress={requestPermission}
                activeOpacity={0.8}
              >
                <Icon name="camera" size={24} color="#FFFFFF" />
                <Text
                  style={StyleSheet.flatten([
                    styles.remoteName,
                    { marginLeft: spacing.sm, fontSize: fontSizes.md },
                  ])}
                >
                  Enable Camera
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <View style={styles.statusBar}>
        <Text style={styles.statusText}>{statusText}</Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, { marginRight: spacing.xl }]}
          activeOpacity={0.7}
        >
          <Icon name="mic" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.endCallButton}
          onPress={handleEndCall}
          activeOpacity={0.7}
        >
          <Icon name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.controlButton, { marginLeft: spacing.xl }]}
          onPress={toggleCamera}
          activeOpacity={0.7}
          disabled={!showCamera}
        >
          <Icon name="camera-reverse" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
};
