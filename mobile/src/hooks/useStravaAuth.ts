import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  makeRedirectUri,
  useAuthRequest,
  ResponseType,
} from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FitnessProvider } from '../../../packages/shared/src';
import { useWorkouts } from './useWorkouts';

// Fecha automaticamente o popup de autenticação OAuth2 na Web ao retornar para o redirectUri
WebBrowser.maybeCompleteAuthSession();

const STRAVA_CLIENT_ID = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID || '294184';

// Endpoints oficiais OAuth2 do Strava (Documentação Strava API v3 + Expo AuthSession)
const stravaDiscovery = {
  authorizationEndpoint: 'https://www.strava.com/oauth/authorize',
  tokenEndpoint: 'https://www.strava.com/oauth/token',
  revocationEndpoint: 'https://www.strava.com/oauth/deauthorize',
};

export function useStravaAuth() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    error?: string;
    strava?: string;
  }>();
  const { connectProvider, syncProvider } = useWorkouts();

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const processedCodeRef = useRef<string | null>(null);

  const redirectUri =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? `${window.location.origin}/workouts`
      : makeRedirectUri({
          scheme: 'nexo',
          path: 'workouts',
        });

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: STRAVA_CLIENT_ID,
      // Strava exige escopos separados por vírgula
      scopes: ['read,activity:read_all,profile:read_all'],
      redirectUri,
      responseType: ResponseType.Code,
      usePKCE: false,
      extraParams: {
        approval_prompt: 'auto',
      },
    },
    stravaDiscovery,
  );

  const exchangeCodeAndSync = useCallback(
    async (authCode: string) => {
      if (!authCode || processedCodeRef.current === authCode) return;
      processedCodeRef.current = authCode;

      setIsAuthenticating(true);
      setErrorMessage(null);
      setStatusMessage('🔐 Validando autorização OAuth2 com o Strava...');

      try {
        await connectProvider({
          provider: FitnessProvider.STRAVA,
          authCode,
        });

        setStatusMessage('🔄 Importando suas corridas e treinos do Strava...');
        const syncRes = await syncProvider(FitnessProvider.STRAVA);

        setStatusMessage(
          `✅ Strava conectado com sucesso! ${syncRes.syncedCount} atividade(s) sincronizada(s).`,
        );
        setTimeout(() => setStatusMessage(null), 5000);
      } catch (err: any) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          'Não foi possível concluir a autorização com o Strava.';
        setErrorMessage(msg);
        setStatusMessage(null);
        setTimeout(() => setErrorMessage(null), 6000);
      } finally {
        setIsAuthenticating(false);
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.search) {
          router.replace('/workouts');
        }
      }
    },
    [connectProvider, syncProvider, router],
  );

  // 1. Resposta do popup via useAuthRequest (Expo AuthSession)
  useEffect(() => {
    if (!response) return;

    if (response.type === 'success' && response.params?.code) {
      exchangeCodeAndSync(response.params.code);
    } else if (response.type === 'error') {
      setErrorMessage('Autorização do Strava recusada ou interrompida.');
      setIsAuthenticating(false);
      setTimeout(() => setErrorMessage(null), 5000);
    } else if (response.type === 'dismiss' || response.type === 'cancel') {
      setIsAuthenticating(false);
    }
  }, [response, exchangeCodeAndSync]);

  // 2. Suporte a redirecionamento direto na mesma aba (?code=... na URL /workouts)
  useEffect(() => {
    if (params?.code && typeof params.code === 'string') {
      exchangeCodeAndSync(params.code);
    } else if (params?.error) {
      setErrorMessage('Autorização com o Strava cancelada pelo usuário.');
      setTimeout(() => setErrorMessage(null), 5000);
    } else if (params?.strava === 'connected') {
      setStatusMessage('✅ Conta do Strava conectada via OAuth2 e atividades sincronizadas!');
      setTimeout(() => setStatusMessage(null), 5000);
    }
  }, [params?.code, params?.error, params?.strava, exchangeCodeAndSync]);

  const startStravaOAuth = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    setIsAuthenticating(true);

    try {
      if (request) {
        const result = await promptAsync();
        if (result.type !== 'success') {
          setIsAuthenticating(false);
        }
      } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const paramsUrl = new URLSearchParams({
          client_id: STRAVA_CLIENT_ID,
          redirect_uri: redirectUri,
          response_type: 'code',
          approval_prompt: 'auto',
          scope: 'read,activity:read_all,profile:read_all',
        });
        window.location.assign(
          `https://www.strava.com/oauth/authorize?${paramsUrl.toString()}`,
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao abrir janela de autorização do Strava.');
      setIsAuthenticating(false);
    }
  };

  return {
    startStravaOAuth,
    exchangeCodeAndSync,
    isAuthenticating,
    statusMessage,
    errorMessage,
    setStatusMessage,
    setErrorMessage,
    ready: !!request,
    authorizationUrl: request?.url || null,
  };
}
