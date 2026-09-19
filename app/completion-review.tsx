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
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../src/lib/supabase';

const JOB_PHOTOS_BUCKET = 'job-photos';

type ReviewJob = {
  id: string;
  customer_id: string | null;
  title: string;
  category: string;
  accepted_quote_id: string | null;
  accepted_worker_name: string | null;
  accepted_price: string | null;
  completed_at: string | null;
};

function photoFileInfo(uri: string) {
  const cleanUri = uri.split('?')[0].toLowerCase();
  if (cleanUri.endsWith('.png')) return { ext: 'png', contentType: 'image/png' };
  if (cleanUri.endsWith('.webp')) return { ext: 'webp', contentType: 'image/webp' };
  if (cleanUri.endsWith('.heic')) return { ext: 'heic', contentType: 'image/heic' };
  if (cleanUri.endsWith('.heif')) return { ext: 'heif', contentType: 'image/heif' };
  return { ext: 'jpg', contentType: 'image/jpeg' };
}

async function uploadCompletionPhoto(uri: string) {
  const { ext, contentType } = photoFileInfo(uri);
  const arrayBuffer = await fetch(uri).then((response) => response.arrayBuffer());
  const filePath = 'completion/' + Date.now() + '-' + Math.random().toString(36).slice(2, 10) + '.' + ext;

  const { data, error } = await supabase.storage
    .from(JOB_PHOTOS_BUCKET)
    .upload(filePath, arrayBuffer, {
      contentType,
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;
  return supabase.storage.from(JOB_PHOTOS_BUCKET).getPublicUrl(data.path).data.publicUrl;
}

export default function CompletionReviewScreen() {
  const { jobId } = useLocalSearchParams<{ jobId?: string }>();
  const [job, setJob] = useState<ReviewJob | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadJob() {
      if (!jobId) {
        if (active) setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('jobs')
        .select('id, customer_id, title, category, accepted_quote_id, accepted_worker_name, accepted_price, completed_at')
        .eq('id', jobId)
        .maybeSingle();

      if (!active) return;

      if (error) {
        Alert.alert('載入失敗', error.message);
      } else {
        setJob((data as ReviewJob | null) ?? null);
      }
      setLoading(false);
    }

    loadJob();
    return () => {
      active = false;
    };
  }, [jobId]);

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('需要相簿權限', '請允許 WorkerApp 存取相片。');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (error: any) {
      Alert.alert('開啟相簿失敗', error?.message ?? '請再試一次。');
    }
  }

  async function submitReview() {
    if (!job || !jobId) return;

    if (!job.accepted_quote_id) {
      Alert.alert('未有配對', '呢個工作目前未有已接受報價。');
      return;
    }

    if (job.completed_at) {
      Alert.alert('工作已完成', '呢個工作已經提交過評分。');
      return;
    }

    setSubmitting(true);

    let photoUrl: string | null = null;
    try {
      if (photoUri) photoUrl = await uploadCompletionPhoto(photoUri);
    } catch (error: any) {
      setSubmitting(false);
      Alert.alert('完成相片上載失敗', error?.message ?? '請再試一次。');
      return;
    }

    const { error } = await supabase.rpc('complete_job_and_review', {
      p_job_id: job.id,
      p_rating: rating,
      p_comment: comment.trim(),
      p_photo_url: photoUrl,
    });

    setSubmitting(false);

    if (error) {
      Alert.alert('提交失敗', error.message);
      return;
    }

    Alert.alert(
      '工作已完成',
      '你已經畀 ' + (job.accepted_worker_name ?? '師傅') + ' ' + rating + ' 星評分。',
      [{ text: '完成', onPress: () => router.back() }]
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>載入工作資料...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!job) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>‹ 返回</Text>
          </Pressable>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>搵唔到呢個工作</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (job.completed_at) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>‹ 返回</Text>
          </Pressable>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>✓ 呢個工作已完成</Text>
            <Text style={styles.emptyText}>每個工作只可以提交一次評分。</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} disabled={submitting}>
          <Text style={styles.back}>‹ 返回我的需求</Text>
        </Pressable>

        <Text style={styles.title}>完成工作及評分</Text>

        <View style={styles.jobCard}>
          <Text style={styles.workerName}>{job.accepted_worker_name ?? '師傅'}</Text>
          <Text style={styles.jobMeta}>🧰 {job.category} · {job.title}</Text>
          {job.accepted_price ? <Text style={styles.price}>{'HK$' + job.accepted_price}</Text> : null}
        </View>

        <Text style={styles.label}>你會畀師傅幾多星？</Text>
        <View style={styles.starRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable key={star} onPress={() => setRating(star)} disabled={submitting}>
              <Text style={[styles.star, star <= rating && styles.starActive]}>★</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.ratingChoice}>{rating} / 5 星</Text>

        <Text style={styles.label}>完成相片（可選）</Text>
        <Text style={styles.helper}>可以上載完成後嘅工作相片，之後會顯示喺師傅 Profile 評價內。</Text>

        {photoUri ? (
          <View style={styles.photoCard}>
            <Image source={{ uri: photoUri }} style={styles.photo} />
            <View style={styles.photoActions}>
              <Pressable style={styles.secondaryButton} onPress={pickPhoto} disabled={submitting}>
                <Text style={styles.secondaryText}>更換相片</Text>
              </Pressable>
              <Pressable style={styles.removeButton} onPress={() => setPhotoUri(null)} disabled={submitting}>
                <Text style={styles.removeText}>移除</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.photoPicker} onPress={pickPhoto} disabled={submitting}>
            <Text style={styles.photoPlus}>＋</Text>
            <Text style={styles.photoPickerText}>從相簿加入完成相片</Text>
          </Pressable>
        )}

        <Text style={styles.label}>評語（可選）</Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="例如：準時、手工好、解釋清楚。"
          multiline
          editable={!submitting}
          style={styles.textArea}
          maxLength={500}
        />

        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            提交後工作會標記為「已完成」，評分會計入師傅公開星級，亦不能再取消配對。
          </Text>
        </View>

        <Pressable
          style={[styles.submitButton, submitting && styles.disabled]}
          onPress={submitReview}
          disabled={submitting}
        >
          {submitting ? (
            <View style={styles.submittingRow}>
              <ActivityIndicator />
              <Text style={styles.submitText}>提交中...</Text>
            </View>
          ) : (
            <Text style={styles.submitText}>確認完成及提交評分</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7FAF8' },
  content: { padding: 20, paddingBottom: 80 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#617168' },
  back: { color: '#0B8D4A', fontSize: 16, fontWeight: '800', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '900', color: '#17251E', marginBottom: 18 },
  jobCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E1E9E4', marginBottom: 12 },
  workerName: { fontSize: 19, fontWeight: '900', color: '#21362B' },
  jobMeta: { marginTop: 7, color: '#667A70', lineHeight: 20 },
  price: { marginTop: 8, color: '#0B7A45', fontSize: 18, fontWeight: '900' },
  label: { marginTop: 18, marginBottom: 8, color: '#32443B', fontSize: 15, fontWeight: '900' },
  helper: { color: '#718178', fontSize: 12, lineHeight: 18, marginBottom: 10 },
  starRow: { flexDirection: 'row', gap: 10 },
  star: { fontSize: 40, color: '#D9DEDB' },
  starActive: { color: '#D89B00' },
  ratingChoice: { color: '#7B6500', fontWeight: '900', marginTop: 4 },
  photoPicker: { height: 110, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#9DB5A8', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  photoPlus: { fontSize: 30, color: '#0FA958' },
  photoPickerText: { marginTop: 5, color: '#597066', fontWeight: '700' },
  photoCard: { backgroundColor: '#FFFFFF', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: '#E1E9E4' },
  photo: { width: '100%', height: 230, borderRadius: 11 },
  photoActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  secondaryButton: { flex: 1, backgroundColor: '#EDF3EF', borderRadius: 11, paddingVertical: 12, alignItems: 'center' },
  secondaryText: { color: '#315243', fontWeight: '900' },
  removeButton: { paddingHorizontal: 22, backgroundColor: '#FFF0F0', borderRadius: 11, paddingVertical: 12, alignItems: 'center' },
  removeText: { color: '#B33A3A', fontWeight: '900' },
  textArea: { minHeight: 105, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE5DF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, textAlignVertical: 'top' },
  notice: { marginTop: 18, backgroundColor: '#FFF9E8', borderRadius: 12, padding: 13, borderWidth: 1, borderColor: '#EADCA7' },
  noticeText: { color: '#6E5E25', fontSize: 12, lineHeight: 18 },
  submitButton: { marginTop: 18, backgroundColor: '#0FA958', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  submitText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  submittingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  disabled: { opacity: 0.55 },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 22, borderWidth: 1, borderColor: '#E1E9E4' },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#22362C' },
  emptyText: { marginTop: 7, color: '#718178' },
});
