import React from 'react';
import { View, StyleSheet } from 'react-native';

/** Small notification dot for unread job chat (top-right of parent; parent should be `position: 'relative'`). */
export function UnreadRedDot({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return <View style={styles.dot} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
});
