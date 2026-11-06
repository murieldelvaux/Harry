import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export interface PartnerOption {
  id: string;
  name: string;
  email?: string;
}

interface PartnerSelectProps {
  label?: string;
  members: PartnerOption[];
  selectedUserId: string;
  currentUserId?: string;
  onSelect: (userId: string) => void;
  testID?: string;
}

export function PartnerSelect({
  label = 'Quem pagou esta conta?',
  members,
  selectedUserId,
  currentUserId,
  onSelect,
  testID = 'partner-select',
}: PartnerSelectProps) {
  const { theme } = useTheme();

  if (!members || members.length === 0) return null;

  return (
    <View style={styles.container} testID={testID}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <View style={styles.optionsRow}>
        {members.map((member) => {
          const isSelected = selectedUserId === member.id;
          const isMe = currentUserId === member.id;
          const firstName = member.name ? member.name.split(' ')[0] : 'Parceiro';
          return (
            <TouchableOpacity
              key={member.id}
              testID={`${testID}-option-${member.id}`}
              accessibilityLabel={`Pago por ${member.name}`}
              style={[
                styles.optionBtn,
                {
                  backgroundColor: isSelected ? theme.primaryLight : theme.surfaceSubtle,
                  borderColor: isSelected ? theme.primary : theme.border,
                },
              ]}
              onPress={() => onSelect(member.id)}
              activeOpacity={0.75}
            >
              <View
                style={[
                  styles.avatarMini,
                  { backgroundColor: isSelected ? theme.primary : theme.border },
                ]}
              >
                <Text style={styles.avatarMiniText}>
                  {firstName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.optionName,
                    {
                      color: isSelected ? theme.primary : theme.textPrimary,
                      fontWeight: isSelected ? '800' : '600',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {firstName} {isMe ? '(Você)' : ''}
                </Text>
                <Text
                  style={[styles.optionSub, { color: theme.textMuted }]}
                  numberOfLines={1}
                >
                  {isSelected ? '✓ Pagador selecionado' : 'Selecionar pagador'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  optionBtn: {
    flex: 1,
    minWidth: 135,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  avatarMini: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarMiniText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  optionName: {
    fontSize: 13,
  },
  optionSub: {
    fontSize: 10.5,
    marginTop: 1,
  },
});

