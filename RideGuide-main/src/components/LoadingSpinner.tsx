import React from 'react';
import { View, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../constants/theme';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  style?: ViewStyle;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'large',
  style,
}) => (
  <View style={[styles.container, style]}>
    <ActivityIndicator size={size} color={colors.primary} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
