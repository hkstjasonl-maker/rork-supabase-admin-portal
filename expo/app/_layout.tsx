import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { LanguageProvider } from '@/providers/LanguageProvider';
import { DrawerProvider } from '@/providers/DrawerProvider';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      void SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <View style={loadingStyles.container}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, headerBackTitle: 'Back' }}>
      {isAuthenticated ? (
        <Stack.Screen name="(drawer)" options={{ headerShown: false, title: 'SLP Jason Portal' }} />
      ) : (
        <Stack.Screen name="login" options={{ headerShown: false, title: 'Login' }} />
      )}
    </Stack>
  );
}

function RootLayoutNav() {
  return <AuthGate />;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <LanguageProvider>
          <AuthProvider>
            <DrawerProvider>
              <RootLayoutNav />
            </DrawerProvider>
          </AuthProvider>
        </LanguageProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
