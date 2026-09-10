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

const DEV_PHONE = '91234567';
const DEV_OTP = '123456';

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

  async function createProfile(userId: string, phoneValue: string | null) {
    return supabase.from('profiles').upsert(
      {
        id: userId,
        phone: phoneValue,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
  }

  async function devLogin() {
    setSubmitting(true);

    const { data, error } = await supabase.auth.signInAnonymously();

    if (error || !data.user) {
      setSubmitting(false);
      Alert.alert(
        '開發登入未啟用',
        '請到 Supabase Dashboard → Authentication → Providers → Anonymous Sign-Ins，將 Anonymous Sign-Ins 開啟。之後返嚟再撳一次。'
      );
      return;
    }

    const { error: profileError } = await createProfile(data.user.id, null);
    setSubmitting(false);

    if (profileError) {
      Alert.alert('測試帳戶建立失敗', profileError.message);
      return;
    }

    router.replace('/');
  }

  function startDevOtp() {
    setPhone(DEV_PHONE);
    setOtp('');
    setStep('otp');
    Alert.alert('免費測試模式', `測試電話：+852 ${DEV_PHONE}\n驗證碼：${DEV_OTP}\n\n呢個模式唔會發 SMS。`);
  }

  async function verifyDevOtp() {
    if (phone !== DEV_PHONE || otp !== DEV_OTP) {
      Alert.alert('測試驗證碼錯誤', `開發測試請使用 ${DEV_OTP}。`);
      return;
    }
    await devLogin();
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
        `${error.message}\n\n正式 Phone OTP 需要先設定 SMS provider。開發期間可以用下面嘅免費測試登入。`
      );
      return;
    }

    setOtp('');
    setStep('otp');
    Alert.alert('驗證碼已發送', `6 位驗證碼已發送到 ${fullPhone}。`);
  }

  async function verifyOtp() {
    if (phone === DEV_PHONE) {
      await verifyDevOtp();
      return;
    }

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

    const { error: profileError } = await createProfile(data.user.id, data.user.phone ?? fullPhone);
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
              ? '正式版本會用香港電話 OTP；開發期間可以免費測試。'
              : phone === DEV_PHONE
                ? `免費測試帳戶 +852 ${DEV_PHONE}`
                : `我哋已經將 6 位驗證碼發送到 ${fullPhone}`}
          </Text>

          {step === 'phone' ? (
            <>
              <Text style={styles.label}>香港電話號碼</Text>
              <View style={styles.phoneRow}>
                <View style={styles.prefixBox}><Text style={styles.prefixText}>+852</Text></View>
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
              <Pressable style={[styles.primaryButton, submitting && styles.disabled]} onPress={sendOtp} disabled={submitting}>
                <Text style={styles.primaryText}>{submitting ? '發送中...' : '取得驗證碼'}</Text>
              </Pressable>

              <View style={styles.divider} />
              <View style={styles.devBox}>
                <Text style={styles.devTitle}>免費開發測試</Text>
                <Text style={styles.devNote}>唔發 SMS、唔需要 Twilio。測試電話 91234567，OTP 123456。</Text>
                <Pressable style={styles.devButton} onPress={startDevOtp} disabled={submitting}>
                  <Text style={styles.devButtonText}>使用免費測試登入</Text>
                </Pressable>
              </View>
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
              {phone === DEV_PHONE && <Text style={styles.testHint}>測試 OTP：123456</Text>}
              <Pressable style={[styles.primaryButton, submitting && styles.disabled]} onPress={verifyOtp} disabled={submitting}>
                <Text style={styles.primaryText}>{submitting ? '登入中...' : '驗證並登入'}</Text>
              </Pressable>
              <View style={styles.linkRow}>
                <Pressable onPress={() => { setStep('phone'); setOtp(''); }} disabled={submitting}>
                  <Text style={styles.linkText}>更改電話號碼</Text>
                </Pressable>
                {phone !== DEV_PHONE && (
                  <Pressable onPress={sendOtp} disabled={submitting}><Text style={styles.linkText}>重新發送</Text></Pressable>
                )}
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7FAF8' },
  keyboardView: { flex: 1, justifyContent: 'center', padding: 22 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 22, borderWidth: 1, borderColor: '#E1E9E4' },
  logo: { fontSize: 25, fontWeight: '900', color: '#0B7A45', marginBottom: 26 },
  title: { fontSize: 29, lineHeight: 35, fontWeight: '900', color: '#17251E' },
  subtitle: { fontSize: 15, lineHeight: 22, color: '#687A71', marginTop: 9, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '800', color: '#32443B', marginBottom: 8 },
  phoneRow: { flexDirection: 'row', gap: 9 },
  prefixBox: { minWidth: 72, borderWidth: 1, borderColor: '#DCE5DF', borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F7F5' },
  prefixText: { fontSize: 16, fontWeight: '800', color: '#40564B' },
  phoneInput: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE5DF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 18 },
  otpInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE5DF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 24, letterSpacing: 8, textAlign: 'center' },
  primaryButton: { backgroundColor: '#0FA958', borderRadius: 13, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  primaryText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  disabled: { opacity: 0.55 },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  linkText: { color: '#0B8D4A', fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#E8EEE9', marginVertical: 22 },
  devBox: { backgroundColor: '#F1FBF5', borderWidth: 1, borderColor: '#C8E8D4', borderRadius: 14, padding: 14 },
  devTitle: { fontSize: 16, fontWeight: '900', color: '#0B7A45' },
  devNote: { fontSize: 13, lineHeight: 19, color: '#60776D', marginTop: 5 },
  devButton: { marginTop: 12, borderRadius: 11, paddingVertical: 12, alignItems: 'center', backgroundColor: '#E0F5E8' },
  devButtonText: { color: '#0B7A45', fontWeight: '900' },
  testHint: { marginTop: 8, color: '#0B7A45', fontWeight: '800', textAlign: 'center' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#617168' },
});
