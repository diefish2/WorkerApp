import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../src/lib/supabase';

export default function AccountScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setLoading(false);
    });
  }, []);

  async function signOut() {
    setSigningOut(true);
    const { error } = await supabase.auth.signOut({ scope: 'local' });

    if (error) {
      setSigningOut(false);
      Alert.alert('登出失敗', error.message);
    }
    // No manual router.replace here. Stack.Protected reacts to the
    // session becoming null and safely returns to the login screen.
  }

  function confirmSignOut() {
    Alert.alert('登出 WorkerApp？', '登出後，下次開 App 需要重新登入。', [
      { text: '取消', style: 'cancel' },
      { text: '登出', style: 'destructive', onPress: signOut },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>載入帳戶...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ 返回</Text>
        </Pressable>

        <Text style={styles.title}>帳戶</Text>

        <View style={styles.card}>
          <Text style={styles.label}>登入狀態</Text>
          <Text style={styles.value}>✓ 已登入</Text>

          <View style={styles.divider} />

          <Text style={styles.label}>帳戶類型</Text>
          <Text style={styles.value}>
            {user?.is_anonymous ? '開發測試帳戶' : 'WorkerApp 帳戶'}
          </Text>

          {user?.id ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.label}>User ID</Text>
              <Text style={styles.userId}>{user.id}</Text>
            </>
          ) : null}
        </View>

        <Pressable
          style={[styles.logoutButton, signingOut && styles.disabled]}
          onPress={confirmSignOut}
          disabled={signingOut}
        >
          <Text style={styles.logoutText}>{signingOut ? '登出中...' : '登出'}</Text>
        </Pressable>

        <Text style={styles.note}>
          開發測試帳戶登出後無法再取回同一個 anonymous account；重新測試登入會建立另一個 User ID。
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7FAF8' },
  content: { flex: 1, padding: 20 },
  back: { color: '#0B8D4A', fontSize: 16, fontWeight: '800', marginTop: 6 },
  title: { fontSize: 30, fontWeight: '900', color: '#17251E', marginTop: 18, marginBottom: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#E1E9E4' },
  label: { fontSize: 13, color: '#718178', fontWeight: '700', marginBottom: 5 },
  value: { fontSize: 17, color: '#21362B', fontWeight: '800' },
  userId: { fontSize: 12, lineHeight: 18, color: '#617168' },
  divider: { height: 1, backgroundColor: '#E8EEE9', marginVertical: 15 },
  logoutButton: { marginTop: 22, backgroundColor: '#FFF2F2', borderWidth: 1, borderColor: '#F0B9B9', borderRadius: 13, paddingVertical: 14, alignItems: 'center' },
  logoutText: { color: '#B33A3A', fontSize: 16, fontWeight: '900' },
  note: { marginTop: 12, fontSize: 12, lineHeight: 18, color: '#7A8981' },
  disabled: { opacity: 0.55 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#617168' },
});
