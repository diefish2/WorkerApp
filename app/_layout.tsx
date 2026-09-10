import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Stack, router, usePathname } from 'expo-router';
import { supabase } from '../src/lib/supabase';

export default function RootLayout() {
  const pathname = usePathname();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function syncRoute() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const session = data.session;
      if (!session && pathname !== '/login') {
        router.replace('/login');
      } else if (session && pathname === '/login') {
        router.replace('/');
      }

      setCheckingAuth(false);
    }

    syncRoute();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      if (!session && pathname !== '/login') {
        router.replace('/login');
      } else if (session && pathname === '/login') {
        router.replace('/');
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [pathname]);

  if (checkingAuth) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>檢查登入狀態...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <Stack
      initialRouteName="login"
      screenOptions={{
        headerTitleAlign: 'center',
        headerShown: false,
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="index" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7FAF8' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#617168' },
});
