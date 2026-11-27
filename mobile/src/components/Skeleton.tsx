import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface SkeletonBlockProps {
  width?: number | `${number}%` | 'auto';
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const SkeletonBlock: React.FC<SkeletonBlockProps> = ({
  width = '100%',
  height = 14,
  borderRadius = 8,
  style,
  testID,
}) => {
  const { isDark } = useTheme();
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const useNativeDriver = Platform.OS !== 'web';
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          isInteraction: false,
          useNativeDriver,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          isInteraction: false,
          useNativeDriver,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      testID={testID}
      accessibilityRole="progressbar"
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: isDark ? '#263244' : '#E2E8F0',
          opacity,
        },
        style,
      ]}
    />
  );
};

interface SkeletonCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  children,
  style,
  testID,
}) => {
  const { theme } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

interface SkeletonListRowProps {
  showRightValue?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const SkeletonListRow: React.FC<SkeletonListRowProps> = ({
  showRightValue = true,
  style,
  testID,
}) => {
  const { theme } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.rowCard,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
        style,
      ]}
    >
      <SkeletonBlock width={40} height={40} borderRadius={12} />
      <View style={styles.rowCenter}>
        <SkeletonBlock width="68%" height={14} borderRadius={6} />
        <SkeletonBlock width="44%" height={11} borderRadius={6} />
      </View>
      {showRightValue && <SkeletonBlock width={68} height={16} borderRadius={6} />}
    </View>
  );
};

interface SkeletonPillProps {
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export const SkeletonPill: React.FC<SkeletonPillProps> = ({
  width = 110,
  height = 32,
  style,
}) => (
  <SkeletonBlock width={width} height={height} borderRadius={999} style={style} />
);

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  rowCenter: {
    flex: 1,
    gap: 8,
  },
});
