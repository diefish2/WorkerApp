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

type Step = 'phone' | 'otp';

export default function LoginScreen() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fullPhone = `+852${phone}`;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/');
      else setLoading(false);
    });
  }, []);

  function updatePhone(value: string) {
    setPhone(value.replace(/\D/g, '').slice(0, 8));
  }

  function updateOtp(value: string) {
    setOtp(value.replace(/\D/g, '').slice(0, 6));
  }

  async function sendOtp() {
    if (phone.length !== 8) {
      Alert.alert('電話號碼格式唔正確', '請輸入 8 位香港電話號碼。');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
    setSubmitting(false);

    if (error) {
      Alert.alert(
        '未能發送驗證碼',
        `${error.message}\n\n如 Phone Auth / SMS provider 仲未設定，請先喺 Supabase Auth Providers 完成設定。`
      );
      return;
    }

    setOtp('');
    setStep('otp');
    Alert.alert('驗證碼已發送', `6 位驗證碼已發送到 ${fullPhone}。`);
  }

  async function verifyOtp() {
    if (otp.length !== 6) {
      Alert.alert('請輸入驗證碼', '驗證碼應該係 6 位數字。');
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.auth.verifyOtp({
      phone: fullPhone,
      token: otp,
      type: 'sms',
    });

    if (error || !data.user) {
      setSubmitting(false);
      Alert.alert('驗證失敗', error?.message ?? '請重新輸入驗證碼。');
      return;
    }

    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: data.user.id,
        phone: data.user.phone ?? fullPhone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    setSubmitting(false);

    if (profileError) {
      Alert.alert('帳戶建立失敗', profileError.message);
      return;
    }

    router.replace('/');
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
          <Text style={styles.title}>{step === 'phone' ? '電話號碼登入' : '輸入驗證碼'}</Text>
          <Text style={styles.subtitle}>
            {step === 'phone'
              ? '用香港電話號碼建立或登入同一個 WorkerApp 帳戶。'
              : `我哋已經將 6 位驗證碼發送到 ${fullPhone}`}
          </Text>

          {step === 'phone' ? (
            <>
              <Text style={styles.label}>香港電話號碼</Text>
              <View style={styles.phoneRow}>
                <View style={styles.prefixBox}>
                  <Text style={styles.prefixText}>+852</Text>
                </View>
                <TextInput
                  value={phone}
                  onChangeText={updatePhone}
                  keyboardType="number-pad"
                  placeholder="91234567"
                  maxLength={8}
                  style={styles.phoneInput}
                  autoFocus
                />
              </View>
              <Pressable
                style={[styles.primaryButton, submitting && styles.disabled]}
                onPress={sendOtp}
                disabled={submitting}
              >
                <Text style={styles.primaryText}>{submitting ? '發送中...' : '取得驗證碼'}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.label}>6 位驗證碼</Text>
              <TextInput
                value={otp}
                onChangeText={updateOtp}
                keyboardType="number-pad"
                placeholder="123456"
                maxLength={6}
                style={styles.otpInput}
                autoFocus
              />
              <Pressable
                style={[styles.primaryButton, submitting && styles.disabled]}
                onPress={verifyOtp}
                disabled={submitting}
              >
                <Text style={styles.primaryText}>{submitting ? '驗證中...' : '驗證並登入'}</Text>
              </Pressable>
              <View style={styles.linkRow}>
                <Pressable onPress={() => setStep('phone')} disabled={submitting}>
                  <Text style={styles.linkText}>更改電話號碼</Text>
                </Pressable>
                <Pressable onPress={sendOtp} disabled={submitting}>
                  <Text style={styles.linkText}>重新發送</Text>
                </Pressable>
              </View>
            </>
          )}

          <View style={styles.divider} />
          <Text style={styles.devNote}>開發期間如果 SMS provider 仲未設定，可以暫時繼續測試現有功能。</Text>
          <Pressable style={styles.prototypeButton} onPress={() => router.replace('/')}>
            <Text style={styles.prototypeText}>暫時繼續 Prototype</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7FAF8' },
  keyboardView: { flex: 1, justifyContent: 'center', padding: 22 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E1E9E4',
  },
  logo: { fontSize: 25, fontWeight: '900', color: '#0B7A45', marginBottom: 26 },
  title: { fontSize: 29, lineHeight: 35, fontWeight: '900', color: '#17251E' },
  subtitle: { fontSize: 15, lineHeight: 22, color: '#687A71', marginTop: 9, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '800', color: '#32443B', marginBottom: 8 },
  phoneRow: { flexDirection: 'row', gap: 9 },
  prefixBox: {
    minWidth: 72,
    borderWidth: 1,
    borderColor: '#DCE5DF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F4F7F5',
  },
  prefixText: { fontSize: 16, fontWeight: '800', color: '#40564B' },
  phoneInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE5DF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 18,
  },
  otpInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE5DF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#0FA958',
    borderRadius: 13,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  disabled: { opacity: 0.55 },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  linkText: { color: '#0B8D4A', fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#E8EEE9', marginVertical: 22 },
  devNote: { fontSize: 12, lineHeight: 18, color: '#7B8B83', textAlign: 'center' },
  prototypeButton: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  prototypeText: { color: '#60776D', fontWeight: '800' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#617168' },
});
