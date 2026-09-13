import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../src/lib/supabase';

const AVATAR_BUCKET = 'avatars';

function avatarFileInfo(uri: string) {
  const cleanUri = uri.split('?')[0].toLowerCase();
  if (cleanUri.endsWith('.png')) return { ext: 'png', contentType: 'image/png' };
  if (cleanUri.endsWith('.webp')) return { ext: 'webp', contentType: 'image/webp' };
  if (cleanUri.endsWith('.heic')) return { ext: 'heic', contentType: 'image/heic' };
  if (cleanUri.endsWith('.heif')) return { ext: 'heif', contentType: 'image/heif' };
  return { ext: 'jpg', contentType: 'image/jpeg' };
}

export default function AccountScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
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
          .select('display_name, avatar_url')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (active) {
          setDisplayName(profile?.display_name ?? '');
          setAvatarUrl(profile?.avatar_url ?? null);
        }
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

  async function pickAndUploadAvatar() {
    if (!user?.id || uploadingAvatar) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('需要相簿權限', '請允許 WorkerApp 存取相片。');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || result.assets.length === 0) return;

    setUploadingAvatar(true);

    try {
      const uri = result.assets[0].uri;
      const { ext, contentType } = avatarFileInfo(uri);
      const bytes = await fetch(uri).then((response) => response.arrayBuffer());
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { data: uploaded, error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, bytes, {
          contentType,
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const publicUrl = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(uploaded.path).data.publicUrl;
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            display_name: displayName.trim() || null,
            avatar_url: publicUrl,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

      if (profileError) throw profileError;

      setAvatarUrl(publicUrl);
      Alert.alert('頭像已更新', 'Customer 查看你嘅師傅 Profile 時會見到呢張相。');
    } catch (error: any) {
      Alert.alert('頭像上載失敗', error?.message ?? '請再試一次。');
    } finally {
      setUploadingAvatar(false);
    }
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

  function openWorkerProfile() {
    if (!user?.id) return;
    router.push({
      pathname: '/worker-profile',
      params: {
        workerId: user.id,
        name: displayName.trim() || '師傅',
      },
    });
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
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ 返回</Text>
        </Pressable>

        <Text style={styles.title}>帳戶</Text>

        <View style={styles.card}>
          <Text style={styles.label}>師傅頭像</Text>
          <Text style={styles.helperText}>Customer 睇你嘅 Profile 時會見到呢張相。</Text>
          <View style={styles.avatarSection}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}><Text style={styles.avatarPlaceholderText}>👷</Text></View>
            )}
            <Pressable
              style={[styles.avatarButton, uploadingAvatar && styles.disabled]}
              onPress={pickAndUploadAvatar}
              disabled={uploadingAvatar}
            >
              <Text style={styles.avatarButtonText}>{uploadingAvatar ? '上載中...' : avatarUrl ? '更換頭像' : '上載頭像'}</Text>
            </Pressable>
          </View>

          <View style={styles.divider} />

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

          <Pressable style={styles.profileButton} onPress={openWorkerProfile}>
            <Text style={styles.profileButtonText}>★ 查看我的師傅 Profile</Text>
          </Pressable>
          <Text style={styles.helperText}>客戶評分、評語同完成相片會保留喺 Profile。</Text>

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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7FAF8' },
  content: { padding: 20, paddingBottom: 50 },
  back: { color: '#0B8D4A', fontSize: 16, fontWeight: '800', marginTop: 6 },
  title: { fontSize: 30, fontWeight: '900', color: '#17251E', marginTop: 18, marginBottom: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#E1E9E4' },
  label: { fontSize: 13, color: '#718178', fontWeight: '700', marginBottom: 5 },
  helperText: { fontSize: 12, color: '#7A8981', marginBottom: 10, marginTop: 6 },
  value: { fontSize: 17, color: '#21362B', fontWeight: '800' },
  avatarSection: { alignItems: 'center', marginTop: 6 },
  avatarImage: { width: 104, height: 104, borderRadius: 52 },
  avatarPlaceholder: { width: 104, height: 104, borderRadius: 52, backgroundColor: '#EAF8F0', alignItems: 'center', justifyContent: 'center' },
  avatarPlaceholderText: { fontSize: 46 },
  avatarButton: { marginTop: 12, backgroundColor: '#EDF7F1', borderWidth: 1, borderColor: '#B9D8C6', borderRadius: 11, paddingVertical: 10, paddingHorizontal: 22 },
  avatarButtonText: { color: '#0B7A45', fontSize: 14, fontWeight: '900' },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE5DF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#21362B' },
  saveButton: { marginTop: 10, backgroundColor: '#0FA958', borderRadius: 11, paddingVertical: 12, alignItems: 'center' },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  profileButton: { marginTop: 12, backgroundColor: '#FFF8E1', borderWidth: 1, borderColor: '#E7CD7A', borderRadius: 11, paddingVertical: 12, alignItems: 'center' },
  profileButtonText: { color: '#8A6700', fontSize: 15, fontWeight: '900' },
  userId: { fontSize: 12, lineHeight: 18, color: '#617168' },
  divider: { height: 1, backgroundColor: '#E8EEE9', marginVertical: 15 },
  logoutButton: { marginTop: 22, backgroundColor: '#FFF2F2', borderWidth: 1, borderColor: '#F0B9B9', borderRadius: 13, paddingVertical: 14, alignItems: 'center' },
  logoutText: { color: '#B33A3A', fontSize: 16, fontWeight: '900' },
  note: { marginTop: 12, fontSize: 12, lineHeight: 18, color: '#7A8981' },
  disabled: { opacity: 0.55 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#617168' },
});
