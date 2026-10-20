import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { useAuth } from '../../src/hooks/useAuth';
import { GoogleButton } from '../../src/components/GoogleButton';
import { useGoogleSignIn } from '../../src/hooks/useGoogleSignIn';
import { GoogleConfigModal } from '../../src/components/GoogleConfigModal';
import { applyMask, MaskType } from '../../src/utils/masks';

// ─── Campo premium reutilizável ───────────────────────────────────────────────
interface FieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  hint?: string;
  mask?: MaskType;
  maxLength?: number;
}

function Field({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  hint,
  mask,
  maxLength,
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleTextChange = (text: string) => {
    if (mask) {
      onChangeText(applyMask(text, mask));
    } else {
      onChangeText(text);
    }
  };

  let resolvedKeyboardType = keyboardType;
  let resolvedMaxLength = maxLength;

  if (mask === 'phone') {
    resolvedKeyboardType = keyboardType === 'default' ? 'phone-pad' : keyboardType;
    resolvedMaxLength = maxLength || 19;
  }

  return (
    <View style={{ marginBottom: 12 }}>
      <View style={[fieldStyles.wrapper, focused && fieldStyles.wrapperFocused]}>
        <Text style={fieldStyles.label}>{label}</Text>
        <View style={fieldStyles.row}>
          <TextInput
            style={fieldStyles.input}
            placeholder={placeholder}
            placeholderTextColor={Colors.textMuted}
            value={value}
            onChangeText={handleTextChange}
            secureTextEntry={secureTextEntry && !showPass}
            keyboardType={resolvedKeyboardType}
            maxLength={resolvedMaxLength}
            autoCapitalize={autoCapitalize}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoCorrect={false}
          />
          {secureTextEntry && (
            <TouchableOpacity onPress={() => setShowPass(!showPass)} style={fieldStyles.eyeBtn}>
              <Text style={fieldStyles.eyeIcon}>{showPass ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {hint ? <Text style={fieldStyles.hint}>{hint}</Text> : null}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: Colors.inputBg,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  wrapperFocused: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(10,132,255,0.05)',
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
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
    fontWeight: '500',
    padding: 0,
    margin: 0,
  },
  eyeBtn: {
    paddingLeft: 8,
  },
  eyeIcon: {
    fontSize: 16,
  },
  hint: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
    lineHeight: 16,
  },
});

// ─── Indicador de força de senha ──────────────────────────────────────────────
function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  const len = password.length;
  const hasUpper = /[A-Z]/.test(password);
  const hasNum = /[0-9]/.test(password);
  const score = (len >= 8 ? 1 : 0) + (len >= 12 ? 1 : 0) + (hasUpper ? 1 : 0) + (hasNum ? 1 : 0);

  const levels = [
    { label: 'Fraca', color: Colors.danger },
    { label: 'Razoável', color: Colors.warning },
    { label: 'Boa', color: Colors.warning },
    { label: 'Forte', color: Colors.success },
    { label: 'Excelente', color: Colors.success },
  ];
  const current = levels[Math.min(score, 4)];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, paddingHorizontal: 4 }}>
      {levels.map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            backgroundColor: i <= score - 1 ? current.color : Colors.border,
          }}
        />
      ))}
      <Text style={{ color: current.color, fontSize: 11, fontWeight: '700', minWidth: 56, textAlign: 'right' }}>
        {current.label}
      </Text>
    </View>
  );
}

// ─── Tela de Cadastro ─────────────────────────────────────────────────────────
export default function RegisterScreen() {
  const router = useRouter();
  const { register, isRegistering } = useAuth();
  const google = useGoogleSignIn();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleRegister = async () => {
    setErrorMessage('');

    if (!name.trim()) {
      setErrorMessage('Informe seu nome');
      return;
    }
    if (!email.trim()) {
      setErrorMessage('Informe seu email');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();

    try {
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phoneNumber: phoneNumber.trim() || undefined,
        password,
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setErrorMessage(
        Array.isArray(msg) ? msg[0] : msg || 'Erro ao criar conta. Verifique os dados.',
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
          {/* ── Header ── */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.backBtnText}>← Voltar</Text>
            </TouchableOpacity>

            <View style={styles.titleRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepText}>1</Text>
              </View>
              <View>
                <Text style={styles.title}>Criar sua conta</Text>
                <Text style={styles.subtitle}>Gestão inteligente e compartilhada com o Harry 🪄</Text>
              </View>
            </View>
          </View>

          {/* ── Card principal ── */}
          <View style={styles.card}>
            {errorMessage || google.error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorText}>{errorMessage || google.error}</Text>
              </View>
            ) : null}

            {/* Cadastro com Google */}
            <GoogleButton
              title="Cadastrar com o Google"
              onPress={google.signIn}
              isLoading={google.isLoading}
            />

            {/* Divisor */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou cadastre com seu e-mail</Text>
              <View style={styles.dividerLine} />
            </View>

            <Field
              label="Seu Nome"
              placeholder="Ex: Muriel"
              autoCapitalize="words"
              value={name}
              onChangeText={setName}
            />

            <Field
              label="Email"
              placeholder="seu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />

            <Field
              label="WhatsApp (com DDD)"
              placeholder="+55 11 99999-9999"
              mask="phone"
              autoCapitalize="none"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              hint="Opcional — para registrar gastos pelo WhatsApp"
            />

            <Field
              label="Senha (mínimo 6 caracteres)"
              placeholder="Crie uma senha segura"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <PasswordStrength password={password} />

            <Animated.View style={{ transform: [{ scale: scaleAnim }], marginTop: 4 }}>
              <TouchableOpacity
                style={[styles.primaryBtn, isRegistering && styles.primaryBtnDisabled]}
                onPress={handleRegister}
                disabled={isRegistering}
                activeOpacity={0.85}
              >
                {isRegistering ? (
                  <Text style={styles.primaryBtnText}>Criando conta…</Text>
                ) : (
                  <Text style={styles.primaryBtnText}>Criar conta e continuar →</Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* ── Info de próximos passos ── */}
          <View style={styles.stepsCard}>
            <Text style={styles.stepsTitle}>O que acontece a seguir</Text>
            {[
              { icon: '🏠', text: 'Criar ou entrar num lar compartilhado' },
              { icon: '📱', text: 'Conectar seu WhatsApp para registrar gastos' },
              { icon: '💸', text: 'Começar a organizar sua vida financeira' },
            ].map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <Text style={styles.stepRowIcon}>{step.icon}</Text>
                <Text style={styles.stepRowText}>{step.text}</Text>
              </View>
            ))}
          </View>

          {/* ── Login link ── */}
          <View style={styles.loginPrompt}>
            <Text style={styles.loginPromptText}>Já tem uma conta? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.loginPromptLink}>Entrar</Text>
            </TouchableOpacity>
          </View>
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
    paddingTop: 16,
    paddingBottom: 32,
  },

  // Header
  header: {
    marginBottom: 20,
  },
  backBtn: {
    marginBottom: 16,
  },
  backBtnText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stepBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: 'rgba(10,132,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  title: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginTop: 2,
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

  // Card de próximos passos
  stepsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    marginBottom: 20,
  },
  stepsTitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  stepRowIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  stepRowText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },

  // Login prompt
  loginPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginPromptText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  loginPromptLink: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
