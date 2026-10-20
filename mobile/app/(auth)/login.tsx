import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { useAuth } from '../../src/hooks/useAuth';
import { GoogleButton } from '../../src/components/GoogleButton';
import { useGoogleSignIn } from '../../src/hooks/useGoogleSignIn';
import { GoogleConfigModal } from '../../src/components/GoogleConfigModal';

const HarryLogo = require('../../assets/harry-logo.png');
const { width } = Dimensions.get('window');

// ─── Componente de campo inline premium ───────────────────────────────────────
interface FieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences';
  autoComplete?: string;
}

function Field({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  const [showPass, setShowPass] = useState(false);

  return (
    <View style={[fieldStyles.wrapper, focused && fieldStyles.wrapperFocused]}>
      <Text style={fieldStyles.label}>{label}</Text>
      <View style={fieldStyles.row}>
        <TextInput
          style={fieldStyles.input}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !showPass}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCorrect={false}
        />
        {secureTextEntry ? (
          <TouchableOpacity
            style={fieldStyles.eyeBtn}
            onPress={() => setShowPass(!showPass)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={fieldStyles.eyeIcon}>{showPass ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    marginBottom: 14,
  },
  wrapperFocused: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(10,132,255,0.06)',
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: 16,
    padding: 0,
    margin: 0,
  },
  eyeBtn: {
    paddingLeft: 8,
  },
  eyeIcon: {
    fontSize: 16,
  },
});

// ─── Tela de Login ─────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoggingIn } = useAuth();
  const google = useGoogleSignIn();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    setErrorMessage('');
    if (!email.trim() || !password) {
      setErrorMessage('Preencha seu email e senha');
      return;
    }

    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();

    try {
      await login({ email: email.trim().toLowerCase(), password });
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setErrorMessage(
        Array.isArray(msg) ? msg[0] : msg || 'Email ou senha incorretos. Tente novamente.',
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', default: 'height' })}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero ── */}
          <View style={styles.hero}>
            <View style={styles.logoWrapper}>
              <Image source={HarryLogo} style={styles.logoImage} resizeMode="contain" />
            </View>
            <Text style={styles.brand}>Harry</Text>
            <Text style={styles.tagline}>
              Finanças e rotina compartilhadas,{'\n'}conectadas ao assistente Harry.
            </Text>
          </View>

          {/* ── Card de login ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Entrar na sua conta</Text>

            {errorMessage || google.error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorText}>{errorMessage || google.error}</Text>
              </View>
            ) : null}

            {/* Botão de Login com Google */}
            <GoogleButton
              title="Continuar com o Google"
              onPress={google.signIn}
              isLoading={google.isLoading}
            />
            {google.error ? (
              <TouchableOpacity
                onPress={() => google.setShowConfigModal(true)}
                style={{ marginTop: 10, alignItems: "center" }}
                activeOpacity={0.7}
              >
                <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: "600", textDecorationLine: "underline" }}>
                  🔑 Entrar com conta de teste / simulação
                </Text>
              </TouchableOpacity>
            ) : null}

            {/* Divisor */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou entrar com e-mail</Text>
              <View style={styles.dividerLine} />
            </View>

            <Field
              label="Email"
              placeholder="seu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <Field
              label="Senha"
              placeholder="Sua senha"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            {/* Esqueci minha senha */}
            <View style={styles.forgotRow}>
              <TouchableOpacity
                onPress={() => router.push('/(auth)/forgot-password')}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotText}>Esqueceu sua senha?</Text>
              </TouchableOpacity>
            </View>

            <Animated.View style={{ transform: [{ scale: scaleAnim }], marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.primaryBtn, isLoggingIn && styles.primaryBtnDisabled]}
                onPress={handleLogin}
                disabled={isLoggingIn}
                activeOpacity={0.85}
              >
                {isLoggingIn ? (
                  <Text style={styles.primaryBtnText}>Entrando…</Text>
                ) : (
                  <Text style={styles.primaryBtnText}>Entrar no Harry →</Text>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* divisor para criar conta */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>não tem uma conta?</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => router.push('/(auth)/register')}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryBtnText}>Criar nova conta</Text>
            </TouchableOpacity>
          </View>

          {/* ── Rodapé ── */}
          <Text style={styles.legalText}>
            Ao continuar, você concorda com os{' '}
            <Text style={styles.legalLink}>Termos de Uso</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <GoogleConfigModal
        visible={google.showConfigModal}
        onClose={() => google.setShowConfigModal(false)}
        onDevLogin={google.signInWithDevAccount}
        isLoading={google.isLoading}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    justifyContent: 'center',
  },

  // Hero
  hero: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoWrapper: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  logoImage: {
    width: 62,
    height: 62,
    borderRadius: 16,
  },
  brand: {
    color: Colors.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 6,
  },
  tagline: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  cardTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 18,
    letterSpacing: -0.3,
  },

  // Erro
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dangerMuted,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.2)',
  },
  errorIcon: {
    fontSize: 14,
  },
  errorText: {
    flex: 1,
    color: Colors.danger,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },

  // Esqueci minha senha
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: -4,
    marginBottom: 16,
  },
  forgotText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },

  // Botão primário
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  // Divisor
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },

  // Botão secundário
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceCard,
  },
  secondaryBtnText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },

  // Rodapé legal
  legalText: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  legalLink: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
