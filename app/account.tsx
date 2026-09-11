import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../src/lib/supabase';

export default function AccountScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadAccount() {
      const { data } = await supabase.auth.getUser();
      const currentUser = data.user ?? null;
      if (!active) return;

      setUser(currentUser);

      if (currentUser?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (active) setDisplayName(profile?.display_name ?? '');
      }

      if (active) setLoading(false);
    }

    loadAccount();

    return () => {
      active = false;
    };
  }, []);

  async function saveDisplayName() {
    const name = displayName.trim();

    if (!user?.id) {
      Alert.alert('登入已失效', '請重新登入後再設定名稱。');
      return;
    }

    if (!name) {
      Alert.alert('請輸入名稱', '例如：陳師傅、Chan Electrical。');
      return;
    }

    setSavingName(true);

    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          display_name: name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    setSavingName(false);

    if (error) {
      Alert.alert('儲存失敗', error.message);
      return;
    }

    setDisplayName(name);
    Alert.alert('已儲存', '之後提交報價會自動使用呢個名稱。');
  }

  async function signOut() {
    setSigningOut(true);
    const { error } = await supabase.auth.signOut({ scope: 'local' });

    if (error) {
      setSigningOut(false);
      Alert.alert('登出失敗', error.message);
    }
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
          <Text style={styles.label}>預設師傅名稱</Text>
          <Text style={styles.helperText}>設定一次，之後每次報價會自動帶出。</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="例如：陳師傅"
            style={styles.input}
            maxLength={60}
          />
          <Pressable
            style={[styles.saveButton, savingName && styles.disabled]}
            onPress={saveDisplayName}
            disabled={savingName}
          >
            <Text style={styles.saveButtonText}>{savingName ? '儲存中...' : '儲存名稱'}</Text>
          </Pressable>

          <View style={styles.divider} />

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
  helperText: { fontSize: 12, color: '#7A8981', marginBottom: 10 },
  value: { fontSize: 17, color: '#21362B', fontWeight: '800' },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE5DF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#21362B' },
  saveButton: { marginTop: 10, backgroundColor: '#0FA958', borderRadius: 11, paddingVertical: 12, alignItems: 'center' },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  userId: { fontSize: 12, lineHeight: 18, color: '#617168' },
  divider: { height: 1, backgroundColor: '#E8EEE9', marginVertical: 15 },
  logoutButton: { marginTop: 22, backgroundColor: '#FFF2F2', borderWidth: 1, borderColor: '#F0B9B9', borderRadius: 13, paddingVertical: 14, alignItems: 'center' },
  logoutText: { color: '#B33A3A', fontSize: 16, fontWeight: '900' },
  note: { marginTop: 12, fontSize: 12, lineHeight: 18, color: '#7A8981' },
  disabled: { opacity: 0.55 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#617168' },
});
