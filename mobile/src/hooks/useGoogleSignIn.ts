import { useEffect, useState } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from './useAuth';

WebBrowser.maybeCompleteAuthSession();

const WEB_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const ANDROID_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

export const isGoogleConfigured = !!(WEB_ID || IOS_ID || ANDROID_ID);

/**
 * Hook de autenticação e cadastro com Google (OAuth).
 * Se as chaves do Google Cloud estiverem configuradas no .env, abre o fluxo oficial.
 * Se ainda não estiverem, permite testar imediatamente em modo dev e explica quais chaves faltam.
 */
export function useGoogleSignIn() {
  const { loginWithGoogle, isGoogleLoading } = useAuth();
  const [error, setError] = useState('');
  const [showConfigModal, setShowConfigModal] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: WEB_ID || 'not-configured',
    iosClientId: IOS_ID || WEB_ID || 'not-configured',
    androidClientId: ANDROID_ID || WEB_ID || 'not-configured',
    scopes: [
      'openid',
      'profile',
      'email',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
    ],
  });

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      const accessToken = response.authentication?.accessToken || response.params?.access_token;
      if (!accessToken) {
        setError('Não foi possível obter o token do Google.');
        return;
      }
      loginWithGoogle({ accessToken }).catch((err: any) => {
        const msg = err?.response?.data?.message;
        setError(Array.isArray(msg) ? msg[0] : msg || 'Falha ao autenticar com o Google.');
      });
    } else if (response.type === 'error') {
      const detail = response.error?.message || response.params?.error_description || '';
      setError(detail ? `Google: ${detail}` : 'O Google recusou a autenticação. Tente novamente.');
    }
  }, [response]);

  const signIn = async () => {
    setError('');
    if (!isGoogleConfigured) {
      setShowConfigModal(true);
      return;
    }
    try {
      const res = await promptAsync();
      if (res?.type === 'error') {
        const detail = res.error?.message || (res as any).params?.error_description || '';
        setError(detail ? `Google: ${detail}` : 'O Google recusou a autenticação.');
      }
    } catch (e: any) {
      setError(e?.message || 'Falha ao iniciar autenticação com o Google.');
    }
  };

  const signInWithDevAccount = async (email: string, name: string) => {
    setError('');
    const token = `dev_token_:${email.trim().toLowerCase()}:${encodeURIComponent(name.trim())}`;
    try {
      await loginWithGoogle({ accessToken: token });
      setShowConfigModal(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg[0] : msg || 'Falha ao autenticar.');
    }
  };

  return {
    signIn,
    error,
    isLoading: isGoogleLoading,
    ready: !!request,
    showConfigModal,
    setShowConfigModal,
    signInWithDevAccount,
    isGoogleConfigured,
  };
}
