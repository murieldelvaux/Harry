import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { useHousehold } from '../../src/hooks/useHousehold';

export default function JoinHouseholdScreen() {
  const router = useRouter();
  const { createHousehold, isCreating, joinHousehold, isJoining } = useHousehold();

  const [inviteCode, setInviteCode] = useState('');
  const [houseName, setHouseName] = useState('Nossa Casa');
  const [activeTab, setActiveTab] = useState<'CREATE' | 'JOIN'>('CREATE');
  const [errorMessage, setErrorMessage] = useState('');

  const handleCreate = async () => {
    setErrorMessage('');
    try {
      await createHousehold({ name: houseName.trim() || 'Nossa Casa' });
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Erro ao criar espaço');
    }
  };

  const handleJoin = async () => {
    setErrorMessage('');
    if (!inviteCode) {
      setErrorMessage('Informe o código de convite enviado pelo seu parceiro(a)');
      return;
    }

    try {
      await joinHousehold({ inviteCode: inviteCode.trim().toUpperCase() });
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Código de convite inválido ou expirado');
    }
  };

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.badgeEmoji}>🏠</Text>
            <Text style={styles.title}>Espaço Compartilhado</Text>
            <Text style={styles.subtitle}>
              Conecte-se com outras pessoas para compartilhar gastos, contas e metas.
            </Text>
          </View>

          {/* Toggle Tabs */}
          <View style={styles.tabContainer}>
            <Button
              title="Criar Novo Espaço"
              variant={activeTab === 'CREATE' ? 'primary' : 'ghost'}
              onPress={() => {
                setActiveTab('CREATE');
                setErrorMessage('');
              }}
              style={styles.tabButton}
            />
            <Button
              title="Entrar com Código"
              variant={activeTab === 'JOIN' ? 'primary' : 'ghost'}
              onPress={() => {
                setActiveTab('JOIN');
                setErrorMessage('');
              }}
              style={styles.tabButton}
            />
          </View>

          <View style={styles.card}>
            {errorMessage ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {activeTab === 'CREATE' ? (
              <>
                <Text style={styles.tabHeading}>Criar espaço</Text>
                <Text style={styles.tabSubheading}>
                  Um código exclusivo será gerado para outras pessoas entrarem no mesmo espaço.
                </Text>

                <Input
                  label="Nome do Espaço"
                  placeholder="Ex: Casa Muriel & Lucas"
                  value={houseName}
                  onChangeText={setHouseName}
                />

                <Button
                  title="Criar Espaço"
                  onPress={handleCreate}
                  isLoading={isCreating}
                  style={styles.actionButton}
                />
              </>
            ) : (
              <>
                <Text style={styles.tabHeading}>Entrar com código recebido</Text>
                <Text style={styles.tabSubheading}>
                  Digite o código que seu parceiro(a) gerou no app dele.
                </Text>

                <Input
                  label="Código de Convite"
                  placeholder="Ex: HARRY-7X8K"
                  autoCapitalize="characters"
                  value={inviteCode}
                  onChangeText={setInviteCode}
                />

                <Button
                  title="Conectar a um Espaço"
                  onPress={handleJoin}
                  isLoading={isJoining}
                  style={styles.actionButton}
                />
              </>
            )}
          </View>

          <Button
            title="Configurar depois (usar individual)"
            variant="ghost"
            onPress={handleSkip}
            style={styles.skipButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  badgeEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
    maxWidth: 300,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    padding: 4,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
  },
  card: {
    backgroundColor: Colors.surface,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabHeading: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  tabSubheading: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 18,
  },
  errorContainer: {
    backgroundColor: Colors.dangerMuted,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  actionButton: {
    marginTop: 8,
  },
  skipButton: {
    marginTop: 20,
  },
});
