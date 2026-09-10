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
  const [unreadChatCount, setUnreadChatCount] = useState(0);

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

  useEffect(() => {
    if (!session?.user.id) {
      setUnreadChatCount(0);
      return;
    }

    let active = true;

    async function loadUnreadChatCount() {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', session!.user.id)
        .eq('type', 'new_message')
        .eq('is_read', false);

      if (!active || error) return;
      setUnreadChatCount(count ?? 0);
    }

    loadUnreadChatCount();

    const channel = supabase
      .channel(`workerapp-chat-badge-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${session.user.id}`,
        },
        loadUnreadChatCount
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [session?.user.id, pathname]);

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
          <Stack.Screen name="notifications" />
          <Stack.Screen name="chats" />
          <Stack.Screen name="chat" />
        </Stack.Protected>
      </Stack>

      {!!session && pathname === '/' ? (
        <View style={styles.homeActions}>
          <Pressable style={styles.floatingButton} onPress={() => router.push('/notifications')}>
            <Text style={styles.floatingIcon}>🔔</Text>
            <Text style={styles.floatingText}>通知</Text>
          </Pressable>
          <Pressable style={styles.floatingButton} onPress={() => router.push('/chats')}>
            <View>
              <Text style={styles.floatingIcon}>💬</Text>
              {unreadChatCount > 0 ? (
                <View style={styles.chatBadge}>
                  <Text style={styles.chatBadgeText}>{unreadChatCount > 99 ? '99+' : unreadChatCount}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.floatingText, unreadChatCount > 0 && styles.floatingTextUnread]}>聊天</Text>
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
  floatingTextUnread: { color: '#D93025' },
  chatBadge: {
    position: 'absolute',
    top: -9,
    right: -13,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#D93025',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  chatBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
});
