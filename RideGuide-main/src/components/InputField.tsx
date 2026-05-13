import React, { useMemo, useEffect, useRef, useState } from 'react';
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps,
  type StyleProp,
  type ViewStyle,
  Animated,
} from 'react-native';
import { colors } from '../constants/theme';
import { useResponsive } from '../hooks';

interface InputFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  error,
  containerStyle,
  style,
  value = '',
  onFocus,
  onBlur,
  placeholder,
  ...props
}) => {
  // When label exists, it serves as floating placeholder - don't use separate placeholder
  const inputPlaceholder = label ? '' : placeholder;
  const { spacing, borderRadius, fontSizes, inputHeight } = useResponsive();
  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;
  const [focused, setFocused] = useState(false);

  const hasValue = !!value;
  const isFloating = hasValue || focused;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: isFloating ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFloating, animatedValue]);

  const handleFocus = (e: any) => {
    setFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setFocused(false);
    onBlur?.(e);
  };

  const labelTop = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(inputHeight / 2 + fontSizes.xs + 6)],
  });

  const labelFontSize = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [fontSizes.md, fontSizes.xs],
  });

  const labelColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.textSecondary, colors.primary],
  });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          marginBottom: spacing.md,
          overflow: 'hidden' as const,
          ...(label ? { paddingTop: 28 } : {}),
        },
        inputWrapper: {
          position: 'relative' as const,
          justifyContent: 'center',
        },
        input: {
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: borderRadius.lg,
          paddingHorizontal: spacing.lg,
          paddingTop: label ? 18 : spacing.md - 2,
          paddingBottom: spacing.md - 2,
          fontSize: fontSizes.md,
          color: colors.text,
          minHeight: inputHeight,
        },
        inputError: {
          borderColor: colors.error,
        },
        labelOuter: {
          position: 'absolute',
          left: spacing.lg,
          right: spacing.lg,
          top: 0,
          bottom: 0,
          pointerEvents: 'none',
          justifyContent: 'center',
        },
        error: {
          fontSize: fontSizes.xs,
          color: colors.error,
          marginTop: spacing.xs,
        },
      }),
    [spacing, borderRadius, fontSizes, inputHeight, label]
  );

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.inputWrapper}>
        <TextInput
          style={[styles.input, error && styles.inputError, style]}
          placeholder={inputPlaceholder}
          value={value}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor={colors.textSecondary}
          {...props}
        />
        {label ? (
          <Animated.View
            style={[
              styles.labelOuter,
              {
                transform: [{ translateY: labelTop }],
              },
            ]}
          >
            <Animated.Text
              numberOfLines={1}
              style={{
                fontSize: labelFontSize,
                fontWeight: '500',
                color: labelColor,
              }}
            >
              {label}
            </Animated.Text>
          </Animated.View>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};
