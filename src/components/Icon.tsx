import React from 'react';
import { StyleSheet, TextStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

export type IconName =
  | 'home'
  | 'document-text'
  | 'person'
  | 'construct'
  | 'camera'
  | 'camera-reverse'
  | 'chatbubble'
  | 'help-circle'
  | 'car'
  | 'map'
  | 'send'
  | 'star'
  | 'mic'
  | 'mic-off'
  | 'videocam'
  | 'call'
  | 'close'
  | 'image';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: TextStyle;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  color = '#111827',
  style,
}) => <Ionicons name={name} size={size} color={color} style={style} />;
