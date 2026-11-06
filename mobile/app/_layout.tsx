import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { appQueryClient } from '../src/services/queryClient';
import { authService } from '../src/services/auth.service';
import { notificationService } from '../src/services/notification.service';
import { queryKeys } from '../src/services/queryKeys';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { DrawerProvider } from '../src/context/DrawerContext';
import { AppDrawer } from '../src/components/AppDrawer';
import { useRealtimeSync } from '../src/hooks/useRealtimeSync';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { theme } = useTheme();

  const userQuery = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: async () => {
      try {
        return await authService.getMe();
      } catch {
        return null;
      }
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  // Ativa sincronização instantânea em tempo real via Server-Sent Events (SSE)
  useRealtimeSync(!!userQuery.data);

  // Registra Push Token e listener de deep-link de notificações (Task 2)
  useEffect(() => {
    if (!userQuery.data) return;
    notificationService.registerDevicePushToken().catch(() => {});

    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url as string | undefined;
      if (url) {
        router.push(url as any);
      }
    });
    return () => sub.remove();
  }, [userQuery.data, router]);

  useEffect(() => {
    if (userQuery.isLoading) return;

    const segs = segments as string[];
    const inAuthGroup =
      segs[0] === '(auth)' ||
      segs.includes('login') ||
      segs.includes('register') ||
      segs.includes('forgot-password');
    const isAuthenticated = !!userQuery.data;

    if (!isAuthenticated && !inAuthGroup) {
      // Redireciona para login se não autenticado
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redireciona direto para as abas principais se já autenticado
      router.replace('/(tabs)');
    }
  }, [userQuery.isLoading, userQuery.data, segments, router]);

  // Tela de loading enquanto verifica autenticação
  if (userQuery.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

function MainNavigation() {
  const { theme, isDark } = useTheme();
  const segments = useSegments();
  const inAuthGroup = segments[0] === '(auth)';

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(household)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      {/* Menu Lateral Global (Drawer) - apenas fora do login */}
      {!inAuthGroup && <AppDrawer />}
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={appQueryClient}>
        <ThemeProvider>
          <DrawerProvider>
            <AuthGuard>
              <MainNavigation />
            </AuthGuard>
          </DrawerProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
