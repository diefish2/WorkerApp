import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, router, usePathname } from 'expo-router';
import { supabase } from '../src/lib/supabase';

export default function RootLayout() {
  const pathname = usePathname();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function syncRoute() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const session = data.session;
      setHasSession(!!session);

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

      setHasSession(!!session);

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
    <View style={styles.root}>
      <Stack
        initialRouteName="login"
        screenOptions={{
          headerTitleAlign: 'center',
          headerShown: false,
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="index" />
        <Stack.Screen name="account" />
      </Stack>

      {hasSession && pathname === '/' ? (
        <Pressable style={styles.accountButton} onPress={() => router.push('/account')}>
          <Text style={styles.accountButtonText}>帳戶</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#F7FAF8' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#617168' },
  accountButton: {
    position: 'absolute',
    top: 54,
    right: 18,
    zIndex: 50,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE8E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  accountButtonText: { color: '#0B7A45', fontWeight: '900', fontSize: 13 },
});
