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
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../src/lib/supabase';

export default function RootLayout() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      if (__DEV__) {
        await supabase.auth.signOut({ scope: 'local' });
      }

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      setCheckingAuth(false);
    }

    initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setCheckingAuth(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

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
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="login" />
        </Stack.Protected>

        <Stack.Protected guard={!!session}>
          <Stack.Screen name="index" />
          <Stack.Screen name="account" />
          <Stack.Screen name="chats" />
          <Stack.Screen name="chat" />
        </Stack.Protected>
      </Stack>

      {!!session && pathname === '/' ? (
        <View style={styles.homeActions}>
          <Pressable style={styles.floatingButton} onPress={() => router.push('/chats')}>
            <Text style={styles.floatingIcon}>💬</Text>
            <Text style={styles.floatingText}>聊天</Text>
          </Pressable>
          <Pressable style={styles.floatingButton} onPress={() => router.push('/account')}>
            <Text style={styles.floatingIcon}>👤</Text>
            <Text style={styles.floatingText}>帳戶</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#F7FAF8' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#617168' },
  homeActions: {
    position: 'absolute',
    right: 18,
    bottom: 28,
    zIndex: 50,
    gap: 9,
    alignItems: 'flex-end',
  },
  floatingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE8E1',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  floatingIcon: { fontSize: 15 },
  floatingText: { color: '#0B7A45', fontWeight: '900', fontSize: 13 },
});
