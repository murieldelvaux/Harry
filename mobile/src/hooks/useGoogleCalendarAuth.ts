import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from './useAuth';
import { useCalendar } from './useCalendar';

WebBrowser.maybeCompleteAuthSession();

const WEB_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const ANDROID_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

export const isGoogleConfigured = !!(WEB_ID || IOS_ID || ANDROID_ID);

export function useGoogleCalendarAuth() {
  const { user, updateProfile } = useAuth();
  const { syncGoogle } = useCalendar();
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

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
      const accessToken =
        response.authentication?.accessToken || response.params?.access_token;

      if (accessToken) {
        setIsConnecting(true);
        setStatusMessage('Vinculando conta do Google...');
        updateProfile({ googleAccessToken: accessToken })
          .then(async () => {
            setStatusMessage('Sincronizando compromissos...');
            await syncGoogle();
            setStatusMessage('Google Agenda conectado e sincronizado com sucesso! ✅');
            setTimeout(() => setStatusMessage(null), 4000);
          })
          .catch((err) => {
            setStatusMessage('Erro ao salvar permissão do Google.');
            setTimeout(() => setStatusMessage(null), 4000);
          })
          .finally(() => {
            setIsConnecting(false);
          });
      }
    } else if (response.type === 'error') {
      setStatusMessage('Autorização do Google cancelada ou recusada.');
      setIsConnecting(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  }, [response]);

  const connectCalendar = async () => {
    setStatusMessage(null);
    setIsConnecting(true);
    try {
      await promptAsync();
    } catch (err: any) {
      setStatusMessage(err?.message || 'Falha ao abrir autorização do Google');
      setIsConnecting(false);
    }
  };

  const connectDevSimulated = async () => {
    setIsConnecting(true);
    try {
      const devToken = `dev_token_:${user?.email || 'murieldelvaux@gmail.com'}:${encodeURIComponent(user?.name || 'Muriel')}`;
      await updateProfile({ googleAccessToken: devToken });
      await syncGoogle();
      setStatusMessage('Google Agenda sincronizado em modo de teste! ✅');
      setTimeout(() => setStatusMessage(null), 4000);
    } catch {
      setStatusMessage('Erro ao conectar em modo dev.');
    } finally {
      setIsConnecting(false);
    }
  };

  return {
    connectCalendar,
    connectDevSimulated,
    isConnecting,
    statusMessage,
    setStatusMessage,
    hasGoogleConnected: !!user?.googleAccessToken,
    ready: !!request,
  };
}
