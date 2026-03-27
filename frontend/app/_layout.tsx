import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabase';

export default function RootLayout() {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState(null);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === 'login';

    if (!session && !inAuthGroup) {
      router.replace('/login');
    } else if (session && inAuthGroup) {
      router.replace('/');
    }
  }, [session, segments, isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#141E30', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#00c6ff" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: 'transparent' }, headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen name="order/[id]" />
    </Stack>
  );
}
