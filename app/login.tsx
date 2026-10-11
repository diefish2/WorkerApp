import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../src/lib/supabase';

type AuthMode = 'signin' | 'signup';

export default function LoginScreen() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/');
      else setLoading(false);
    });
  }, []);

  function cleanEmail(value: string) {
    setEmail(value.trim().toLowerCase());
  }

  async function createProfile(userId: string) {
    return supabase.from('profiles').upsert(
      {
        id: userId,
        phone: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
  }

  async function signIn() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      Alert.alert('請輸入有效 Email');
      return;
    }
    if (!password) {
      Alert.alert('請輸入密碼');
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error || !data.user) {
      setSubmitting(false);
      const notConfirmed = /email not confirmed/i.test(error?.message ?? '');
      Alert.alert(
        '登入失敗',
        notConfirmed ? '請先到 Email 收件箱完成驗證，再返嚟登入。' : (error?.message ?? '請檢查 Email 同密碼。')
      );
      return;
    }

    const { error: profileError } = await createProfile(data.user.id);
    setSubmitting(false);

    if (profileError) {
      Alert.alert('帳戶資料建立失敗', profileError.message);
      return;
    }

    router.replace('/');
  }

  async function signUp() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      Alert.alert('請輸入有效 Email');
      return;
    }
    if (password.length < 8) {
      Alert.alert('密碼太短', '密碼最少需要 8 個字元。');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('密碼唔一致', '請再次確認兩次輸入嘅密碼相同。');
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    });

    if (error || !data.user) {
      setSubmitting(false);
      Alert.alert('建立帳戶失敗', error?.message ?? '請再試一次。');
      return;
    }

    const { error: profileError } = await createProfile(data.user.id);
    setSubmitting(false);

    if (profileError) {
      Alert.alert('帳戶資料建立失敗', profileError.message);
      return;
    }

    if (data.session) {
      router.replace('/');
      return;
    }

    setPassword('');
    setConfirmPassword('');
    setMode('signin');
    Alert.alert(
      '請驗證 Email',
      '帳戶已建立。請到 ' + normalizedEmail + ' 收件箱撳驗證連結，完成後返 WorkerApp 登入。'
    );
  }

  async function submit() {
    if (mode === 'signin') await signIn();
    else await signUp();
  }

  if (loading) {
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.logo}>WorkerApp</Text>

          <View style={styles.modeRow}>
            <Pressable
              style={[styles.modeButton, mode === 'signin' && styles.modeButtonActive]}
              onPress={() => setMode('signin')}
              disabled={submitting}
            >
              <Text style={[styles.modeText, mode === 'signin' && styles.modeTextActive]}>登入</Text>
            </Pressable>
            <Pressable
              style={[styles.modeButton, mode === 'signup' && styles.modeButtonActive]}
              onPress={() => setMode('signup')}
              disabled={submitting}
            >
              <Text style={[styles.modeText, mode === 'signup' && styles.modeTextActive]}>建立帳戶</Text>
            </Pressable>
          </View>

          <Text style={styles.title}>{mode === 'signin' ? '歡迎返嚟' : '建立 WorkerApp 帳戶'}</Text>
          <Text style={styles.subtitle}>
            {mode === 'signin'
              ? '使用 Email 同密碼登入。'
              : 'Customer 同 Worker 都使用同一個 Email 帳戶；登入後可以隨時切換模式。'}
          </Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={cleanEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            placeholder="you@example.com"
            style={styles.input}
          />

          <Text style={styles.label}>密碼</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            textContentType={mode === 'signin' ? 'password' : 'newPassword'}
            placeholder={mode === 'signup' ? '最少 8 個字元' : '輸入密碼'}
            style={styles.input}
          />

          {mode === 'signup' ? (
            <>
              <Text style={styles.label}>再次輸入密碼</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                textContentType="newPassword"
                placeholder="再次輸入密碼"
                style={styles.input}
              />
            </>
          ) : null}

          <Pressable
            style={[styles.primaryButton, submitting && styles.disabled]}
            onPress={submit}
            disabled={submitting}
          >
            <Text style={styles.primaryText}>
              {submitting ? '處理中...' : mode === 'signin' ? '登入' : '建立帳戶'}
            </Text>
          </Pressable>

          <Text style={styles.note}>
            {mode === 'signup'
              ? '正式版本建議保留 Email 驗證。建立帳戶後可能需要先到收件箱完成驗證。'
              : '登入後 App 會保留 session，重新開 App 唔需要每次再登入。'}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7FAF8' },
  keyboardView: { flex: 1, justifyContent: 'center', padding: 22 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 22, borderWidth: 1, borderColor: '#E1E9E4' },
  logo: { fontSize: 25, fontWeight: '900', color: '#0B7A45', marginBottom: 22 },
  modeRow: { flexDirection: 'row', backgroundColor: '#EEF4F0', padding: 4, borderRadius: 13, marginBottom: 22 },
  modeButton: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  modeButtonActive: { backgroundColor: '#0FA958' },
  modeText: { color: '#60746A', fontWeight: '900' },
  modeTextActive: { color: '#FFFFFF' },
  title: { fontSize: 29, lineHeight: 35, fontWeight: '900', color: '#17251E' },
  subtitle: { fontSize: 15, lineHeight: 22, color: '#687A71', marginTop: 9, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '800', color: '#32443B', marginBottom: 8, marginTop: 10 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE5DF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16 },
  primaryButton: { backgroundColor: '#0FA958', borderRadius: 13, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  primaryText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  note: { marginTop: 14, color: '#7A8981', fontSize: 12, lineHeight: 18 },
  disabled: { opacity: 0.55 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#617168' },
});
