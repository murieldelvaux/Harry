import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface ScopeBadgeProps {
  scope: 'PRIVATE' | 'SHARED';
  authorName?: string;
  isPartnerPrivate?: boolean;
}

export const ScopeBadge: React.FC<ScopeBadgeProps> = ({ scope, authorName, isPartnerPrivate }) => {
  const { theme } = useTheme();
  const isShared = scope === 'SHARED';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: isShared
            ? theme.tagSharedBg
            : isPartnerPrivate
            ? 'rgba(139, 92, 246, 0.15)'
            : theme.tagPrivateBg,
        },
      ]}
    >
      <Text
        style={[
          styles.icon,
          {
            color: isShared
              ? theme.tagSharedText
              : isPartnerPrivate
              ? '#8B5CF6'
              : theme.tagPrivateText,
          },
        ]}
      >
        {isShared ? '🏠' : isPartnerPrivate ? '👁️' : '🔒'}
      </Text>
      <Text
        style={[
          styles.text,
          {
            color: isShared
              ? theme.tagSharedText
              : isPartnerPrivate
              ? '#8B5CF6'
              : theme.tagPrivateText,
          },
        ]}
      >
        {isShared
          ? `Casa${authorName ? ` (${authorName})` : ''}`
          : isPartnerPrivate
          ? `Pessoal (${authorName || 'Par'})`
          : 'Pessoal'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  icon: {
    fontSize: 11,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
});
