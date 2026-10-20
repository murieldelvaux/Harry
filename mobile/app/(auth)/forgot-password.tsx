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

// ─── Componente de campo inline ──────────────────────────────────────────────
interface FieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences';
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
  maxLength,
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
          maxLength={maxLength}
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
    marginBottom: 14,
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
});

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { forgotPassword, resetPassword, isForgotPasswordLoading, isResetPasswordLoading } = useAuth();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Estados do fluxo
  const [step, setStep] = useState<'request' | 'reset' | 'success'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const animateButton = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const handleRequestCode = async () => {
    setErrorMessage('');
    if (!email.trim()) {
      setErrorMessage('Informe seu e-mail cadastrado');
      return;
    }

    animateButton();

    try {
      const res = await forgotPassword({ email: email.trim().toLowerCase() });
      setInfoMessage(res.message);
      if (res.devCode) {
        setCode(res.devCode); // Preenche automaticamente para testes locais rápidos
      }
      setStep('reset');
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setErrorMessage(
        Array.isArray(msg) ? msg[0] : msg || 'Não foi possível enviar o e-mail. Tente novamente.',
      );
    }
  };

  const handleResetPassword = async () => {
    setErrorMessage('');

    if (!code.trim() || code.trim().length < 4) {
      setErrorMessage('Informe o código de verificação recebido');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('A nova senha deve ter no mínimo 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('As senhas digitadas não coincidem');
      return;
    }

    animateButton();

    try {
      await resetPassword({
        email: email.trim().toLowerCase(),
        code: code.trim(),
        newPassword,
      });
      setStep('success');
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setErrorMessage(
        Array.isArray(msg) ? msg[0] : msg || 'Código inválido ou expirado. Tente novamente.',
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
          {/* Header */}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.backBtnText}>← Voltar para Login</Text>
          </TouchableOpacity>

          <View style={styles.card}>
            {step === 'request' && (
              <>
                <View style={styles.iconCircle}>
                  <Text style={styles.iconText}>🔑</Text>
                </View>

                <Text style={styles.title}>Esqueceu sua senha?</Text>
                <Text style={styles.subtitle}>
                  Sem problemas! Digite seu e-mail cadastrado e enviaremos um código de 6 dígitos para você criar uma nova senha.
                </Text>

                {errorMessage ? (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorIcon}>⚠️</Text>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                ) : null}

                <Field
                  label="Seu Email"
                  placeholder="seu@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />

                <Animated.View style={{ transform: [{ scale: scaleAnim }], marginTop: 6 }}>
                  <TouchableOpacity
                    style={[styles.primaryBtn, isForgotPasswordLoading && styles.btnDisabled]}
                    onPress={handleRequestCode}
                    disabled={isForgotPasswordLoading}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.primaryBtnText}>
                      {isForgotPasswordLoading ? 'Enviando código...' : 'Enviar Código por E-mail →'}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              </>
            )}

            {step === 'reset' && (
              <>
                <View style={styles.iconCircle}>
                  <Text style={styles.iconText}>✉️</Text>
                </View>

                <Text style={styles.title}>Redefinir Senha</Text>
                <Text style={styles.subtitle}>
                  Enviamos o código de segurança para <Text style={{ color: Colors.primary, fontWeight: '700' }}>{email}</Text>.
                </Text>

                {errorMessage ? (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorIcon}>⚠️</Text>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                ) : null}

                {infoMessage ? (
                  <View style={styles.infoBanner}>
                    <Text style={styles.infoIcon}>ℹ️</Text>
                    <Text style={styles.infoText}>{infoMessage}</Text>
                  </View>
                ) : null}

                <Field
                  label="Código de 6 dígitos"
                  placeholder="Ex: 123456"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={code}
                  onChangeText={setCode}
                />

                <Field
                  label="Nova Senha"
                  placeholder="Mínimo 6 caracteres"
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                />

                <Field
                  label="Confirmar Nova Senha"
                  placeholder="Repita a nova senha"
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />

                <Animated.View style={{ transform: [{ scale: scaleAnim }], marginTop: 6 }}>
                  <TouchableOpacity
                    style={[styles.primaryBtn, isResetPasswordLoading && styles.btnDisabled]}
                    onPress={handleResetPassword}
                    disabled={isResetPasswordLoading}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.primaryBtnText}>
                      {isResetPasswordLoading ? 'Salvando...' : 'Salvar Nova Senha →'}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>

                <TouchableOpacity
                  style={{ marginTop: 18, alignItems: 'center' }}
                  onPress={handleRequestCode}
                >
                  <Text style={styles.resendText}>Não recebeu o código? <Text style={styles.resendLink}>Reenviar</Text></Text>
                </TouchableOpacity>
              </>
            )}

            {step === 'success' && (
              <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(48,209,88,0.15)', borderColor: 'rgba(48,209,88,0.3)' }]}>
                  <Text style={styles.iconText}>✅</Text>
                </View>

                <Text style={styles.title}>Senha Alterada!</Text>
                <Text style={[styles.subtitle, { textAlign: 'center', marginBottom: 24 }]}>
                  Sua senha foi redefinida com sucesso. Você já pode fazer login na sua conta Harry.
                </Text>

                <TouchableOpacity
                  style={[styles.primaryBtn, { width: '100%' }]}
                  onPress={() => router.replace('/(auth)/login')}
                >
                  <Text style={styles.primaryBtnText}>Ir para o Login →</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    justifyContent: 'center',
  },
  backBtn: {
    marginBottom: 20,
  },
  backBtnText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: 'rgba(10,132,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    alignSelf: 'center',
  },
  iconText: {
    fontSize: 28,
  },
  title: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
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
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,132,255,0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(10,132,255,0.25)',
  },
  infoIcon: {
    fontSize: 14,
  },
  infoText: {
    flex: 1,
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '500',
  },
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
  btnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  resendText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  resendLink: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
